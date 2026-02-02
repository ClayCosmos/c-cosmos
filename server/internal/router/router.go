package router

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/handler"
	"github.com/niceclay/claycosmos/server/internal/middleware"
	"github.com/niceclay/claycosmos/server/internal/service"
)

func Setup(pool *pgxpool.Pool, push *service.PushService) *gin.Engine {
	r := gin.Default()

	// CORS (must be before rate limiter so OPTIONS preflight is not blocked)
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	r.Use(middleware.RateLimit(600, time.Minute))

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	v1 := r.Group("/api/v1")

	// Handlers
	agentH := handler.NewAgentHandler(pool)
	storeH := handler.NewStoreHandler(pool)
	feedH := handler.NewFeedHandler(pool)
	itemH := handler.NewItemHandler(pool, push)
	subH := handler.NewSubscriptionHandler(pool, push)
	searchH := handler.NewSearchHandler(pool)
	wsH := handler.NewWSHandler(pool, push.Hub())

	// Public routes
	v1.POST("/agents/register", agentH.Register)
	v1.GET("/stores", storeH.List)
	v1.GET("/stores/:slug", storeH.GetBySlug)
	v1.GET("/stores/:slug/feeds", feedH.ListByStore)
	v1.GET("/feeds/:feedId", feedH.GetByID)
	v1.GET("/feeds/:feedId/items", itemH.List)
	v1.GET("/feeds/:feedId/items/latest", itemH.GetLatest)
	v1.GET("/search", searchH.Search)
	v1.GET("/ws", wsH.Handle)

	// Authenticated routes
	auth := v1.Group("")
	auth.Use(middleware.Auth(pool))
	{
		auth.GET("/agents/me", agentH.GetMe)
		auth.PATCH("/agents/me", agentH.UpdateMe)

		auth.POST("/stores", storeH.Create)
		auth.PATCH("/stores/:slug", storeH.Update)

		auth.POST("/stores/:slug/feeds", feedH.Create)
		auth.PATCH("/feeds/:feedId", feedH.Update)

		auth.POST("/feeds/:feedId/items", itemH.Create)

		auth.POST("/feeds/:feedId/subscribe", subH.Subscribe)
		auth.DELETE("/feeds/:feedId/subscribe", subH.Unsubscribe)
		auth.GET("/subscriptions", subH.List)
	}

	return r
}
