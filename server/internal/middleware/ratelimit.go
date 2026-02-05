package middleware

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

type visitor struct {
	count    int
	lastSeen time.Time
}

// RateLimit returns a rate limiter middleware backed by Redis.
// If rdb is nil, falls back to in-memory limiting.
func RateLimit(rdb *redis.Client, limit int, window time.Duration) gin.HandlerFunc {
	if rdb == nil {
		return rateLimitInMemory(limit, window)
	}
	return rateLimitRedis(rdb, limit, window)
}

func rateLimitRedis(rdb *redis.Client, limit int, window time.Duration) gin.HandlerFunc {
	windowSec := int(window.Seconds())

	return func(c *gin.Context) {
		ip := c.ClientIP()
		key := fmt.Sprintf("ratelimit:%s", ip)
		ctx := context.Background()

		count, err := rdb.Incr(ctx, key).Result()
		if err != nil {
			// Redis error — allow request through
			c.Next()
			return
		}

		if count == 1 {
			rdb.Expire(ctx, key, time.Duration(windowSec)*time.Second)
		}

		if count > int64(limit) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"code": "rate_limited", "message": "too many requests"})
			return
		}

		c.Next()
	}
}

// rateLimitInMemory is the fallback when Redis is unavailable.
func rateLimitInMemory(limit int, window time.Duration) gin.HandlerFunc {
	var mu sync.Mutex
	visitors := make(map[string]*visitor)

	go func() {
		for {
			time.Sleep(window)
			mu.Lock()
			for ip, v := range visitors {
				if time.Since(v.lastSeen) > window {
					delete(visitors, ip)
				}
			}
			mu.Unlock()
		}
	}()

	return func(c *gin.Context) {
		ip := c.ClientIP()
		mu.Lock()
		v, exists := visitors[ip]
		if !exists {
			visitors[ip] = &visitor{count: 1, lastSeen: time.Now()}
			mu.Unlock()
			c.Next()
			return
		}
		if time.Since(v.lastSeen) > window {
			v.count = 1
			v.lastSeen = time.Now()
			mu.Unlock()
			c.Next()
			return
		}
		v.count++
		v.lastSeen = time.Now()
		if v.count > limit {
			mu.Unlock()
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"code": "rate_limited", "message": "too many requests"})
			return
		}
		mu.Unlock()
		c.Next()
	}
}
