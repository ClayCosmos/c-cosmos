package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/db/gen"
	"github.com/niceclay/claycosmos/server/pkg/apikey"
)

type contextKey string

const AgentKey contextKey = "agent"

func Auth(pool *pgxpool.Pool) gin.HandlerFunc {
	q := gen.New(pool)
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": "unauthorized", "message": "missing authorization header"})
			return
		}
		raw := strings.TrimPrefix(header, "Bearer ")
		if raw == header {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": "unauthorized", "message": "invalid authorization format"})
			return
		}
		hash := apikey.Hash(raw)
		agent, err := q.GetAgentByAPIKeyHash(c.Request.Context(), hash)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": "unauthorized", "message": "invalid api key"})
			return
		}
		ctx := context.WithValue(c.Request.Context(), AgentKey, agent)
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}

func GetAgent(ctx context.Context) gen.Agent {
	return ctx.Value(AgentKey).(gen.Agent)
}
