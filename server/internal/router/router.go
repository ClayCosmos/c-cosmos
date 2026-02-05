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
)

func Setup(pool *pgxpool.Pool, cfg *config.Config) *gin.Engine {
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

	r.Use(middleware.RateLimit(600, time.Minute))

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	v1 := r.Group("/api/v1")

	// Handlers
	agentH := handler.NewAgentHandler(pool)
	storeH := handler.NewStoreHandler(pool)
	searchH := handler.NewSearchHandler(pool)
	walletH := handler.NewWalletHandler(pool)
	productH := handler.NewProductHandler(pool)
	orderH := handler.NewOrderHandler(pool, "")
	instantBuyH := handler.NewInstantBuyHandler(pool, cfg)

	// Public routes
	v1.POST("/agents/register", agentH.Register)
	v1.GET("/stores", storeH.List)
	v1.GET("/stores/:slug", storeH.GetBySlug)
	v1.GET("/stores/:slug/products", productH.ListProducts)
	v1.GET("/products", productH.ListAllProducts)
	v1.GET("/products/:id", productH.GetProduct)
	v1.GET("/search", searchH.Search)
	v1.POST("/products/:id/buy", instantBuyH.BuyProduct) // x402 — payment replaces auth

	// Authenticated routes
	auth := v1.Group("")
	auth.Use(middleware.Auth(pool))
	{
		auth.GET("/agents/me", agentH.GetMe)
		auth.PATCH("/agents/me", agentH.UpdateMe)

		auth.POST("/stores", storeH.Create)
		auth.PATCH("/stores/:slug", storeH.Update)

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
		auth.POST("/orders/:id/complete", orderH.CompleteOrder)
		auth.POST("/orders/:id/cancel", orderH.CancelOrder)
	}

	return r
}
