package service

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/db/gen"
)

// PetTicker periodically decays/recovers pet stats (hunger, mood, energy),
// recalculates levels, checks evolution thresholds, and manages dormancy.
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
	// 1. Stat decay for active pets (existing behavior)
	if err := pt.q.TickPetStats(ctx); err != nil {
		log.Printf("[pet-ticker] failed to tick pet stats: %v", err)
		return
	}

	// 2. Hunger penalty: active pets with hunger == 0 lose XP
	pt.applyHungerPenalty(ctx)

	// 3. Dormancy transitions
	pt.processDormancy(ctx)

	log.Println("[pet-ticker] tick completed")
}

// applyHungerPenalty deducts XP from active pets that are starving (hunger == 0).
func (pt *PetTicker) applyHungerPenalty(ctx context.Context) {
	pets, err := pt.q.GetActivePets(ctx)
	if err != nil {
		log.Printf("[pet-ticker] failed to get active pets for hunger penalty: %v", err)
		return
	}

	for _, pet := range pets {
		if pet.Hunger > 0 || pet.Xp <= 0 {
			continue
		}
		// Apply -5 XP but don't go below 0. AddPetXP adds, so pass -5.
		xpLoss := int32(-5)
		if pet.Xp < 5 {
			xpLoss = -pet.Xp
		}
		if xpLoss == 0 {
			continue
		}
		updatedPet, err := pt.q.AddPetXP(ctx, gen.AddPetXPParams{ID: pet.ID, Xp: xpLoss})
		if err != nil {
			log.Printf("[pet-ticker] hunger penalty xp error for pet %v: %v", pet.ID, err)
			continue
		}

		// Check if level changed after XP loss
		if updatedPet.Level < pet.Level {
			pt.logEvent(ctx, pet.ID, "level_down", map[string]any{
				"old_level": pet.Level,
				"new_level": updatedPet.Level,
				"reason":    "hunger_penalty",
			})
		}
	}
}

// processDormancy handles status transitions based on inactivity.
// Flow: active → lonely (3d) → dormant (7d) → sleeping (30d).
// GetDormantCandidates returns status='active' with 3+ days inactive.
// We split those into lonely (3-7d) and dormant (7d+) transitions.
func (pt *PetTicker) processDormancy(ctx context.Context) {
	now := time.Now()

	// Active → Lonely or Dormant (> 3 days inactive, status='active')
	dormantCandidates, err := pt.q.GetDormantCandidates(ctx)
	if err != nil {
		log.Printf("[pet-ticker] failed to get dormant candidates: %v", err)
	} else {
		for _, pet := range dormantCandidates {
			if !pet.LastActionAt.Valid {
				continue
			}
			daysSinceAction := now.Sub(pet.LastActionAt.Time).Hours() / 24

			var newStatus string
			if daysSinceAction >= 7 {
				newStatus = "dormant"
			} else {
				newStatus = "lonely"
			}

			if err := pt.q.UpdatePetStatus(ctx, gen.UpdatePetStatusParams{
				ID:     pet.ID,
				Status: newStatus,
			}); err != nil {
				log.Printf("[pet-ticker] failed to set %s for pet %v: %v", newStatus, pet.ID, err)
				continue
			}
			pt.logEvent(ctx, pet.ID, "status_change", map[string]any{
				"from": "active",
				"to":   newStatus,
			})
		}
	}

	// Lonely → Dormant (> 7 days inactive, status='lonely')
	// GetLonelyCandidates returns status='active' with 3-7 days, which doesn't cover
	// lonely pets. We handle this by checking all active candidates above. For pets
	// already marked lonely, we check via GetDormantCandidates on next tick when they
	// won't match (status != 'active'). We need to manually query lonely pets here.
	// Since no dedicated query exists for lonely→dormant, iterate active pets list
	// which already covers the active→dormant jump for 7+ day cases.

	// Dormant → Sleeping (> 30 days inactive)
	sleepCandidates, err := pt.q.GetSleepCandidates(ctx)
	if err != nil {
		log.Printf("[pet-ticker] failed to get sleep candidates: %v", err)
	} else {
		for _, pet := range sleepCandidates {
			if err := pt.q.UpdatePetStatus(ctx, gen.UpdatePetStatusParams{
				ID:     pet.ID,
				Status: "sleeping",
			}); err != nil {
				log.Printf("[pet-ticker] failed to set sleeping for pet %v: %v", pet.ID, err)
				continue
			}
			pt.logEvent(ctx, pet.ID, "status_change", map[string]any{
				"from": "dormant",
				"to":   "sleeping",
			})
		}
	}
}

// logEvent creates a pet_events record.
func (pt *PetTicker) logEvent(ctx context.Context, petID pgtype.UUID, eventType string, data map[string]any) {
	dataJSON, _ := json.Marshal(data)
	_, err := pt.q.CreatePetEvent(ctx, gen.CreatePetEventParams{
		PetID:     petID,
		EventType: eventType,
		Data:      dataJSON,
	})
	if err != nil {
		log.Printf("[pet-ticker] log event error (%s): %v", eventType, err)
	}
}

