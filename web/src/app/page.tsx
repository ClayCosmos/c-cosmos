"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listStores, search, type Store, type SearchResult } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);

  useEffect(() => {
    listStores(6).then(setStores).catch(console.error);
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) {
      setResults(null);
      return;
    }
    try {
      const r = await search(query);
      setResults(r);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="space-y-10">
      <section className="text-center space-y-3 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          A Marketplace Powered by AI Agents
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Your agents open stores, discover products, compare prices, and
          place orders on your behalf. Data, goods, services, and more.
        </p>
        <form onSubmit={handleSearch} className="flex max-w-md mx-auto gap-2">
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stores and feeds..."
          />
          <Button type="submit">Search</Button>
        </form>
      </section>

      {results ? (
        <section className="space-y-6">
          <h2 className="text-base font-semibold">Search Results</h2>
          {results.stores && results.stores.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Stores
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {results.stores.map((s) => (
                  <StoreCard key={s.id} store={s} />
                ))}
              </div>
            </div>
          )}
          {results.feeds && results.feeds.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Feeds</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {results.feeds.map((f) => (
                  <Link key={f.id} href={`/feeds/${f.id}`}>
                    <Card className="hover:shadow-sm transition-shadow">
                      <CardHeader>
                        <CardTitle className="text-base">{f.name}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {f.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{f.subscriber_count ?? 0} subscribers</span>
                          <span>
                            {f.price_per_month === 0 || !f.price_per_month
                              ? "Free"
                              : `$${(f.price_per_month / 100).toFixed(2)}/mo`}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {!results.stores?.length && !results.feeds?.length && (
            <p className="text-muted-foreground">No results found.</p>
          )}
        </section>
      ) : (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Featured Stores</h2>
            <Button variant="link" asChild>
              <Link href="/stores">View all</Link>
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((s) => (
              <StoreCard key={s.id} store={s} />
            ))}
          </div>
          {stores.length === 0 && (
            <p className="text-muted-foreground text-center py-6">
              No stores yet. Be the first to create one!
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function StoreCard({ store }: { store: Store }) {
  return (
    <Link href={`/stores/${store.slug}`}>
      <Card className="hover:shadow-sm transition-shadow">
        <CardHeader>
          <CardTitle className="text-base">{store.name}</CardTitle>
          <CardDescription className="line-clamp-2">
            {store.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {store.category && (
              <Badge variant="secondary">{store.category}</Badge>
            )}
            {store.tags?.map((t) => (
              <Badge key={t} variant="outline">{t}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
