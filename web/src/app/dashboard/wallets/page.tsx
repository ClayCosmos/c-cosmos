"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { listWallets, bindWallet, verifyWallet, deleteWallet, type Wallet } from "@/lib/api";
import { useApiKey } from "@/hooks/useApiKey";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function WalletsPage() {
  const { apiKey, isConnected, loading: authLoading } = useApiKey();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");

  // Binding flow state
  const [step, setStep] = useState<"address" | "sign">("address");
  const [chain, setChain] = useState("base");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [nonce, setNonce] = useState("");
  const [signature, setSignature] = useState("");

  // MetaMask detection
  const [hasMetaMask, setHasMetaMask] = useState(false);
  useEffect(() => {
    setHasMetaMask(typeof window !== "undefined" && !!window.ethereum);
  }, []);

  const loadWallets = useCallback(async () => {
    if (!apiKey) return;
    setLoading(true);
    try {
      const res = await listWallets(apiKey);
      setWallets(res.wallets || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    if (isConnected) {
      loadWallets();
    }
  }, [isConnected, loadWallets]);

  async function handleBind(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFormLoading(true);

    try {
      const res = await bindWallet(apiKey!, address, chain);
      setMessage(res.message);
      setNonce(res.nonce);
      setStep("sign");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to initiate binding");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFormLoading(true);

    try {
      await verifyWallet(apiKey!, address, signature, nonce, chain);
      setShowForm(false);
      setStep("address");
      setAddress("");
      setMessage("");
      setNonce("");
      setSignature("");
      loadWallets();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to verify wallet");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleConnectMetaMask() {
    setError("");
    try {
      const accounts = (await window.ethereum!.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (accounts && accounts.length > 0) {
        setAddress(accounts[0]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect MetaMask");
    }
  }

  async function handleSignWithMetaMask() {
    setError("");
    setFormLoading(true);
    try {
      const sig = (await window.ethereum!.request({
        method: "personal_sign",
        params: [message, address],
      })) as string;
      // Auto-submit verification
      await verifyWallet(apiKey!, address, sig, nonce, chain);
      setShowForm(false);
      setStep("address");
      setAddress("");
      setMessage("");
      setNonce("");
      setSignature("");
      loadWallets();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sign with MetaMask");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete(walletId: string) {
    if (!confirm("Are you sure you want to remove this wallet?")) return;
    try {
      await deleteWallet(apiKey!, walletId);
      loadWallets();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete wallet");
    }
  }

  function resetForm() {
    setShowForm(false);
    setStep("address");
    setAddress("");
    setMessage("");
    setNonce("");
    setSignature("");
    setError("");
  }

  if (authLoading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-muted-foreground">
          Please{" "}
          <Link href="/dashboard" className="text-primary hover:underline">
            connect
          </Link>{" "}
          your API key first.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">My Wallets</h1>
        <Button onClick={() => (showForm ? resetForm() : setShowForm(true))}>
          {showForm ? "Cancel" : "Connect Wallet"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {step === "address" ? "Connect Wallet" : "Sign Message"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {step === "address" ? (
              <form onSubmit={handleBind} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Chain</label>
                  <Select value={chain} onValueChange={setChain}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="base">Base</SelectItem>
                      <SelectItem value="ethereum">Ethereum</SelectItem>
                      <SelectItem value="arbitrum">Arbitrum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Wallet Address</label>
                  <div className="flex gap-2">
                    <Input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="0x..."
                      className="font-mono"
                      required
                    />
                    {hasMetaMask && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleConnectMetaMask}
                      >
                        MetaMask
                      </Button>
                    )}
                  </div>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" disabled={formLoading}>
                  {formLoading ? "Loading..." : "Continue"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Message to Sign</label>
                  <pre className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap font-mono">
                    {message}
                  </pre>
                  <p className="text-xs text-muted-foreground mt-2">
                    Sign this message using your wallet (e.g., via MetaMask,
                    ethers.js, or your preferred wallet).
                  </p>
                </div>
                {hasMetaMask && (
                  <Button
                    type="button"
                    onClick={handleSignWithMetaMask}
                    disabled={formLoading}
                  >
                    {formLoading ? "Signing..." : "Sign with MetaMask"}
                  </Button>
                )}
                <div>
                  <label className="text-sm font-medium">
                    {hasMetaMask ? "Or paste signature manually" : "Signature"}
                  </label>
                  <Input
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder="0x..."
                    className="font-mono"
                    required={!hasMetaMask}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button type="submit" disabled={formLoading || !signature}>
                    {formLoading ? "Verifying..." : "Verify"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep("address")}
                  >
                    Back
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : wallets.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No wallets connected.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Connect a wallet to receive payments for your products.
              </p>
            </CardContent>
          </Card>
        ) : (
          wallets.map((wallet) => (
            <Card key={wallet.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="uppercase">
                        {wallet.chain}
                      </Badge>
                      {wallet.is_primary && (
                        <Badge variant="default">Primary</Badge>
                      )}
                      {wallet.verified_at ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                          Pending
                        </Badge>
                      )}
                    </div>
                    <p className="font-mono text-sm mt-2 truncate">
                      {wallet.address}
                    </p>
                    {wallet.verified_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Verified: {new Date(wallet.verified_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(wallet.id!)}
                  >
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <h3 className="font-medium mb-2">How Wallet Verification Works</h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground mb-1">
                One-Click with MetaMask (Recommended)
              </p>
              <ol className="space-y-1 list-decimal list-inside">
                <li>Click <span className="font-medium">MetaMask</span> to connect your wallet</li>
                <li>Sign the verification message in MetaMask</li>
                <li>Verification completes automatically — your wallet is ready to receive payments</li>
              </ol>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Manual Signature</p>
              <ol className="space-y-1 list-decimal list-inside">
                <li>Enter your wallet address manually</li>
                <li>Sign the verification message using your preferred wallet or library (e.g., ethers.js)</li>
                <li>Paste the signature and click Verify</li>
              </ol>
            </div>
            <p>
              Need more help?{" "}
              <Link href="/help" className="text-primary hover:underline">
                Visit the Help Center
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
