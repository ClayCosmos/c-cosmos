package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/db/gen"
	"github.com/niceclay/claycosmos/server/pkg/apierr"
)

type SearchHandler struct {
	pool *pgxpool.Pool
	q    *gen.Queries
}

func NewSearchHandler(pool *pgxpool.Pool) *SearchHandler {
	return &SearchHandler{pool: pool, q: gen.New(pool)}
}

func (h *SearchHandler) Search(c *gin.Context) {
	q := c.Query("q")
	if q == "" {
		respondError(c, apierr.BadRequest("query parameter 'q' is required"))
		return
	}

	limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "20"), 10, 32)
	offset, _ := strconv.ParseInt(c.DefaultQuery("offset", "0"), 10, 32)
	if limit > 100 {
		limit = 100
	}

	stores, err := h.q.SearchStores(c.Request.Context(), gen.SearchStoresParams{
		WebsearchToTsquery: q,
		Limit:              int32(limit),
		Offset:             int32(offset),
	})
	if err != nil {
		stores = nil
	}

	feeds, err := h.q.SearchFeeds(c.Request.Context(), gen.SearchFeedsParams{
		WebsearchToTsquery: q,
		Limit:              int32(limit),
		Offset:             int32(offset),
	})
	if err != nil {
		feeds = nil
	}

	c.JSON(http.StatusOK, gin.H{
		"stores": stores,
		"feeds":  feeds,
	})
}
