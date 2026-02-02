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
	"github.com/niceclay/claycosmos/server/internal/service"
	"github.com/redis/go-redis/v9"
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

	// Redis
	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatalf("parse redis url: %v", err)
	}
	rdb := redis.NewClient(opt)
	defer rdb.Close()
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("ping redis: %v", err)
	}
	log.Println("connected to Redis")

	// Push service
	push := service.NewPushService(rdb)
	push.Start(ctx)

	// HTTP server
	r := router.Setup(pool, push)

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
	migration, err := os.ReadFile("internal/db/migrations/001_init.up.sql")
	if err != nil {
		log.Fatalf("read migration file: %v", err)
	}
	if _, err := pool.Exec(ctx, string(migration)); err != nil {
		log.Fatalf("run migration: %v", err)
	}
	log.Println("migrations complete")
}
