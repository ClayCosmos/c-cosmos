package service

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/db/gen"
)

// PetTicker periodically decays/recovers pet stats (hunger, mood, energy).
type PetTicker struct {
	pool *pgxpool.Pool
	q    *gen.Queries
}

func NewPetTicker(pool *pgxpool.Pool) *PetTicker {
	return &PetTicker{pool: pool, q: gen.New(pool)}
}

// Start launches the background tick goroutine.
func (pt *PetTicker) Start(ctx context.Context) {
	go pt.run(ctx)
}

func (pt *PetTicker) run(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	// Run once on startup
	pt.tick(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			pt.tick(ctx)
		}
	}
}

func (pt *PetTicker) tick(ctx context.Context) {
	if err := pt.q.TickPetStats(ctx); err != nil {
		log.Printf("[pet-ticker] failed to tick pet stats: %v", err)
		return
	}
	log.Println("[pet-ticker] tick completed")
}
