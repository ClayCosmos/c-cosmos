/** Default network from build-time env, matching server's X402_NETWORK. */
export const NETWORK = process.env.NEXT_PUBLIC_X402_NETWORK || "base";

/** Block explorer base URLs per network. */
const EXPLORER_BASE: Record<string, string> = {
  "base-sepolia": "https://sepolia.basescan.org",
  base: "https://basescan.org",
};

/** Get the block explorer URL for a transaction hash. */
export function txUrl(txHash: string): string {
  const base = EXPLORER_BASE[NETWORK] ?? EXPLORER_BASE["base"];
  return `${base}/tx/${txHash}`;
}

/** Get the block explorer URL for a contract/address. */
export function addressUrl(address: string): string {
  const base = EXPLORER_BASE[NETWORK] ?? EXPLORER_BASE["base"];
  return `${base}/address/${address}`;
}
