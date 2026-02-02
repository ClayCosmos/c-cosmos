package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

type subscriberInfo struct {
	WebhookURL *string
}

// PushService manages Redis pub/sub and fan-out to WebSocket connections and webhooks.
type PushService struct {
	rdb         *redis.Client
	mu          sync.RWMutex
	subscribers map[string]map[string]*subscriberInfo // feedID -> agentID -> info
	wsHub       *WSHub
}

func NewPushService(rdb *redis.Client) *PushService {
	ps := &PushService{
		rdb:         rdb,
		subscribers: make(map[string]map[string]*subscriberInfo),
		wsHub:       NewWSHub(),
	}
	return ps
}

func (ps *PushService) Hub() *WSHub {
	return ps.wsHub
}

// Start begins listening on Redis pub/sub for feed:* channels.
func (ps *PushService) Start(ctx context.Context) {
	go ps.wsHub.Run(ctx)

	pubsub := ps.rdb.PSubscribe(ctx, "feed:*")
	ch := pubsub.Channel()

	go func() {
		defer pubsub.Close()
		for {
			select {
			case <-ctx.Done():
				return
			case msg := <-ch:
				if msg == nil {
					return
				}
				feedID := msg.Channel[len("feed:"):]
				ps.fanOut(feedID, []byte(msg.Payload))
			}
		}
	}()
}

// Publish sends a message to the Redis channel for a feed.
func (ps *PushService) Publish(ctx context.Context, feedID string, data []byte) {
	ps.rdb.Publish(ctx, "feed:"+feedID, data)
}

// AddSubscription registers an agent's subscription in-memory for push routing.
func (ps *PushService) AddSubscription(feedID, agentID string, webhookURL *string) {
	ps.mu.Lock()
	defer ps.mu.Unlock()
	if ps.subscribers[feedID] == nil {
		ps.subscribers[feedID] = make(map[string]*subscriberInfo)
	}
	ps.subscribers[feedID][agentID] = &subscriberInfo{WebhookURL: webhookURL}
}

// RemoveSubscription removes an agent's subscription from memory.
func (ps *PushService) RemoveSubscription(feedID, agentID string) {
	ps.mu.Lock()
	defer ps.mu.Unlock()
	delete(ps.subscribers[feedID], agentID)
}

func (ps *PushService) fanOut(feedID string, data []byte) {
	// Push to WebSocket connections
	ps.wsHub.BroadcastToFeed(feedID, data)

	// Push to webhook subscribers
	ps.mu.RLock()
	subs := ps.subscribers[feedID]
	ps.mu.RUnlock()

	for _, info := range subs {
		if info.WebhookURL != nil && *info.WebhookURL != "" {
			go ps.webhookPost(*info.WebhookURL, feedID, data)
		}
	}
}

func (ps *PushService) webhookPost(url, feedID string, data []byte) {
	payload, _ := json.Marshal(map[string]any{
		"feed_id": feedID,
		"item":    json.RawMessage(data),
	})

	for attempt := 0; attempt < 3; attempt++ {
		resp, err := http.Post(url, "application/json", bytes.NewReader(payload))
		if err == nil && resp.StatusCode < 300 {
			resp.Body.Close()
			return
		}
		if resp != nil {
			resp.Body.Close()
		}
		backoff := time.Duration(math.Pow(2, float64(attempt))) * time.Second
		log.Printf("webhook push to %s failed (attempt %d), retrying in %v", url, attempt+1, backoff)
		time.Sleep(backoff)
	}
	fmt.Printf("webhook push to %s failed after 3 attempts for feed %s\n", url, feedID)
}
