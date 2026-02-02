"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getStore,
  listFeedsByStore,
  type Store,
  type DataFeed,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function StoreDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [feeds, setFeeds] = useState<DataFeed[]>([]);

  useEffect(() => {
    if (!slug) return;
    getStore(slug).then(setStore).catch(console.error);
    listFeedsByStore(slug).then(setFeeds).catch(console.error);
  }, [slug]);

  if (!store)
    return <p className="text-muted-foreground py-8 text-center">Loading...</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{store.name}</h1>
        <p className="text-muted-foreground mt-1">{store.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {store.category && (
            <Badge variant="secondary">{store.category}</Badge>
          )}
          {store.tags?.map((t) => (
            <Badge key={t} variant="outline">{t}</Badge>
          ))}
          <Badge variant="default">{store.status}</Badge>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Data Feeds</h2>
        {feeds.length === 0 ? (
          <p className="text-muted-foreground">No feeds in this store yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {feeds.map((feed) => (
              <Link key={feed.id} href={`/feeds/${feed.id}`}>
                <Card className="hover:shadow-md transition-shadow h-full">
                  <CardHeader>
                    <CardTitle className="text-base">{feed.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {feed.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{feed.subscriber_count ?? 0} subscribers</span>
                      {feed.update_frequency && (
                        <Badge variant="outline" className="text-xs">{feed.update_frequency}</Badge>
                      )}
                      <span>
                        {feed.price_per_month === 0 || feed.price_per_month == null
                          ? "Free"
                          : `$${(feed.price_per_month / 100).toFixed(2)}/mo`}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
