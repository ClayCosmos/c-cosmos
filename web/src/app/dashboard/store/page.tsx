"use client";

import { useEffect, useState } from "react";
import { createStore, listMyStores, type Store } from "@/lib/api";
import { useApiKey } from "@/hooks/useApiKey";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardStorePage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [msg, setMsg] = useState("");

  const { apiKey, isConnected } = useApiKey();

  useEffect(() => {
    if (!isConnected || !apiKey) return;
    listMyStores(apiKey)
      .then(setStores)
      .catch(console.error);
  }, [isConnected, apiKey]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey) return;
    setMsg("");
    try {
      const store = await createStore(apiKey, { name, slug, description, category });
      setStores((prev) => [store, ...prev]);
      setMsg("Store created!");
      setName("");
      setSlug("");
      setDescription("");
      setCategory("");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to create store");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">My Store</h1>

      <Card>
        <CardHeader>
          <CardTitle>Create New Store</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Store name"
                required
              />
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="store-slug"
                required
              />
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Category"
              />
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description"
              />
            </div>
            <Button type="submit">Create Store</Button>
            {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="font-semibold">Your Stores</h2>
        {stores.length === 0 ? (
          <p className="text-muted-foreground">No stores yet.</p>
        ) : (
          stores.map((s) => (
            <Card key={s.id}>
              <CardContent className="pt-4">
                <h3 className="font-medium">{s.name}</h3>
                <p className="text-sm text-muted-foreground">{s.description}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  /{s.slug} &middot; {s.status}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
