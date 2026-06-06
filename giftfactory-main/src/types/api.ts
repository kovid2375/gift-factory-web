/**
 * Backend API response and entity types (align with MVE-service).
 */

/** Fallback image when product/asset has no image (free, no attribution required). */
export const PLACEHOLDER_IMAGE =
  "https://picsum.photos/seed/gift/400/400";

export interface ApiMeta {
  count: number;
  totalPages: number;
  page: number;
  limit: number;
  source?: string;
}

export function getValidImageUrl(url: unknown): string {
  if (typeof url !== "string" || !url.trim()) return PLACEHOLDER_IMAGE;
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  const prefix = process.env.NEXT_PUBLIC_AWS_PREFIX_URL || process.env.AWS_PREFIX_URL || "https://d3ori68ve27vyu.cloudfront.net";
  return `${prefix}/${trimmed}`;
}

export interface ApiResponse<T> {
  data?: T;
  message?: string;
  meta?: ApiMeta;
  source?: string;
  timestamp?: string;
  accessToken?: string;
  refreshToken?: string;
  status?: number;
  success?: boolean;
}

/** Review / comment embedded on product detail (web products/:id) */
export interface ApiProductComment {
  _id?: string;
  rating?: number;
  comment?: string;
  publisherName?: string;
  createdAt?: string;
  customerId?: string | { fullName?: string };
}

/** Unified review row for product page (embedded comments or /reviews endpoint) */
export interface NormalizedProductReview {
  _id?: string;
  rating: number;
  comment?: string;
  authorName: string;
  createdAt?: string;
}

export function parseAverageRating(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "string" && value.trim() === "") return 0;
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(5, Math.max(0, n));
}

/** MOQ may be a number or `{ min, price }` from B2B APIs */
export function getProductMoqMinimum(moq: number | { min?: number; price?: number } | undefined | null): number | undefined {
  if (moq == null) return undefined;
  if (typeof moq === "object" && moq !== null && "min" in moq && (moq as { min: unknown }).min != null) {
    const n = Number((moq as { min: number }).min);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }
  const n = Number(moq);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Review count from list payload (`commentCount` or embedded `comments` length) */
export function getProductReviewCount(p: ApiProduct): number | undefined {
  if (typeof p.commentCount === "number") return p.commentCount;
  if (Array.isArray(p.comments) && p.comments.length > 0) return p.comments.length;
  return undefined;
}

/** Backend product (web list/detail) - populated categoryId, brandId */
export interface ApiProduct {
  _id: string;
  title: string;
  sub_title?: string;
  slug: string;
  sku?: string;
  description?: string;
  defaultPrice?: number;
  /** M.R.P. / main price (original); when > defaultPrice, show as struck-through */
  mrp?: number;
  /**
   * Full pricing object for base products (no variants).
   * sellingPrice and mrp here take precedence over the top-level defaultPrice / mrp shortcuts.
   */
  price?: {
    sellingPrice: number;
    mrp: number | null;
    discountPercent?: number;
    gstRate?: number;
    paymentGatewayFee?: number;
    packagingFee?: number;
    platformFee?: number;
    commision?: number;
    vendorAmount?: number;
    productSellingPrice?: number;
  };
  /** HSN code for GST classification */
  hsnCode?: number;
  /** Bullet-point product features shown on the detail page */
  features?: string[];
  categoryId?: { _id: string; name: string; slug?: string } | string;
  brandId?: { _id: string; name: string; slug?: string } | string;
  baseImageUrl?: string[];
  thumbnail?: string;
  variantIds?: ApiProductVariant[] | null;
  explicitAttributes?: { label: string; value: string }[];
  seo?: { title: string; sub_title: string };
  visibility?: string;
  status?: string;
  /** Units in stock when there are no variants */
  stock?: number;
  viewCount?: number;
  soldCount?: number;
  clickCount?: number;
  /** Average rating from backend (may be string e.g. "5.0") */
  averageRating?: string | number;
  commentCount?: number;
  comments?: ApiProductComment[];
  policies?: unknown[];
  createdAt?: string;
  updatedAt?: string;
  /** Vendor ID (for cart add) */
  createdBy?: string;
  /** Minimum order quantity (B2B) — number or `{ min, price }` */
  moq?: number | { min?: number; price?: number };
  /** B2B / wholesale price per unit */
  b2bPrice?: number;
  /** Whether product is available for RFQ (request for quote) */
  rfqAvailable?: boolean;
  /** B2B quantity-based price tiers (minQty, maxQty null = no upper limit) */
  b2bPriceTiers?: ApiB2BPriceTier[];
  /** Product variations: attribute name + options (backend-ready: option can have id/sku) */
  variations?: ApiProductVariation[];
}

/** Prefer `comments` on product payload; else use GET /web/products/:id/reviews list */
export function normalizeProductReviews(
  product: ApiProduct | undefined,
  reviewsFromEndpoint: unknown[] | undefined,
): NormalizedProductReview[] {
  const embedded = product?.comments;
  if (Array.isArray(embedded) && embedded.length > 0) {
    return embedded.map((raw) => {
      const c = raw as ApiProductComment;
      const fromCustomer =
        typeof c.customerId === "object" && c.customerId !== null && "fullName" in c.customerId
          ? String((c.customerId as { fullName?: string }).fullName ?? "").trim()
          : "";
      const authorName = c.publisherName?.trim() || fromCustomer || "Anonymous";
      return {
        _id: c._id,
        rating: Number(c.rating) || 0,
        comment: c.comment,
        authorName,
        createdAt: c.createdAt,
      };
    });
  }
  const list = reviewsFromEndpoint ?? [];
  return list.map((raw, index) => {
    const r = raw as {
      _id?: string;
      rating?: number;
      comment?: string;
      createdAt?: string;
      publisherName?: string;
      customerId?: { fullName?: string };
      user?: string;
    };
    const userStr = typeof r.user === "string"
      ? r.user.trim()
      : (r.user && typeof r.user === "object"
          ? String((r.user as any).name || (r.user as any).fullName || "").trim()
          : "");
    const authorName =
      r.publisherName?.trim() ||
      r.customerId?.fullName?.trim() ||
      userStr ||
      "Anonymous";
    return {
      _id: r._id ?? `idx-${index}`,
      rating: Number(r.rating) || 0,
      comment: r.comment,
      authorName,
      createdAt: r.createdAt,
    };
  });
}

/** Backend: single B2B price tier by quantity range */
export interface ApiB2BPriceTier {
  minQty: number;
  maxQty?: number | null;
  price: number;
  /** Optional tier label for display */
  label?: string;
}

/** Backend: product variant (populated on product.variantIds) - has its own price and optional bulk tiers */
export interface ApiProductVariant {
  _id: string;
  title?: string;
  sku?: string;
  price: { mrp: number; sellingPrice: number; discountPercent?: number };
  b2bPriceTiers?: ApiB2BPriceTier[];
  stock?: number;
  reservedStock?: number;
  images?: string[];
  explicitAttributes?: { label: string; value: string }[];
  attributeIds?: { _id: string; title: string; slug?: string; attributeNameId?: string }[];
  /** HSN code for GST classification (overrides product-level hsnCode) */
  hsnCode?: number;
  /** Variant-specific bullet-point features (override / supplement base product features) */
  features?: string[];
  status?: string;
  isDeleted?: boolean;
  createdBy?: string;
}

/** Backend: one variation attribute and its options */
export interface ApiProductVariation {
  /** Attribute name (e.g. "Color", "Size") */
  name: string;
  /** Optional backend attribute key (e.g. "color", "size") */
  key?: string;
  /** Options: string (display value) or object with value + optional id/sku for cart/order */
  options: (string | { value: string; id?: string; sku?: string; priceAdjust?: number })[];
}

/** Normalized product for UI (compatible with ProductCard) */
export interface ProductDisplay {
  id: string;
  title: string;
  description?: string;
  price: number;
  mrp?: number;
  discountPercentage: number;
  rating: number;
  /** From API `commentCount` or `comments.length` — avoids per-card /reviews requests */
  reviewCount?: number;
  thumbnail: string;
  images?: string[];
  category?: string;
  brand?: string;
  slug?: string;
  availabilityStatus?: string;
  stock?: number;
  merchantId?: string;
  moq?: number;
  b2bPriceTiers?: ApiB2BPriceTier[];
  variantCount?: number;
  variantLabels?: string[];
  /** Pre-selected variant ID — when a variant card links directly to add-to-cart */
  preVariantId?: string;
  /** Human-readable variant label shown on listing cards (e.g. "Red / L") */
  variantTitle?: string;
}

export interface ApiCategory {
  _id: string;
  name: string;
  slug?: string;
  parentId?: string | null;
  imageUrl?: string;
}

export interface ApiBrand {
  _id: string;
  name: string;
  slug?: string;
  logoUrl?: string;
  icon?: { secure_url: string; key?: string };
  imageUrl?: string;
}

export interface ApiBanner {
  _id: string;
  id?: string;
  title: string;
  subTitle?: string;
  description?: string;
  type?: string;
  path?: string; // image URL (legacy)
  imageUrl?: string; // backend schema field
  ctaText?: string;
  redirectUrl?: string;
  redirectType?: string;
  redirectId?: string;
  position?: string;
  status?: string;
  product?: string | { _id: string };
}

export function resolveBannerRedirect(banner: ApiBanner): string {
  if (banner.redirectUrl && banner.redirectUrl !== "null") {
    return banner.redirectUrl;
  }
  const type = banner.redirectType || banner.type;
  const id = banner.redirectId || (typeof banner.product === "object" ? banner.product?._id : banner.product);
  
  if (id) {
    if (type === "BRAND") {
      return `/products?brandId=${id}`;
    }
    if (type === "PRODUCT") {
      return `/products/${id}`;
    }
  }
  return "#";
}

export interface ApiOffer {
  _id: string;
  title?: string;
  description?: string;
  discountType?: string;
  discountValue?: number;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
}

export interface ApiWishlistItem {
  _id: string;
  productId: string | ApiProduct;
  /** Specific variant that was wishlisted. Only present for variant-specific entries. */
  variantId?: string | ApiProductVariant;
  productSlug?: string;
  productUrl?: string;
  customerId?: string;
  createdAt?: string;
}

export interface ApiCartItem {
  _id?: string;
  id?: string;
  productId: string | ApiProduct;
  variantId?: string | ApiProductVariant;
  quantity: number;
  priceAtAddition: number;
}

export interface ApiCart {
  _id: string;
  customerId: string;
  merchantId?: string;
  status?: "active" | "abandoned" | "checked_out" | string;
  items?: ApiCartItem[];
  itemsCount?: number;
  totalAmount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiAddress {
  _id: string;
  id?: string;
  fullName?: string;
  phone?: string;
  type?: string;
  /** Legacy / alternate response fields */
  line?: string;
  addressLine1?: string;
  addressLine2?: string;
  city: string;
  state: string;
  postal_code?: string;
  zipCode?: string;
  country: string;
  is_default?: boolean;
  isDefault?: boolean;
  customerId?: string;
}

export function apiAddressStreet(addr: ApiAddress): string {
  const a1 = (addr.addressLine1 ?? addr.line ?? "").trim();
  const a2 = (addr.addressLine2 ?? "").trim();
  return a2 ? `${a1}, ${a2}` : a1;
}

export function apiAddressPostalCode(addr: ApiAddress): string {
  return (addr.zipCode ?? addr.postal_code ?? "").trim();
}

export type OrderStatus =
  | "CREATED"
  | "PENDING"
  | "FAILED"
  | "PAYMENT_FAILED"
  | "CONFIRMED"
  | "PROCESSING"
  | "PACKED"
  | "CANCELLED"
  | "SHIPPED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "RETURN_REQUESTED"
  | "REFUND_INITIATED"
  | "RETURN_APPROVED"
  | "RETURN_PICKED"
  | "RETURN_RECEIVED"
  | "REFUND_COMPLETED"
  | string;

export interface ApiOrderItem {
  productId?: string | ApiProduct | null;
  variantId?: (ApiProductVariant & { productId?: ApiProduct | string | null }) | string | null;
  quantity: number;
  price: number;
  _id?: string;
}

export interface ApiOrder {
  _id: string;
  orderNumber?: string;
  customerId?: string | { _id: string; email?: string; fullName?: string; phone?: string } | null;
  vendorId?: string | { _id: string; name?: string } | null;
  items?: ApiOrderItem[];
  discountAmount?: number;
  totalAmount?: number;
  platformFee?: number;
  shippingFee?: number;
  /** GST rate as decimal (e.g. 0.18 for 18%) */
  gstRate?: number;
  vendorPayableAmount?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentId?: string;
  vendorSettlementStatus?: string;
  status: OrderStatus;
  returnWindowEndsAt?: string;
  statusHistory?: Array<{
    fromStatus?: string;
    toStatus?: string;
    changedAt?: string;
    changedBy?: string;
    reason?: string;
  }>;
  deliveryAddress?: ApiAddress | Record<string, unknown>;
  shippingAddress?: ApiAddress | Record<string, unknown>;
  trackingNumber?: string;
  trackingUrl?: string;
  courierName?: string;
  createdAt?: string;
  updatedAt?: string;
  packedAt?: string;
  shippedAt?: string;
  outForDeliveryAt?: string;
  deliveredAt?: string;
}

/**
 * Resolve the selected variant from product.variantIds using selectedVariations.
 * Price (and tiers) should be taken from the returned variant so the UI updates when selection changes.
 * - If an option has id and it matches a variant _id, use that variant.
 * - Else match variant by attributeIds: variant has attributes whose title matches each selected value (case-insensitive).
 * - Fallback for single variation: match variant whose title contains the selected value.
 */
export function resolveSelectedVariant(
  product: ApiProduct | undefined,
  selectedVariations: Record<string, string>,
): ApiProductVariant | null {
  if (!product?.variantIds?.length) return null;
  const variants = product.variantIds as ApiProductVariant[];
  const names = Object.keys(selectedVariations);
  if (names.length === 0) return null;

  const selectedValues = names.map((n) => selectedVariations[n].trim()).filter(Boolean);
  if (selectedValues.length === 0) return null;

  const norm = (s: string) => s.toLowerCase().trim();

  for (const v of variants) {
    if (!v?.price?.sellingPrice) continue;

    if (
      names.length === 1 &&
      product.variations?.length === 1 &&
      product.variations[0].options.some((opt) => {
        const val = typeof opt === "string" ? opt : opt.value;
        const id = typeof opt === "string" ? undefined : (opt as { id?: string }).id;
        return id && selectedVariations[names[0]] === val && id === v._id;
      })
    ) {
      return v;
    }

    const attrs = v.attributeIds ?? [];
    const variantTitles = attrs.map((a) => norm((a as { title?: string }).title ?? ""));
    const allMatch = selectedValues.every((val) => variantTitles.includes(norm(val)));
    if (allMatch && variantTitles.length >= selectedValues.length) return v;

    if (names.length === 1 && selectedValues.length === 1) {
      const vTitle = (v.title ?? "").toLowerCase();
      if (vTitle.includes(selectedValues[0].toLowerCase())) return v;
    }
  }
  return null;
}

/** Check if a variantIds entry is a populated object (not a raw string ID) */
function isPopulatedVariant(v: unknown): v is ApiProductVariant {
  return typeof v === "object" && v !== null && typeof (v as ApiProductVariant)._id === "string";
}

/** Map backend product to display shape — derives price/stock from first active variant when available */
export function mapApiProductToDisplay(p: ApiProduct): ProductDisplay {
  const populatedVariants = (p.variantIds ?? []).filter(isPopulatedVariant);
  const activeVariants = populatedVariants.filter((v) => !v.isDeleted && v.status !== "rejected");
  const firstVariant = activeVariants[0] ?? null;

  const price = firstVariant?.price?.sellingPrice != null
    ? Number(firstVariant.price.sellingPrice)
    : (p.price?.sellingPrice != null
      ? Number(p.price.sellingPrice)
      : (typeof p.defaultPrice === "number" ? p.defaultPrice : Number(p.defaultPrice) || 0));
  const mrp = firstVariant?.price?.mrp != null
    ? Number(firstVariant.price.mrp)
    : (p.price?.mrp != null
      ? Number(p.price.mrp)
      : (p.mrp != null ? Number(p.mrp) : undefined));
  const discountPercentage =
    mrp != null && mrp > price && mrp > 0
      ? Math.round((1 - price / mrp) * 100)
      : (firstVariant?.price?.discountPercent ?? p.price?.discountPercent ?? 0);

  const category = typeof p.categoryId === "object" && p.categoryId?.name ? p.categoryId.name : "";
  const brand = typeof p.brandId === "object" && p.brandId?.name ? p.brandId.name : "";

  const variantImages = firstVariant?.images?.length ? firstVariant.images : null;
  const rawImages = p.baseImageUrl;
  const baseImages = Array.isArray(rawImages)
    ? rawImages
    : typeof rawImages === "string" && rawImages
      ? [rawImages]
      : [];
  const images = (variantImages ?? (baseImages.length > 0 ? baseImages : [])).map(getValidImageUrl);

  const merchantId = typeof p.createdBy === "string" ? p.createdBy : undefined;

  let stock: number | undefined;
  let availabilityStatus = "in_stock";
  if (activeVariants.length > 0) {
    const totalStock = activeVariants.reduce(
      (sum, v) => sum + Math.max(0, (v.stock ?? 0) - (v.reservedStock ?? 0)),
      0,
    );
    stock = totalStock;
    availabilityStatus = totalStock > 0 ? (totalStock <= 5 ? "Low Stock" : "in_stock") : "out_of_stock";
  } else if (p.stock != null && Number.isFinite(Number(p.stock))) {
    stock = Math.max(0, Number(p.stock));
    availabilityStatus = stock > 0 ? (stock <= 5 ? "Low Stock" : "in_stock") : "out_of_stock";
  }

  const b2bTiers = firstVariant?.b2bPriceTiers?.length
    ? firstVariant.b2bPriceTiers
    : (p.b2bPriceTiers?.length ? p.b2bPriceTiers : undefined);

  const variantCount = activeVariants.length > 0 ? activeVariants.length : undefined;
  const variantLabels = activeVariants.length > 0
    ? activeVariants.map((v) => v.title || v.explicitAttributes?.map((a) => a.value).join(", ") || "").filter(Boolean)
    : undefined;

  return {
    id: p._id,
    title: p.title,
    description: p.description,
    price,
    mrp,
    discountPercentage,
    rating: parseAverageRating(p.averageRating),
    reviewCount: getProductReviewCount(p),
    thumbnail: p.thumbnail ? getValidImageUrl(p.thumbnail) : (images.length > 0 ? images[0] : PLACEHOLDER_IMAGE),
    images,
    category,
    brand,
    slug: p.slug,
    availabilityStatus,
    stock,
    merchantId,
    moq: getProductMoqMinimum(p.moq),
    b2bPriceTiers: b2bTiers,
    variantCount,
    variantLabels,
  };
}

/**
 * Expand each product into one card per active variant.
 * If a product has no active variants, it emits a single card using mapApiProductToDisplay.
 * Each variant card carries preVariantId so the listing can add directly to cart.
 */
export function flatMapApiProductsToCards(products: ApiProduct[], limitOneVariant = false): ProductDisplay[] {
  const result: ProductDisplay[] = [];

  for (const p of products) {
    const populatedVariants = (p.variantIds ?? []).filter(isPopulatedVariant);
    const activeVariants = populatedVariants.filter((v) => !v.isDeleted && v.status !== "rejected");

    if (activeVariants.length > 0) {
      const rawImages = p.baseImageUrl;
      const baseImages = Array.isArray(rawImages)
        ? rawImages
        : typeof rawImages === "string" && rawImages
          ? [rawImages]
          : [];

      const category = typeof p.categoryId === "object" && p.categoryId?.name ? p.categoryId.name : "";
      const brand = typeof p.brandId === "object" && p.brandId?.name ? p.brandId.name : "";
      const merchantId = typeof p.createdBy === "string" ? p.createdBy : undefined;

      const variantsToUse = limitOneVariant ? activeVariants.slice(0, 1) : activeVariants;
      for (const v of variantsToUse) {
        const vImages = (v.images?.length ? v.images : baseImages).map(getValidImageUrl);
        const vTitle =
          v.title ||
          v.explicitAttributes?.map((a) => a.value).filter(Boolean).join(" / ") ||
          "";

        const price = v.price?.sellingPrice != null ? Number(v.price.sellingPrice) : 0;
        const mrp = v.price?.mrp != null ? Number(v.price.mrp) : undefined;
        const discountPercentage =
          mrp != null && mrp > price && mrp > 0
            ? Math.round((1 - price / mrp) * 100)
            : (v.price?.discountPercent ?? 0);
        const stock = Math.max(0, (v.stock ?? 0) - (v.reservedStock ?? 0));
        const availabilityStatus =
          stock > 0 ? (stock <= 5 ? "Low Stock" : "in_stock") : "out_of_stock";

        result.push({
          id: p._id,
          title: p.title,
          description: p.description,
          price,
          mrp,
          discountPercentage,
          rating: parseAverageRating(p.averageRating),
          reviewCount: getProductReviewCount(p),
          thumbnail: p.thumbnail ? getValidImageUrl(p.thumbnail) : (vImages.length > 0 ? vImages[0] : PLACEHOLDER_IMAGE),
          images: vImages,
          category,
          brand,
          slug: p.slug,
          availabilityStatus,
          stock,
          merchantId,
          moq: getProductMoqMinimum(p.moq),
          b2bPriceTiers: v.b2bPriceTiers?.length ? v.b2bPriceTiers : (p.b2bPriceTiers?.length ? p.b2bPriceTiers : undefined),
          variantCount: activeVariants.length,
          preVariantId: v._id,
          variantTitle: vTitle || undefined,
        });
      }
    } else {
      result.push(mapApiProductToDisplay(p));
    }
  }

  return result;
}

export interface ApiFaq {
  id: string;
  question: string;
  answer: string;
  isPublished?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

