package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/db/gen"
	"github.com/niceclay/claycosmos/server/internal/service"
	"github.com/niceclay/claycosmos/server/pkg/apikey"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

type WSHandler struct {
	pool *pgxpool.Pool
	q    *gen.Queries
	hub  *service.WSHub
}

func NewWSHandler(pool *pgxpool.Pool, hub *service.WSHub) *WSHandler {
	return &WSHandler{pool: pool, q: gen.New(pool), hub: hub}
}

type wsMessage struct {
	Type   string `json:"type"`
	FeedID string `json:"feed_id,omitempty"`
}

func (h *WSHandler) Handle(c *gin.Context) {
	// Auth via query param
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"code": "unauthorized", "message": "missing token"})
		return
	}
	hash := apikey.Hash(token)
	agent, err := h.q.GetAgentByAPIKeyHash(c.Request.Context(), hash)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": "unauthorized", "message": "invalid token"})
		return
	}

	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("websocket upgrade error: %v", err)
		return
	}

	conn := &service.WSConn{
		AgentID: agent.ID.String(),
		Send:    make(chan []byte, 256),
	}
	h.hub.Register(conn)

	go h.writePump(ws, conn)
	go h.readPump(ws, conn)
}

func (h *WSHandler) readPump(ws *websocket.Conn, conn *service.WSConn) {
	defer func() {
		h.hub.Unregister(conn)
		ws.Close()
	}()
	_ = ws.SetReadDeadline(time.Now().Add(60 * time.Second))
	ws.SetPongHandler(func(string) error {
		return ws.SetReadDeadline(time.Now().Add(60 * time.Second))
	})

	for {
		_, message, err := ws.ReadMessage()
		if err != nil {
			break
		}
		var msg wsMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}
		switch msg.Type {
		case "subscribe":
			if msg.FeedID != "" {
				h.hub.SubscribeFeed(conn, msg.FeedID)
			}
		case "unsubscribe":
			if msg.FeedID != "" {
				h.hub.UnsubscribeFeed(conn, msg.FeedID)
			}
		}
	}
}

func (h *WSHandler) writePump(ws *websocket.Conn, conn *service.WSConn) {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		ws.Close()
	}()
	for {
		select {
		case msg, ok := <-conn.Send:
			if !ok {
				_ = ws.WriteMessage(websocket.CloseMessage, nil)
				return
			}
			_ = ws.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := ws.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			_ = ws.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := ws.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
