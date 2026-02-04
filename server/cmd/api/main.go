package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/config"
	"github.com/niceclay/claycosmos/server/internal/router"
)

func main() {
	migrate := flag.Bool("migrate", false, "run database migrations and exit")
	flag.Parse()

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

	if *migrate {
		runMigrations(pool, ctx)
		return
	}

	// HTTP server
	r := router.Setup(pool)

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

func runMigrations(pool *pgxpool.Pool, ctx context.Context) {
	migrations := []string{
		"internal/db/migrations/001_init.up.sql",
		"internal/db/migrations/002_trading.up.sql",
		"internal/db/migrations/003_remove_feeds.up.sql",
	}

	for _, path := range migrations {
		migration, err := os.ReadFile(path)
		if err != nil {
			log.Printf("skip migration %s: %v", path, err)
			continue
		}
		if _, err := pool.Exec(ctx, string(migration)); err != nil {
			log.Printf("migration %s: %v (may already be applied)", path, err)
		} else {
			log.Printf("migration %s: applied", path)
		}
	}
	log.Println("migrations complete")
}
