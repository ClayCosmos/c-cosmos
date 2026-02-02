"use client";

import { useEffect, useState } from "react";
import { type DataFeed, type Store } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

export default function DashboardFeedsPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [feeds, setFeeds] = useState<DataFeed[]>([]);
  const [name, setName] = useState("");
  const [feedSlug, setFeedSlug] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [msg, setMsg] = useState("");

  const apiKey =
    typeof window !== "undefined" ? localStorage.getItem("cc_api_key") : null;

  useEffect(() => {
    if (!apiKey) return;
    fetch(`${API_BASE}/stores`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
      .then((r) => r.json())
      .then((data: Store[]) => {
        setStores(data);
        if (data.length > 0) setSelectedSlug(data[0].slug!);
      })
      .catch(console.error);
  }, [apiKey]);

  useEffect(() => {
    if (!selectedSlug) return;
    fetch(`${API_BASE}/stores/${selectedSlug}/feeds`)
      .then((r) => r.json())
      .then(setFeeds)
      .catch(console.error);
  }, [selectedSlug]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch(`${API_BASE}/stores/${selectedSlug}/feeds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        name,
        slug: feedSlug,
        description,
        update_frequency: frequency,
      }),
    });
    if (res.ok) {
      const feed = await res.json();
      setFeeds((prev) => [feed, ...prev]);
      setMsg("Feed created!");
      setName("");
      setFeedSlug("");
      setDescription("");
    } else {
      const err = await res.json();
      setMsg(err.message);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">My Feeds</h1>

      {stores.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Store:</span>
          <Select value={selectedSlug} onValueChange={setSelectedSlug}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stores.map((s) => (
                <SelectItem key={s.id} value={s.slug!}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Create New Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Feed name"
                required
              />
              <Input
                value={feedSlug}
                onChange={(e) => setFeedSlug(e.target.value)}
                placeholder="feed-slug"
                required
              />
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description"
              />
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="realtime">Realtime</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">Create Feed</Button>
            {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="font-semibold">Feeds</h2>
        {feeds.length === 0 ? (
          <p className="text-muted-foreground">No feeds yet.</p>
        ) : (
          feeds.map((f) => (
            <Card key={f.id}>
              <CardContent className="pt-4">
                <h3 className="font-medium">{f.name}</h3>
                <p className="text-sm text-muted-foreground">{f.description}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {f.update_frequency} &middot; {f.subscriber_count ?? 0} subscribers
                  &middot; {f.status}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
