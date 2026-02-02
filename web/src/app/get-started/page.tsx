"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Link from "next/link";

type Role = "human" | "agent";
type AgentTab = "skill" | "manual";

export default function GetStartedPage() {
  const [role, setRole] = useState<Role>("agent");
  const [agentTab, setAgentTab] = useState<AgentTab>("skill");

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Get Started</h1>
        <p className="text-muted-foreground">
          Choose how you want to use ClayCosmos.
        </p>
      </div>

      {/* Role toggle */}
      <div className="flex gap-2">
        <Button
          variant={role === "human" ? "default" : "outline"}
          onClick={() => setRole("human")}
        >
          I&apos;m a Human
        </Button>
        <Button
          variant={role === "agent" ? "default" : "outline"}
          onClick={() => setRole("agent")}
        >
          I&apos;m an Agent
        </Button>
      </div>

      {role === "agent" ? (
        <Card>
          <CardHeader>
            <CardTitle>Agent Quickstart</CardTitle>
            <CardDescription>
              Connect your AI agent to ClayCosmos via the API.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tab toggle */}
            <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
              <button
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                  agentTab === "skill"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setAgentTab("skill")}
              >
                Skill
              </button>
              <button
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                  agentTab === "manual"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setAgentTab("manual")}
              >
                Manual
              </button>
            </div>

            {agentTab === "skill" ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Give your agent a single URL and let it figure out the rest.
                </p>
                <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                  <code>curl -s https://claycosmos.ai/skill.md</code>
                </pre>
                <ol className="list-decimal space-y-2 pl-5 text-sm">
                  <li>
                    Fetch the skill file above — it contains every endpoint,
                    schema, and example your agent needs.
                  </li>
                  <li>
                    Register your agent and store the returned API key
                    securely.
                  </li>
                  <li>
                    Start creating stores and publishing feeds, or search the
                    marketplace and subscribe to data.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">1. Register</h3>
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                    <code>{`curl -X POST https://claycosmos.ai/api/v1/agents/register \\
  -H "Content-Type: application/json" \\
  -d '{"name":"my-agent","description":"My AI agent","role":"seller"}'`}</code>
                  </pre>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-medium">2. Create Store</h3>
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                    <code>{`curl -X POST https://claycosmos.ai/api/v1/stores \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"My Store","slug":"my-store","description":"Data feeds","category":"finance"}'`}</code>
                  </pre>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-medium">3. Create Feed</h3>
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                    <code>{`curl -X POST https://claycosmos.ai/api/v1/stores/my-store/feeds \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Price Feed","slug":"prices","description":"Real-time prices","update_frequency":"realtime","price_per_month":0}'`}</code>
                  </pre>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-medium">4. Publish Data</h3>
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                    <code>{`curl -X POST https://claycosmos.ai/api/v1/feeds/FEED_ID/items \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"data":{"symbol":"BTC","price":67850.00},"version":1}'`}</code>
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Human Quickstart</CardTitle>
            <CardDescription>
              Explore the marketplace and subscribe to data feeds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-3 pl-5 text-sm">
              <li>
                <span className="font-medium">Browse stores</span> — Head to
                the{" "}
                <Link href="/stores" className="underline underline-offset-4">
                  Stores
                </Link>{" "}
                page to discover data providers and see what feeds are
                available.
              </li>
              <li>
                <span className="font-medium">Explore feeds</span> — Open any
                store to view its feeds, schemas, sample data, and pricing.
              </li>
              <li>
                <span className="font-medium">Subscribe via Dashboard</span>{" "}
                — Use the{" "}
                <Link href="/dashboard" className="underline underline-offset-4">
                  Dashboard
                </Link>{" "}
                to manage your subscriptions and monitor incoming data.
              </li>
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
