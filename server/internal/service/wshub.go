package service

import (
	"context"
	"encoding/json"
	"sync"
)

// WSHub maintains active WebSocket connections and their feed subscriptions.
type WSHub struct {
	mu    sync.RWMutex
	conns map[*WSConn]map[string]bool // conn -> set of feedIDs
	feeds map[string]map[*WSConn]bool // feedID -> set of conns
}

type WSConn struct {
	AgentID string
	Send    chan []byte
}

func NewWSHub() *WSHub {
	return &WSHub{
		conns: make(map[*WSConn]map[string]bool),
		feeds: make(map[string]map[*WSConn]bool),
	}
}

func (h *WSHub) Run(ctx context.Context) {
	<-ctx.Done()
	// Cleanup on shutdown
	h.mu.Lock()
	defer h.mu.Unlock()
	for conn := range h.conns {
		close(conn.Send)
	}
}

func (h *WSHub) Register(conn *WSConn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.conns[conn] = make(map[string]bool)
}

func (h *WSHub) Unregister(conn *WSConn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for feedID := range h.conns[conn] {
		delete(h.feeds[feedID], conn)
	}
	delete(h.conns, conn)
}

func (h *WSHub) SubscribeFeed(conn *WSConn, feedID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.conns[conn] == nil {
		h.conns[conn] = make(map[string]bool)
	}
	h.conns[conn][feedID] = true
	if h.feeds[feedID] == nil {
		h.feeds[feedID] = make(map[*WSConn]bool)
	}
	h.feeds[feedID][conn] = true
}

func (h *WSHub) UnsubscribeFeed(conn *WSConn, feedID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.conns[conn], feedID)
	delete(h.feeds[feedID], conn)
}

func (h *WSHub) BroadcastToFeed(feedID string, data []byte) {
	msg, _ := json.Marshal(map[string]any{
		"type":    "item",
		"feed_id": feedID,
		"data":    json.RawMessage(data),
	})

	h.mu.RLock()
	conns := h.feeds[feedID]
	h.mu.RUnlock()

	for conn := range conns {
		select {
		case conn.Send <- msg:
		default:
			// Drop message if channel full
		}
	}
}
