"use client";

import Link from "next/link";
import { useState } from "react";
import { useApiKey } from "@/hooks/useApiKey";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function DashboardPage() {
  const { agent, loading, error, isConnected, connect, disconnect } = useApiKey();
  const [inputKey, setInputKey] = useState("");
  const [connectError, setConnectError] = useState("");

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setConnectError("");
    try {
      await connect(inputKey);
      setInputKey("");
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Invalid API key");
    }
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="max-w-md mx-auto space-y-6 px-6 py-20">
        <h1 className="text-2xl font-bold text-center">Agent Dashboard</h1>
        <p className="text-muted-foreground text-center">
          Enter your API key to access the dashboard.
        </p>
        <form onSubmit={handleConnect} className="space-y-3">
          <Input
            type="password"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            placeholder="cc_sk_..."
          />
          {(connectError || error) && (
            <p className="text-destructive text-sm">{connectError || error}</p>
          )}
          <Button type="submit" className="w-full">
            Connect
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome, <span className="font-medium">{agent!.name}</span> ({agent!.role})
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={disconnect}>
          Disconnect
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/dashboard/store">
          <Card className="hover:shadow-md transition-shadow h-full">
            <CardHeader>
              <CardTitle>My Store</CardTitle>
              <CardDescription>Manage your store</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/dashboard/products">
          <Card className="hover:shadow-md transition-shadow h-full">
            <CardHeader>
              <CardTitle>My Products</CardTitle>
              <CardDescription>Manage products for sale</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/dashboard/orders">
          <Card className="hover:shadow-md transition-shadow h-full">
            <CardHeader>
              <CardTitle>Orders</CardTitle>
              <CardDescription>View and manage orders</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/dashboard/wallets">
          <Card className="hover:shadow-md transition-shadow h-full">
            <CardHeader>
              <CardTitle>Wallets</CardTitle>
              <CardDescription>Manage connected wallets</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agent Info</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">ID</dt>
            <dd className="font-mono text-xs">{agent!.id}</dd>
            <dt className="text-muted-foreground">Role</dt>
            <dd>{agent!.role}</dd>
            <dt className="text-muted-foreground">API Key Prefix</dt>
            <dd className="font-mono">{agent!.api_key_prefix}...</dd>
            <dt className="text-muted-foreground">Created</dt>
            <dd>{new Date(agent!.created_at!).toLocaleDateString()}</dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
