package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/db/gen"
	"github.com/niceclay/claycosmos/server/internal/middleware"
	"github.com/niceclay/claycosmos/server/internal/service"
	"github.com/niceclay/claycosmos/server/pkg/apierr"
)

type ItemHandler struct {
	pool *pgxpool.Pool
	q    *gen.Queries
	push *service.PushService
}

func NewItemHandler(pool *pgxpool.Pool, push *service.PushService) *ItemHandler {
	return &ItemHandler{pool: pool, q: gen.New(pool), push: push}
}

type CreateItemRequest struct {
	Data      any     `json:"data" binding:"required"`
	Version   *int32  `json:"version"`
	ExpiresAt *string `json:"expires_at"`
}

func (h *ItemHandler) Create(c *gin.Context) {
	var req CreateItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierr.BadRequest(err.Error()))
		return
	}

	feedID, err := parsePgUUID(c.Param("feedId"))
	if err != nil {
		respondError(c, apierr.BadRequest("invalid feed id"))
		return
	}

	agent := middleware.GetAgent(c.Request.Context())

	feed, err := h.q.GetFeedByID(c.Request.Context(), feedID)
	if err != nil {
		respondError(c, apierr.NotFound("feed not found"))
		return
	}
	store, err := h.q.GetStoreByID(c.Request.Context(), feed.StoreID)
	if err != nil || store.AgentID != agent.ID {
		respondError(c, apierr.Forbidden("you do not own this feed"))
		return
	}

	version := pgtype.Int4{Int32: 1, Valid: true}
	if req.Version != nil {
		version = pgtype.Int4{Int32: *req.Version, Valid: true}
	}

	var expiresAt pgtype.Timestamptz
	if req.ExpiresAt != nil {
		t, err := time.Parse(time.RFC3339, *req.ExpiresAt)
		if err == nil {
			expiresAt = pgtype.Timestamptz{Time: t, Valid: true}
		}
	}

	item, err := h.q.CreateItem(c.Request.Context(), gen.CreateItemParams{
		FeedID:    feedID,
		Data:      toJSON(req.Data),
		Version:   version,
		ExpiresAt: expiresAt,
	})
	if err != nil {
		respondError(c, apierr.Internal("failed to create item"))
		return
	}

	// Publish to Redis for push notifications
	itemJSON, _ := json.Marshal(item)
	h.push.Publish(c.Request.Context(), pgUUIDString(feedID), itemJSON)

	c.JSON(http.StatusCreated, item)
}

func (h *ItemHandler) List(c *gin.Context) {
	feedID, err := parsePgUUID(c.Param("feedId"))
	if err != nil {
		respondError(c, apierr.BadRequest("invalid feed id"))
		return
	}

	limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "20"), 10, 32)
	offset, _ := strconv.ParseInt(c.DefaultQuery("offset", "0"), 10, 32)
	if limit > 100 {
		limit = 100
	}

	afterStr := c.Query("after")
	if afterStr != "" {
		afterTime, err := time.Parse(time.RFC3339, afterStr)
		if err != nil {
			respondError(c, apierr.BadRequest("invalid 'after' timestamp"))
			return
		}
		items, err := h.q.ListItemsAfter(c.Request.Context(), gen.ListItemsAfterParams{
			FeedID:      feedID,
			PublishedAt: pgtype.Timestamptz{Time: afterTime, Valid: true},
			Limit:       int32(limit),
		})
		if err != nil {
			respondError(c, apierr.Internal("failed to list items"))
			return
		}
		c.JSON(http.StatusOK, items)
		return
	}

	items, err := h.q.ListItemsByFeed(c.Request.Context(), gen.ListItemsByFeedParams{
		FeedID: feedID,
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		respondError(c, apierr.Internal("failed to list items"))
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *ItemHandler) GetLatest(c *gin.Context) {
	feedID, err := parsePgUUID(c.Param("feedId"))
	if err != nil {
		respondError(c, apierr.BadRequest("invalid feed id"))
		return
	}
	item, err := h.q.GetLatestItem(c.Request.Context(), feedID)
	if err != nil {
		respondError(c, apierr.NotFound("no items found"))
		return
	}
	c.JSON(http.StatusOK, item)
}
