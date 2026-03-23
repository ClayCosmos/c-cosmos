package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/db/gen"
	"github.com/niceclay/claycosmos/server/internal/middleware"
	"github.com/niceclay/claycosmos/server/pkg/apierr"
)

type StoreHandler struct {
	pool *pgxpool.Pool
	q    *gen.Queries
}

func NewStoreHandler(pool *pgxpool.Pool) *StoreHandler {
	return &StoreHandler{pool: pool, q: gen.New(pool)}
}

type CreateStoreRequest struct {
	Name          string   `json:"name" binding:"required,max=128"`
	Slug          string   `json:"slug" binding:"required,max=128"`
	Description   *string  `json:"description"`
	Category      *string  `json:"category"`
	Tags          []string `json:"tags"`
	PricingPolicy any      `json:"pricing_policy"`
}

func (h *StoreHandler) Create(c *gin.Context) {
	var req CreateStoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierr.BadRequest(err.Error()))
		return
	}

	// Sanitize and validate slug
	req.Slug = sanitizeSlug(req.Slug)
	if !isValidSlug(req.Slug) {
		respondError(c, apierr.BadRequest("invalid slug: must be 2-128 characters, lowercase alphanumeric and hyphens only (e.g. my-store)"))
		return
	}

	agent := middleware.GetAgent(c.Request.Context())
	store, err := h.q.CreateStore(c.Request.Context(), gen.CreateStoreParams{
		AgentID:       agent.ID,
		Name:          req.Name,
		Slug:          req.Slug,
		Description:   toPgText(req.Description),
		Category:      toPgText(req.Category),
		Tags:          req.Tags,
		PricingPolicy: toJSON(req.PricingPolicy),
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(c, apierr.Conflict("store slug already taken"))
			return
		}
		respondError(c, apierr.Internal("failed to create store"))
		return
	}
	c.JSON(http.StatusCreated, store)
}

func (h *StoreHandler) ListMy(c *gin.Context) {
	agent := middleware.GetAgent(c.Request.Context())
	stores, err := h.q.ListStoresByAgent(c.Request.Context(), agent.ID)
	if err != nil {
		respondError(c, apierr.Internal("failed to list your stores"))
		return
	}
	c.JSON(http.StatusOK, stores)
}

func (h *StoreHandler) List(c *gin.Context) {
	limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "20"), 10, 32)
	offset, _ := strconv.ParseInt(c.DefaultQuery("offset", "0"), 10, 32)
	category := c.Query("category")

	if limit > 100 {
		limit = 100
	}

	var stores []gen.Store
	var err error
	if category != "" {
		stores, err = h.q.ListStoresByCategory(c.Request.Context(), gen.ListStoresByCategoryParams{
			Category: toPgText(&category),
			Limit:    int32(limit),
			Offset:   int32(offset),
		})
	} else {
		stores, err = h.q.ListStores(c.Request.Context(), gen.ListStoresParams{
			Limit:  int32(limit),
			Offset: int32(offset),
		})
	}
	if err != nil {
		respondError(c, apierr.Internal("failed to list stores"))
		return
	}
	c.JSON(http.StatusOK, stores)
}

func (h *StoreHandler) GetBySlug(c *gin.Context) {
	store, err := h.q.GetStoreBySlug(c.Request.Context(), c.Param("slug"))
	if err != nil {
		respondError(c, apierr.NotFound("store not found"))
		return
	}
	c.JSON(http.StatusOK, store)
}

type UpdateStoreRequest struct {
	Name          *string  `json:"name"`
	Description   *string  `json:"description"`
	Category      *string  `json:"category"`
	Tags          []string `json:"tags"`
	PricingPolicy any      `json:"pricing_policy"`
	Status        *string  `json:"status" binding:"omitempty,oneof=active inactive"`
}

func (h *StoreHandler) Update(c *gin.Context) {
	var req UpdateStoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierr.BadRequest(err.Error()))
		return
	}

	agent := middleware.GetAgent(c.Request.Context())
	updated, err := h.q.UpdateStore(c.Request.Context(), gen.UpdateStoreParams{
		Slug:          c.Param("slug"),
		AgentID:       agent.ID,
		Name:          toPgText(req.Name),
		Description:   toPgText(req.Description),
		Category:      toPgText(req.Category),
		Tags:          req.Tags,
		PricingPolicy: toJSON(req.PricingPolicy),
		Status:        toPgText(req.Status),
	})
	if err != nil {
		respondError(c, apierr.NotFound("store not found or not owned by you"))
		return
	}
	c.JSON(http.StatusOK, updated)
}
