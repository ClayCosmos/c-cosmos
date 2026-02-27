package x402

import (
	"bytes"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// FacilitatorClient is an HTTP client for the x402 facilitator service.
type FacilitatorClient struct {
	baseURL    string
	httpClient *http.Client
	auth       *CDPAuth // nil if no auth needed (e.g. community facilitator)
}

// CDPAuth holds Coinbase Developer Platform API credentials for JWT authentication.
type CDPAuth struct {
	KeyID     string // CDP_API_KEY_ID
	KeySecret string // CDP_API_KEY_SECRET (base64-encoded Ed25519 private key)
}

// NewFacilitatorClient creates a new facilitator client.
// If cdpKeyID and cdpKeySecret are non-empty, requests are authenticated with CDP JWT.
func NewFacilitatorClient(baseURL, cdpKeyID, cdpKeySecret string) *FacilitatorClient {
	fc := &FacilitatorClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
	if cdpKeyID != "" && cdpKeySecret != "" {
		fc.auth = &CDPAuth{KeyID: cdpKeyID, KeySecret: cdpKeySecret}
	}
	return fc
}

// --- x402 Protocol Types (v2) ---

// ResourceInfo describes the resource being paid for.
type ResourceInfo struct {
	URL         string `json:"url"`
	Description string `json:"description"`
	MimeType    string `json:"mimeType"`
}

// PaymentRequirements describes one accepted payment option.
type PaymentRequirements struct {
	Scheme            string         `json:"scheme"`
	Network           string         `json:"network"`
	Asset             string         `json:"asset"`
	Amount            string         `json:"amount"`
	PayTo             string         `json:"payTo"`
	MaxTimeoutSeconds int            `json:"maxTimeoutSeconds"`
	Extra             map[string]any `json:"extra"`
}

// PaymentRequired is the 402 response object (base64-encoded in PAYMENT-REQUIRED header).
type PaymentRequired struct {
	X402Version int                   `json:"x402Version"`
	Error       string                `json:"error,omitempty"`
	Resource    ResourceInfo          `json:"resource"`
	Accepts     []PaymentRequirements `json:"accepts"`
}

// PaymentPayload is decoded from the client's PAYMENT-SIGNATURE header.
type PaymentPayload struct {
	X402Version int                    `json:"x402Version"`
	Resource    ResourceInfo           `json:"resource"`
	Accepted    PaymentRequirements    `json:"accepted"`
	Payload     map[string]any         `json:"payload"`
	Extensions  map[string]any         `json:"extensions,omitempty"`
}

// --- Facilitator Request/Response Types ---

// FacilitatorRequest is the request body for /verify and /settle endpoints.
type FacilitatorRequest struct {
	X402Version         int                 `json:"x402Version"`
	PaymentPayload      PaymentPayload      `json:"paymentPayload"`
	PaymentRequirements PaymentRequirements `json:"paymentRequirements"`
}

// VerifyResponse is returned by the facilitator /verify endpoint.
type VerifyResponse struct {
	IsValid        bool   `json:"isValid"`
	InvalidReason  string `json:"invalidReason,omitempty"`
	InvalidMessage string `json:"invalidMessage,omitempty"`
	Payer          string `json:"payer,omitempty"`
}

// SettleResponse is returned by the facilitator /settle endpoint.
type SettleResponse struct {
	Success      bool   `json:"success"`
	ErrorReason  string `json:"errorReason,omitempty"`
	ErrorMessage string `json:"errorMessage,omitempty"`
	Payer        string `json:"payer,omitempty"`
	Transaction  string `json:"transaction,omitempty"`
	Network      string `json:"network,omitempty"`
}

// --- JWT Authentication for CDP ---

// generateJWT creates a signed JWT for CDP API authentication.
func (a *CDPAuth) generateJWT(method, fullURL string) (string, error) {
	keyBytes, err := base64.StdEncoding.DecodeString(a.KeySecret)
	if err != nil {
		return "", fmt.Errorf("decode CDP key secret: %w", err)
	}
	if len(keyBytes) != ed25519.PrivateKeySize {
		return "", fmt.Errorf("invalid CDP key secret length: got %d, want %d", len(keyBytes), ed25519.PrivateKeySize)
	}
	privateKey := ed25519.PrivateKey(keyBytes)

	u, err := url.Parse(fullURL)
	if err != nil {
		return "", fmt.Errorf("parse url: %w", err)
	}
	uri := fmt.Sprintf("%s %s%s", method, u.Host, u.Path)

	nonceBytes := make([]byte, 16)
	if _, err := rand.Read(nonceBytes); err != nil {
		return "", fmt.Errorf("generate nonce: %w", err)
	}
	nonce := fmt.Sprintf("%x", nonceBytes)

	now := time.Now().Unix()

	header := map[string]string{
		"alg": "EdDSA",
		"typ": "JWT",
		"kid": a.KeyID,
	}

	payload := map[string]any{
		"sub":   a.KeyID,
		"iss":   "cdp",
		"nbf":   now,
		"exp":   now + 120,
		"uri":   uri,
		"nonce": nonce,
	}

	headerJSON, _ := json.Marshal(header)
	payloadJSON, _ := json.Marshal(payload)

	headerB64 := base64.RawURLEncoding.EncodeToString(headerJSON)
	payloadB64 := base64.RawURLEncoding.EncodeToString(payloadJSON)

	signingInput := headerB64 + "." + payloadB64
	signature := ed25519.Sign(privateKey, []byte(signingInput))
	sigB64 := base64.RawURLEncoding.EncodeToString(signature)

	return signingInput + "." + sigB64, nil
}

// --- Client Methods ---

// doPost sends an authenticated POST request to the facilitator.
func (fc *FacilitatorClient) doPost(endpoint string, body []byte) ([]byte, int, error) {
	fullURL := fc.baseURL + endpoint

	req, err := http.NewRequest(http.MethodPost, fullURL, bytes.NewReader(body))
	if err != nil {
		return nil, 0, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	if fc.auth != nil {
		jwt, err := fc.auth.generateJWT("POST", fullURL)
		if err != nil {
			return nil, 0, fmt.Errorf("generate CDP JWT: %w", err)
		}
		req.Header.Set("Authorization", "Bearer "+jwt)
	}

	resp, err := fc.httpClient.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("read response: %w", err)
	}

	return respBody, resp.StatusCode, nil
}

// Verify calls the facilitator to verify a payment payload against requirements.
func (fc *FacilitatorClient) Verify(payload PaymentPayload, requirements PaymentRequirements) (*VerifyResponse, error) {
	body := FacilitatorRequest{
		X402Version:         payload.X402Version,
		PaymentPayload:      payload,
		PaymentRequirements: requirements,
	}
	data, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal verify request: %w", err)
	}

	respBody, statusCode, err := fc.doPost("/verify", data)
	if err != nil {
		return nil, fmt.Errorf("facilitator verify request: %w", err)
	}

	// Try to parse as VerifyResponse even on non-200 (CDP returns 400 with valid VerifyResponse)
	var result VerifyResponse
	if err := json.Unmarshal(respBody, &result); err == nil && (result.InvalidReason != "" || result.IsValid) {
		return &result, nil
	}

	if statusCode != http.StatusOK {
		return nil, fmt.Errorf("facilitator verify returned %d: %s", statusCode, string(respBody))
	}

	return &result, nil
}

// Settle calls the facilitator to settle (execute) a payment.
func (fc *FacilitatorClient) Settle(payload PaymentPayload, requirements PaymentRequirements) (*SettleResponse, error) {
	body := FacilitatorRequest{
		X402Version:         payload.X402Version,
		PaymentPayload:      payload,
		PaymentRequirements: requirements,
	}
	data, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal settle request: %w", err)
	}

	respBody, statusCode, err := fc.doPost("/settle", data)
	if err != nil {
		return nil, fmt.Errorf("facilitator settle request: %w", err)
	}

	if statusCode != http.StatusOK {
		return nil, fmt.Errorf("facilitator settle returned %d: %s", statusCode, string(respBody))
	}

	var result SettleResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal settle response: %w", err)
	}

	return &result, nil
}
