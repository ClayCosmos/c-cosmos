"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getProduct, createOrder, listWallets, type ProductDetail, type Wallet, type Order, type ShippingAddress } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApiKey } from "@/hooks/useApiKey";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;
  const { apiKey, isConnected } = useApiKey();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Checkout state
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);

  // Shipping address state
  const [shippingAddr, setShippingAddr] = useState<ShippingAddress>({
    recipient_name: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    country: "",
    postal_code: "",
    notes: "",
  });

  const loadProduct = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const p = await getProduct(productId);
      setProduct(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load product");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  useEffect(() => {
    if (isConnected && apiKey) {
      listWallets(apiKey)
        .then((res) => {
          const verified = (res.wallets || []).filter((w) => w.verified_at);
          setWallets(verified);
          if (verified.length > 0) {
            setSelectedWallet(verified[0].address!);
          }
        })
        .catch(console.error);
    }
  }, [isConnected, apiKey]);

  async function handleCheckout() {
    if (!isConnected) {
      router.push("/dashboard");
      return;
    }
    if (!selectedWallet) {
      alert("Please select a wallet for payment");
      return;
    }

    if (product?.requires_shipping) {
      if (!shippingAddr.recipient_name || !shippingAddr.phone || !shippingAddr.address_line1 || !shippingAddr.city || !shippingAddr.country || !shippingAddr.postal_code) {
        setError("Please fill in all required shipping address fields");
        return;
      }
    }

    setCheckoutLoading(true);
    setError("");
    try {
      const addr = product?.requires_shipping ? shippingAddr : undefined;
      const newOrder = await createOrder(apiKey!, productId, selectedWallet, undefined, addr);
      setOrder(newOrder);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create order");
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12 space-y-4">
        <p className="text-destructive">{error}</p>
        <Link href="/products">
          <Button variant="outline">Back to Products</Button>
        </Link>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12 space-y-4">
        <p className="text-muted-foreground">Product not found</p>
        <Link href="/products">
          <Button variant="outline">Back to Products</Button>
        </Link>
      </div>
    );
  }

  // Order created successfully
  if (order) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-green-600">Order Created!</h1>
          <p className="text-muted-foreground mt-2">
            Complete the payment to receive your product.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payment Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Order Number</p>
                <p className="font-mono">{order.order_no}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="text-2xl font-bold">${order.amount_usd?.toFixed(2)} USDC</p>
              </div>
            </div>

            <div className="p-4 bg-muted rounded-lg space-y-3">
              <h3 className="font-medium">Send USDC to the Escrow Contract</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Contract Address: </span>
                  <code className="break-all bg-background px-1 rounded">{order.escrow_contract}</code>
                </div>
                <div>
                  <span className="text-muted-foreground">Order ID: </span>
                  <code className="break-all bg-background px-1 rounded">{order.escrow_order_id}</code>
                </div>
                <div>
                  <span className="text-muted-foreground">Seller Wallet: </span>
                  <code className="break-all bg-background px-1 rounded">{order.seller_wallet}</code>
                </div>
                <div>
                  <span className="text-muted-foreground">Amount (micro-units): </span>
                  <code className="bg-background px-1 rounded">{order.amount_usdc}</code>
                </div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              <p>After completing the on-chain payment:</p>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Copy the transaction hash</li>
                <li>Go to your order details</li>
                <li>Enter the transaction hash to confirm payment</li>
                <li>Receive your product delivery</li>
              </ol>
            </div>

            <div className="flex gap-3 pt-4">
              <Link href={`/dashboard/orders/${order.id}`}>
                <Button>View Order Details</Button>
              </Link>
              <Link href="/dashboard/orders">
                <Button variant="outline">All Orders</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/products">
          <Button variant="ghost" size="sm">
            &larr; Back
          </Button>
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Product Info */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            {product.store_name && (
              <p className="text-muted-foreground mt-1">
                by{" "}
                <Link
                  href={`/stores/${product.store_slug}`}
                  className="text-primary hover:underline"
                >
                  {product.store_name}
                </Link>
              </p>
            )}
          </div>

          {product.image_urls && product.image_urls.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {product.image_urls.map((url, i) => (
                <div key={i} className="relative aspect-video w-full overflow-hidden rounded-lg">
                  <Image
                    src={url}
                    alt={`${product.name} image ${i + 1}`}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Badge variant={product.status === "active" ? "default" : "secondary"}>
              {product.status}
            </Badge>
            {product.requires_shipping && (
              <Badge variant="outline">Physical</Badge>
            )}
            <Badge variant={product.payment_mode === "instant" ? "default" : "outline"}>
              {product.payment_mode === "instant" ? "x402 Instant" : "Escrow"}
            </Badge>
            {product.stock !== undefined && (
              <span className="text-sm text-muted-foreground">
                {product.stock === -1 ? "Unlimited stock" : `${product.stock} in stock`}
              </span>
            )}
          </div>

          {product.description && (
            <div>
              <h2 className="font-semibold mb-2">Description</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {product.description}
              </p>
            </div>
          )}

          {product.external_url && (
            <div>
              <h2 className="font-semibold mb-2">External Link</h2>
              <a
                href={product.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {product.external_url}
              </a>
            </div>
          )}
        </div>

        {/* Purchase Card */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                ${product.price_usd?.toFixed(2)} USDC
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {product.price_usdc?.toLocaleString()} micro-units
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isConnected ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Connect your agent to purchase this product.
                  </p>
                  <Link href="/dashboard">
                    <Button className="w-full">Connect Agent</Button>
                  </Link>
                </div>
              ) : wallets.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    You need a verified wallet to make purchases.
                  </p>
                  <Link href="/dashboard/wallets">
                    <Button className="w-full">Connect Wallet</Button>
                  </Link>
                </div>
              ) : product.status !== "active" ? (
                <p className="text-sm text-muted-foreground">
                  This product is currently unavailable.
                </p>
              ) : product.stock === 0 ? (
                <p className="text-sm text-muted-foreground">
                  This product is out of stock.
                </p>
              ) : product.payment_mode === "instant" ? (
                <>
                  <div className="p-3 bg-muted rounded-lg space-y-2">
                    <h3 className="text-sm font-semibold">x402 Instant Purchase</h3>
                    <p className="text-xs text-muted-foreground">
                      This product supports instant purchase via the x402 protocol.
                      AI Agents can buy it in a single HTTP request.
                    </p>
                    <div className="space-y-1 text-xs font-mono">
                      <p>
                        <span className="text-muted-foreground">Endpoint:</span>{" "}
                        <code className="bg-background px-1 rounded">
                          POST /api/v1/products/{product.id}/buy
                        </code>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Price:</span>{" "}
                        ${product.price_usd?.toFixed(2)} USDC ({product.price_usdc?.toLocaleString()} micro-units)
                      </p>
                      <p>
                        <span className="text-muted-foreground">Network:</span>{" "}
                        Base Sepolia
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    No API key needed. Send a POST request — the first call returns
                    402 with payment requirements in the PAYMENT-REQUIRED header.
                    Include your payment proof in the PAYMENT-SIGNATURE header to
                    complete the purchase.
                  </p>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium">Payment Wallet</label>
                    <Select value={selectedWallet} onValueChange={setSelectedWallet}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select wallet" />
                      </SelectTrigger>
                      <SelectContent>
                        {wallets.map((w) => (
                          <SelectItem key={w.id} value={w.address!}>
                            <span className="font-mono text-xs">
                              {w.address?.slice(0, 6)}...{w.address?.slice(-4)}
                            </span>
                            <span className="ml-2 text-muted-foreground uppercase text-xs">
                              ({w.chain})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {product.requires_shipping && (
                    <div className="space-y-3 border-t pt-4">
                      <h3 className="text-sm font-semibold">Shipping Address</h3>
                      <div>
                        <label className="text-xs text-muted-foreground">Recipient Name *</label>
                        <Input
                          value={shippingAddr.recipient_name}
                          onChange={(e) => setShippingAddr({ ...shippingAddr, recipient_name: e.target.value })}
                          placeholder="John Doe"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Phone *</label>
                        <Input
                          value={shippingAddr.phone}
                          onChange={(e) => setShippingAddr({ ...shippingAddr, phone: e.target.value })}
                          placeholder="+1-555-0100"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Address Line 1 *</label>
                        <Input
                          value={shippingAddr.address_line1}
                          onChange={(e) => setShippingAddr({ ...shippingAddr, address_line1: e.target.value })}
                          placeholder="123 Main St"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Address Line 2</label>
                        <Input
                          value={shippingAddr.address_line2 ?? ""}
                          onChange={(e) => setShippingAddr({ ...shippingAddr, address_line2: e.target.value })}
                          placeholder="Apt 4B"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground">City *</label>
                          <Input
                            value={shippingAddr.city}
                            onChange={(e) => setShippingAddr({ ...shippingAddr, city: e.target.value })}
                            placeholder="San Francisco"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">State</label>
                          <Input
                            value={shippingAddr.state ?? ""}
                            onChange={(e) => setShippingAddr({ ...shippingAddr, state: e.target.value })}
                            placeholder="CA"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground">Country *</label>
                          <Input
                            value={shippingAddr.country}
                            onChange={(e) => setShippingAddr({ ...shippingAddr, country: e.target.value })}
                            placeholder="US"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Postal Code *</label>
                          <Input
                            value={shippingAddr.postal_code}
                            onChange={(e) => setShippingAddr({ ...shippingAddr, postal_code: e.target.value })}
                            placeholder="94105"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Notes</label>
                        <Textarea
                          value={shippingAddr.notes ?? ""}
                          onChange={(e) => setShippingAddr({ ...shippingAddr, notes: e.target.value })}
                          placeholder="Ring doorbell"
                          rows={2}
                        />
                      </div>
                    </div>
                  )}

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleCheckout}
                    disabled={checkoutLoading || !selectedWallet}
                  >
                    {checkoutLoading ? "Creating Order..." : "Buy Now"}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    Payment via USDC on Base network. Funds held in escrow until delivery.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
