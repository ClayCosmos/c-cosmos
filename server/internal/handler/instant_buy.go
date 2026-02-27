package handler

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/config"
	"github.com/niceclay/claycosmos/server/internal/db/gen"
	"github.com/niceclay/claycosmos/server/internal/x402"
	"github.com/niceclay/claycosmos/server/pkg/apierr"
)

type InstantBuyHandler struct {
	pool        *pgxpool.Pool
	q           *gen.Queries
	facilitator *x402.FacilitatorClient
	cfg         *config.Config
}

func NewInstantBuyHandler(pool *pgxpool.Pool, cfg *config.Config) *InstantBuyHandler {
	return &InstantBuyHandler{
		pool:        pool,
		q:           gen.New(pool),
		facilitator: x402.NewFacilitatorClient(cfg.FacilitatorURL, cfg.CDPAPIKeyID, cfg.CDPAPIKeySecret),
		cfg:         cfg,
	}
}

type InstantBuyResponse struct {
	ID              string `json:"id"`
	OrderNo         string `json:"order_no"`
	TxHash          string `json:"tx_hash,omitempty"`
	DeliveryContent string `json:"delivery_content"`
	Status          string `json:"status"`
}

// BuyProduct handles POST /products/:id/buy (public, no auth required).
// Implements x402 protocol v2:
//   - No PAYMENT-SIGNATURE header → 402 with PAYMENT-REQUIRED header (base64-encoded PaymentRequired)
//   - Valid PAYMENT-SIGNATURE header → verify, settle, return delivery content
//
// The buyer is identified by the payer wallet address from the facilitator verify response.
func (h *InstantBuyHandler) BuyProduct(c *gin.Context) {
	productIDStr := c.Param("id")
	productID := pgtype.UUID{}
	if err := productID.Scan(productIDStr); err != nil {
		respondError(c, apierr.BadRequest("invalid product id"))
		return
	}

	product, err := h.q.GetProductByID(c.Request.Context(), productID)
	if err != nil {
		respondError(c, apierr.NotFound("product not found"))
		return
	}

	if product.Status != "active" {
		respondError(c, apierr.BadRequest("product is not available"))
		return
	}

	if product.PaymentMode != "instant" {
		respondError(c, apierr.BadRequest("this product uses escrow payment mode, use POST /orders instead"))
		return
	}

	// Get seller info
	store, err := h.q.GetStoreByID(c.Request.Context(), product.StoreID)
	if err != nil {
		respondError(c, apierr.Internal("failed to get store"))
		return
	}

	// Get seller's verified wallet
	sellerWallet, err := h.q.GetWalletByAgentAndChain(c.Request.Context(), gen.GetWalletByAgentAndChainParams{
		AgentID: store.AgentID,
		Chain:   "base",
	})
	if err != nil || !sellerWallet.VerifiedAt.Valid {
		respondError(c, apierr.BadRequest("seller has no verified wallet"))
		return
	}

	// Build payment requirements (x402 v2 format)
	usdcAddr, ok := x402.USDCAddress[h.cfg.X402Network]
	if !ok {
		respondError(c, apierr.Internal("unsupported x402 network"))
		return
	}
	caip2Net, ok := x402.CAIP2Network[h.cfg.X402Network]
	if !ok {
		respondError(c, apierr.Internal("unsupported x402 network for CAIP-2"))
		return
	}

	resourceURL := fmt.Sprintf("/api/v1/products/%s/buy", productIDStr)
	requirements := x402.PaymentRequirements{
		Scheme:            "exact",
		Network:           caip2Net,
		Asset:             usdcAddr,
		Amount:            fmt.Sprintf("%d", product.PriceUsdc),
		PayTo:             sellerWallet.Address,
		MaxTimeoutSeconds: 60,
		Extra:             map[string]any{},
	}

	paymentRequired := x402.PaymentRequired{
		X402Version: 2,
		Resource: x402.ResourceInfo{
			URL:         resourceURL,
			Description: fmt.Sprintf("Purchase: %s", product.Name),
			MimeType:    "application/json",
		},
		Accepts: []x402.PaymentRequirements{requirements},
	}

	// Check for PAYMENT-SIGNATURE header (x402 v2)
	signatureHeader := c.GetHeader("PAYMENT-SIGNATURE")
	if signatureHeader == "" {
		// Return 402 Payment Required with base64-encoded PaymentRequired in header
		paymentRequiredJSON, _ := json.Marshal(paymentRequired)
		encoded := base64.StdEncoding.EncodeToString(paymentRequiredJSON)
		c.Header("PAYMENT-REQUIRED", encoded)
		c.JSON(http.StatusPaymentRequired, gin.H{})
		return
	}

	// --- Decode PAYMENT-SIGNATURE header ---
	decoded, err := base64.StdEncoding.DecodeString(signatureHeader)
	if err != nil {
		respondError(c, apierr.BadRequest("invalid PAYMENT-SIGNATURE header: not valid base64"))
		return
	}
	var paymentPayload x402.PaymentPayload
	if err := json.Unmarshal(decoded, &paymentPayload); err != nil {
		respondError(c, apierr.BadRequest("invalid PAYMENT-SIGNATURE header: "+err.Error()))
		return
	}

	// --- Idempotency: dedup by payment signature hash ---
	sigHash := sha256.Sum256(decoded)
	paymentSigHash := hex.EncodeToString(sigHash[:])
	existingOrder, err := h.q.GetOrderByPaymentSigHash(c.Request.Context(), pgtype.Text{String: paymentSigHash, Valid: true})
	if err == nil {
		// Already processed — return existing order
		c.JSON(http.StatusOK, InstantBuyResponse{
			ID:              pgtypeUUIDToString(existingOrder.ID),
			OrderNo:         existingOrder.OrderNo,
			TxHash:          existingOrder.TxHash.String,
			DeliveryContent: existingOrder.DeliveryContent.String,
			Status:          existingOrder.Status,
		})
		return
	}

	// Match the accepted requirements from the payload
	matched := matchRequirements(paymentRequired.Accepts, paymentPayload.Accepted)
	if !matched {
		// Re-send 402 with current requirements
		paymentRequired.Error = "No matching payment requirements found"
		paymentRequiredJSON, _ := json.Marshal(paymentRequired)
		encoded := base64.StdEncoding.EncodeToString(paymentRequiredJSON)
		c.Header("PAYMENT-REQUIRED", encoded)
		c.JSON(http.StatusPaymentRequired, gin.H{})
		return
	}

	// --- Payment flow begins ---
	// Reserve stock atomically BEFORE calling facilitator.
	_, err = h.q.DecrementProductStock(c.Request.Context(), product.ID)
	if err != nil {
		respondError(c, apierr.BadRequest("product out of stock"))
		return
	}
	stockReserved := true
	restoreStock := func() {
		if stockReserved {
			if err := h.q.RestoreProductStock(c.Request.Context(), product.ID); err != nil {
				log.Printf("[x402] CRITICAL: failed to restore stock for product %s: %v", productIDStr, err)
			}
		}
	}

	// Verify payment with facilitator
	verifyResp, err := h.facilitator.Verify(paymentPayload, requirements)
	if err != nil {
		log.Printf("[x402] facilitator verify failed for product %s: %v", productIDStr, err)
		restoreStock()
		respondError(c, apierr.Internal("payment verification failed"))
		return
	}
	if !verifyResp.IsValid {
		restoreStock()
		msg := verifyResp.InvalidReason
		if verifyResp.InvalidMessage != "" {
			msg = verifyResp.InvalidReason + ": " + verifyResp.InvalidMessage
		}
		respondError(c, apierr.BadRequest("invalid payment: "+msg))
		return
	}

	// Resolve buyer agent from payer wallet address (returned by facilitator)
	payerAddr := verifyResp.Payer
	if payerAddr == "" {
		restoreStock()
		respondError(c, apierr.BadRequest("facilitator did not return payer address"))
		return
	}

	buyerWallet, err := h.q.GetWalletByAddress(c.Request.Context(), gen.GetWalletByAddressParams{
		Chain: "base",
		Lower: payerAddr,
	})
	if err != nil || !buyerWallet.VerifiedAt.Valid {
		restoreStock()
		respondError(c, apierr.BadRequest("payer wallet not registered on ClayCosmos — register your agent and verify your wallet first"))
		return
	}

	if buyerWallet.AgentID == store.AgentID {
		restoreStock()
		respondError(c, apierr.BadRequest("cannot buy your own product"))
		return
	}

	// Settle payment with facilitator
	settleResp, err := h.facilitator.Settle(paymentPayload, requirements)
	if err != nil {
		log.Printf("[x402] facilitator settle failed for product %s: %v", productIDStr, err)
		restoreStock()
		respondError(c, apierr.Internal("payment settlement failed"))
		return
	}
	if !settleResp.Success {
		restoreStock()
		msg := settleResp.ErrorReason
		if settleResp.ErrorMessage != "" {
			msg = settleResp.ErrorReason + ": " + settleResp.ErrorMessage
		}
		respondError(c, apierr.Internal("payment settlement unsuccessful: "+msg))
		return
	}

	// Create completed order.
	orderNo := GenerateOrderNo()
	order, err := h.q.CreateInstantOrder(c.Request.Context(), gen.CreateInstantOrderParams{
		OrderNo:         orderNo,
		ProductID:       product.ID,
		BuyerAgentID:    buyerWallet.AgentID,
		SellerAgentID:   store.AgentID,
		BuyerWallet:     payerAddr,
		SellerWallet:    sellerWallet.Address,
		AmountUsdc:      product.PriceUsdc,
		EscrowOrderID:   "0x0000000000000000000000000000000000000000000000000000000000000000",
		EscrowContract:  "x402",
		TxHash:          pgtype.Text{String: settleResp.Transaction, Valid: settleResp.Transaction != ""},
		DeliveryContent: product.DeliveryContent,
		ShippingAddress: nil,
		PaymentSigHash:  pgtype.Text{String: paymentSigHash, Valid: true},
	})
	if err != nil {
		log.Printf("[x402] CRITICAL: payment settled (tx=%s) but order creation failed for product %s, buyer %s: %v",
			settleResp.Transaction, productIDStr, pgtypeUUIDToString(buyerWallet.AgentID), err)
		// Record failed settlement for background recovery — do NOT restore stock (money already transferred)
		stockReserved = false
		if _, fsErr := h.q.CreateFailedSettlement(c.Request.Context(), gen.CreateFailedSettlementParams{
			ProductID:       product.ID,
			BuyerAgentID:    buyerWallet.AgentID,
			SellerAgentID:   store.AgentID,
			BuyerWallet:     payerAddr,
			SellerWallet:    sellerWallet.Address,
			AmountUsdc:      product.PriceUsdc,
			TxHash:          settleResp.Transaction,
			PaymentSigHash:  paymentSigHash,
			DeliveryContent: product.DeliveryContent,
			ErrorMessage:    pgtype.Text{String: err.Error(), Valid: true},
		}); fsErr != nil {
			log.Printf("[x402] CRITICAL: failed to record failed settlement for product %s: %v", productIDStr, fsErr)
		}
		respondError(c, apierr.Internal("payment was processed but order recording failed — our system will resolve this automatically"))
		return
	}

	// Order created successfully — payment is settled and recorded, no need to restore stock.
	stockReserved = false

	// Recalculate agent stats for both buyer and seller
	for _, agentID := range []pgtype.UUID{buyerWallet.AgentID, store.AgentID} {
		if err := h.q.RecalculateAgentStats(c.Request.Context(), agentID); err != nil {
			log.Printf("[x402] failed to recalculate stats: %v", err)
		}
	}

	// Build PAYMENT-RESPONSE header (base64-encoded SettleResponse)
	settleJSON, _ := json.Marshal(settleResp)
	c.Header("PAYMENT-RESPONSE", base64.StdEncoding.EncodeToString(settleJSON))

	c.JSON(http.StatusOK, InstantBuyResponse{
		ID:              pgtypeUUIDToString(order.ID),
		OrderNo:         order.OrderNo,
		TxHash:          settleResp.Transaction,
		DeliveryContent: product.DeliveryContent.String,
		Status:          "completed",
	})
}

// matchRequirements checks if the client's accepted requirements match any of our offered options.
func matchRequirements(offered []x402.PaymentRequirements, accepted x402.PaymentRequirements) bool {
	for _, req := range offered {
		if req.Scheme == accepted.Scheme && req.Network == accepted.Network && req.Asset == accepted.Asset {
			return true
		}
	}
	return false
}
