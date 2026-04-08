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

	rawProducts, err := h.q.SearchProducts(c.Request.Context(), gen.SearchProductsParams{
		PlaintoTsquery: q,
		Limit:          int32(limit),
		Offset:         int32(offset),
	})
	if err != nil {
		rawProducts = nil
	}

	// Strip delivery_content from search results — it is paid content.
	products := make([]ProductDetailResponse, len(rawProducts))
	for i, p := range rawProducts {
		imageURLs := p.ImageUrls
		if imageURLs == nil {
			imageURLs = []string{}
		}
		products[i] = ProductDetailResponse{
			ProductResponse: ProductResponse{
				ID:               pgtypeUUIDToString(p.ID),
				StoreID:          pgtypeUUIDToString(p.StoreID),
				Name:             p.Name,
				Slug:             p.Slug,
				Description:      p.Description.String,
				PriceUSDC:        p.PriceUsdc,
				PriceUSD:         float64(p.PriceUsdc) / 1_000_000,
				ImageURLs:        imageURLs,
				ExternalURL:      p.ExternalUrl.String,
				RequiresShipping: p.RequiresShipping,
				PaymentMode:      p.PaymentMode,
				Stock:            p.Stock.Int32,
				Status:           p.Status,
				CreatedAt:        p.CreatedAt.Time,
				UpdatedAt:        p.UpdatedAt.Time,
			},
			StoreName: p.StoreName,
			StoreSlug: p.StoreSlug,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"stores":   stores,
		"products": products,
	})
}
