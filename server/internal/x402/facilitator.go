package x402

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// FacilitatorClient is an HTTP client for the x402 facilitator service.
type FacilitatorClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewFacilitatorClient creates a new facilitator client.
func NewFacilitatorClient(baseURL string) *FacilitatorClient {
	return &FacilitatorClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
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

// --- Client Methods ---

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

	resp, err := fc.httpClient.Post(fc.baseURL+"/verify", "application/json", bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("facilitator verify request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read verify response: %w", err)
	}

	var result VerifyResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal verify response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return &result, fmt.Errorf("facilitator verify returned %d: %s", resp.StatusCode, string(respBody))
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

	resp, err := fc.httpClient.Post(fc.baseURL+"/settle", "application/json", bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("facilitator settle request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read settle response: %w", err)
	}

	var result SettleResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal settle response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return &result, fmt.Errorf("facilitator settle returned %d: %s", resp.StatusCode, string(respBody))
	}

	return &result, nil
}
