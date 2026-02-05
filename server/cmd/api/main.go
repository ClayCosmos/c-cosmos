package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/config"
	"github.com/niceclay/claycosmos/server/internal/redisclient"
	"github.com/niceclay/claycosmos/server/internal/router"
	"github.com/niceclay/claycosmos/server/internal/service"
)

func main() {
	cfg := config.Load()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// PostgreSQL
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect to postgres: %v", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("ping postgres: %v", err)
	}
	log.Println("connected to PostgreSQL")

	// Redis (nil if unavailable — graceful degradation)
	rdb := redisclient.Connect(ctx, cfg.RedisURL)
	if rdb != nil {
		defer rdb.Close()
	}

	// Chain listener (disabled when RPC_URL is empty)
	if cfg.RPCURL != "" {
		listener, listenerErr := service.NewChainListener(pool, rdb, cfg)
		if listenerErr != nil {
			log.Printf("chain listener init failed: %v", listenerErr)
		} else {
			listener.Start(ctx)
			log.Println("chain listener started")
		}
	}

	// Settlement recovery (retries failed x402 order recordings)
	recovery := service.NewSettlementRecovery(pool)
	recovery.Start(ctx)
	log.Println("settlement recovery started")

	// HTTP server
	r := router.Setup(pool, rdb, cfg)

	go func() {
		log.Printf("server listening on :%s", cfg.Port)
		if err := r.Run(":" + cfg.Port); err != nil {
			log.Fatalf("server error: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("shutting down...")
	cancel()
}
