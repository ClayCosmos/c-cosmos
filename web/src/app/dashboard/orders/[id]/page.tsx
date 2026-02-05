"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getOrder, cancelOrder, completeOrder, markOrderPaid, type Order } from "@/lib/api";
import { useApiKey } from "@/hooks/useApiKey";
import { getOrderStatusColor, formatDateTime } from "@/lib/utils/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const { apiKey, isConnected, loading: authLoading } = useApiKey();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!apiKey || !orderId) return;
    setLoading(true);
    try {
      const o = await getOrder(apiKey, orderId);
      setOrder(o);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load order");
    } finally {
      setLoading(false);
    }
  }, [apiKey, orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  async function handleMarkPaid() {
    if (!txHash.trim()) {
      alert("Please enter the transaction hash");
      return;
    }
    setActionLoading(true);
    try {
      await markOrderPaid(apiKey!, orderId, txHash);
      loadOrder();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to mark as paid");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleComplete() {
    if (!confirm("Confirm delivery received? This will release funds to the seller.")) return;
    setActionLoading(true);
    try {
      await completeOrder(apiKey!, orderId);
      loadOrder();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to complete order");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel this order?")) return;
    setActionLoading(true);
    try {
      await cancelOrder(apiKey!, orderId);
      router.push("/dashboard/orders");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to cancel order");
    } finally {
      setActionLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-muted-foreground">
          Please <Link href="/dashboard" className="text-primary hover:underline">connect</Link> your API key first.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-muted-foreground">Loading order...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12 space-y-4">
        <p className="text-destructive">{error || "Order not found"}</p>
        <Link href="/dashboard/orders">
          <Button variant="outline">Back to Orders</Button>
        </Link>
      </div>
    );
  }


  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-12">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/orders">
          <Button variant="ghost" size="sm">
            &larr; Back
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Order Details</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">{order.product_name}</CardTitle>
              <p className="text-sm text-muted-foreground font-mono mt-1">
                {order.order_no}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={`text-sm ${getOrderStatusColor(order.status!)}`}>
                {order.status}
              </Badge>
              <Badge variant={order.payment_mode === "instant" ? "default" : "outline"} className="text-sm">
                {order.payment_mode === "instant" ? "x402" : "Escrow"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Amount */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Amount</h3>
            <p className="text-2xl font-bold">${order.amount_usd?.toFixed(2)} USDC</p>
            <p className="text-sm text-muted-foreground">
              {order.amount_usdc?.toLocaleString()} micro-units
            </p>
          </div>

          {/* Timeline */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Created</h3>
              <p>{formatDateTime(order.created_at)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Deadline</h3>
              <p>{formatDateTime(order.deadline)}</p>
            </div>
            {order.delivered_at && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Delivered</h3>
                <p>{formatDateTime(order.delivered_at)}</p>
              </div>
            )}
            {order.completed_at && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Completed</h3>
                <p>{formatDateTime(order.completed_at)}</p>
              </div>
            )}
          </div>

          {/* Wallets */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Buyer Wallet</h3>
              <p className="font-mono text-sm break-all">{order.buyer_wallet}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Seller Wallet</h3>
              <p className="font-mono text-sm break-all">{order.seller_wallet}</p>
            </div>
          </div>

          {/* Shipping Address */}
          {order.shipping_address && (
            <div className="p-4 bg-blue-50 rounded-lg space-y-2">
              <h3 className="font-medium text-blue-800">Shipping Address</h3>
              <div className="text-sm space-y-1">
                <p className="font-medium">{order.shipping_address.recipient_name}</p>
                <p>{order.shipping_address.phone}</p>
                <p>{order.shipping_address.address_line1}</p>
                {order.shipping_address.address_line2 && <p>{order.shipping_address.address_line2}</p>}
                <p>
                  {order.shipping_address.city}
                  {order.shipping_address.state ? `, ${order.shipping_address.state}` : ""}{" "}
                  {order.shipping_address.postal_code}
                </p>
                <p>{order.shipping_address.country}</p>
                {order.shipping_address.notes && (
                  <p className="text-muted-foreground italic">Notes: {order.shipping_address.notes}</p>
                )}
              </div>
            </div>
          )}

          {/* Payment Details */}
          {order.payment_mode === "instant" ? (
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <h3 className="font-medium">x402 Instant Payment</h3>
              <p className="text-sm text-muted-foreground">
                This order was completed instantly via the x402 protocol.
              </p>
            </div>
          ) : (
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <h3 className="font-medium">Escrow Payment Details</h3>
              <div className="grid gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Contract: </span>
                  <a
                    href={`https://sepolia.basescan.org/address/${order.escrow_contract}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-blue-600 hover:underline break-all"
                  >
                    {order.escrow_contract}
                  </a>
                </div>
                <div>
                  <span className="text-muted-foreground">Order ID: </span>
                  <span className="font-mono break-all">{order.escrow_order_id}</span>
                </div>
              </div>
            </div>
          )}

          {/* Transaction Hash */}
          {order.tx_hash && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Payment Transaction</h3>
              <a
                href={`https://sepolia.basescan.org/tx/${order.tx_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-blue-600 hover:underline break-all"
              >
                {order.tx_hash}
              </a>
            </div>
          )}

          {/* Delivery Content */}
          {order.delivery_content && (order.status === "paid" || order.status === "completed") && (
            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-medium text-green-800 mb-2">Delivery Content</h3>
              <pre className="text-sm whitespace-pre-wrap break-all bg-white p-3 rounded border">
                {order.delivery_content}
              </pre>
            </div>
          )}

          {/* Actions */}
          <div className="border-t pt-6 space-y-4">
            {order.status === "pending" && (
              <>
                <div>
                  <h3 className="font-medium mb-2">Mark as Paid</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    After completing the on-chain payment, enter the transaction hash below.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={txHash}
                      onChange={(e) => setTxHash(e.target.value)}
                      placeholder="0x..."
                      className="font-mono"
                    />
                    <Button onClick={handleMarkPaid} disabled={actionLoading}>
                      Submit
                    </Button>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  onClick={handleCancel}
                  disabled={actionLoading}
                >
                  Cancel Order
                </Button>
              </>
            )}

            {order.status === "paid" && (
              <div>
                <h3 className="font-medium mb-2">Confirm Receipt</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Once you have received the delivery, confirm to release the payment to the seller.
                </p>
                <Button onClick={handleComplete} disabled={actionLoading}>
                  Confirm Delivery Received
                </Button>
              </div>
            )}

            {order.status === "completed" && (
              <div className="text-center py-4">
                <p className="text-green-600 font-medium">Order completed successfully!</p>
              </div>
            )}

            {order.status === "cancelled" && (
              <div className="text-center py-4">
                <p className="text-muted-foreground">This order has been cancelled.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
