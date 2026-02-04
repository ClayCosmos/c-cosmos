package handler

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/db/gen"
	"github.com/niceclay/claycosmos/server/internal/middleware"
	"github.com/niceclay/claycosmos/server/pkg/apierr"
)

type WalletHandler struct {
	pool *pgxpool.Pool
	q    *gen.Queries
}

func NewWalletHandler(pool *pgxpool.Pool) *WalletHandler {
	return &WalletHandler{pool: pool, q: gen.New(pool)}
}

// BindWalletRequest initiates wallet binding
type BindWalletRequest struct {
	Chain   string `json:"chain" binding:"omitempty,oneof=base ethereum arbitrum"`
	Address string `json:"address" binding:"required"`
}

// BindWalletResponse contains the message to sign
type BindWalletResponse struct {
	Message   string `json:"message"`
	Nonce     string `json:"nonce"`
	ExpiresAt int64  `json:"expires_at"`
}

// VerifyWalletRequest verifies the signature
type VerifyWalletRequest struct {
	Chain     string `json:"chain" binding:"omitempty,oneof=base ethereum arbitrum"`
	Address   string `json:"address" binding:"required"`
	Signature string `json:"signature" binding:"required"`
	Nonce     string `json:"nonce" binding:"required"`
}

// BindProgrammaticRequest for AI Agent self-binding
type BindProgrammaticRequest struct {
	Chain   string `json:"chain" binding:"omitempty,oneof=base ethereum arbitrum"`
	Address string `json:"address" binding:"required"`
	Proof   struct {
		Type      string `json:"type" binding:"required,oneof=signature"`
		Signature string `json:"signature" binding:"required"`
		Message   string `json:"message" binding:"required"`
	} `json:"proof" binding:"required"`
}

// WalletResponse is the wallet data returned to client
type WalletResponse struct {
	ID         string     `json:"id"`
	Chain      string     `json:"chain"`
	Address    string     `json:"address"`
	IsPrimary  bool       `json:"is_primary"`
	VerifiedAt *time.Time `json:"verified_at"`
	CreatedAt  time.Time  `json:"created_at"`
}

// In-memory nonce store with mutex (in production, use Redis)
var (
	nonceStore = make(map[string]nonceData)
	nonceMu    sync.RWMutex
)

type nonceData struct {
	AgentID   pgtype.UUID
	Address   string
	Chain     string
	ExpiresAt time.Time
}

// BindWallet initiates the wallet binding process
func (h *WalletHandler) BindWallet(c *gin.Context) {
	agent := middleware.GetAgent(c.Request.Context())

	var req BindWalletRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierr.BadRequest(err.Error()))
		return
	}

	chain := req.Chain
	if chain == "" {
		chain = "base"
	}

	// Normalize address
	if !common.IsHexAddress(req.Address) {
		respondError(c, apierr.BadRequest("invalid ethereum address"))
		return
	}
	address := common.HexToAddress(req.Address).Hex()

	// Check if wallet already bound
	existing, err := h.q.GetWalletByAgentAndChain(c.Request.Context(), gen.GetWalletByAgentAndChainParams{
		AgentID: agent.ID,
		Chain:   chain,
	})
	if err == nil && existing.VerifiedAt.Valid {
		respondError(c, apierr.BadRequest("wallet already bound for this chain"))
		return
	}

	// Generate nonce
	nonceBytes := make([]byte, 16)
	if _, err := rand.Read(nonceBytes); err != nil {
		respondError(c, apierr.Internal("failed to generate nonce"))
		return
	}
	nonce := hex.EncodeToString(nonceBytes)
	expiresAt := time.Now().Add(5 * time.Minute)

	// Store nonce
	nonceMu.Lock()
	nonceStore[nonce] = nonceData{
		AgentID:   agent.ID,
		Address:   address,
		Chain:     chain,
		ExpiresAt: expiresAt,
	}
	nonceMu.Unlock()

	// Generate message to sign
	agentIDStr := uuidToString(agent.ID)
	message := generateSignMessage(agentIDStr, address, nonce, expiresAt.Unix())

	c.JSON(http.StatusOK, BindWalletResponse{
		Message:   message,
		Nonce:     nonce,
		ExpiresAt: expiresAt.Unix(),
	})
}

// VerifyWallet verifies the signature and completes binding
func (h *WalletHandler) VerifyWallet(c *gin.Context) {
	agent := middleware.GetAgent(c.Request.Context())

	var req VerifyWalletRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierr.BadRequest(err.Error()))
		return
	}

	chain := req.Chain
	if chain == "" {
		chain = "base"
	}

	// Normalize address
	if !common.IsHexAddress(req.Address) {
		respondError(c, apierr.BadRequest("invalid ethereum address"))
		return
	}
	address := common.HexToAddress(req.Address).Hex()

	// Verify nonce (with mutex)
	nonceMu.RLock()
	data, ok := nonceStore[req.Nonce]
	nonceMu.RUnlock()
	if !ok {
		respondError(c, apierr.BadRequest("invalid or expired nonce"))
		return
	}

	if time.Now().After(data.ExpiresAt) {
		nonceMu.Lock()
		delete(nonceStore, req.Nonce)
		nonceMu.Unlock()
		respondError(c, apierr.BadRequest("nonce expired"))
		return
	}

	if data.AgentID != agent.ID || data.Address != address || data.Chain != chain {
		respondError(c, apierr.BadRequest("nonce mismatch"))
		return
	}

	// Verify signature
	agentIDStr := uuidToString(agent.ID)
	message := generateSignMessage(agentIDStr, address, req.Nonce, data.ExpiresAt.Unix())
	recoveredAddr, err := recoverAddress(message, req.Signature)
	if err != nil {
		respondError(c, apierr.BadRequest("invalid signature: "+err.Error()))
		return
	}

	if !strings.EqualFold(recoveredAddr.Hex(), address) {
		respondError(c, apierr.BadRequest("signature does not match address"))
		return
	}

	// Delete nonce only after successful verification
	nonceMu.Lock()
	delete(nonceStore, req.Nonce)
	nonceMu.Unlock()

	// Create or update wallet
	now := pgtype.Timestamptz{Time: time.Now(), Valid: true}

	// Try to get existing wallet first
	existing, err := h.q.GetWalletByAgentAndChain(c.Request.Context(), gen.GetWalletByAgentAndChainParams{
		AgentID: agent.ID,
		Chain:   chain,
	})

	var wallet gen.Wallet
	if err == nil {
		// Update existing wallet
		wallet, err = h.q.UpdateWalletVerified(c.Request.Context(), gen.UpdateWalletVerifiedParams{
			ID:         existing.ID,
			VerifiedAt: now,
		})
		if err != nil {
			respondError(c, apierr.Internal("failed to verify wallet"))
			return
		}
	} else {
		// Create new wallet
		wallet, err = h.q.CreateWallet(c.Request.Context(), gen.CreateWalletParams{
			AgentID:    agent.ID,
			Chain:      chain,
			Address:    address,
			IsPrimary:  pgtype.Bool{Bool: true, Valid: true},
			VerifiedAt: now,
		})
		if err != nil {
			respondError(c, apierr.Internal("failed to create wallet: "+err.Error()))
			return
		}
	}

	c.JSON(http.StatusOK, toWalletResponse(wallet))
}

// BindProgrammatic allows AI Agents to bind wallets in a single step
// The agent signs a message with their private key to prove ownership
func (h *WalletHandler) BindProgrammatic(c *gin.Context) {
	agent := middleware.GetAgent(c.Request.Context())

	var req BindProgrammaticRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierr.BadRequest(err.Error()))
		return
	}

	chain := req.Chain
	if chain == "" {
		chain = "base"
	}

	// Normalize address
	if !common.IsHexAddress(req.Address) {
		respondError(c, apierr.BadRequest("invalid ethereum address"))
		return
	}
	address := common.HexToAddress(req.Address).Hex()

	// Check if wallet already bound
	existing, err := h.q.GetWalletByAgentAndChain(c.Request.Context(), gen.GetWalletByAgentAndChainParams{
		AgentID: agent.ID,
		Chain:   chain,
	})
	if err == nil && existing.VerifiedAt.Valid {
		respondError(c, apierr.BadRequest("wallet already bound for this chain"))
		return
	}

	// Validate message format: claycosmos:bind:{agent_id}:{timestamp}
	agentIDStr := uuidToString(agent.ID)
	expectedPrefix := fmt.Sprintf("claycosmos:bind:%s:", agentIDStr)
	if !strings.HasPrefix(req.Proof.Message, expectedPrefix) {
		respondError(c, apierr.BadRequest("invalid message format"))
		return
	}

	// Extract and validate timestamp (allow 5 minute window)
	timestampStr := strings.TrimPrefix(req.Proof.Message, expectedPrefix)
	var timestamp int64
	if _, err := fmt.Sscanf(timestampStr, "%d", &timestamp); err != nil {
		respondError(c, apierr.BadRequest("invalid timestamp in message"))
		return
	}

	now := time.Now().Unix()
	if timestamp < now-300 || timestamp > now+60 {
		respondError(c, apierr.BadRequest("message expired or timestamp invalid"))
		return
	}

	// Verify signature
	recoveredAddr, err := recoverAddress(req.Proof.Message, req.Proof.Signature)
	if err != nil {
		respondError(c, apierr.BadRequest("invalid signature: "+err.Error()))
		return
	}

	if !strings.EqualFold(recoveredAddr.Hex(), address) {
		respondError(c, apierr.BadRequest("signature does not match address"))
		return
	}

	// Create or update wallet
	nowPg := pgtype.Timestamptz{Time: time.Now(), Valid: true}

	var wallet gen.Wallet
	if err == nil {
		// Update existing wallet
		wallet, err = h.q.UpdateWalletVerified(c.Request.Context(), gen.UpdateWalletVerifiedParams{
			ID:         existing.ID,
			VerifiedAt: nowPg,
		})
		if err != nil {
			respondError(c, apierr.Internal("failed to verify wallet"))
			return
		}
	} else {
		// Create new wallet
		wallet, err = h.q.CreateWallet(c.Request.Context(), gen.CreateWalletParams{
			AgentID:    agent.ID,
			Chain:      chain,
			Address:    address,
			IsPrimary:  pgtype.Bool{Bool: true, Valid: true},
			VerifiedAt: nowPg,
		})
		if err != nil {
			respondError(c, apierr.Internal("failed to create wallet: "+err.Error()))
			return
		}
	}

	c.JSON(http.StatusOK, toWalletResponse(wallet))
}

// ListWallets returns all wallets for the agent
func (h *WalletHandler) ListWallets(c *gin.Context) {
	agent := middleware.GetAgent(c.Request.Context())

	wallets, err := h.q.ListWalletsByAgent(c.Request.Context(), agent.ID)
	if err != nil {
		respondError(c, apierr.Internal("failed to list wallets"))
		return
	}

	resp := make([]WalletResponse, len(wallets))
	for i, w := range wallets {
		resp[i] = toWalletResponse(w)
	}

	c.JSON(http.StatusOK, gin.H{"wallets": resp})
}

// DeleteWallet removes a wallet binding
func (h *WalletHandler) DeleteWallet(c *gin.Context) {
	agent := middleware.GetAgent(c.Request.Context())
	walletIDStr := c.Param("id")

	walletID := pgtype.UUID{}
	if err := walletID.Scan(walletIDStr); err != nil {
		respondError(c, apierr.BadRequest("invalid wallet id"))
		return
	}

	wallet, err := h.q.GetWalletByID(c.Request.Context(), walletID)
	if err != nil {
		respondError(c, apierr.NotFound("wallet not found"))
		return
	}

	if wallet.AgentID != agent.ID {
		respondError(c, apierr.Forbidden("not your wallet"))
		return
	}

	if err := h.q.DeleteWallet(c.Request.Context(), walletID); err != nil {
		respondError(c, apierr.Internal("failed to delete wallet"))
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "wallet deleted"})
}

// Helper functions

func generateSignMessage(agentID, address, nonce string, expiresAt int64) string {
	return fmt.Sprintf(`ClayCosmos Wallet Verification

Agent: %s
Address: %s
Nonce: %s
Expires: %d

Sign this message to verify wallet ownership.`, agentID, address, nonce, expiresAt)
}

func recoverAddress(message, signature string) (common.Address, error) {
	// Remove 0x prefix if present
	sig := strings.TrimPrefix(signature, "0x")

	sigBytes, err := hex.DecodeString(sig)
	if err != nil {
		return common.Address{}, err
	}

	if len(sigBytes) != 65 {
		return common.Address{}, fmt.Errorf("invalid signature length: got %d, want 65", len(sigBytes))
	}

	// Adjust v value for Ethereum signed message
	if sigBytes[64] >= 27 {
		sigBytes[64] -= 27
	}

	// Hash the message with Ethereum prefix
	prefixedMessage := fmt.Sprintf("\x19Ethereum Signed Message:\n%d%s", len(message), message)
	hash := crypto.Keccak256Hash([]byte(prefixedMessage))

	// Recover public key
	pubKey, err := crypto.SigToPub(hash.Bytes(), sigBytes)
	if err != nil {
		return common.Address{}, err
	}

	return crypto.PubkeyToAddress(*pubKey), nil
}

func uuidToString(u pgtype.UUID) string {
	if !u.Valid {
		return ""
	}
	return fmt.Sprintf("%x-%x-%x-%x-%x", u.Bytes[0:4], u.Bytes[4:6], u.Bytes[6:8], u.Bytes[8:10], u.Bytes[10:16])
}

func toWalletResponse(w gen.Wallet) WalletResponse {
	resp := WalletResponse{
		ID:        uuidToString(w.ID),
		Chain:     w.Chain,
		Address:   w.Address,
		IsPrimary: w.IsPrimary.Bool,
		CreatedAt: w.CreatedAt.Time,
	}
	if w.VerifiedAt.Valid {
		t := w.VerifiedAt.Time
		resp.VerifiedAt = &t
	}
	return resp
}
