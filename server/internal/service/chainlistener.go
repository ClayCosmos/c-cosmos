package service

import (
	"context"
	"crypto/ecdsa"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/config"
	"github.com/niceclay/claycosmos/server/internal/db/gen"
	"github.com/redis/go-redis/v9"
)

// Event topic hashes (keccak256 of event signatures)
var (
	orderCreatedTopic   = ethcrypto.Keccak256Hash([]byte("OrderCreated(bytes32,address,address,address,uint256,uint256)"))
	orderCompletedTopic = ethcrypto.Keccak256Hash([]byte("OrderCompleted(bytes32,uint256)"))
	orderCancelledTopic = ethcrypto.Keccak256Hash([]byte("OrderCancelled(bytes32,uint256)"))
)

const lastBlockRedisKey = "chainlistener:lastblock"

// autoComplete(bytes32) selector
var autoCompleteSelector = ethcrypto.Keccak256([]byte("autoComplete(bytes32)"))[:4]

// ChainListener polls a SimpleEscrow contract for events and updates order status.
type ChainListener struct {
	pool         *pgxpool.Pool
	q            *gen.Queries
	client       *ethclient.Client
	rdb          *redis.Client
	contractAddr common.Address
	chain        string
	chainID      *big.Int
	pollInterval time.Duration
	lastBlock    uint64
	keeperKey    *ecdsa.PrivateKey // nil = keeper disabled
}

// NewChainListener creates a new chain listener. Returns an error if the RPC connection fails.
func NewChainListener(pool *pgxpool.Pool, rdb *redis.Client, cfg *config.Config) (*ChainListener, error) {
	client, err := ethclient.Dial(cfg.RPCURL)
	if err != nil {
		return nil, fmt.Errorf("dial rpc: %w", err)
	}

	contractAddr := cfg.EscrowContract
	if contractAddr == "" {
		if cfg.X402Network == "base" {
			contractAddr = "0x42f8E9D601911aA7ED415A9657a5F955E1D443c3" // Base Mainnet
		} else {
			contractAddr = "0xcB2CEB939e955a28c9d4ADC0358C0B959F5ec9ce" // Base Sepolia
		}
	}

	cl := &ChainListener{
		pool:         pool,
		q:            gen.New(pool),
		client:       client,
		rdb:          rdb,
		contractAddr: common.HexToAddress(contractAddr),
		chain:        cfg.X402Network,
		pollInterval: cfg.ChainPollInterval,
	}

	// Resolve chain ID
	chainID, err := client.ChainID(context.Background())
	if err != nil {
		return nil, fmt.Errorf("get chain id: %w", err)
	}
	cl.chainID = chainID

	// Set up keeper key if configured
	if cfg.KeeperPrivateKey != "" {
		key, err := ethcrypto.HexToECDSA(strings.TrimPrefix(cfg.KeeperPrivateKey, "0x"))
		if err != nil {
			return nil, fmt.Errorf("parse keeper private key: %w", err)
		}
		cl.keeperKey = key
		addr := ethcrypto.PubkeyToAddress(key.PublicKey)
		log.Printf("chainlistener: keeper enabled, address=%s", addr.Hex())
	}

	return cl, nil
}

// Start launches the polling goroutine. Exits when ctx is cancelled.
func (cl *ChainListener) Start(ctx context.Context) {
	cl.lastBlock = cl.loadLastBlock(ctx)
	go cl.run(ctx)
}

func (cl *ChainListener) run(ctx context.Context) {
	ticker := time.NewTicker(cl.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := cl.poll(ctx); err != nil {
				log.Printf("chainlistener poll error: %v", err)
			}
			cl.checkOverdueOrders(ctx)
		}
	}
}

func (cl *ChainListener) poll(ctx context.Context) error {
	latest, err := cl.client.BlockNumber(ctx)
	if err != nil {
		return fmt.Errorf("get block number: %w", err)
	}

	if latest <= cl.lastBlock {
		return nil
	}

	fromBlock := cl.lastBlock + 1
	// Cap batch size to avoid huge queries (CDP RPC limits to 1000 blocks)
	toBlock := latest
	if toBlock-fromBlock > 999 {
		toBlock = fromBlock + 999
	}

	query := ethereum.FilterQuery{
		FromBlock: new(big.Int).SetUint64(fromBlock),
		ToBlock:   new(big.Int).SetUint64(toBlock),
		Addresses: []common.Address{cl.contractAddr},
		Topics:    [][]common.Hash{{orderCreatedTopic, orderCompletedTopic, orderCancelledTopic}},
	}

	logs, err := cl.client.FilterLogs(ctx, query)
	if err != nil {
		return fmt.Errorf("filter logs: %w", err)
	}

	for i := range logs {
		if err := cl.processLog(ctx, &logs[i]); err != nil {
			log.Printf("chainlistener process log error (tx=%s idx=%d): %v", logs[i].TxHash.Hex(), logs[i].Index, err)
		}
	}

	cl.lastBlock = toBlock
	cl.saveLastBlock(ctx, toBlock)
	return nil
}

func (cl *ChainListener) processLog(ctx context.Context, lg *types.Log) error {
	if len(lg.Topics) == 0 {
		return nil
	}

	txHash := lg.TxHash.Hex()
	eventData, _ := json.Marshal(map[string]any{
		"topics":       topicsToStrings(lg.Topics),
		"data":         common.Bytes2Hex(lg.Data),
		"block_number": lg.BlockNumber,
	})

	// Idempotent insert — ON CONFLICT DO NOTHING
	_, err := cl.q.CreateBlockchainEvent(ctx, gen.CreateBlockchainEventParams{
		Chain:       cl.chain,
		TxHash:      txHash,
		LogIndex:    int32(lg.Index),
		BlockNumber: int64(lg.BlockNumber),
		EventName:   cl.eventName(lg.Topics[0]),
		EventData:   eventData,
	})
	if err != nil {
		// ON CONFLICT DO NOTHING returns no rows — treat as already processed
		return nil
	}

	switch lg.Topics[0] {
	case orderCreatedTopic:
		return cl.handleOrderCreated(ctx, lg, txHash)
	case orderCompletedTopic:
		return cl.handleOrderCompleted(ctx, lg, txHash)
	case orderCancelledTopic:
		return cl.handleOrderCancelled(ctx, lg, txHash)
	}
	return nil
}

func (cl *ChainListener) handleOrderCreated(ctx context.Context, lg *types.Log, txHash string) error {
	if len(lg.Topics) < 2 {
		return nil
	}
	orderId := "0x" + common.Bytes2Hex(lg.Topics[1].Bytes())

	order, err := cl.q.GetOrderByEscrowID(ctx, gen.GetOrderByEscrowIDParams{
		EscrowContract: strings.ToLower(cl.contractAddr.Hex()),
		EscrowOrderID:  orderId,
	})
	if err != nil {
		// Try with checksummed address
		order, err = cl.q.GetOrderByEscrowID(ctx, gen.GetOrderByEscrowIDParams{
			EscrowContract: cl.contractAddr.Hex(),
			EscrowOrderID:  orderId,
		})
		if err != nil {
			log.Printf("chainlistener: order not found for escrow_order_id=%s", orderId)
			return nil
		}
	}

	if order.Status != "pending" {
		return nil
	}

	// Mark as paid
	if _, err := cl.q.UpdateOrderPaid(ctx, gen.UpdateOrderPaidParams{
		ID:     order.ID,
		TxHash: pgtype.Text{String: txHash, Valid: true},
	}); err != nil {
		return fmt.Errorf("update order paid: %w", err)
	}

	// Deliver content
	product, err := cl.q.GetProductByID(ctx, order.ProductID)
	if err == nil && product.DeliveryContent.Valid {
		_, _ = cl.q.UpdateOrderDelivered(ctx, gen.UpdateOrderDeliveredParams{
			ID:              order.ID,
			DeliveryContent: product.DeliveryContent,
		})
	}

	// Decrement stock
	_, _ = cl.q.DecrementProductStock(ctx, order.ProductID)

	log.Printf("chainlistener: order %s marked paid (tx=%s)", order.OrderNo, txHash)
	return nil
}

func (cl *ChainListener) handleOrderCompleted(ctx context.Context, lg *types.Log, txHash string) error {
	if len(lg.Topics) < 2 {
		return nil
	}
	orderId := "0x" + common.Bytes2Hex(lg.Topics[1].Bytes())

	order, err := cl.q.GetOrderByEscrowID(ctx, gen.GetOrderByEscrowIDParams{
		EscrowContract: cl.contractAddr.Hex(),
		EscrowOrderID:  orderId,
	})
	if err != nil {
		return nil
	}

	if order.Status != "paid" {
		return nil
	}

	if _, err := cl.q.UpdateOrderCompleted(ctx, gen.UpdateOrderCompletedParams{
		ID:             order.ID,
		CompleteTxHash: pgtype.Text{String: txHash, Valid: true},
	}); err != nil {
		return fmt.Errorf("update order completed: %w", err)
	}

	cl.recalculateStats(ctx, order.BuyerAgentID, order.SellerAgentID)
	log.Printf("chainlistener: order %s completed (tx=%s)", order.OrderNo, txHash)
	return nil
}

func (cl *ChainListener) handleOrderCancelled(ctx context.Context, lg *types.Log, _ string) error {
	if len(lg.Topics) < 2 {
		return nil
	}
	orderId := "0x" + common.Bytes2Hex(lg.Topics[1].Bytes())

	order, err := cl.q.GetOrderByEscrowID(ctx, gen.GetOrderByEscrowIDParams{
		EscrowContract: cl.contractAddr.Hex(),
		EscrowOrderID:  orderId,
	})
	if err != nil {
		return nil
	}

	switch order.Status {
	case "pending", "paid":
		if _, err := cl.q.UpdateOrderCancelled(ctx, order.ID); err != nil {
			return fmt.Errorf("update order cancelled: %w", err)
		}
		cl.recalculateStats(ctx, order.BuyerAgentID, order.SellerAgentID)
		log.Printf("chainlistener: order %s cancelled", order.OrderNo)
	case "disputed":
		if _, err := cl.q.UpdateOrderRefunded(ctx, order.ID); err != nil {
			return fmt.Errorf("update order refunded: %w", err)
		}
		cl.recalculateStats(ctx, order.BuyerAgentID, order.SellerAgentID)
		log.Printf("chainlistener: order %s refunded", order.OrderNo)
	default:
		return nil
	}
	return nil
}

func (cl *ChainListener) checkOverdueOrders(ctx context.Context) {
	orders, err := cl.q.ListPaidOrdersPastDeadline(ctx)
	if err != nil || len(orders) == 0 {
		return
	}
	for _, o := range orders {
		// Skip instant orders — they are already completed
		if o.PaymentMode == "instant" {
			continue
		}
		if cl.keeperKey == nil {
			log.Printf("chainlistener: WARNING order %s is past deadline (status=%s) — no keeper key configured", o.OrderNo, o.Status)
			continue
		}
		cl.sendAutoComplete(ctx, o)
	}
}

func (cl *ChainListener) sendAutoComplete(ctx context.Context, order gen.Order) {
	// Rate-limit attempts via Redis (max 3 per order, TTL 2h)
	attemptKey := fmt.Sprintf("keeper:attempt:%s", order.OrderNo)
	if cl.rdb != nil {
		count, _ := cl.rdb.Incr(ctx, attemptKey).Result()
		if count == 1 {
			cl.rdb.Expire(ctx, attemptKey, 2*time.Hour)
		}
		if count > 3 {
			log.Printf("chainlistener: keeper skipping order %s — max attempts reached", order.OrderNo)
			return
		}
	}

	// Build calldata: autoComplete(bytes32 orderId)
	// orderId is stored as "0x" + 64 hex chars
	orderIDBytes := common.FromHex(order.EscrowOrderID)
	if len(orderIDBytes) != 32 {
		log.Printf("chainlistener: keeper invalid escrow_order_id for order %s", order.OrderNo)
		return
	}
	calldata := append(autoCompleteSelector, common.LeftPadBytes(orderIDBytes, 32)...)

	// Get nonce
	fromAddr := ethcrypto.PubkeyToAddress(cl.keeperKey.PublicKey)
	nonce, err := cl.client.PendingNonceAt(ctx, fromAddr)
	if err != nil {
		log.Printf("chainlistener: keeper nonce error for order %s: %v", order.OrderNo, err)
		return
	}

	// Get gas prices
	gasTipCap, err := cl.client.SuggestGasTipCap(ctx)
	if err != nil {
		log.Printf("chainlistener: keeper gas tip error for order %s: %v", order.OrderNo, err)
		return
	}

	head, err := cl.client.HeaderByNumber(ctx, nil)
	if err != nil {
		log.Printf("chainlistener: keeper header error for order %s: %v", order.OrderNo, err)
		return
	}
	gasFeeCap := new(big.Int).Add(head.BaseFee, gasTipCap)

	// Build and sign EIP-1559 tx
	tx := types.NewTx(&types.DynamicFeeTx{
		ChainID:   cl.chainID,
		Nonce:     nonce,
		GasTipCap: gasTipCap,
		GasFeeCap: gasFeeCap,
		Gas:       200000,
		To:        &cl.contractAddr,
		Value:     big.NewInt(0),
		Data:      calldata,
	})

	signer := types.LatestSignerForChainID(cl.chainID)
	signedTx, err := types.SignTx(tx, signer, cl.keeperKey)
	if err != nil {
		log.Printf("chainlistener: keeper sign error for order %s: %v", order.OrderNo, err)
		return
	}

	if err := cl.client.SendTransaction(ctx, signedTx); err != nil {
		log.Printf("chainlistener: keeper send error for order %s: %v", order.OrderNo, err)
		return
	}

	log.Printf("chainlistener: keeper auto-complete tx sent for order %s (tx=%s)", order.OrderNo, signedTx.Hash().Hex())
}

// lastBlock persistence via Redis (or fallback to 0)

func (cl *ChainListener) loadLastBlock(ctx context.Context) uint64 {
	if cl.rdb == nil {
		return 0
	}
	val, err := cl.rdb.Get(ctx, lastBlockRedisKey).Uint64()
	if err != nil {
		return 0
	}
	return val
}

func (cl *ChainListener) saveLastBlock(ctx context.Context, block uint64) {
	if cl.rdb == nil {
		return
	}
	cl.rdb.Set(ctx, lastBlockRedisKey, block, 0)
}

func (cl *ChainListener) eventName(topic common.Hash) string {
	switch topic {
	case orderCreatedTopic:
		return "OrderCreated"
	case orderCompletedTopic:
		return "OrderCompleted"
	case orderCancelledTopic:
		return "OrderCancelled"
	default:
		return "Unknown"
	}
}

func (cl *ChainListener) recalculateStats(ctx context.Context, agentIDs ...pgtype.UUID) {
	for _, id := range agentIDs {
		if err := cl.q.RecalculateAgentStats(ctx, id); err != nil {
			log.Printf("chainlistener: failed to recalculate stats: %v", err)
		}
	}
}

func topicsToStrings(topics []common.Hash) []string {
	s := make([]string, len(topics))
	for i, t := range topics {
		s[i] = t.Hex()
	}
	return s
}
