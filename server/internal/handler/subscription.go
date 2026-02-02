package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/db/gen"
	"github.com/niceclay/claycosmos/server/internal/middleware"
	"github.com/niceclay/claycosmos/server/internal/service"
	"github.com/niceclay/claycosmos/server/pkg/apierr"
)

type SubscriptionHandler struct {
	pool *pgxpool.Pool
	q    *gen.Queries
	push *service.PushService
}

func NewSubscriptionHandler(pool *pgxpool.Pool, push *service.PushService) *SubscriptionHandler {
	return &SubscriptionHandler{pool: pool, q: gen.New(pool), push: push}
}

type SubscribeRequest struct {
	WebhookURL *string `json:"webhook_url"`
}

func (h *SubscriptionHandler) Subscribe(c *gin.Context) {
	var req SubscribeRequest
	_ = c.ShouldBindJSON(&req)

	feedID, err := parsePgUUID(c.Param("feedId"))
	if err != nil {
		respondError(c, apierr.BadRequest("invalid feed id"))
		return
	}

	agent := middleware.GetAgent(c.Request.Context())

	_, err = h.q.GetFeedByID(c.Request.Context(), feedID)
	if err != nil {
		respondError(c, apierr.NotFound("feed not found"))
		return
	}

	sub, err := h.q.CreateSubscription(c.Request.Context(), gen.CreateSubscriptionParams{
		SubscriberAgentID: agent.ID,
		FeedID:            feedID,
		WebhookUrl:        toPgText(req.WebhookURL),
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(c, apierr.Conflict("already subscribed to this feed"))
			return
		}
		respondError(c, apierr.Internal("failed to subscribe"))
		return
	}

	_ = h.q.IncrementSubscriberCount(c.Request.Context(), feedID)

	h.push.AddSubscription(pgUUIDString(feedID), pgUUIDString(agent.ID), req.WebhookURL)

	c.JSON(http.StatusCreated, sub)
}

func (h *SubscriptionHandler) Unsubscribe(c *gin.Context) {
	feedID, err := parsePgUUID(c.Param("feedId"))
	if err != nil {
		respondError(c, apierr.BadRequest("invalid feed id"))
		return
	}

	agent := middleware.GetAgent(c.Request.Context())

	err = h.q.DeleteSubscription(c.Request.Context(), gen.DeleteSubscriptionParams{
		SubscriberAgentID: agent.ID,
		FeedID:            feedID,
	})
	if err != nil {
		respondError(c, apierr.NotFound("subscription not found"))
		return
	}

	_ = h.q.DecrementSubscriberCount(c.Request.Context(), feedID)
	h.push.RemoveSubscription(pgUUIDString(feedID), pgUUIDString(agent.ID))

	c.JSON(http.StatusOK, gin.H{"message": "unsubscribed"})
}

func (h *SubscriptionHandler) List(c *gin.Context) {
	agent := middleware.GetAgent(c.Request.Context())
	subs, err := h.q.ListSubscriptionsByAgent(c.Request.Context(), agent.ID)
	if err != nil {
		respondError(c, apierr.Internal("failed to list subscriptions"))
		return
	}
	c.JSON(http.StatusOK, subs)
}
