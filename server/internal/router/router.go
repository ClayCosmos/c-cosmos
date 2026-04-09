package router

import (
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/config"
	"github.com/niceclay/claycosmos/server/internal/handler"
	"github.com/niceclay/claycosmos/server/internal/middleware"
	"github.com/redis/go-redis/v9"
)

func Setup(pool *pgxpool.Pool, rdb *redis.Client, cfg *config.Config) *gin.Engine {
	r := gin.Default()

	// Trust proxies from private networks (K8s pods, load balancers)
	if err := r.SetTrustedProxies([]string{
		"10.0.0.0/8",     // Class A private
		"172.16.0.0/12",  // Class B private
		"192.168.0.0/16", // Class C private
		"127.0.0.1",      // Localhost
	}); err != nil {
		panic("failed to set trusted proxies: " + err.Error())
	}

	// CORS (must be before rate limiter so OPTIONS preflight is not blocked)
	allowedOrigin := os.Getenv("CORS_ORIGIN")
	if allowedOrigin == "" {
		allowedOrigin = "*" // Default for development
	}
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", allowedOrigin)
		c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, PAYMENT-SIGNATURE")
		c.Header("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	r.Use(middleware.RateLimit(rdb, 600, time.Minute))

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	v1 := r.Group("/api/v1")

	// API index — agent-discoverable entry point
	v1.GET("", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"name":    "ClayCosmos API",
			"version": "v1",
			"skill":   "https://claycosmos.ai/skill.md",
			"docs":    "https://claycosmos.ai/help",
			"register": gin.H{
				"method":      "POST",
				"path":        "/api/v1/agents/register",
				"description": "Register a new agent. Returns an API key.",
				"body":        gin.H{"name": "string (required)", "description": "string", "role": "buyer | seller | hybrid"},
			},
			"endpoints": gin.H{
				"agents":   "GET /api/v1/agents/me",
				"stores":   "GET /api/v1/stores",
				"products": "GET /api/v1/products",
				"search":   "GET /api/v1/search?q=",
				"pets":     "GET /api/v1/pets",
				"feed":     "GET /api/v1/feed",
				"cards":    "GET /api/v1/cards/:slug",
			},
		})
	})

	// Handlers
	agentH := handler.NewAgentHandler(pool)
	storeH := handler.NewStoreHandler(pool)
	searchH := handler.NewSearchHandler(pool)
	walletH := handler.NewWalletHandler(pool, rdb)
	productH := handler.NewProductHandler(pool)
	orderH := handler.NewOrderHandler(pool, cfg)
	instantBuyH := handler.NewInstantBuyHandler(pool, cfg)
	petH := handler.NewPetHandler(pool)
	socialH := handler.NewSocialHandler(pool, petH)
	cardH := handler.NewCardHandler(pool)

	// Public routes
	v1.POST("/agents/register", agentH.Register)
	v1.GET("/stores", storeH.List)
	v1.GET("/stores/:slug", storeH.GetBySlug)
	v1.GET("/stores/:slug/products", productH.ListProducts)
	v1.GET("/products", productH.ListAllProducts)
	v1.GET("/products/:id", productH.GetProduct)
	v1.GET("/search", searchH.Search)
	v1.GET("/agents/:id/stats", agentH.GetAgentStats)     // Public agent reputation
	v1.POST("/products/:id/buy", instantBuyH.BuyProduct) // x402 — payment replaces auth

	// Pet public routes
	v1.GET("/pets", petH.ListPets)
	v1.GET("/pets/:id", petH.GetPet)
	v1.GET("/pets/:id/posts", socialH.GetPetPosts)

	// Social public routes
	v1.GET("/feed", socialH.GetFeed)
	v1.GET("/posts/:id/comments", socialH.ListComments)

	// Card public routes
	v1.GET("/cards/:slug", cardH.GetCard)
	v1.GET("/cards/:slug/widget", cardH.GetWidget)

	// Authenticated routes
	auth := v1.Group("")
	auth.Use(middleware.Auth(pool))
	{
		auth.GET("/agents/me", agentH.GetMe)
		auth.PATCH("/agents/me", agentH.UpdateMe)

		auth.GET("/stores/me", storeH.ListMy)
		auth.POST("/stores", storeH.Create)
		auth.PATCH("/stores/:slug", storeH.Update)
		auth.DELETE("/stores/:slug", storeH.Delete)

		// Wallet routes
		auth.POST("/wallets", walletH.BindWallet)
		auth.POST("/wallets/verify", walletH.VerifyWallet)
		auth.POST("/wallets/bind-programmatic", walletH.BindProgrammatic) // For AI Agents
		auth.GET("/wallets", walletH.ListWallets)
		auth.DELETE("/wallets/:id", walletH.DeleteWallet)

		// Product routes
		auth.POST("/products", productH.CreateProduct)
		auth.GET("/products/mine", productH.ListMyProducts)
		auth.PATCH("/products/:id", productH.UpdateProduct)
		auth.DELETE("/products/:id", productH.DeleteProduct)

		// Order routes
		auth.POST("/orders", orderH.CreateOrder)
		auth.GET("/orders", orderH.ListMyOrders)
		auth.GET("/orders/:id", orderH.GetOrder)
		auth.POST("/orders/:id/paid", orderH.MarkOrderPaid)
		auth.POST("/orders/:id/ship", orderH.MarkOrderShipped)
		auth.POST("/orders/:id/complete", orderH.CompleteOrder)
		auth.POST("/orders/:id/cancel", orderH.CancelOrder)
		auth.POST("/orders/:id/dispute", orderH.DisputeOrder)
		auth.POST("/orders/:id/resolve-dispute", orderH.ResolveDispute)

		// Pet routes (authenticated)
		auth.POST("/pets", petH.Adopt)
		auth.GET("/pets/mine", petH.GetMyPet)
		auth.GET("/pets/mine/observations", petH.Observations)
		auth.GET("/pets/mine/events", petH.ListEvents)
		auth.POST("/pets/:id/feed", petH.Feed)
		auth.PATCH("/pets/:id", petH.Update)

		// Card routes (authenticated)
		auth.GET("/cards/me", cardH.GetMyCard)
		auth.PATCH("/cards/me", cardH.UpdateCard)

		// Social routes (authenticated)
		auth.POST("/posts", socialH.CreatePost)
		auth.POST("/posts/:id/comments", socialH.CreateComment)
		auth.POST("/posts/:id/react", socialH.React)
	}

	return r
}
