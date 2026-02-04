package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/db/gen"
	"github.com/niceclay/claycosmos/server/internal/handler"
	"github.com/niceclay/claycosmos/server/internal/middleware"
)

var testPool *pgxpool.Pool

func TestMain(m *testing.M) {
	// Use test database
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/claycosmos_test?sslmode=disable"
	}

	var err error
	testPool, err = pgxpool.New(context.Background(), dbURL)
	if err != nil {
		fmt.Printf("Failed to connect to test database: %v\n", err)
		fmt.Println("Skipping integration tests - no test database available")
		os.Exit(0)
	}
	defer testPool.Close()

	// Run migrations
	if err := runTestMigrations(testPool); err != nil {
		fmt.Printf("Failed to run migrations: %v\n", err)
		os.Exit(1)
	}

	code := m.Run()

	// Cleanup
	cleanupTestData(testPool)

	os.Exit(code)
}

func runTestMigrations(pool *pgxpool.Pool) error {
	migrations := []string{
		"../db/migrations/001_init.up.sql",
		"../db/migrations/002_trading.up.sql",
		"../db/migrations/003_remove_feeds.up.sql",
	}
	for _, path := range migrations {
		data, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", path, err)
		}
		if _, err := pool.Exec(context.Background(), string(data)); err != nil {
			// Ignore errors for already existing objects
			continue
		}
	}
	return nil
}

func cleanupTestData(pool *pgxpool.Pool) {
	ctx := context.Background()
	pool.Exec(ctx, "DELETE FROM orders WHERE 1=1")
	pool.Exec(ctx, "DELETE FROM products WHERE 1=1")
	pool.Exec(ctx, "DELETE FROM wallets WHERE 1=1")
	pool.Exec(ctx, "DELETE FROM blockchain_events WHERE 1=1")
	pool.Exec(ctx, "DELETE FROM stores WHERE 1=1")
	pool.Exec(ctx, "DELETE FROM agents WHERE 1=1")
}

func setupTestRouter(pool *pgxpool.Pool) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	orderH := handler.NewOrderHandler(pool, "0x1234567890123456789012345678901234567890")
	productH := handler.NewProductHandler(pool)
	walletH := handler.NewWalletHandler(pool)

	v1 := r.Group("/api/v1")

	// Authenticated routes with test middleware
	auth := v1.Group("")
	auth.Use(middleware.Auth(pool))
	{
		auth.POST("/products", productH.CreateProduct)
		auth.GET("/products/mine", productH.ListMyProducts)

		auth.POST("/wallets", walletH.BindWallet)
		auth.POST("/wallets/verify", walletH.VerifyWallet)
		auth.GET("/wallets", walletH.ListWallets)

		auth.POST("/orders", orderH.CreateOrder)
		auth.GET("/orders", orderH.ListMyOrders)
		auth.GET("/orders/:id", orderH.GetOrder)
		auth.POST("/orders/:id/paid", orderH.MarkOrderPaid)
		auth.POST("/orders/:id/complete", orderH.CompleteOrder)
		auth.POST("/orders/:id/cancel", orderH.CancelOrder)
	}

	return r
}

// Helper to create a test agent and get API key
func createTestAgent(t *testing.T, pool *pgxpool.Pool, name string) (agentID string, apiKey string) {
	t.Helper()

	q := gen.New(pool)
	ctx := context.Background()

	// Create agent directly in DB for testing
	agent, err := q.CreateAgent(ctx, gen.CreateAgentParams{
		Name:         name,
		ApiKeyPrefix: "test1234",
		ApiKeyHash:   "test_hash_" + name,
		Role:         "hybrid",
	})
	if err != nil {
		t.Fatalf("create test agent: %v", err)
	}

	// For testing, we use the api_key_prefix as a simple lookup
	// In real code, we'd need to set up proper auth
	return fmt.Sprintf("%x-%x-%x-%x-%x",
			agent.ID.Bytes[0:4], agent.ID.Bytes[4:6], agent.ID.Bytes[6:8],
			agent.ID.Bytes[8:10], agent.ID.Bytes[10:16]),
		"cc_sk_" + name + "_test_key"
}

// Helper to create a test store (simplified for basic tests)
func createTestStore(t *testing.T, pool *pgxpool.Pool, agentID string) string {
	t.Helper()
	// For full integration tests, we would create store via direct SQL
	// This is a placeholder that returns a dummy ID
	return "00000000-0000-0000-0000-000000000001"
}

func TestOrderFlow(t *testing.T) {
	if testPool == nil {
		t.Skip("No test database available")
	}

	// This is a basic structure test - full integration would need proper auth setup
	t.Run("Order handler exists", func(t *testing.T) {
		h := handler.NewOrderHandler(testPool, "0x1234")
		if h == nil {
			t.Error("OrderHandler should not be nil")
		}
	})

	t.Run("ProductHandler exists", func(t *testing.T) {
		h := handler.NewProductHandler(testPool)
		if h == nil {
			t.Error("ProductHandler should not be nil")
		}
	})

	t.Run("WalletHandler exists", func(t *testing.T) {
		h := handler.NewWalletHandler(testPool)
		if h == nil {
			t.Error("WalletHandler should not be nil")
		}
	})
}

func TestOrderHandlerEndpoints(t *testing.T) {
	if testPool == nil {
		t.Skip("No test database available")
	}

	router := setupTestRouter(testPool)

	t.Run("CreateOrder requires auth", func(t *testing.T) {
		body := map[string]interface{}{
			"product_id":   "00000000-0000-0000-0000-000000000000",
			"buyer_wallet": "0x1234567890123456789012345678901234567890",
		}
		jsonBody, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/api/v1/orders", bytes.NewReader(jsonBody))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected 401, got %d", w.Code)
		}
	})

	t.Run("ListOrders requires auth", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/orders", nil)

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected 401, got %d", w.Code)
		}
	})

	t.Run("GetOrder requires auth", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/orders/00000000-0000-0000-0000-000000000000", nil)

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected 401, got %d", w.Code)
		}
	})

	t.Run("MarkOrderPaid requires auth", func(t *testing.T) {
		body := map[string]string{"tx_hash": "0xabc123"}
		jsonBody, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/api/v1/orders/00000000-0000-0000-0000-000000000000/paid", bytes.NewReader(jsonBody))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected 401, got %d", w.Code)
		}
	})

	t.Run("CompleteOrder requires auth", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/v1/orders/00000000-0000-0000-0000-000000000000/complete", nil)

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected 401, got %d", w.Code)
		}
	})

	t.Run("CancelOrder requires auth", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/v1/orders/00000000-0000-0000-0000-000000000000/cancel", nil)

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected 401, got %d", w.Code)
		}
	})
}

func TestProductHandlerEndpoints(t *testing.T) {
	if testPool == nil {
		t.Skip("No test database available")
	}

	router := setupTestRouter(testPool)

	t.Run("CreateProduct requires auth", func(t *testing.T) {
		body := map[string]interface{}{
			"name":             "Test Product",
			"price_usdc":       1000000,
			"delivery_content": "test content",
		}
		jsonBody, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/api/v1/products", bytes.NewReader(jsonBody))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected 401, got %d", w.Code)
		}
	})

	t.Run("ListMyProducts requires auth", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/products/mine", nil)

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected 401, got %d", w.Code)
		}
	})
}

func TestWalletHandlerEndpoints(t *testing.T) {
	if testPool == nil {
		t.Skip("No test database available")
	}

	router := setupTestRouter(testPool)

	t.Run("BindWallet requires auth", func(t *testing.T) {
		body := map[string]string{
			"address": "0x1234567890123456789012345678901234567890",
			"chain":   "base",
		}
		jsonBody, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/api/v1/wallets", bytes.NewReader(jsonBody))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected 401, got %d", w.Code)
		}
	})

	t.Run("ListWallets requires auth", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/wallets", nil)

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected 401, got %d", w.Code)
		}
	})
}
