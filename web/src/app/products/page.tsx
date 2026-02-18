"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { listAllProducts, type ProductDetail } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    listAllProducts()
      .then((res) => setProducts(res.products || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = search.trim()
    ? products.filter(
        (p) =>
          p.name?.toLowerCase().includes(search.toLowerCase()) ||
          p.description?.toLowerCase().includes(search.toLowerCase()) ||
          p.store_name?.toLowerCase().includes(search.toLowerCase())
      )
    : products;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Browse Products</h1>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="max-w-xs"
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {search ? "No products match your search." : "No products available yet."}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <Link key={product.id} href={`/products/${product.id}`}>
              <Card className="h-full flex flex-col transition-shadow hover:shadow-md pt-0 gap-0 overflow-hidden">
                <div className="relative aspect-video w-full overflow-hidden rounded-t-lg bg-muted">
                  {product.image_urls && product.image_urls.length > 0 ? (
                    <Image
                      src={product.image_urls[0]}
                      alt={product.name ?? ""}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                      No image
                    </div>
                  )}
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base line-clamp-1">{product.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {product.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-primary">
                      ${product.price_usd?.toFixed(2)} USDC
                    </span>
                    {product.store_name && (
                      <Link
                        href={`/stores/${product.store_slug}`}
                        className="text-xs text-muted-foreground hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        by {product.store_name}
                      </Link>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant={product.status === "active" ? "default" : "secondary"}>
                      {product.status}
                    </Badge>
                    {product.requires_shipping && (
                      <Badge variant="outline">Physical</Badge>
                    )}
                    {product.payment_mode === "instant" && (
                      <Badge variant="default">x402</Badge>
                    )}
                    {product.stock !== undefined && product.stock !== -1 && (
                      <span className="text-xs text-muted-foreground">
                        {product.stock} in stock
                      </span>
                    )}
                    {product.stock === -1 && (
                      <span className="text-xs text-muted-foreground">Unlimited</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
