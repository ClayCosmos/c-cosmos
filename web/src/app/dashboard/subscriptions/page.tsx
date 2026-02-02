"use client";

import { useEffect, useState, useCallback } from "react";
import {
  listSubscriptions,
  unsubscribe,
  type Subscription,
} from "@/lib/api";
import { createWSClient, type WSMessage } from "@/lib/ws";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DashboardSubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [liveData, setLiveData] = useState<Record<string, unknown[]>>({});
  const [connected, setConnected] = useState(false);

  const apiKey =
    typeof window !== "undefined" ? localStorage.getItem("cc_api_key") : null;

  const loadSubs = useCallback(() => {
    if (!apiKey) return;
    listSubscriptions(apiKey).then(setSubs).catch(console.error);
  }, [apiKey]);

  useEffect(() => {
    loadSubs();
  }, [loadSubs]);

  useEffect(() => {
    if (!apiKey || subs.length === 0) return;

    const client = createWSClient(apiKey);
    client.ws.onopen = () => {
      setConnected(true);
      subs.forEach((s) => client.subscribeFeed(s.feed_id!));
    };
    client.ws.onclose = () => setConnected(false);
    client.onMessage((msg: WSMessage) => {
      if (msg.type === "item") {
        setLiveData((prev) => ({
          ...prev,
          [msg.feed_id]: [msg.data, ...(prev[msg.feed_id] || [])].slice(0, 5),
        }));
      }
    });

    return () => client.close();
  }, [apiKey, subs]);

  async function handleUnsubscribe(feedId: string) {
    if (!apiKey) return;
    await unsubscribe(feedId, apiKey);
    loadSubs();
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">My Subscriptions</h1>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              connected ? "bg-green-500" : "bg-muted-foreground/30"
            }`}
          />
          <Badge variant={connected ? "default" : "secondary"}>
            {connected ? "Live" : "Disconnected"}
          </Badge>
        </div>
      </div>

      {subs.length === 0 ? (
        <p className="text-muted-foreground">No subscriptions yet.</p>
      ) : (
        <div className="space-y-4">
          {subs.map((sub) => (
            <Card key={sub.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{sub.feed_name}</CardTitle>
                    <CardDescription>
                      {sub.store_name} / {sub.feed_slug}
                    </CardDescription>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleUnsubscribe(sub.feed_id!)}
                  >
                    Unsubscribe
                  </Button>
                </div>
              </CardHeader>

              {liveData[sub.feed_id!] && liveData[sub.feed_id!].length > 0 && (
                <CardContent>
                  <p className="text-xs font-medium text-green-600 mb-2">
                    Live data stream:
                  </p>
                  <div className="space-y-2">
                    {liveData[sub.feed_id!].map((item, i) => (
                      <pre
                        key={i}
                        className="text-xs bg-muted rounded p-2 overflow-x-auto"
                      >
                        {JSON.stringify(item, null, 2)}
                      </pre>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
