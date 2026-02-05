package handler

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/db/gen"
	"github.com/niceclay/claycosmos/server/internal/middleware"
	"github.com/niceclay/claycosmos/server/pkg/apierr"
)

// Contract addresses
const (
	EscrowContractBaseSepolia = "0xcB2CEB939e955a28c9d4ADC0358C0B959F5ec9ce"
	EscrowContractBaseMainnet = "0x0000000000000000000000000000000000000000" // TODO: Deploy to mainnet
	DefaultDeadlineDays       = 7
)

type OrderHandler struct {
	pool           *pgxpool.Pool
	q              *gen.Queries
	escrowContract string
}

func NewOrderHandler(pool *pgxpool.Pool, escrowContract string) *OrderHandler {
	if escrowContract == "" {
		escrowContract = EscrowContractBaseSepolia
	}
	return &OrderHandler{pool: pool, q: gen.New(pool), escrowContract: escrowContract}
}

type ShippingAddress struct {
	RecipientName string `json:"recipient_name"`
	Phone         string `json:"phone"`
	AddressLine1  string `json:"address_line1"`
	AddressLine2  string `json:"address_line2,omitempty"`
	City          string `json:"city"`
	State         string `json:"state,omitempty"`
	Country       string `json:"country"`
	PostalCode    string `json:"postal_code"`
	Notes         string `json:"notes,omitempty"`
}

type CreateOrderRequest struct {
	ProductID       string           `json:"product_id" binding:"required"`
	BuyerWallet     string           `json:"buyer_wallet" binding:"required"`
	DeadlineDays    *int             `json:"deadline_days"`
	ShippingAddress *ShippingAddress `json:"shipping_address"`
}

type OrderResponse struct {
	ID              string           `json:"id"`
	OrderNo         string           `json:"order_no"`
	ProductID       string           `json:"product_id"`
	ProductName     string           `json:"product_name"`
	BuyerAgentID    string           `json:"buyer_agent_id"`
	SellerAgentID   string           `json:"seller_agent_id"`
	BuyerWallet     string           `json:"buyer_wallet"`
	SellerWallet    string           `json:"seller_wallet"`
	AmountUSDC      int64            `json:"amount_usdc"`
	AmountUSD       float64          `json:"amount_usd"`
	EscrowOrderID   string           `json:"escrow_order_id"`
	EscrowContract  string           `json:"escrow_contract"`
	Status          string           `json:"status"`
	TxHash          string           `json:"tx_hash,omitempty"`
	ShippingAddress *ShippingAddress `json:"shipping_address,omitempty"`
	DeliveryContent string           `json:"delivery_content,omitempty"`
	DeliveredAt     *string          `json:"delivered_at,omitempty"`
	CompletedAt     *string          `json:"completed_at,omitempty"`
	Deadline        time.Time        `json:"deadline"`
	CreatedAt       time.Time        `json:"created_at"`
}

// CreateOrder creates a new order
func (h *OrderHandler) CreateOrder(c *gin.Context) {
	agent := middleware.GetAgent(c.Request.Context())

	var req CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierr.BadRequest(err.Error()))
		return
	}

	// Get product
	productID := pgtype.UUID{}
	if err := productID.Scan(req.ProductID); err != nil {
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

	// Check stock
	if product.Stock.Int32 == 0 {
		respondError(c, apierr.BadRequest("product out of stock"))
		return
	}

	// Get seller's store and wallet
	store, err := h.q.GetStoreByID(c.Request.Context(), product.StoreID)
	if err != nil {
		respondError(c, apierr.Internal("failed to get store"))
		return
	}

	// Can't buy your own product
	if store.AgentID == agent.ID {
		respondError(c, apierr.BadRequest("cannot buy your own product"))
		return
	}

	// Get seller's wallet
	sellerWallet, err := h.q.GetWalletByAgentAndChain(c.Request.Context(), gen.GetWalletByAgentAndChainParams{
		AgentID: store.AgentID,
		Chain:   "base",
	})
	if err != nil || !sellerWallet.VerifiedAt.Valid {
		respondError(c, apierr.BadRequest("seller has no verified wallet"))
		return
	}

	// Generate order number
	orderNo := generateOrderNo()

	// Generate escrow order ID (bytes32)
	escrowOrderID := generateEscrowOrderID()

	// Validate shipping address for physical products
	var shippingAddrJSON []byte
	if product.RequiresShipping {
		if req.ShippingAddress == nil {
			respondError(c, apierr.BadRequest("shipping address is required for this product"))
			return
		}
		addr := req.ShippingAddress
		if addr.RecipientName == "" || addr.Phone == "" || addr.AddressLine1 == "" || addr.City == "" || addr.Country == "" || addr.PostalCode == "" {
			respondError(c, apierr.BadRequest("shipping address must include recipient_name, phone, address_line1, city, country, and postal_code"))
			return
		}
		data, marshalErr := json.Marshal(addr)
		if marshalErr != nil {
			respondError(c, apierr.Internal("failed to encode shipping address"))
			return
		}
		shippingAddrJSON = data
	}

	// Calculate deadline
	deadlineDays := DefaultDeadlineDays
	if req.DeadlineDays != nil && *req.DeadlineDays > 0 {
		deadlineDays = *req.DeadlineDays
	}
	deadline := time.Now().Add(time.Duration(deadlineDays) * 24 * time.Hour)

	// Create order
	order, err := h.q.CreateOrder(c.Request.Context(), gen.CreateOrderParams{
		OrderNo:         orderNo,
		ProductID:       product.ID,
		BuyerAgentID:    agent.ID,
		SellerAgentID:   store.AgentID,
		BuyerWallet:     req.BuyerWallet,
		SellerWallet:    sellerWallet.Address,
		AmountUsdc:      product.PriceUsdc,
		EscrowOrderID:   escrowOrderID,
		EscrowContract:  h.escrowContract,
		Status:          "pending",
		Deadline:        pgtype.Timestamptz{Time: deadline, Valid: true},
		ShippingAddress: shippingAddrJSON,
	})
	if err != nil {
		respondError(c, apierr.Internal("failed to create order: "+err.Error()))
		return
	}

	c.JSON(http.StatusCreated, toOrderResponse(order, product.Name))
}

// GetOrder returns an order by ID
func (h *OrderHandler) GetOrder(c *gin.Context) {
	agent := middleware.GetAgent(c.Request.Context())
	orderIDStr := c.Param("id")

	orderID := pgtype.UUID{}
	if err := orderID.Scan(orderIDStr); err != nil {
		respondError(c, apierr.BadRequest("invalid order id"))
		return
	}

	order, err := h.q.GetOrderByID(c.Request.Context(), orderID)
	if err != nil {
		respondError(c, apierr.NotFound("order not found"))
		return
	}

	// Check authorization
	if order.BuyerAgentID != agent.ID && order.SellerAgentID != agent.ID {
		respondError(c, apierr.Forbidden("not your order"))
		return
	}

	// Get product name
	product, _ := h.q.GetProductByID(c.Request.Context(), order.ProductID)

	resp := toOrderResponse(order, product.Name)

	// Only show delivery content to buyer after payment
	if order.BuyerAgentID == agent.ID && (order.Status == "paid" || order.Status == "completed") {
		resp.DeliveryContent = order.DeliveryContent.String
	}

	c.JSON(http.StatusOK, resp)
}

// ListMyOrders returns orders for the current agent
func (h *OrderHandler) ListMyOrders(c *gin.Context) {
	agent := middleware.GetAgent(c.Request.Context())
	role := c.Query("role") // "buyer" or "seller"

	var orders []gen.ListOrdersByBuyerRow
	var err error

	if role == "seller" {
		sellerOrders, e := h.q.ListOrdersBySeller(c.Request.Context(), gen.ListOrdersBySellerParams{
			SellerAgentID: agent.ID,
			Limit:         50,
			Offset:        0,
		})
		err = e
		// Convert to buyer row type for consistency
		for _, o := range sellerOrders {
			orders = append(orders, gen.ListOrdersByBuyerRow(o))
		}
	} else {
		orders, err = h.q.ListOrdersByBuyer(c.Request.Context(), gen.ListOrdersByBuyerParams{
			BuyerAgentID: agent.ID,
			Limit:        50,
			Offset:       0,
		})
	}

	if err != nil {
		respondError(c, apierr.Internal("failed to list orders"))
		return
	}

	resp := make([]OrderResponse, len(orders))
	for i, o := range orders {
		resp[i] = toOrderResponseFromRow(o)
	}

	c.JSON(http.StatusOK, gin.H{"orders": resp})
}

// MarkOrderPaid marks an order as paid (called by buyer or seller after on-chain payment)
func (h *OrderHandler) MarkOrderPaid(c *gin.Context) {
	agent := middleware.GetAgent(c.Request.Context())
	orderIDStr := c.Param("id")
	orderID := pgtype.UUID{}
	if err := orderID.Scan(orderIDStr); err != nil {
		respondError(c, apierr.BadRequest("invalid order id"))
		return
	}

	var req struct {
		TxHash string `json:"tx_hash" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierr.BadRequest(err.Error()))
		return
	}

	order, err := h.q.GetOrderByID(c.Request.Context(), orderID)
	if err != nil {
		respondError(c, apierr.NotFound("order not found"))
		return
	}

	// Authorization: only buyer or seller can mark as paid
	if order.BuyerAgentID != agent.ID && order.SellerAgentID != agent.ID {
		respondError(c, apierr.Forbidden("not your order"))
		return
	}

	if order.Status != "pending" {
		respondError(c, apierr.BadRequest("order is not pending"))
		return
	}

	// Update order status
	updated, err := h.q.UpdateOrderPaid(c.Request.Context(), gen.UpdateOrderPaidParams{
		ID:     orderID,
		TxHash: pgtype.Text{String: req.TxHash, Valid: true},
	})
	if err != nil {
		respondError(c, apierr.Internal("failed to update order"))
		return
	}

	// Deliver content
	product, err := h.q.GetProductByID(c.Request.Context(), order.ProductID)
	if err != nil {
		respondError(c, apierr.Internal("failed to get product"))
		return
	}
	if product.DeliveryContent.Valid {
		if _, err := h.q.UpdateOrderDelivered(c.Request.Context(), gen.UpdateOrderDeliveredParams{
			ID:              orderID,
			DeliveryContent: product.DeliveryContent,
		}); err != nil {
			respondError(c, apierr.Internal("failed to deliver content"))
			return
		}
	}

	// Decrement stock - ignore error as it's not critical
	_, _ = h.q.DecrementProductStock(c.Request.Context(), order.ProductID)

	c.JSON(http.StatusOK, toOrderResponse(updated, product.Name))
}

// CompleteOrder marks an order as completed (buyer confirms)
func (h *OrderHandler) CompleteOrder(c *gin.Context) {
	agent := middleware.GetAgent(c.Request.Context())
	orderIDStr := c.Param("id")

	orderID := pgtype.UUID{}
	if err := orderID.Scan(orderIDStr); err != nil {
		respondError(c, apierr.BadRequest("invalid order id"))
		return
	}

	order, err := h.q.GetOrderByID(c.Request.Context(), orderID)
	if err != nil {
		respondError(c, apierr.NotFound("order not found"))
		return
	}

	// Only buyer can complete
	if order.BuyerAgentID != agent.ID {
		respondError(c, apierr.Forbidden("only buyer can complete order"))
		return
	}

	if order.Status != "paid" {
		respondError(c, apierr.BadRequest("order is not paid"))
		return
	}

	var req struct {
		TxHash string `json:"tx_hash"`
	}
	_ = c.ShouldBindJSON(&req)

	updated, err := h.q.UpdateOrderCompleted(c.Request.Context(), gen.UpdateOrderCompletedParams{
		ID:             orderID,
		CompleteTxHash: pgtype.Text{String: req.TxHash, Valid: req.TxHash != ""},
	})
	if err != nil {
		respondError(c, apierr.Internal("failed to complete order"))
		return
	}

	product, _ := h.q.GetProductByID(c.Request.Context(), order.ProductID)
	c.JSON(http.StatusOK, toOrderResponse(updated, product.Name))
}

// CancelOrder cancels an order (buyer only, before payment)
func (h *OrderHandler) CancelOrder(c *gin.Context) {
	agent := middleware.GetAgent(c.Request.Context())
	orderIDStr := c.Param("id")

	orderID := pgtype.UUID{}
	if err := orderID.Scan(orderIDStr); err != nil {
		respondError(c, apierr.BadRequest("invalid order id"))
		return
	}

	order, err := h.q.GetOrderByID(c.Request.Context(), orderID)
	if err != nil {
		respondError(c, apierr.NotFound("order not found"))
		return
	}

	if order.BuyerAgentID != agent.ID {
		respondError(c, apierr.Forbidden("only buyer can cancel order"))
		return
	}

	if order.Status != "pending" {
		respondError(c, apierr.BadRequest("can only cancel pending orders"))
		return
	}

	updated, err := h.q.UpdateOrderCancelled(c.Request.Context(), orderID)
	if err != nil {
		respondError(c, apierr.Internal("failed to cancel order"))
		return
	}

	product, _ := h.q.GetProductByID(c.Request.Context(), order.ProductID)
	c.JSON(http.StatusOK, toOrderResponse(updated, product.Name))
}

// Helper functions

func generateOrderNo() string {
	now := time.Now()
	randBytes := make([]byte, 4)
	_, _ = rand.Read(randBytes)
	return fmt.Sprintf("CC-%s-%s", now.Format("20060102"), hex.EncodeToString(randBytes))
}

func generateEscrowOrderID() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return "0x" + hex.EncodeToString(b)
}

func parseShippingAddress(data []byte) *ShippingAddress {
	if len(data) == 0 {
		return nil
	}
	var addr ShippingAddress
	if err := json.Unmarshal(data, &addr); err != nil {
		return nil
	}
	return &addr
}

func toOrderResponse(o gen.Order, productName string) OrderResponse {
	resp := OrderResponse{
		ID:              pgtypeUUIDToString(o.ID),
		OrderNo:         o.OrderNo,
		ProductID:       pgtypeUUIDToString(o.ProductID),
		ProductName:     productName,
		BuyerAgentID:    pgtypeUUIDToString(o.BuyerAgentID),
		SellerAgentID:   pgtypeUUIDToString(o.SellerAgentID),
		BuyerWallet:     o.BuyerWallet,
		SellerWallet:    o.SellerWallet,
		AmountUSDC:      o.AmountUsdc,
		AmountUSD:       float64(o.AmountUsdc) / 1_000_000,
		EscrowOrderID:   o.EscrowOrderID,
		EscrowContract:  o.EscrowContract,
		Status:          o.Status,
		ShippingAddress: parseShippingAddress(o.ShippingAddress),
		Deadline:        o.Deadline.Time,
		CreatedAt:       o.CreatedAt.Time,
	}

	if o.TxHash.Valid {
		resp.TxHash = o.TxHash.String
	}
	if o.DeliveredAt.Valid {
		t := o.DeliveredAt.Time.Format(time.RFC3339)
		resp.DeliveredAt = &t
	}
	if o.CompletedAt.Valid {
		t := o.CompletedAt.Time.Format(time.RFC3339)
		resp.CompletedAt = &t
	}

	return resp
}

func toOrderResponseFromRow(o gen.ListOrdersByBuyerRow) OrderResponse {
	resp := OrderResponse{
		ID:              pgtypeUUIDToString(o.ID),
		OrderNo:         o.OrderNo,
		ProductID:       pgtypeUUIDToString(o.ProductID),
		ProductName:     o.ProductName,
		BuyerAgentID:    pgtypeUUIDToString(o.BuyerAgentID),
		SellerAgentID:   pgtypeUUIDToString(o.SellerAgentID),
		BuyerWallet:     o.BuyerWallet,
		SellerWallet:    o.SellerWallet,
		AmountUSDC:      o.AmountUsdc,
		AmountUSD:       float64(o.AmountUsdc) / 1_000_000,
		EscrowOrderID:   o.EscrowOrderID,
		EscrowContract:  o.EscrowContract,
		Status:          o.Status,
		ShippingAddress: parseShippingAddress(o.ShippingAddress),
		Deadline:        o.Deadline.Time,
		CreatedAt:       o.CreatedAt.Time,
	}

	if o.TxHash.Valid {
		resp.TxHash = o.TxHash.String
	}
	if o.DeliveredAt.Valid {
		t := o.DeliveredAt.Time.Format(time.RFC3339)
		resp.DeliveredAt = &t
	}
	if o.CompletedAt.Valid {
		t := o.CompletedAt.Time.Format(time.RFC3339)
		resp.CompletedAt = &t
	}

	return resp
}
