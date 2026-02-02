package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type visitor struct {
	count    int
	lastSeen time.Time
}

// RateLimit returns a simple in-memory rate limiter middleware.
// limit is the max number of requests per window.
func RateLimit(limit int, window time.Duration) gin.HandlerFunc {
	var mu sync.Mutex
	visitors := make(map[string]*visitor)

	// Cleanup goroutine
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
