package handler

import (
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/db/gen"
	"github.com/niceclay/claycosmos/server/internal/middleware"
	"github.com/niceclay/claycosmos/server/pkg/apierr"
)

type ProductHandler struct {
	pool *pgxpool.Pool
	q    *gen.Queries
}

func NewProductHandler(pool *pgxpool.Pool) *ProductHandler {
	return &ProductHandler{pool: pool, q: gen.New(pool)}
}

type CreateProductRequest struct {
	Name             string   `json:"name" binding:"required,max=256"`
	Description      string   `json:"description"`
	PriceUSDC        int64    `json:"price_usdc" binding:"required,min=1"`
	DeliveryContent  string   `json:"delivery_content" binding:"required"`
	StoreID          *string  `json:"store_id"`
	Stock            *int32   `json:"stock"`
	ImageURLs        []string `json:"image_urls"`
	ExternalURL      string   `json:"external_url"`
	RequiresShipping *bool    `json:"requires_shipping"`
	PaymentMode      *string  `json:"payment_mode"`
}

type UpdateProductRequest struct {
	Name             *string   `json:"name"`
	Description      *string   `json:"description"`
	PriceUSDC        *int64    `json:"price_usdc"`
	DeliveryContent  *string   `json:"delivery_content"`
	Stock            *int32    `json:"stock"`
	ImageURLs        *[]string `json:"image_urls"`
	ExternalURL      *string   `json:"external_url"`
	RequiresShipping *bool     `json:"requires_shipping"`
	PaymentMode      *string   `json:"payment_mode"`
}

type ProductResponse struct {
	ID               string    `json:"id"`
	StoreID          string    `json:"store_id"`
	Name             string    `json:"name"`
	Slug             string    `json:"slug"`
	Description      string    `json:"description"`
	PriceUSDC        int64     `json:"price_usdc"`
	PriceUSD         float64   `json:"price_usd"`
	ImageURLs        []string  `json:"image_urls"`
	ExternalURL      string    `json:"external_url,omitempty"`
	RequiresShipping bool      `json:"requires_shipping"`
	PaymentMode      string    `json:"payment_mode"`
	Stock            int32     `json:"stock"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type ProductDetailResponse struct {
	ProductResponse
	DeliveryContent string `json:"delivery_content,omitempty"`
	StoreName       string `json:"store_name,omitempty"`
	StoreSlug       string `json:"store_slug,omitempty"`
}

func (h *ProductHandler) CreateProduct(c *gin.Context) {
	agent := middleware.GetAgent(c.Request.Context())

	var req CreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierr.BadRequest(formatValidationErrors(err)))
		return
	}

	var store gen.Store
	if req.StoreID != nil {
		storeID := pgtype.UUID{}
		if err := storeID.Scan(*req.StoreID); err != nil {
			respondError(c, apierr.BadRequest("invalid store_id"))
			return
		}
		s, err := h.q.GetStoreByID(c.Request.Context(), storeID)
		if err != nil {
			respondError(c, apierr.NotFound("store not found"))
			return
		}
		if s.AgentID != agent.ID {
			respondError(c, apierr.Forbidden("store does not belong to you"))
			return
		}
		store = s
	} else {
		s, err := h.q.GetStoreByAgent(c.Request.Context(), agent.ID)
		if err != nil {
			respondError(c, apierr.BadRequest("you must create a store first"))
			return
		}
		store = s
	}

	slug := generateSlug(req.Name)

	_, err := h.q.GetProductBySlug(c.Request.Context(), gen.GetProductBySlugParams{
		StoreID: store.ID,
		Slug:    slug,
	})
	if err == nil {
		slug = slug + "-" + uuid.New().String()[:8]
	}

	stock := int32(-1)
	if req.Stock != nil {
		stock = *req.Stock
	}

	requiresShipping := false
	if req.RequiresShipping != nil {
		requiresShipping = *req.RequiresShipping
	}

	paymentMode := "escrow"
	if req.PaymentMode != nil {
		paymentMode = *req.PaymentMode
	}
	if paymentMode != "escrow" && paymentMode != "instant" {
		respondError(c, apierr.BadRequest("payment_mode must be 'escrow' or 'instant'"))
		return
	}
	if requiresShipping && paymentMode == "instant" {
		respondError(c, apierr.BadRequest("physical products (requires_shipping=true) must use escrow payment mode"))
		return
	}

	product, err := h.q.CreateProduct(c.Request.Context(), gen.CreateProductParams{
		StoreID:          store.ID,
		Name:             req.Name,
		Slug:             slug,
		Description:      pgtype.Text{String: req.Description, Valid: req.Description != ""},
		PriceUsdc:        req.PriceUSDC,
		DeliveryContent:  pgtype.Text{String: req.DeliveryContent, Valid: true},
		ImageUrls:        req.ImageURLs,
		ExternalUrl:      pgtype.Text{String: req.ExternalURL, Valid: req.ExternalURL != ""},
		RequiresShipping: requiresShipping,
		PaymentMode:      paymentMode,
		Stock:            pgtype.Int4{Int32: stock, Valid: true},
		Status:           "active",
	})
	if err != nil {
		respondError(c, apierr.Internal("failed to create product: "+err.Error()))
		return
	}

	c.JSON(http.StatusCreated, toProductDetailResp(product, store.Name, store.Slug))
}

func (h *ProductHandler) GetProduct(c *gin.Context) {
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

	store, _ := h.q.GetStoreByID(c.Request.Context(), product.StoreID)

	agent := middleware.GetAgent(c.Request.Context())
	isOwner := store.AgentID == agent.ID

	resp := toProductDetailResp(product, store.Name, store.Slug)
	if !isOwner {
		resp.DeliveryContent = ""
	}

	c.JSON(http.StatusOK, resp)
}

func (h *ProductHandler) ListProducts(c *gin.Context) {
	storeSlug := c.Param("slug")

	store, err := h.q.GetStoreBySlug(c.Request.Context(), storeSlug)
	if err != nil {
		respondError(c, apierr.NotFound("store not found"))
		return
	}

	products, err := h.q.ListProductsByStore(c.Request.Context(), gen.ListProductsByStoreParams{
		StoreID: store.ID,
		Limit:   20,
		Offset:  0,
	})
	if err != nil {
		respondError(c, apierr.Internal("failed to list products"))
		return
	}

	resp := make([]ProductResponse, len(products))
	for i, p := range products {
		resp[i] = toProductResp(p)
	}

	c.JSON(http.StatusOK, gin.H{
		"products": resp,
		"store": gin.H{
			"id":   pgtypeUUIDToString(store.ID),
			"name": store.Name,
			"slug": store.Slug,
		},
	})
}

func (h *ProductHandler) ListAllProducts(c *gin.Context) {
	products, err := h.q.ListAllProducts(c.Request.Context(), gen.ListAllProductsParams{
		Limit:  50,
		Offset: 0,
	})
	if err != nil {
		respondError(c, apierr.Internal("failed to list products"))
		return
	}

	resp := make([]ProductDetailResponse, len(products))
	for i, p := range products {
		imageURLs := p.ImageUrls
		if imageURLs == nil {
			imageURLs = []string{}
		}
		resp[i] = ProductDetailResponse{
			ProductResponse: ProductResponse{
				ID:               pgtypeUUIDToString(p.ID),
				StoreID:          pgtypeUUIDToString(p.StoreID),
				Name:             p.Name,
				Slug:             p.Slug,
				Description:      p.Description.String,
				PriceUSDC:        p.PriceUsdc,
				PriceUSD:         float64(p.PriceUsdc) / 1_000_000,
				ImageURLs:        imageURLs,
				ExternalURL:      p.ExternalUrl.String,
				RequiresShipping: p.RequiresShipping,
				PaymentMode:      p.PaymentMode,
				Stock:            p.Stock.Int32,
				Status:           p.Status,
				CreatedAt:        p.CreatedAt.Time,
				UpdatedAt:        p.UpdatedAt.Time,
			},
			StoreName: p.StoreName,
			StoreSlug: p.StoreSlug,
		}
	}

	c.JSON(http.StatusOK, gin.H{"products": resp})
}

func (h *ProductHandler) ListMyProducts(c *gin.Context) {
	agent := middleware.GetAgent(c.Request.Context())

	store, err := h.q.GetStoreByAgent(c.Request.Context(), agent.ID)
	if err != nil {
		respondError(c, apierr.BadRequest("you don't have a store"))
		return
	}

	products, err := h.q.ListProductsByStore(c.Request.Context(), gen.ListProductsByStoreParams{
		StoreID: store.ID,
		Limit:   100,
		Offset:  0,
	})
	if err != nil {
		respondError(c, apierr.Internal("failed to list products"))
		return
	}

	resp := make([]ProductDetailResponse, len(products))
	for i, p := range products {
		resp[i] = toProductDetailResp(p, store.Name, store.Slug)
	}

	c.JSON(http.StatusOK, gin.H{"products": resp})
}

func (h *ProductHandler) UpdateProduct(c *gin.Context) {
	agent := middleware.GetAgent(c.Request.Context())
	productIDStr := c.Param("id")
	productID := pgtype.UUID{}
	if err := productID.Scan(productIDStr); err != nil {
		respondError(c, apierr.BadRequest("invalid product id"))
		return
	}

	var req UpdateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierr.BadRequest(formatValidationErrors(err)))
		return
	}

	product, err := h.q.GetProductByID(c.Request.Context(), productID)
	if err != nil {
		respondError(c, apierr.NotFound("product not found"))
		return
	}

	store, err := h.q.GetStoreByID(c.Request.Context(), product.StoreID)
	if err != nil || store.AgentID != agent.ID {
		respondError(c, apierr.Forbidden("not your product"))
		return
	}

	params := gen.UpdateProductParams{ID: productID}
	if req.Name != nil {
		params.Name = pgtype.Text{String: *req.Name, Valid: true}
	}
	if req.Description != nil {
		params.Description = pgtype.Text{String: *req.Description, Valid: true}
	}
	if req.PriceUSDC != nil {
		params.PriceUsdc = pgtype.Int8{Int64: *req.PriceUSDC, Valid: true}
	}
	if req.DeliveryContent != nil {
		params.DeliveryContent = pgtype.Text{String: *req.DeliveryContent, Valid: true}
	}
	if req.ImageURLs != nil {
		params.ImageUrls = *req.ImageURLs
	}
	if req.ExternalURL != nil {
		params.ExternalUrl = pgtype.Text{String: *req.ExternalURL, Valid: true}
	}
	if req.RequiresShipping != nil {
		params.RequiresShipping = pgtype.Bool{Bool: *req.RequiresShipping, Valid: true}
	}
	if req.PaymentMode != nil {
		if *req.PaymentMode != "escrow" && *req.PaymentMode != "instant" {
			respondError(c, apierr.BadRequest("payment_mode must be 'escrow' or 'instant'"))
			return
		}
		// Check if the product would be physical + instant (not allowed)
		isShipping := product.RequiresShipping
		if req.RequiresShipping != nil {
			isShipping = *req.RequiresShipping
		}
		if isShipping && *req.PaymentMode == "instant" {
			respondError(c, apierr.BadRequest("physical products (requires_shipping=true) must use escrow payment mode"))
			return
		}
		params.PaymentMode = pgtype.Text{String: *req.PaymentMode, Valid: true}
	}
	if req.Stock != nil {
		params.Stock = pgtype.Int4{Int32: *req.Stock, Valid: true}
	}

	updated, err := h.q.UpdateProduct(c.Request.Context(), params)
	if err != nil {
		respondError(c, apierr.Internal("failed to update product"))
		return
	}

	c.JSON(http.StatusOK, toProductDetailResp(updated, store.Name, store.Slug))
}

func (h *ProductHandler) DeleteProduct(c *gin.Context) {
	agent := middleware.GetAgent(c.Request.Context())
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

	store, err := h.q.GetStoreByID(c.Request.Context(), product.StoreID)
	if err != nil || store.AgentID != agent.ID {
		respondError(c, apierr.Forbidden("not your product"))
		return
	}

	_, err = h.q.UpdateProductStatus(c.Request.Context(), gen.UpdateProductStatusParams{
		ID:     productID,
		Status: "inactive",
	})
	if err != nil {
		respondError(c, apierr.Internal("failed to delete product"))
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "product deleted"})
}

func generateSlug(name string) string {
	slug := strings.ToLower(name)
	reg := regexp.MustCompile(`[^a-z0-9]+`)
	slug = reg.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	if len(slug) > 64 {
		slug = slug[:64]
	}
	return slug
}

func pgtypeUUIDToString(u pgtype.UUID) string {
	if !u.Valid {
		return ""
	}
	return fmt.Sprintf("%x-%x-%x-%x-%x", u.Bytes[0:4], u.Bytes[4:6], u.Bytes[6:8], u.Bytes[8:10], u.Bytes[10:16])
}

func toProductResp(p gen.Product) ProductResponse {
	imageURLs := p.ImageUrls
	if imageURLs == nil {
		imageURLs = []string{}
	}
	return ProductResponse{
		ID:               pgtypeUUIDToString(p.ID),
		StoreID:          pgtypeUUIDToString(p.StoreID),
		Name:             p.Name,
		Slug:             p.Slug,
		Description:      p.Description.String,
		PriceUSDC:        p.PriceUsdc,
		PriceUSD:         float64(p.PriceUsdc) / 1_000_000,
		ImageURLs:        imageURLs,
		ExternalURL:      p.ExternalUrl.String,
		RequiresShipping: p.RequiresShipping,
		PaymentMode:      p.PaymentMode,
		Stock:            p.Stock.Int32,
		Status:           p.Status,
		CreatedAt:        p.CreatedAt.Time,
		UpdatedAt:        p.UpdatedAt.Time,
	}
}

func toProductDetailResp(p gen.Product, storeName, storeSlug string) ProductDetailResponse {
	return ProductDetailResponse{
		ProductResponse: toProductResp(p),
		DeliveryContent: p.DeliveryContent.String,
		StoreName:       storeName,
		StoreSlug:       storeSlug,
	}
}
