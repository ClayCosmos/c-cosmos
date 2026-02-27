import type { PaymentRequired, PaymentRequirements } from "./api";

// EIP-1193 provider type
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

// Chain configuration (supports both legacy and CAIP-2 network names)
const CHAINS: Record<string, { chainId: string; name: string }> = {
  "base-sepolia": { chainId: "0x14A34", name: "Base Sepolia" },
  base: { chainId: "0x2105", name: "Base" },
  "eip155:84532": { chainId: "0x14A34", name: "Base Sepolia" },
  "eip155:8453": { chainId: "0x2105", name: "Base" },
};

// USDC contract addresses per network (supports both legacy and CAIP-2 network names)
const USDC_ADDRESS: Record<string, string> = {
  "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "eip155:84532": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "eip155:8453": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

/** Default x402 network from build-time env, matching server's X402_NETWORK. */
export const X402_NETWORK = process.env.NEXT_PUBLIC_X402_NETWORK || "base";

/** Get human-readable network name. */
export function getNetworkDisplayName(network: string): string {
  return CHAINS[network]?.name ?? network;
}

/**
 * Request wallet connection via MetaMask (EIP-1193).
 * Returns the connected account address.
 */
export async function connectWallet(): Promise<string> {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed");
  }
  const accounts = (await window.ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts returned from wallet");
  }
  return accounts[0];
}

/**
 * Switch to the correct chain for the payment network.
 */
export async function ensureChain(network: string): Promise<void> {
  if (!window.ethereum) throw new Error("MetaMask is not installed");
  const chain = CHAINS[network];
  if (!chain) throw new Error(`Unsupported network: ${network}`);

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chain.chainId }],
    });
  } catch (err: unknown) {
    const switchErr = err as { code?: number };
    // 4902 = chain not added
    if (switchErr.code === 4902) {
      throw new Error(
        `Please add ${chain.name} (chainId ${chain.chainId}) to your wallet manually.`
      );
    }
    throw err;
  }
}

/** Generate a random bytes32 hex string for the EIP-3009 nonce. */
function randomBytes32(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Convert a hex chain ID string (like "0x14A34") to a decimal number. */
function chainIdToDecimal(hexChainId: string): number {
  return parseInt(hexChainId, 16);
}

interface TransferAuthParams {
  from: string;
  to: string;
  value: string;
  network: string;
  maxTimeoutSeconds: number;
}

interface TransferAuthResult {
  signature: string;
  authorization: {
    from: string;
    to: string;
    value: string;
    validAfter: string;
    validBefore: string;
    nonce: string;
  };
}

/**
 * Sign an EIP-3009 TransferWithAuthorization using MetaMask's eth_signTypedData_v4.
 */
export async function signTransferWithAuthorization(
  params: TransferAuthParams
): Promise<TransferAuthResult> {
  if (!window.ethereum) throw new Error("MetaMask is not installed");

  const chain = CHAINS[params.network];
  if (!chain) throw new Error(`Unsupported network: ${params.network}`);

  const usdcAddr = USDC_ADDRESS[params.network];
  if (!usdcAddr) throw new Error(`No USDC address for network: ${params.network}`);

  const chainId = chainIdToDecimal(chain.chainId);
  const nonce = randomBytes32();
  const validAfter = "0";
  const validBefore = String(Math.floor(Date.now() / 1000) + params.maxTimeoutSeconds);

  const domain = {
    name: "USD Coin",
    version: "2",
    chainId,
    verifyingContract: usdcAddr,
  };

  const types = {
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
    ],
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  };

  const message = {
    from: params.from,
    to: params.to,
    value: params.value,
    validAfter,
    validBefore,
    nonce,
  };

  const typedData = JSON.stringify({
    types,
    domain,
    primaryType: "TransferWithAuthorization",
    message,
  });

  const signature = (await window.ethereum.request({
    method: "eth_signTypedData_v4",
    params: [params.from, typedData],
  })) as string;

  return {
    signature,
    authorization: {
      from: params.from,
      to: params.to,
      value: params.value,
      validAfter,
      validBefore,
      nonce,
    },
  };
}

/**
 * Build the base64-encoded PaymentPayload for the PAYMENT-SIGNATURE header.
 */
export function buildPaymentPayload(
  paymentRequired: PaymentRequired,
  requirements: PaymentRequirements,
  authResult: TransferAuthResult
): string {
  const payload = {
    x402Version: paymentRequired.x402Version,
    resource: paymentRequired.resource,
    accepted: requirements,
    payload: {
      signature: authResult.signature,
      authorization: authResult.authorization,
    },
  };
  const jsonStr = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(jsonStr);
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}
