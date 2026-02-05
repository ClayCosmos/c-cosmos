package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/db/gen"
	"github.com/niceclay/claycosmos/server/internal/handler"
)

// SettlementRecovery periodically retries failed x402 settlements.
type SettlementRecovery struct {
	pool *pgxpool.Pool
	q    *gen.Queries
}

func NewSettlementRecovery(pool *pgxpool.Pool) *SettlementRecovery {
	return &SettlementRecovery{pool: pool, q: gen.New(pool)}
}

// Start launches the background recovery goroutine.
func (sr *SettlementRecovery) Start(ctx context.Context) {
	go sr.run(ctx)
}

func (sr *SettlementRecovery) run(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			sr.recover(ctx)
		}
	}
}

func (sr *SettlementRecovery) recover(ctx context.Context) {
	settlements, err := sr.q.ListUnrecoveredSettlements(ctx)
	if err != nil || len(settlements) == 0 {
		return
	}

	for _, s := range settlements {
		// Check if an order already exists for this payment signature hash (dedup)
		if s.PaymentSigHash != "" {
			existingOrder, err := sr.q.GetOrderByPaymentSigHash(ctx, pgtype.Text{String: s.PaymentSigHash, Valid: true})
			if err == nil {
				// Order already exists — mark settlement as recovered without creating a new order
				if err := sr.q.MarkSettlementRecovered(ctx, gen.MarkSettlementRecoveredParams{
					ID:               s.ID,
					RecoveredOrderID: existingOrder.ID,
				}); err != nil {
					log.Printf("[recovery] failed to mark settlement %s as recovered (existing order): %v", pgtypeUUIDToStr(s.ID), err)
				} else {
					log.Printf("[recovery] settlement %s already has order %s — marked recovered", pgtypeUUIDToStr(s.ID), existingOrder.OrderNo)
				}
				continue
			}
		}

		if err := sr.q.IncrementSettlementAttempts(ctx, s.ID); err != nil {
			log.Printf("[recovery] failed to increment attempts for settlement %s: %v", pgtypeUUIDToStr(s.ID), err)
			continue
		}

		orderNo := handler.GenerateOrderNo()
		order, err := sr.q.CreateInstantOrder(ctx, gen.CreateInstantOrderParams{
			OrderNo:         orderNo,
			ProductID:       s.ProductID,
			BuyerAgentID:    s.BuyerAgentID,
			SellerAgentID:   s.SellerAgentID,
			BuyerWallet:     s.BuyerWallet,
			SellerWallet:    s.SellerWallet,
			AmountUsdc:      s.AmountUsdc,
			EscrowOrderID:   "0x0000000000000000000000000000000000000000000000000000000000000000",
			EscrowContract:  "x402",
			TxHash:          pgtype.Text{String: s.TxHash, Valid: true},
			DeliveryContent: s.DeliveryContent,
			ShippingAddress: nil,
			PaymentSigHash:  pgtype.Text{String: s.PaymentSigHash, Valid: true},
		})
		if err != nil {
			log.Printf("[recovery] retry failed for settlement %s (attempt %d): %v",
				pgtypeUUIDToStr(s.ID), s.Attempts.Int32+1, err)
			continue
		}

		if err := sr.q.MarkSettlementRecovered(ctx, gen.MarkSettlementRecoveredParams{
			ID:               s.ID,
			RecoveredOrderID: order.ID,
		}); err != nil {
			log.Printf("[recovery] failed to mark settlement %s as recovered: %v", pgtypeUUIDToStr(s.ID), err)
			continue
		}

		log.Printf("[recovery] successfully recovered settlement %s → order %s", pgtypeUUIDToStr(s.ID), order.OrderNo)
	}
}

func pgtypeUUIDToStr(id pgtype.UUID) string {
	if !id.Valid {
		return ""
	}
	b := id.Bytes
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
