package handler

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
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
		respondError(c, apierr.BadRequest(formatValidationErrors(err)))
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
		"agent": gin.H{
			"id":            agent.ID,
			"name":          agent.Name,
			"description":   agent.Description,
			"api_key_prefix": agent.ApiKeyPrefix,
			"role":          agent.Role,
			"capabilities":  json.RawMessage(agent.Capabilities),
			"owner_id":      agent.OwnerID,
			"created_at":    agent.CreatedAt,
			"updated_at":    agent.UpdatedAt,
		},
		"api_key": rawKey,
		"message": "Store this API key securely. It will not be shown again.",
	})
}

func (h *AgentHandler) GetMe(c *gin.Context) {
	agent := middleware.GetAgent(c.Request.Context())

	var reputation any
	var tradingStats any
	if len(agent.Reputation) > 0 {
		_ = json.Unmarshal(agent.Reputation, &reputation)
	}
	if len(agent.TradingStats) > 0 {
		_ = json.Unmarshal(agent.TradingStats, &tradingStats)
	}

	c.JSON(http.StatusOK, gin.H{
		"id":            agent.ID,
		"name":          agent.Name,
		"description":   agent.Description,
		"api_key_prefix": agent.ApiKeyPrefix,
		"role":          agent.Role,
		"capabilities":  json.RawMessage(agent.Capabilities),
		"reputation":    reputation,
		"trading_stats": tradingStats,
		"owner_id":      agent.OwnerID,
		"created_at":    agent.CreatedAt,
		"updated_at":    agent.UpdatedAt,
	})
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
		respondError(c, apierr.BadRequest(formatValidationErrors(err)))
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

	var reputation any
	var tradingStats any
	if len(updated.Reputation) > 0 {
		_ = json.Unmarshal(updated.Reputation, &reputation)
	}
	if len(updated.TradingStats) > 0 {
		_ = json.Unmarshal(updated.TradingStats, &tradingStats)
	}

	c.JSON(http.StatusOK, gin.H{
		"id":            updated.ID,
		"name":          updated.Name,
		"description":   updated.Description,
		"api_key_prefix": updated.ApiKeyPrefix,
		"role":          updated.Role,
		"capabilities":  json.RawMessage(updated.Capabilities),
		"reputation":    reputation,
		"trading_stats": tradingStats,
		"owner_id":      updated.OwnerID,
		"created_at":    updated.CreatedAt,
		"updated_at":    updated.UpdatedAt,
	})
}

// GetAgentStats returns public reputation and trading stats for an agent
func (h *AgentHandler) GetAgentStats(c *gin.Context) {
	idStr := c.Param("id")
	agentID := pgtype.UUID{}
	if err := agentID.Scan(idStr); err != nil {
		respondError(c, apierr.BadRequest("invalid agent id"))
		return
	}

	row, err := h.q.GetAgentPublicStats(c.Request.Context(), agentID)
	if err != nil {
		respondError(c, apierr.NotFound("agent not found"))
		return
	}

	var reputation any
	var tradingStats any
	if len(row.Reputation) > 0 {
		_ = json.Unmarshal(row.Reputation, &reputation)
	}
	if len(row.TradingStats) > 0 {
		_ = json.Unmarshal(row.TradingStats, &tradingStats)
	}

	c.JSON(http.StatusOK, gin.H{
		"id":            idStr,
		"name":          row.Name,
		"reputation":    reputation,
		"trading_stats": tradingStats,
	})
}
