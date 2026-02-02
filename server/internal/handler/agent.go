package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/db/gen"
	"github.com/niceclay/claycosmos/server/internal/middleware"
	"github.com/niceclay/claycosmos/server/pkg/apierr"
	"github.com/niceclay/claycosmos/server/pkg/apikey"
)

type AgentHandler struct {
	pool *pgxpool.Pool
	q    *gen.Queries
}

func NewAgentHandler(pool *pgxpool.Pool) *AgentHandler {
	return &AgentHandler{pool: pool, q: gen.New(pool)}
}

type RegisterRequest struct {
	Name         string  `json:"name" binding:"required,max=64"`
	Description  *string `json:"description"`
	Role         string  `json:"role" binding:"omitempty,oneof=seller buyer hybrid"`
	Capabilities any     `json:"capabilities"`
	OwnerID      *string `json:"owner_id"`
}

func (h *AgentHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierr.BadRequest(err.Error()))
		return
	}

	rawKey, prefix, hash, err := apikey.Generate()
	if err != nil {
		respondError(c, apierr.Internal("failed to generate api key"))
		return
	}

	role := req.Role
	if role == "" {
		role = "hybrid"
	}

	agent, err := h.q.CreateAgent(c.Request.Context(), gen.CreateAgentParams{
		Name:         req.Name,
		Description:  toPgText(req.Description),
		ApiKeyPrefix: prefix,
		ApiKeyHash:   hash,
		Role:         role,
		Capabilities: toJSON(req.Capabilities),
		OwnerID:      toPgText(req.OwnerID),
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(c, apierr.Conflict("agent name already taken"))
			return
		}
		respondError(c, apierr.Internal("failed to create agent"))
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"agent":   agent,
		"api_key": rawKey,
		"message": "Store this API key securely. It will not be shown again.",
	})
}

func (h *AgentHandler) GetMe(c *gin.Context) {
	agent := middleware.GetAgent(c.Request.Context())
	c.JSON(http.StatusOK, agent)
}

type UpdateAgentRequest struct {
	Name         *string `json:"name"`
	Description  *string `json:"description"`
	Role         *string `json:"role" binding:"omitempty,oneof=seller buyer hybrid"`
	Capabilities any     `json:"capabilities"`
}

func (h *AgentHandler) UpdateMe(c *gin.Context) {
	var req UpdateAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierr.BadRequest(err.Error()))
		return
	}

	agent := middleware.GetAgent(c.Request.Context())
	updated, err := h.q.UpdateAgent(c.Request.Context(), gen.UpdateAgentParams{
		ID:           agent.ID,
		Name:         toPgText(req.Name),
		Description:  toPgText(req.Description),
		Role:         toPgText(req.Role),
		Capabilities: toJSON(req.Capabilities),
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(c, apierr.Conflict("agent name already taken"))
			return
		}
		respondError(c, apierr.Internal("failed to update agent"))
		return
	}
	c.JSON(http.StatusOK, updated)
}
