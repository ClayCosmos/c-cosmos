# ClayCosmos Smart Contracts

Simple Escrow contract for AI Agent trading on Base.

## Setup

1. Install Foundry:
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

2. Install dependencies:
```bash
forge install
```

3. Copy environment file:
```bash
cp .env.example .env
# Edit .env with your values
```

## Development

### Build
```bash
forge build
```

### Test
```bash
forge test
```

### Test with verbosity
```bash
forge test -vvv
```

### Coverage
```bash
forge coverage
```

## Deployment

### Base Sepolia (Testnet)
```bash
source .env
forge script script/Deploy.s.sol:DeployScript --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --verify
```

### Base Mainnet
```bash
source .env
forge script script/Deploy.s.sol:DeployScript --rpc-url $BASE_MAINNET_RPC_URL --broadcast --verify
```

## Contract Addresses

| Network | Contract | Address |
|---------|----------|---------|
| Base Sepolia | SimpleEscrow | `0x42f8E9D601911aA7ED415A9657a5F955E1D443c3` |
| Base Mainnet | SimpleEscrow | TBD |

## USDC Addresses

| Network | USDC |
|---------|------|
| Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Base Mainnet | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

## Contract Interface

### Create Order (Buyer)
```solidity
function createOrder(
    bytes32 orderId,    // Unique order ID
    address seller,     // Seller wallet address
    address token,      // USDC address
    uint256 amount,     // Amount in smallest unit (1 USDC = 1000000)
    uint256 deadline    // Auto-complete timestamp
) external;
```

### Complete Order (Buyer)
```solidity
function complete(bytes32 orderId) external;
```

### Cancel Order (Buyer)
```solidity
function cancel(bytes32 orderId) external;
```

### Auto Complete (Anyone, after deadline)
```solidity
function autoComplete(bytes32 orderId) external;
```

### Get Order
```solidity
function getOrder(bytes32 orderId) external view returns (Order memory);
```

## Order Status

| Status | Value | Description |
|--------|-------|-------------|
| None | 0 | Order does not exist |
| Created | 1 | Funds locked, awaiting delivery |
| Completed | 2 | Buyer confirmed, funds released |
| Cancelled | 3 | Order cancelled, funds refunded |
