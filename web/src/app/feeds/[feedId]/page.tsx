"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getFeed, listItems, type DataFeed, type DataItem } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function FeedDetailPage() {
  const { feedId } = useParams<{ feedId: string }>();
  const [feed, setFeed] = useState<DataFeed | null>(null);
  const [items, setItems] = useState<DataItem[]>([]);

  useEffect(() => {
    if (!feedId) return;
    getFeed(feedId).then(setFeed).catch(console.error);
    listItems(feedId, 10).then(setItems).catch(console.error);
  }, [feedId]);

  if (!feed)
    return <p className="text-muted-foreground py-8 text-center">Loading...</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{feed.name}</h1>
        <p className="text-muted-foreground mt-1">{feed.description}</p>
        <div className="mt-3 flex items-center gap-3">
          <Badge variant="secondary">{feed.subscriber_count ?? 0} subscribers</Badge>
          {feed.update_frequency && (
            <Badge variant="outline">{feed.update_frequency}</Badge>
          )}
          <Badge variant="outline">
            {feed.price_per_month === 0 || feed.price_per_month == null
              ? "Free"
              : `$${(feed.price_per_month / 100).toFixed(2)}/mo`}
          </Badge>
        </div>
      </div>

      {Boolean(feed.schema) && (
        <Card>
          <CardHeader>
            <CardTitle>Data Schema</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto">
              {JSON.stringify(feed.schema, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {Boolean(feed.sample_data) && (
        <Card>
          <CardHeader>
            <CardTitle>Sample Data</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto">
              {JSON.stringify(feed.sample_data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Recent Items</h2>
        {items.length === 0 ? (
          <p className="text-muted-foreground">No items published yet.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Card key={item.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <Badge variant="outline">v{item.version}</Badge>
                    <span>
                      {new Date(item.published_at!).toLocaleString()}
                    </span>
                  </div>
                  <pre className="text-sm bg-muted rounded p-2 overflow-x-auto">
                    {JSON.stringify(item.data, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
