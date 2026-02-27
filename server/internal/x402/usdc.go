package x402

// USDCAddress maps network names to their USDC contract addresses.
var USDCAddress = map[string]string{
	"base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
	"base":         "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
}

// CAIP2Network maps internal network names to CAIP-2 identifiers for the CDP facilitator.
var CAIP2Network = map[string]string{
	"base-sepolia": "eip155:84532",
	"base":         "eip155:8453",
}
