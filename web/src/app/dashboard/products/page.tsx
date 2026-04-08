"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  listMyProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  type ProductDetail,
} from "@/lib/api";
import { useApiKey } from "@/hooks/useApiKey";
import { useToast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProductsPage() {
  const { apiKey, isConnected, loading: authLoading } = useApiKey();
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");

  // Create form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceUsd, setPriceUsd] = useState("");
  const [deliveryContent, setDeliveryContent] = useState("");
  const [stock, setStock] = useState("-1");
  const [imageUrls, setImageUrls] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [requiresShipping, setRequiresShipping] = useState(false);
  const [paymentMode, setPaymentMode] = useState("escrow");

  // Edit state
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriceUsd, setEditPriceUsd] = useState("");
  const [editDeliveryContent, setEditDeliveryContent] = useState("");
  const [editStock, setEditStock] = useState("");
  const [editImageUrls, setEditImageUrls] = useState("");
  const [editExternalUrl, setEditExternalUrl] = useState("");
  const [editRequiresShipping, setEditRequiresShipping] = useState(false);
  const [editPaymentMode, setEditPaymentMode] = useState("escrow");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const loadProducts = useCallback(async () => {
    if (!apiKey) return;
    setLoading(true);
    try {
      const res = await listMyProducts(apiKey);
      setProducts(res.products || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    if (isConnected) {
      loadProducts();
    }
  }, [isConnected, loadProducts]);

  function startEdit(product: ProductDetail) {
    setEditingProductId(product.id!);
    setEditName(product.name ?? "");
    setEditDescription(product.description ?? "");
    setEditPriceUsd(product.price_usd?.toFixed(2) ?? "");
    setEditDeliveryContent("");
    setEditStock(String(product.stock ?? -1));
    setEditImageUrls((product.image_urls ?? []).join("\n"));
    setEditExternalUrl(product.external_url ?? "");
    setEditRequiresShipping(product.requires_shipping ?? false);
    setEditPaymentMode(product.payment_mode ?? "escrow");
    setEditError("");
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setEditError("");
    setEditLoading(true);

    try {
      const priceUsdc = Math.round(parseFloat(editPriceUsd) * 1_000_000);
      if (isNaN(priceUsdc) || priceUsdc <= 0) {
        throw new Error("Invalid price");
      }

      const parsedImageUrls = editImageUrls
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean);

      const data: Parameters<typeof updateProduct>[2] = {
        name: editName,
        description: editDescription || undefined,
        price_usdc: priceUsdc,
        stock: editStock ? parseInt(editStock, 10) : undefined,
        image_urls: parsedImageUrls.length > 0 ? parsedImageUrls : undefined,
        external_url: editExternalUrl || undefined,
        requires_shipping: editRequiresShipping || undefined,
        payment_mode: editPaymentMode,
      };

      if (editDeliveryContent) {
        data.delivery_content = editDeliveryContent;
      }

      const updated = await updateProduct(apiKey!, editingProductId!, data);

      setProducts((prev) =>
        prev.map((p) => (p.id === editingProductId ? updated : p))
      );
      setEditingProductId(null);
      toast({ title: "Product updated", variant: "success" });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to update product";
      setEditError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setEditLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFormLoading(true);

    try {
      const priceUsdc = Math.round(parseFloat(priceUsd) * 1_000_000);
      if (isNaN(priceUsdc) || priceUsdc <= 0) {
        throw new Error("Invalid price");
      }

      const parsedImageUrls = imageUrls
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean);

      await createProduct(apiKey!, {
        name,
        description: description || undefined,
        price_usdc: priceUsdc,
        delivery_content: deliveryContent,
        stock: stock ? parseInt(stock, 10) : undefined,
        image_urls: parsedImageUrls.length > 0 ? parsedImageUrls : undefined,
        external_url: externalUrl || undefined,
        requires_shipping: requiresShipping || undefined,
        payment_mode: paymentMode,
      });

      setShowForm(false);
      setName("");
      setDescription("");
      setPriceUsd("");
      setDeliveryContent("");
      setStock("-1");
      setImageUrls("");
      setExternalUrl("");
      setRequiresShipping(false);
      setPaymentMode("escrow");
      toast({ title: "Product created", variant: "success" });
      loadProducts();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create product";
      setError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete(productId: string) {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      await deleteProduct(apiKey!, productId);
      toast({ title: "Product deleted", variant: "success" });
      loadProducts();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to delete product";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  }

  if (authLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-12">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-muted-foreground">
          Please{" "}
          <Link href="/dashboard" className="text-primary hover:underline">
            connect
          </Link>{" "}
          your API key first.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">My Products</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "New Product"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Product</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Product name"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Product description"
                  rows={2}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Price (USDC) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={priceUsd}
                    onChange={(e) => setPriceUsd(e.target.value)}
                    placeholder="10.00"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Stock</label>
                  <Input
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    placeholder="-1 for unlimited"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    -1 for unlimited
                  </p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Image URLs</label>
                <Textarea
                  value={imageUrls}
                  onChange={(e) => setImageUrls(e.target.value)}
                  placeholder="One URL per line"
                  rows={2}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  One image URL per line
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">External URL</label>
                <Input
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="requires-shipping"
                  checked={requiresShipping}
                  onChange={(e) => {
                    setRequiresShipping(e.target.checked);
                    if (e.target.checked) setPaymentMode("escrow");
                  }}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="requires-shipping" className="text-sm font-medium">
                  Requires Shipping (physical product)
                </label>
              </div>
              <div>
                <label className="text-sm font-medium">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  disabled={requiresShipping}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="escrow">Escrow (multi-step)</option>
                  <option value="instant">Instant (x402 protocol)</option>
                </select>
                {requiresShipping && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Physical products must use escrow payment mode.
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Delivery Content *</label>
                <Textarea
                  value={deliveryContent}
                  onChange={(e) => setDeliveryContent(e.target.value)}
                  placeholder="Content delivered to buyer after payment (API key, download link, etc.)"
                  rows={4}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This content will be revealed to the buyer after payment.
                </p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={formLoading}>
                {formLoading ? "Creating..." : "Create Product"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <div className="text-4xl mb-3">📦</div>
              <p className="text-muted-foreground">No products yet.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first product to start selling.
              </p>
            </CardContent>
          </Card>
        ) : (
          products.map((product) => (
            <Card key={product.id}>
              <CardContent className="p-4">
                {editingProductId === product.id ? (
                  <form onSubmit={handleUpdate} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Edit Product</h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingProductId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Name</label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium">
                          Price (USDC)
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={editPriceUsd}
                          onChange={(e) => setEditPriceUsd(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Stock</label>
                        <Input
                          type="number"
                          value={editStock}
                          onChange={(e) => setEditStock(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Image URLs</label>
                      <Textarea
                        value={editImageUrls}
                        onChange={(e) => setEditImageUrls(e.target.value)}
                        placeholder="One URL per line"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">External URL</label>
                      <Input
                        value={editExternalUrl}
                        onChange={(e) => setEditExternalUrl(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`edit-shipping-${product.id}`}
                        checked={editRequiresShipping}
                        onChange={(e) => {
                          setEditRequiresShipping(e.target.checked);
                          if (e.target.checked) setEditPaymentMode("escrow");
                        }}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <label
                        htmlFor={`edit-shipping-${product.id}`}
                        className="text-sm font-medium"
                      >
                        Requires Shipping
                      </label>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Payment Mode</label>
                      <select
                        value={editPaymentMode}
                        onChange={(e) => setEditPaymentMode(e.target.value)}
                        disabled={editRequiresShipping}
                        className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="escrow">Escrow (multi-step)</option>
                        <option value="instant">Instant (x402 protocol)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Delivery Content
                      </label>
                      <Textarea
                        value={editDeliveryContent}
                        onChange={(e) => setEditDeliveryContent(e.target.value)}
                        placeholder="Leave empty to keep current content"
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Leave empty to keep the current delivery content unchanged.
                      </p>
                    </div>
                    {editError && (
                      <p className="text-sm text-destructive">{editError}</p>
                    )}
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={editLoading}>
                        {editLoading ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingProductId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    {product.image_urls && product.image_urls.length > 0 && (
                      <Image
                        src={product.image_urls[0]}
                        alt={product.name ?? ""}
                        width={64}
                        height={64}
                        unoptimized
                        className="h-16 w-16 rounded object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{product.name}</h3>
                        <Badge
                          variant={
                            product.status === "active" ? "default" : "secondary"
                          }
                        >
                          {product.status}
                        </Badge>
                        <Badge variant="outline">
                          {product.requires_shipping ? "Physical" : "Digital"}
                        </Badge>
                        <Badge
                          variant={
                            product.payment_mode === "instant"
                              ? "default"
                              : "outline"
                          }
                        >
                          {product.payment_mode === "instant" ? "x402" : "Escrow"}
                        </Badge>
                      </div>
                      {product.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {product.description}
                        </p>
                      )}
                      <p className="text-lg font-semibold text-primary mt-2">
                        ${product.price_usd?.toFixed(2)} USDC
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Stock:{" "}
                        {product.stock === -1 ? "Unlimited" : product.stock}
                      </p>
                      {product.external_url && (
                        <a
                          href={product.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline mt-1 inline-block"
                        >
                          External link
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(product)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(product.id!)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
