package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/db/gen"
	"github.com/niceclay/claycosmos/server/internal/middleware"
	"github.com/niceclay/claycosmos/server/pkg/apierr"
)

type FeedHandler struct {
	pool *pgxpool.Pool
	q    *gen.Queries
}

func NewFeedHandler(pool *pgxpool.Pool) *FeedHandler {
	return &FeedHandler{pool: pool, q: gen.New(pool)}
}

type CreateFeedRequest struct {
	Name            string  `json:"name" binding:"required,max=256"`
	Slug            string  `json:"slug" binding:"required,max=256"`
	Description     *string `json:"description"`
	Schema          any     `json:"schema"`
	UpdateFrequency *string `json:"update_frequency"`
	PricePerMonth   *int32  `json:"price_per_month"`
	SampleData      any     `json:"sample_data"`
}

func (h *FeedHandler) Create(c *gin.Context) {
	var req CreateFeedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierr.BadRequest(err.Error()))
		return
	}

	agent := middleware.GetAgent(c.Request.Context())
	storeSlug := c.Param("slug")

	store, err := h.q.GetStoreBySlug(c.Request.Context(), storeSlug)
	if err != nil {
		respondError(c, apierr.NotFound("store not found"))
		return
	}
	if store.AgentID != agent.ID {
		respondError(c, apierr.Forbidden("you do not own this store"))
		return
	}

	ppm := pgtype.Int4{}
	if req.PricePerMonth != nil {
		ppm = pgtype.Int4{Int32: *req.PricePerMonth, Valid: true}
	}

	feed, err := h.q.CreateFeed(c.Request.Context(), gen.CreateFeedParams{
		StoreID:         store.ID,
		Name:            req.Name,
		Slug:            req.Slug,
		Description:     toPgText(req.Description),
		Schema:          toJSON(req.Schema),
		UpdateFrequency: toPgText(req.UpdateFrequency),
		PricePerMonth:   ppm,
		SampleData:      toJSON(req.SampleData),
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(c, apierr.Conflict("feed slug already exists in this store"))
			return
		}
		respondError(c, apierr.Internal("failed to create feed"))
		return
	}
	c.JSON(http.StatusCreated, feed)
}

func (h *FeedHandler) ListByStore(c *gin.Context) {
	store, err := h.q.GetStoreBySlug(c.Request.Context(), c.Param("slug"))
	if err != nil {
		respondError(c, apierr.NotFound("store not found"))
		return
	}
	feeds, err := h.q.ListFeedsByStore(c.Request.Context(), store.ID)
	if err != nil {
		respondError(c, apierr.Internal("failed to list feeds"))
		return
	}
	c.JSON(http.StatusOK, feeds)
}

func (h *FeedHandler) GetByID(c *gin.Context) {
	id, err := parsePgUUID(c.Param("feedId"))
	if err != nil {
		respondError(c, apierr.BadRequest("invalid feed id"))
		return
	}
	feed, err := h.q.GetFeedByID(c.Request.Context(), id)
	if err != nil {
		respondError(c, apierr.NotFound("feed not found"))
		return
	}
	c.JSON(http.StatusOK, feed)
}

type UpdateFeedRequest struct {
	Name            *string `json:"name"`
	Description     *string `json:"description"`
	Schema          any     `json:"schema"`
	UpdateFrequency *string `json:"update_frequency"`
	PricePerMonth   *int32  `json:"price_per_month"`
	SampleData      any     `json:"sample_data"`
	Status          *string `json:"status" binding:"omitempty,oneof=active inactive"`
}

func (h *FeedHandler) Update(c *gin.Context) {
	var req UpdateFeedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierr.BadRequest(err.Error()))
		return
	}

	id, err := parsePgUUID(c.Param("feedId"))
	if err != nil {
		respondError(c, apierr.BadRequest("invalid feed id"))
		return
	}

	agent := middleware.GetAgent(c.Request.Context())

	feed, err := h.q.GetFeedByID(c.Request.Context(), id)
	if err != nil {
		respondError(c, apierr.NotFound("feed not found"))
		return
	}
	store, err := h.q.GetStoreByID(c.Request.Context(), feed.StoreID)
	if err != nil || store.AgentID != agent.ID {
		respondError(c, apierr.Forbidden("you do not own this feed"))
		return
	}

	ppm := pgtype.Int4{}
	if req.PricePerMonth != nil {
		ppm = pgtype.Int4{Int32: *req.PricePerMonth, Valid: true}
	}

	updated, err := h.q.UpdateFeed(c.Request.Context(), gen.UpdateFeedParams{
		ID:              id,
		Name:            toPgText(req.Name),
		Description:     toPgText(req.Description),
		Schema:          toJSON(req.Schema),
		UpdateFrequency: toPgText(req.UpdateFrequency),
		PricePerMonth:   ppm,
		SampleData:      toJSON(req.SampleData),
		Status:          toPgText(req.Status),
	})
	if err != nil {
		respondError(c, apierr.Internal("failed to update feed"))
		return
	}
	c.JSON(http.StatusOK, updated)
}
