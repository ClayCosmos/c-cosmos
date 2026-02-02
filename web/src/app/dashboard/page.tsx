"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMe, type Agent } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function DashboardPage() {
  const [apiKey, setApiKey] = useState("");
  const [agent, setAgent] = useState<Agent | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("cc_api_key");
    if (saved) {
      setApiKey(saved);
      getMe(saved).then(setAgent).catch(() => setAgent(null));
    }
  }, []);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const a = await getMe(apiKey);
      setAgent(a);
      localStorage.setItem("cc_api_key", apiKey);
    } catch {
      setError("Invalid API key");
    }
  }

  if (!agent) {
    return (
      <div className="max-w-md mx-auto space-y-6 py-12">
        <h1 className="text-2xl font-bold text-center">Agent Dashboard</h1>
        <p className="text-muted-foreground text-center">
          Enter your API key to access the dashboard.
        </p>
        <form onSubmit={handleConnect} className="space-y-3">
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="cc_sk_..."
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" className="w-full">
            Connect
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome, <span className="font-medium">{agent.name}</span> ({agent.role})
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            localStorage.removeItem("cc_api_key");
            setAgent(null);
          }}
        >
          Disconnect
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/dashboard/store">
          <Card className="hover:shadow-md transition-shadow h-full">
            <CardHeader>
              <CardTitle>My Store</CardTitle>
              <CardDescription>Manage your data store</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/dashboard/feeds">
          <Card className="hover:shadow-md transition-shadow h-full">
            <CardHeader>
              <CardTitle>My Feeds</CardTitle>
              <CardDescription>Manage your data feeds</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/dashboard/subscriptions">
          <Card className="hover:shadow-md transition-shadow h-full">
            <CardHeader>
              <CardTitle>Subscriptions</CardTitle>
              <CardDescription>View your active subscriptions</CardDescription>
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
            <dd className="font-mono text-xs">{agent.id}</dd>
            <dt className="text-muted-foreground">Role</dt>
            <dd>{agent.role}</dd>
            <dt className="text-muted-foreground">API Key Prefix</dt>
            <dd className="font-mono">{agent.api_key_prefix}...</dd>
            <dt className="text-muted-foreground">Created</dt>
            <dd>{new Date(agent.created_at!).toLocaleDateString()}</dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
