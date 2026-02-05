package redisclient

import (
	"context"
	"log"

	"github.com/redis/go-redis/v9"
)

// Connect parses the Redis URL and returns a connected client.
// Returns nil if redisURL is empty (graceful degradation).
func Connect(ctx context.Context, redisURL string) *redis.Client {
	if redisURL == "" {
		log.Println("REDIS_URL not set, running without Redis")
		return nil
	}

	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Printf("failed to parse REDIS_URL: %v, running without Redis", err)
		return nil
	}

	rdb := redis.NewClient(opts)
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Printf("failed to connect to Redis: %v, running without Redis", err)
		_ = rdb.Close()
		return nil
	}

	log.Println("connected to Redis")
	return rdb
}
