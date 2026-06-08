"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChevronLeft,
  ShoppingCart,
  Package,
  Truck,
  PackageCheck,
  Home,
  FileText,
  Download,
  Star,
  X,
} from "lucide-react";
import { submitReview, fetchOrderById, fetchOrderByOrderNumber, returnRequestOrder, createSupportTicket, fetchProductById, cancelOrder, fetchProductReviews, updateReview } from "@/lib/api";
import { useAuthModal } from "@/provider/auth-modal-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { ApiAddress, ApiOrder, ApiOrderItem, ApiProduct } from "@/types/api";
import { apiAddressPostalCode, apiAddressStreet } from "@/types/api";

const TRACKING_STAGES = [
  { key: "placed", label: "Order Placed", icon: ShoppingCart, status: "CREATED" },
  { key: "packed", label: "Order Packed", icon: Package, status: "PACKED" },
  { key: "shipped", label: "In Transit", icon: Truck, status: "SHIPPED" },
  { key: "out", label: "Out for delivery", icon: PackageCheck, status: "OUT_FOR_DELIVERY" },
  { key: "delivered", label: "Delivered", icon: Home, status: "DELIVERED" },
] as const;

const STATUS_ORDER = [
  "CREATED",
  "PENDING",
  "FAILED",
  "PAYMENT_FAILED",
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "CANCELLED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "RETURN_REQUESTED",
  "REFUND_INITIATED",
  "RETURN_APPROVED",
  "RETURN_PICKED",
  "RETURN_RECEIVED",
  "REFUND_COMPLETED",
];

function getDateForStage(order: ApiOrder, key: string): string | null {
  const d =
    key === "placed"
      ? order.createdAt
      : key === "packed"
        ? order.packedAt
        : key === "shipped"
          ? order.shippedAt
          : key === "out"
            ? order.outForDeliveryAt
            : order.deliveredAt;
  return d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
}

function isStageReached(order: ApiOrder, stageStatus: string): boolean {
  const statusTransitions = new Set(
    (order.statusHistory ?? []).map((s) => s.toStatus).filter(Boolean),
  );
  if (statusTransitions.has(stageStatus)) return true;

  const idx = STATUS_ORDER.indexOf(order.status);
  const stageIdx = STATUS_ORDER.indexOf(stageStatus);
  if (idx < 0 || stageIdx < 0) return stageStatus === order.status;

  // Terminal states still keep previously reached logistics milestones.
  if (order.status === "CANCELLED" || order.status === "FAILED" || order.status === "PAYMENT_FAILED") {
    if (stageStatus === "CREATED") return true;
    return statusTransitions.has(stageStatus);
  }

  return idx >= stageIdx;
}

function getOrderItemImage(item: ApiOrderItem): string {
  const variant = item.variantId && typeof item.variantId === "object" ? item.variantId : null;
  if (Array.isArray(variant?.images) && variant.images.length && typeof variant.images[0] === "string") {
    return variant.images[0];
  }
  const fromProductLike = (p: unknown): string | undefined => {
    if (!p || typeof p !== "object") return undefined;
    const rec = p as Record<string, unknown>;
    const base = rec.baseImageUrl;
    if (Array.isArray(base) && base.length > 0 && typeof base[0] === "string") return base[0];
    if (typeof base === "string" && base) return base;
    if (typeof rec.thumbnail === "string" && rec.thumbnail) return rec.thumbnail;
    if (typeof rec.imageUrl === "string" && rec.imageUrl) return rec.imageUrl;
    if (typeof rec.image === "string" && rec.image) return rec.image;
    return undefined;
  };
  const variantProductImage = fromProductLike(variant?.productId);
  if (variantProductImage) return variantProductImage;
  const productImage = fromProductLike(item.productId);
  if (productImage) return productImage;
  return "https://picsum.photos/seed/gift/400/400";
}

function getOrderItemProductId(item: ApiOrderItem): string | undefined {
  const fromProduct =
    typeof item.productId === "string"
      ? item.productId
      : (item.productId as { _id?: string } | undefined)?._id;
  if (fromProduct) return fromProduct;
  const variant = item.variantId && typeof item.variantId === "object" ? item.variantId : null;
  const fromVariantProduct =
    typeof variant?.productId === "string"
      ? variant.productId
      : (variant?.productId as { _id?: string } | undefined)?._id;
  return fromVariantProduct;
}

function getProductImageFromApiProduct(product?: ApiProduct): string | undefined {
  if (!product) return undefined;
  const base = product.baseImageUrl;
  if (Array.isArray(base) && base.length > 0 && typeof base[0] === "string") return base[0];
  if (typeof base === "string" && base) return base;
  const rec = product as unknown as Record<string, unknown>;
  if (typeof rec.thumbnail === "string" && rec.thumbnail) return rec.thumbnail;
  if (typeof rec.imageUrl === "string" && rec.imageUrl) return rec.imageUrl;
  if (typeof rec.image === "string" && rec.image) return rec.image;
  return undefined;
}

function escapeHtml(text: unknown): string {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toApiAddress(raw: ApiOrder["deliveryAddress"]): ApiAddress | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const line1 = String(a.addressLine1 ?? a.line ?? "").trim();
  const city = String(a.city ?? "").trim();
  const state = String(a.state ?? "").trim();
  if (!line1 && !city) return null;
  return {
    _id: "",
    addressLine1: line1 || "—",
    addressLine2: a.addressLine2 != null ? String(a.addressLine2).trim() : undefined,
    city: city || "—",
    state: state || "—",
    country: a.country != null ? String(a.country) : "INDIA",
    zipCode: String(a.zipCode ?? a.postal_code ?? "").trim() || "—",
  };
}

function formatPaymentLabel(method?: string): string {
  if (!method) return "—";
  const u = method.toLowerCase();
  if (u === "cod") return "Cash on Delivery (COD)";
  if (u === "upi") return "UPI";
  if (u === "card") return "Card";
  if (u === "wallet") return "Wallet";
  if (u === "online") return "Online payment";
  return escapeHtml(method);
}

function invoiceItemRow(item: ApiOrderItem): { title: string; variant?: string; qty: number; unit: number; line: number } {
  const variant = item.variantId && typeof item.variantId === "object" ? item.variantId : null;
  const fromVariantProduct =
    variant?.productId && typeof variant.productId === "object" ? (variant.productId as ApiProduct) : null;
  const fromItemProduct = item.productId && typeof item.productId === "object" ? (item.productId as ApiProduct) : null;
  const product = fromVariantProduct ?? fromItemProduct;
  const title = (item as any).productName || (product?.title ? String(product.title) : "Product");
  const variantTitle =
    variant && typeof variant === "object" && "title" in variant && (variant as { title?: string }).title
      ? String((variant as { title?: string }).title)
      : undefined;
  const qty = item.quantity ?? 0;
  const unit = item.price ?? 0;
  return { title, variant: variantTitle, qty, unit, line: qty * unit };
}

function buildInvoiceHtml(order: ApiOrder): string {
  const orderNo = escapeHtml(order.orderNumber ?? order._id);
  const dateStr = order.createdAt
    ? escapeHtml(
        new Date(order.createdAt).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      )
    : "—";

  const cust = order.customerId;
  const customerName =
    typeof cust === "object" && cust !== null && "fullName" in cust && cust.fullName
      ? escapeHtml(cust.fullName)
      : "—";
  const customerEmail =
    typeof cust === "object" && cust !== null && "email" in cust && cust.email ? escapeHtml(cust.email) : "";
  const customerPhone =
    typeof cust === "object" && cust !== null && "phone" in cust && (cust as { phone?: string }).phone
      ? escapeHtml((cust as { phone?: string }).phone)
      : "";

  const ven = order.vendorId;
  const vendorName =
    typeof ven === "object" && ven !== null && "name" in ven && ven.name ? escapeHtml(ven.name) : "—";

  const addr = toApiAddress(order.deliveryAddress);
  const addrLines: string[] = [];
  if (addr) {
    addrLines.push(escapeHtml(apiAddressStreet(addr)));
    if (addr.addressLine2?.trim()) addrLines.push(escapeHtml(addr.addressLine2));
    addrLines.push(
      escapeHtml(
        `${addr.city}, ${addr.state} ${apiAddressPostalCode(addr)}, ${addr.country}`,
      ),
    );
  }

  const items = (order.items ?? []).map(invoiceItemRow);
  const subtotal = items.reduce((s, r) => s + r.line, 0);
  const shippingFee = order.shippingFee ?? 0;
  const discount = order.discountAmount ?? 0;
  const platformFee = order.platformFee ?? 0;
  const gstRate = order.gstRate;
  const total = order.totalAmount ?? subtotal + shippingFee - discount + platformFee;

  const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  const itemRows = items
    .map(
      (row, i) => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top;">${i + 1}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
        <strong>${escapeHtml(row.title)}</strong>${row.variant ? `<br/><span style="color:#6b7280;font-size:12px;">Variant: ${escapeHtml(row.variant)}</span>` : ""}
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${row.qty}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${money(row.unit)}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${money(row.line)}</td>
    </tr>`,
    )
    .join("");

  const discountRow =
    discount > 0
      ? `<tr><td style="padding:8px;text-align:right;color:#059669;">Discount</td><td style="padding:8px;text-align:right;color:#059669;">−${money(discount)}</td></tr>`
      : "";
  const platformRow =
    platformFee > 0
      ? `<tr><td style="padding:8px;text-align:right;">Platform / convenience fee</td><td style="padding:8px;text-align:right;">${money(platformFee)}</td></tr>`
      : "";

  const gstNote =
    gstRate != null && Number.isFinite(gstRate)
      ? `<p style="margin:12px 0 0;font-size:11px;color:#6b7280;">Tax: GST rate applied on this order: ${(gstRate * 100).toFixed(0)}%. Amounts are inclusive of applicable taxes as per order.</p>`
      : "";

  const trackingBlock =
    order.trackingNumber || order.courierName || order.trackingUrl
      ? `<div class="box" style="margin-top:16px;">
          <h3 style="margin:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Shipment</h3>
          ${order.courierName ? `<p style="margin:4px 0;"><strong>Courier:</strong> ${escapeHtml(order.courierName)}</p>` : ""}
          ${order.trackingNumber ? `<p style="margin:4px 0;"><strong>Tracking #:</strong> ${escapeHtml(order.trackingNumber)}</p>` : ""}
          ${order.trackingUrl ? `<p style="margin:4px 0;word-break:break-all;"><strong>Tracking URL:</strong> ${escapeHtml(order.trackingUrl)}</p>` : ""}
        </div>`
      : "";

  const paymentIdRow = order.paymentId
    ? `<p style="margin:8px 0 0;font-size:12px;"><strong>Payment reference:</strong> ${escapeHtml(order.paymentId)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Invoice ${orderNo}</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111827; margin: 0; padding: 24px; max-width: 800px; margin-left: auto; margin-right: auto; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .muted { color: #6b7280; font-size: 13px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
    @media print { body { padding: 16px; } .no-print-btn { display: none; } }
    .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; background: #fafafa; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    table.invoice-totals { width: auto; max-width: 360px; margin-left: auto; margin-top: 12px; }
    th { text-align: left; padding: 10px 8px; border-bottom: 2px solid #e5e7eb; color: #374151; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    th:nth-child(3), th:nth-child(4), th:nth-child(5) { text-align: right; }
    th:nth-child(3) { text-align: center; }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
    <div>
      <h1>Tax invoice</h1>
      <p class="muted">Gift Factory</p>
    </div>
    <div style="text-align:right;">
      <p style="margin:0;font-size:15px;"><strong>Order</strong> ${orderNo}</p>
      <p style="margin:6px 0 0;font-size:13px;" class="muted">Placed: ${dateStr}</p>
      <p style="margin:4px 0 0;font-size:13px;"><strong>Order status:</strong> ${escapeHtml(order.status)}</p>
    </div>
  </div>

  <div class="grid2">
    <div class="box">
      <h3 style="margin:0 0 10px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Bill to</h3>
      <p style="margin:0;font-size:15px;font-weight:600;">${customerName}</p>
      ${customerEmail ? `<p style="margin:6px 0 0;font-size:13px;">${customerEmail}</p>` : ""}
      ${customerPhone ? `<p style="margin:4px 0 0;font-size:13px;">Phone: ${customerPhone}</p>` : ""}
    </div>
    <div class="box">
      <h3 style="margin:0 0 10px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Sold by</h3>
      <p style="margin:0;font-size:15px;font-weight:600;">${vendorName}</p>
    </div>
  </div>

  <div class="box" style="margin-top:16px;">
    <h3 style="margin:0 0 10px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Shipping address</h3>
    ${
      addrLines.length
        ? addrLines.map((line) => `<p style="margin:4px 0;font-size:14px;line-height:1.45;">${line}</p>`).join("")
        : `<p style="margin:0;color:#9ca3af;">No address on file</p>`
    }
  </div>

  <div style="margin-top:20px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:8px;">
    <p style="margin:0 0 6px;font-size:14px;"><strong>Payment</strong> ${formatPaymentLabel(order.paymentMethod)}</p>
    <p style="margin:0;font-size:13px;color:#374151;"><strong>Payment status:</strong> ${escapeHtml(order.paymentStatus ?? "—")}</p>
    ${paymentIdRow}
  </div>

  ${trackingBlock}

  <h2 style="margin:28px 0 12px;font-size:15px;">Items</h2>
  <table>
    <thead>
      <tr>
        <th style="width:36px;">#</th>
        <th>Description</th>
        <th style="text-align:center;width:72px;">Qty</th>
        <th style="width:100px;">Rate</th>
        <th style="width:110px;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows || `<tr><td colspan="5" style="padding:16px;color:#9ca3af;">No line items</td></tr>`}
    </tbody>
  </table>

  <table class="invoice-totals">
    <tbody>
      <tr><td style="padding:8px;text-align:right;">Subtotal</td><td style="padding:8px;text-align:right;width:120px;">${money(subtotal)}</td></tr>
      ${discountRow}
      <tr><td style="padding:8px;text-align:right;">Shipping</td><td style="padding:8px;text-align:right;">${shippingFee > 0 ? money(shippingFee) : "—"}</td></tr>
      ${platformRow}
      <tr><td style="padding:12px 8px;text-align:right;font-size:16px;font-weight:700;border-top:2px solid #e5e7eb;">Total</td><td style="padding:12px 8px;text-align:right;font-size:16px;font-weight:700;border-top:2px solid #e5e7eb;">${money(total)}</td></tr>
    </tbody>
  </table>
  ${gstNote}

  <p style="margin-top:32px;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;">
    This is a computer-generated invoice for your records. For support, contact Gift Factory with your order number.
  </p>
</body>
</html>`;
}

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const idOrNumber = use(params).id;
  const queryClient = useQueryClient();
  const { status: sessionStatus, data: sessionData } = useSession();
  const router = useRouter();
  const { openAuthModal } = useAuthModal();
  const authOpenedRef = useRef(false);
  const isId = /^[a-f0-9]{24}$/i.test(idOrNumber) || /^c[a-z0-9]{24}$/i.test(idOrNumber);

  useEffect(() => {
    if (sessionStatus !== "authenticated" && sessionStatus !== "loading" && !authOpenedRef.current) {
      authOpenedRef.current = true;
      openAuthModal({ message: "Sign in to view order details", callbackUrl: `/orders/${idOrNumber}` });
      router.replace("/");
    }
  }, [sessionStatus, openAuthModal, router, idOrNumber]);

  const { data: orderRes, isLoading, isError, error } = useQuery({
    queryKey: ["customer", "order", idOrNumber],
    queryFn: () =>
      isId ? fetchOrderById(idOrNumber) : fetchOrderByOrderNumber(idOrNumber),
    enabled: sessionStatus === "authenticated",
  });

  const order = orderRes?.data as ApiOrder | undefined;
  const productIds = useMemo(() => {
    const ids = new Set<string>();
    (order?.items ?? []).forEach((it) => {
      const id = getOrderItemProductId(it);
      if (id) ids.add(id);
    });
    return Array.from(ids);
  }, [order?.items]);
  const productQueries = useQueries({
    queries: productIds.map((id) => ({
      queryKey: ["web", "product", id],
      queryFn: () => fetchProductById(id),
      enabled: !!id && sessionStatus === "authenticated",
    })),
  });

  const reviewQueries = useQueries({
    queries: productIds.map((id) => ({
      queryKey: ["web", "product", id, "reviews"],
      queryFn: () => fetchProductReviews(id),
      enabled: !!id && sessionStatus === "authenticated",
    })),
  });

  const reviewQueriesSerialized = JSON.stringify(
    reviewQueries.map((q) => {
      const reviews = (q.data?.data ?? []) as any[];
      return reviews.map((r) => ({
        id: r._id || r.id,
        rating: Number(r.rating) || 0,
        comment: r.comment,
        cust: typeof r.customerId === "object" ? r.customerId?._id : r.customerId,
        userId: r.userId,
        orderId: r.orderId,
      }));
    })
  );

  const userReviewsMap = useMemo(() => {
    const userId = sessionData?.userId;
    if (!userId) return {} as Record<string, { id: string; rating: number; comment: string }>;

    const next: Record<string, { id: string; rating: number; comment: string }> = {};
    reviewQueries.forEach((query, index) => {
      const productId = productIds[index];
      if (!productId) return;

      const reviews = (query.data?.data ?? []) as Array<{
        _id?: string;
        id?: string;
        rating?: number;
        comment?: string;
        customerId?: string | { _id?: string } | null;
        userId?: string;
        orderId?: string;
      }>;

      const userReviews = reviews.filter((review) => {
        if (typeof review.customerId === "string") return review.customerId === userId;
        if (review.customerId && typeof review.customerId === "object") return review.customerId._id === userId;
        if (typeof review.userId === "string") return review.userId === userId;
        return false;
      });

      userReviews.forEach((review) => {
        const oId = review.orderId;
        const ratingVal = Number(review.rating);
        const rId = review._id || review.id;
        if (oId && !isNaN(ratingVal) && rId) {
          next[`${oId}_${productId}`] = {
            id: rId,
            rating: ratingVal,
            comment: review.comment || "",
          };
        }
      });
    });

    return next;
  }, [productIds, sessionData?.userId, reviewQueriesSerialized]);
  const productMap = useMemo(() => {
    const map = new Map<string, ApiProduct>();
    productQueries.forEach((q, i) => {
      const raw = q.data;
      const product = (raw as { data?: ApiProduct } | undefined)?.data;
      if (product?._id && productIds[i]) map.set(productIds[i], product);
    });
    return map;
  }, [productQueries, productIds]);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  // Review Dialog State
  const [reviewItem, setReviewItem] = useState<{ productId: string; title: string } | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnRequestType, setReturnRequestType] = useState<"return" | "exchange">("return");
  const [returnReason, setReturnReason] = useState("");
  const [returnComment, setReturnComment] = useState("");
  const [supportDialogOpen, setSupportDialogOpen] = useState(false);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportDescription, setSupportDescription] = useState("");
  const [supportType, setSupportType] = useState<"ORDER" | "PAYMENT" | "DELIVERY" | "RETURN" | "OTHER">("DELIVERY");
  const [supportPriority, setSupportPriority] = useState<"low" | "medium" | "high">("medium");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const handleOpenReview = (productId: string, title: string) => {
    const ratingKey = `${order?._id}_${productId}`;
    const existing = userReviewsMap[ratingKey];
    setReviewItem({ productId, title });
    setReviewRating(existing?.rating || 0);
    setReviewComment(existing?.comment || "");
    setActiveReviewId(existing?.id || null);
  };

  const returnRequestMutation = useMutation({
    mutationFn: (payload: { requestType: "return" | "refund"; reason: string; comment?: string }) =>
      returnRequestOrder(order?.orderNumber ?? order?._id ?? idOrNumber, payload),
    onSuccess: () => {
      toast.success("Return/Exchange request submitted");
      setReturnDialogOpen(false);
      setReturnReason("");
      setReturnComment("");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || "Failed to submit request";
      toast.error(msg);
    },
  });

  const supportTicketMutation = useMutation({
    mutationFn: () =>
      createSupportTicket({
        subject: supportSubject,
        description: supportDescription,
        type: supportType,
        priority: supportPriority,
        orderId: order?._id,
      }),
    onSuccess: () => {
      toast.success("Support ticket created successfully");
      setSupportDialogOpen(false);
      setSupportSubject("");
      setSupportDescription("");
      setSupportType("DELIVERY");
      setSupportPriority("medium");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || "Failed to create support ticket";
      toast.error(msg);
    },
  });

  const submitReturnOrExchange = () => {
    const trimmedReason = returnReason.trim();
    if (!trimmedReason) {
      toast.error("Please enter a reason");
      return;
    }
    // Backend supports return/refund; map exchange flow to return with explicit reason.
    returnRequestMutation.mutate({
      requestType: "return",
      reason: returnRequestType === "exchange" ? `Exchange request: ${trimmedReason}` : trimmedReason,
      comment: returnComment.trim() || undefined,
    });
  };

  const submitSupportCase = () => {
    if (!supportSubject.trim() || !supportDescription.trim()) {
      toast.error("Please add subject and description");
      return;
    }
    supportTicketMutation.mutate();
  };

  const cancelOrderMutation = useMutation({
    mutationFn: () => cancelOrder(order?._id ?? idOrNumber),
    onSuccess: () => {
      toast.success("Order cancelled successfully");
      setCancelDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["customer", "order", idOrNumber] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || "Failed to cancel order";
      toast.error(msg);
    },
  });

  const handleSubmitReview = async () => {
    if (!reviewItem || reviewRating === 0) {
      toast.error("Please select a rating");
      return;
    }
    setIsSubmittingReview(true);
    try {
      if (activeReviewId) {
        await updateReview(activeReviewId, {
          rating: reviewRating,
          comment: reviewComment,
        });
        toast.success("Review updated successfully");
      } else {
        const res = await submitReview({
          productId: reviewItem.productId,
          orderId: order?._id,
          rating: reviewRating,
          comment: reviewComment,
        });
        if (res.success || res.status === 200 || res.status === 201) {
          toast.success("Review submitted successfully");
        } else {
          toast.error(res.message || "Failed to submit review");
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["web", "product", reviewItem.productId] });
      await queryClient.invalidateQueries({ queryKey: ["web", "product", reviewItem.productId, "reviews"] });
      setReviewItem(null);
    } catch (e: any) {
      toast.error(e.message || "An error occurred while submitting your review");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleDownloadInvoice = () => {
    if (!order?._id) return;
    setDownloadingInvoice(true);
    try {
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(buildInvoiceHtml(order));
        win.document.close();
        win.print();
      } else {
        toast.error("Pop-up blocked. Allow pop-ups for this site to print the invoice.");
      }
    } finally {
      setDownloadingInvoice(false);
    }
  };

  if (sessionStatus !== "authenticated") {
    return null;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="container mx-auto px-4 py-8 text-center text-destructive">
        <p>{(error as Error)?.message ?? "Order not found"}</p>
        <Link href="/orders" className="mt-4 inline-block">
          <Button variant="outline"><ChevronLeft className="mr-2 h-4 w-4" /> Back to Orders</Button>
        </Link>
      </div>
    );
  }

  const itemCount = order.items?.length ?? 0;
  const subtotal = order.items?.reduce((sum, i) => sum + (i.quantity ?? 0) * (i.price ?? 0), 0) ?? 0;
  const total = order.totalAmount ?? subtotal;
  const shippingValue = order.shippingFee ?? Math.max(total - subtotal, 0);
  const shippingLabel = shippingValue > 0 ? shippingValue.toLocaleString("en-IN") : "—";

  const canCancel =
    order &&
    order.status !== "CANCELLED" &&
    order.status !== "DELIVERED" &&
    order.status !== "SHIPPED" &&
    order.status !== "OUT_FOR_DELIVERY" &&
    order.paymentStatus?.toUpperCase() !== "PAID" &&
    order.paymentStatus?.toUpperCase() !== "COMPLETED";

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <Link href="/orders">
          <Button variant="ghost" className="gap-2 -ml-2">
            <ChevronLeft className="h-4 w-4" /> Order Details
          </Button>
        </Link>
        <div className="flex flex-wrap gap-2 shrink-0">
          {canCancel && (
            <Button
              variant="destructive"
              className="gap-2"
              onClick={() => setCancelDialogOpen(true)}
              disabled={cancelOrderMutation.isPending}
            >
              <X className="h-4 w-4" />
              Cancel Order
            </Button>
          )}
          <Button
            variant="default"
            className="gap-2"
            onClick={handleDownloadInvoice}
            disabled={downloadingInvoice}
          >
            <Download className="h-4 w-4" />
            {downloadingInvoice ? "Preparing…" : "Download Invoice"}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border">
            <CardContent className="p-4 sm:p-6">
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-4 gap-y-2 text-sm mb-6">
                <div>
                  <p className="text-muted-foreground">Order number</p>
                  <p className="font-semibold">{order.orderNumber ?? order._id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Order placed</p>
                  <p className="font-medium">
                    {order.createdAt
                      ? new Date(order.createdAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                      : "—"}
                  </p>
                </div>
                {order.deliveredAt && (
                  <div>
                    <p className="text-muted-foreground">Delivered</p>
                    <p className="font-medium">
                      {new Date(order.deliveredAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">No of items</p>
                  <p className="font-medium">{itemCount} {itemCount === 1 ? "item" : "items"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{order.status?.toLowerCase().replace(/_/g, " ")}</p>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-foreground mb-2">Order Tracking</h3>
              {(order.status === "CANCELLED" || order.status === "FAILED" || order.status === "PAYMENT_FAILED") && (
                <p className="text-xs text-destructive mb-3">
                  This order is {order.status.toLowerCase().replace(/_/g, " ")}.
                </p>
              )}
              {(order.trackingNumber || order.trackingUrl) && (
                <p className="text-xs text-muted-foreground mb-4">
                  {order.trackingNumber && <>Tracking ID #{order.trackingNumber}</>}
                  {order.trackingUrl && (
                    <>
                      {" · "}
                      <a
                        href={order.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Track on courier site
                      </a>
                    </>
                  )}
                </p>
              )}
              <div className="relative">
                <div className="flex justify-between gap-1">
                  {TRACKING_STAGES.map((stage, i) => {
                    const Icon = stage.icon;
                    const date = getDateForStage(order, stage.key);
                    const reached = isStageReached(order, stage.status);
                    return (
                      <div key={stage.key} className="flex flex-col items-center flex-1 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 shrink-0 ${reached
                            ? "bg-primary border-primary text-primary-foreground"
                            : "bg-muted border-border text-muted-foreground"
                            }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <p className="text-[10px] sm:text-xs font-medium mt-2 text-center leading-tight">
                          {stage.label}
                        </p>
                        {date && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 text-center">{date}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div
                  className="absolute top-5 left-0 right-0 h-0.5 bg-muted -z-10"
                  style={{ left: "5%", right: "5%" }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4 sm:p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Items from the order</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-2 font-medium text-muted-foreground">Product</th>
                      <th className="text-center py-2 px-2 font-medium text-muted-foreground w-20">Quantity</th>
                      <th className="text-right py-2 pl-2 font-medium text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(order.items ?? []).map((item: ApiOrderItem, idx: number) => {
                      // Backend populates items.variantId -> productId
                      const variant = item.variantId as any;
                      const product = (variant?.productId) || (item.productId as ApiProduct | undefined);
                      const variantTitle =
                        variant && typeof variant === "object" && "title" in variant
                          ? variant.title
                          : undefined;

                      const title = (item as any).productName || (product && typeof product === "object" && "title" in product ? product.title : "Product");
                      const fallbackProduct = productMap.get(getOrderItemProductId(item) ?? "");
                      const primaryThumb = (item as any).imageUrl || getOrderItemImage(item);
                      const thumb = primaryThumb.includes("picsum.photos/seed/gift")
                        ? (getProductImageFromApiProduct(fallbackProduct) ?? primaryThumb)
                        : primaryThumb;
                      const qty = item.quantity ?? 0;
                      const price = item.price ?? 0;
                      const lineTotal = qty * price;
                      return (
                        <tr key={idx} className="border-b border-border last:border-0">
                          <td className="py-3 pr-2">
                            <Link
                              href={
                                variant && typeof variant === "object" && variant._id
                                  ? `/products/${encodeURIComponent(getOrderItemProductId(item) || "")}?variantId=${variant._id}`
                                  : `/products/${encodeURIComponent(getOrderItemProductId(item) || "")}`
                              }
                            >
                              <div className="flex items-center gap-3 group cursor-pointer">
                                <div className="relative w-14 h-14 rounded-md overflow-hidden bg-muted shrink-0 ring-1 ring-border/50 group-hover:ring-primary/50 transition-all">
                                  <Image
                                    src={thumb || "https://picsum.photos/seed/gift/400/400"}
                                    alt={title}
                                    fill
                                    className="object-cover group-hover:scale-110 transition-transform duration-300"
                                  />
                                </div>
                                <div>
                                  <p className="font-medium text-foreground group-hover:text-primary transition-colors">{title}</p>
                                  {variantTitle && (
                                    <p className="text-xs text-muted-foreground">Variant: {variantTitle}</p>
                                  )}
                                  <p className="text-xs text-muted-foreground">Qty: {qty} × ₹{price.toLocaleString("en-IN")}</p>
                                </div>
                              </div>
                            </Link>
                            {order.status === "DELIVERED" && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {product?._id && (
                                  (() => {
                                    const ratingKey = `${order._id}_${product._id}`;
                                    const isReviewed = !!userReviewsMap[ratingKey];
                                    return (
                                      <Button
                                        variant="link"
                                        className="p-0 h-auto text-xs text-primary"
                                        onClick={() => handleOpenReview(product._id, title)}
                                      >
                                        {isReviewed ? "Edit Review" : "Write a Review"}
                                      </Button>
                                    );
                                  })()
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setReturnRequestType("return");
                                    setReturnReason("");
                                    setReturnComment("");
                                    setReturnDialogOpen(true);
                                  }}
                                >
                                  Return
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setReturnRequestType("exchange");
                                    setReturnReason("");
                                    setReturnComment("");
                                    setReturnDialogOpen(true);
                                  }}
                                >
                                  Exchange
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setSupportSubject(`Order issue: ${order.orderNumber ?? order._id}`);
                                    setSupportDescription("");
                                    setSupportType("DELIVERY");
                                    setSupportPriority("medium");
                                    setSupportDialogOpen(true);
                                  }}
                                >
                                  Customer Support
                                </Button>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-2 text-center">{qty}</td>
                          <td className="py-3 pl-2 text-right font-medium">
                            ₹{lineTotal.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="border-border bg-muted/20 sticky top-24">
            <CardContent className="p-4 sm:p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{subtotal.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{shippingLabel === "—" ? "—" : `₹${shippingLabel}`}</span>
                </div>
              </div>
              <div className="border-t border-border mt-4 pt-4 flex justify-between text-base font-semibold">
                <span>Total</span>
                <span>₹{total.toLocaleString("en-IN")}</span>
              </div>
              <Link href="/products" className="mt-6 block">
                <Button className="w-full gap-2">
                  Continue Shopping
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!reviewItem} onOpenChange={(open) => !open && setReviewItem(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{activeReviewId ? "Edit Review" : "Review"} for {reviewItem?.title}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewRating(star)}
                  className="focus:outline-none transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-8 w-8 ${star <= reviewRating ? "fill-primary text-primary" : "text-muted border-muted-foreground"
                      }`}
                  />
                </button>
              ))}
            </div>
            {reviewRating > 0 && (
              <p className="text-center text-sm font-medium text-primary">
                {["Poor", "Fair", "Good", "Very Good", "Excellent"][reviewRating - 1]}
              </p>
            )}
            <div className="space-y-2 mt-4">
              <label htmlFor="comment" className="text-sm font-medium">Add a written review (optional)</label>
              <Textarea
                id="comment"
                placeholder="What did you like or dislike?"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setReviewItem(null)} disabled={isSubmittingReview}>
              Cancel
            </Button>
            <Button onClick={handleSubmitReview} disabled={!reviewRating || isSubmittingReview}>
              {isSubmittingReview ? "Saving..." : activeReviewId ? "Update Review" : "Submit Review"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{returnRequestType === "exchange" ? "Request Exchange" : "Request Return"}</DialogTitle>
            <DialogDescription>
              We will review your request and update the status in your order timeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <label className="text-sm font-medium">Reason</label>
              <Input
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder={returnRequestType === "exchange" ? "Wrong size / color, want exchange" : "Product damaged / not as expected"}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Comment (optional)</label>
              <Textarea
                value={returnComment}
                onChange={(e) => setReturnComment(e.target.value)}
                rows={4}
                placeholder="Add extra details"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialogOpen(false)} disabled={returnRequestMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={submitReturnOrExchange} disabled={returnRequestMutation.isPending}>
              {returnRequestMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={supportDialogOpen} onOpenChange={setSupportDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Customer Support</DialogTitle>
            <DialogDescription>
              Create a support case for this order. Our team will reach out soon.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <label className="text-sm font-medium">Subject</label>
              <Input
                value={supportSubject}
                onChange={(e) => setSupportSubject(e.target.value)}
                placeholder="Order delayed beyond ETA"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Type</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={supportType}
                  onChange={(e) => setSupportType(e.target.value as typeof supportType)}
                >
                  <option value="ORDER">Order</option>
                  <option value="PAYMENT">Payment</option>
                  <option value="DELIVERY">Delivery</option>
                  <option value="RETURN">Return</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Priority</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={supportPriority}
                  onChange={(e) => setSupportPriority(e.target.value as typeof supportPriority)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={supportDescription}
                onChange={(e) => setSupportDescription(e.target.value)}
                rows={5}
                placeholder="Describe the issue in detail..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupportDialogOpen(false)} disabled={supportTicketMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={submitSupportCase} disabled={supportTicketMutation.isPending}>
              {supportTicketMutation.isPending ? "Submitting..." : "Create Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this order? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={cancelOrderMutation.isPending}
            >
              No, Keep Order
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelOrderMutation.mutate()}
              disabled={cancelOrderMutation.isPending}
            >
              {cancelOrderMutation.isPending ? "Cancelling..." : "Yes, Cancel Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
