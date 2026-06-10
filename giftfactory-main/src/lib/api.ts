/**
 * Central API client for Gift Factory backend (MVE-service).
 * Uses axiosInstance which has baseURL = getApiBaseUrl() and auth from setApiAccessToken().
 */
import { axiosInstance, authHeaders } from "@/lib/axios";
import { API_ENDPOINTS } from "@/constants/api";
import type {
  ApiResponse,
  ApiProduct,
  ApiProductVariant,
  ApiCategory,
  ApiBrand,
  ApiBanner,
  ApiOffer,
  ApiCart,
  ApiWishlistItem,
  ApiOrder,
  ApiAddress,
  ApiFaq,
} from "@/types/api";

const get = axiosInstance.get.bind(axiosInstance);
const post = axiosInstance.post.bind(axiosInstance);
const patch = axiosInstance.patch.bind(axiosInstance);
const del = axiosInstance.delete.bind(axiosInstance);

// —— Public (no auth) ——

export interface FetchProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  brandId?: string;
  /** Seller/vendor ID – products by this seller */
  vendorId?: string;
  sortBy?: string;
  order?: "asc" | "desc";
  /** Min price (e.g. 500 for ₹500) */
  minPrice?: number;
  /** Max price (e.g. 5000 for ₹5000) */
  maxPrice?: number;
  /** Minimum star rating 1–5 (e.g. 4 for "4 & Up") */
  minRating?: number;
  /** Minimum discount % (e.g. 10 for "10% off or more") */
  discountMin?: number;
}

/** Params the backend products API accepts (others are applied client-side or ignored to avoid 400) */
const PRODUCTS_API_PARAMS = [
  "page",
  "limit",
  "search",
  "categoryId",
  "brandId",
  "vendorId",
  "sortBy",
  "order",
  "minPrice",
  "maxPrice",
] as const;

export function normalizeProduct(p: any): ApiProduct {
  if (!p) return p;
  const priceVal = p.price != null && !isNaN(Number(p.price)) ? Number(p.price) : undefined;
  const mrpVal = p.mrpPrice != null && !isNaN(Number(p.mrpPrice)) ? Number(p.mrpPrice) : undefined;

  const categoryMapped = p.category ? {
    _id: p.category.id,
    name: p.category.name,
    slug: p.category.slug,
    parentId: p.category.parentId,
  } : p.categoryId;

  const brandMapped = p.brandRef ? {
    _id: p.brandRef.id,
    name: p.brandRef.name,
    slug: p.brandRef.slug,
    imageUrl: p.brandRef.imageUrl,
  } : p.brandId;

  const baseImageUrlMapped = p.imageUrls || p.images || (p.imageUrl ? [p.imageUrl] : []) || p.baseImageUrl || [];
  const thumbnailMapped = p.imageUrl || baseImageUrlMapped[0] || p.thumbnail;

  const variantsMapped = Array.isArray(p.variants) ? p.variants.map((v: any, index: number) => {
    const isSystemSku = v.sku && (v.sku.length > 20 || (v.sku.match(/-/g) || []).length >= 3);
    const title = v.title || v.name || v.variantName || (isSystemSku ? `Variant ${index + 1}` : (v.sku || `Variant ${v.id || index + 1}`));
    return {
      _id: v.id,
      sku: v.sku,
      title,
      price: {
        sellingPrice: Number(v.price || 0),
        mrp: Number(v.mrpPrice || v.price || 0),
      },
      stock: v.stock,
      images: v.imageUrls || (v.imageUrl ? [v.imageUrl] : []),
      isDeleted: !v.isActive,
      status: v.isActive ? "approved" : "rejected",
      explicitAttributes: v.explicitAttributes || [],
      attributeIds: v.attributeIds,
    };
  }) : p.variantIds;

  return {
    _id: p.id || p._id,
    title: p.name || p.title || "",
    sub_title: p.sub_title,
    slug: p.slug || "",
    sku: p.sku,
    description: p.description || "",
    defaultPrice: priceVal ?? p.defaultPrice,
    mrp: mrpVal ?? p.mrp,
    price: priceVal !== undefined ? {
      sellingPrice: priceVal,
      mrp: mrpVal !== undefined ? mrpVal : null,
    } : p.price,
    categoryId: categoryMapped,
    brandId: brandMapped,
    baseImageUrl: baseImageUrlMapped,
    thumbnail: thumbnailMapped,
    stock: p.stock,
    averageRating: p.ratingAvg != null ? Number(p.ratingAvg) : p.averageRating,
    commentCount: p.commentCount,
    comments: p.comments,
    variantIds: variantsMapped,
    explicitAttributes: p.explicitAttributes,
    seo: p.seo,
    visibility: p.visibility,
    status: p.status,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export function normalizeProducts(list: any[]): ApiProduct[] {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeProduct);
}

function mapElasticSortBy(sortBy?: string, order?: "asc" | "desc"): string | undefined {
  if (!sortBy) return undefined;
  const s = sortBy.toLowerCase();
  const o = order?.toLowerCase() || "";

  if (s === "price" || s === "defaultprice") {
    return o === "desc" ? "price_desc" : "price_asc";
  }
  if (s === "createdat" || s === "newest") {
    return "newest";
  }
  if (s === "popular" || s === "reviewcount") {
    return "popular";
  }
  if (s === "relevance" || s === "title") {
    return "relevance";
  }

  const validEnums = ["popular", "newest", "price_asc", "price_desc", "relevance"];
  if (validEnums.includes(sortBy)) {
    return sortBy;
  }
  return undefined;
}

function mapWebProductsSortBy(sortBy?: string, order?: "asc" | "desc"): string | undefined {
  if (!sortBy) return undefined;
  const s = sortBy.toLowerCase();
  const o = order?.toLowerCase() || "";

  if (s === "price" || s === "defaultprice") {
    return o === "desc" ? "price_desc" : "price_asc";
  }
  if (s === "title" || s === "name") {
    return o === "desc" ? "name_desc" : "name_asc";
  }
  if (s === "createdat") {
    return o === "asc" ? "oldest" : "createdAt";
  }
  if (s === "newest" || s === "oldest") {
    return s;
  }
  if (s === "popular" || s === "reviewcount") {
    return "popular";
  }
  if (s === "relevance") {
    return "relevance";
  }
  if (s === "rating" || s === "rating_desc" || s === "ratingdesc") {
    return "rating_desc";
  }
  if (s === "featured") {
    return "featured";
  }
  if (s === "bestseller" || s === "bestsellers") {
    return "bestseller";
  }

  const validEnums = [
    "createdAt",
    "oldest",
    "price_asc",
    "price_desc",
    "rating_desc",
    "popular",
    "name_asc",
    "name_desc",
    "relevance",
    "featured",
    "bestseller"
  ];
  const found = validEnums.find(v => v.toLowerCase() === s);
  if (found) return found;

  return undefined;
}

export async function fetchProducts(params?: FetchProductsParams): Promise<ApiResponse<ApiProduct[]>> {
  const allowed = params ?? {};
  const paramsToSend: Record<string, string | number | undefined> = {};
  for (const key of PRODUCTS_API_PARAMS) {
    const v = allowed[key as keyof FetchProductsParams];
    if (v !== undefined && v !== "") paramsToSend[key] = v;
  }

  const searchQuery = allowed.search?.trim();
  if (searchQuery) {
    const elasticParams: Record<string, any> = {
      query: searchQuery,
      page: allowed.page,
      limit: allowed.limit,
      categoryId: allowed.categoryId,
      sortBy: mapElasticSortBy(allowed.sortBy, allowed.order),
      priceMin: allowed.minPrice,
      priceMax: allowed.maxPrice,
    };
    // Clean up empty params
    Object.keys(elasticParams).forEach(key => {
      if (elasticParams[key] === undefined || elasticParams[key] === "") {
        delete elasticParams[key];
      }
    });

    const { data } = await get(API_ENDPOINTS.elasticSearch.products, { params: elasticParams });
    const rawList = data?.data ?? data ?? [];
    const list = Array.isArray(rawList) ? rawList : (rawList.products ?? []);

    return {
      ...data,
      data: normalizeProducts(list),
      meta: data?.meta ?? {
        page: allowed.page ?? 1,
        limit: allowed.limit ?? 12,
        totalItems: data?.meta?.totalItems ?? list.length,
        totalPages: data?.meta?.totalPages ?? 1,
      }
    };
  }

  const mappedSort = mapWebProductsSortBy(allowed.sortBy, allowed.order);
  if (mappedSort) {
    paramsToSend.sortBy = mappedSort;
    delete paramsToSend.order;
  } else {
    delete paramsToSend.sortBy;
    delete paramsToSend.order;
  }

  const { data } = await get(API_ENDPOINTS.web.products, { params: paramsToSend });
  let list = normalizeProducts(data?.data);
  return { ...data, data: list };
}

/** Query key for a single product; use with fetchQuery/useQuery to avoid refetching on every use */
export const productQueryKey = (id: string) => ["web", "product", id] as const;

/** Consider product data fresh for 5 minutes to avoid repeated GET when adding to cart etc. */
export const PRODUCT_STALE_TIME_MS = 5 * 60 * 1000;

export async function fetchProductById(id: string): Promise<ApiResponse<ApiProduct>> {
  const { data: res } = await get(API_ENDPOINTS.web.productById(id));
  // Backend may return { data: product } or the product at root
  const product = (res && typeof res === "object" && "data" in res && res.data != null)
    ? (res as { data: any }).data
    : (res as any);
  return { data: normalizeProduct(product) };
}

export async function fetchProductSuggest(query: string, page = 1, limit = 20): Promise<{ data: { id: string; title: string; slug?: string }[] }> {
  try {
    const { data: res } = await get(API_ENDPOINTS.elasticSearch.products, {
      params: { autoComplete: query, page, limit }
    });
    
    let list: any[] = [];
    if (Array.isArray(res?.meta?.suggestions)) {
      list = res.meta.suggestions;
    } else if (Array.isArray(res?.suggestions)) {
      list = res.suggestions;
    } else if (Array.isArray(res?.data?.suggestions)) {
      list = res.data.suggestions;
    } else {
      const raw = res?.data ?? res ?? [];
      list = Array.isArray(raw) ? raw : (raw.suggestions ?? raw.data ?? []);
    }

    const results = list.map((item: any) => ({
      id: item.id || item._id || item.productId || item.text || "",
      title: item.name || item.title || item.text || "",
      slug: item.slug || item.productSlug
    }));
    return { data: results };
  } catch (e) {
    console.error("Failed to fetch product suggestions:", e);
    return { data: [] };
  }
}

export async function fetchSearchAutoComplete(query: string, page = 1, limit = 20): Promise<{ data: any[]; meta: { suggestions: { text: string; type: string; confidence: number }[] } }> {
  try {
    const { data: res } = await get(API_ENDPOINTS.elasticSearch.products, {
      params: { autoComplete: query, page, limit }
    });

    let suggestionsList: any[] = [];
    if (Array.isArray(res?.meta?.suggestions)) {
      suggestionsList = res.meta.suggestions;
    } else if (Array.isArray(res?.suggestions)) {
      suggestionsList = res.suggestions;
    } else if (Array.isArray(res?.data?.suggestions)) {
      suggestionsList = res.data.suggestions;
    } else {
      const raw = res?.data ?? res ?? [];
      suggestionsList = Array.isArray(raw) ? raw : (raw.suggestions ?? []);
    }

    const suggestions = suggestionsList.map((item: any) => ({
      text: item.text || item.name || item.title || "",
      type: item.type || "product",
      confidence: item.confidence ?? 100
    }));

    const productsRaw = res?.data ?? [];
    const productsList = Array.isArray(productsRaw) ? productsRaw : (productsRaw.products ?? productsRaw.data ?? []);

    return {
      data: normalizeProducts(productsList),
      meta: { suggestions }
    };
  } catch (e) {
    console.error("Failed to fetch search auto-complete:", e);
    return { data: [], meta: { suggestions: [] } };
  }
}


export async function fetchFeaturedProducts(): Promise<ApiResponse<ApiProduct[]>> {
  const { data } = await get(API_ENDPOINTS.web.productFeatured);
  return { ...data, data: normalizeProducts(data?.data) };
}

export async function fetchProductDeals(params?: { limit?: number }): Promise<ApiResponse<ApiProduct[]>> {
  const res = await get(API_ENDPOINTS.web.productDeals, { params: params ?? {} });
  const raw = res?.data ?? res;
  const list = Array.isArray(raw) ? raw : (raw as { data?: any[] })?.data ?? [];
  return { data: normalizeProducts(list) };
}

export async function fetchProductRecommended(params?: { limit?: number }): Promise<ApiResponse<CustomerRecommendedResponse>> {
  const res = await get(API_ENDPOINTS.web.productRecommended, { params: params ?? {} });
  const raw = res?.data ?? res;
  const list = Array.isArray(raw) ? raw : (raw as { data?: any[] })?.data ?? [];
  return {
    data: {
      products: normalizeProducts(list),
      personalized: false,
      reason: 'Trending products',
    },
  };
}

export async function fetchRelatedProducts(productId: string): Promise<ApiResponse<ApiProduct[]>> {
  const { data } = await get(API_ENDPOINTS.web.productRelated(productId));
  return { ...data, data: normalizeProducts(data?.data) };
}

export async function fetchProductReviews(
  productId: string,
  approved?: boolean | string
): Promise<ApiResponse<unknown[]>> {
  const params: Record<string, string> = { productId };
  if (approved !== undefined && approved !== "all") {
    params.approved = approved === true || approved === "true" ? "true" : "false";
  }
  const { data } = await get(API_ENDPOINTS.web.productReviews, { params });
  return data;
}

export async function notifyInStock(productId: string, email: string): Promise<ApiResponse<unknown>> {
  const { data } = await post(API_ENDPOINTS.web.productNotifyStock(productId), { email });
  return data;
}

export interface ApiSellerCategory {
  _id: string;
  name: string;
}

export interface ApiSellerProfile {
  _id: string;
  name: string;
  logo?: string;
  description?: string;
  website?: string;
  badges: string[];
  eligibility: string;
  productCount: number;
  categories: ApiSellerCategory[];
}

export async function fetchSellerById(vendorId: string): Promise<ApiResponse<ApiSellerProfile>> {
  const { data } = await get(API_ENDPOINTS.web.sellerById(vendorId));
  return data;
}

export async function fetchCategories(): Promise<ApiResponse<ApiCategory[]>> {
  const { data: res } = await get(API_ENDPOINTS.web.categories);
  const tree = res?.data ?? [];

  const flatten = (nodes: any[], parentId: string | null = null): ApiCategory[] => {
    const list: ApiCategory[] = [];
    for (const node of nodes) {
      list.push({
        _id: node.id,
        name: node.name,
        slug: node.slug,
        parentId: node.parentId || parentId,
        imageUrl: node.imageUrl,
      });
      if (node.children && node.children.length > 0) {
        list.push(...flatten(node.children, node.id));
      }
    }
    return list;
  };

  return { ...res, data: flatten(tree) };
}

export async function fetchSubCategories(rootId: string): Promise<ApiResponse<ApiCategory[]>> {
  const { data: res } = await get(API_ENDPOINTS.web.categories);
  const tree = res?.data ?? [];

  const findNode = (nodes: any[]): any | null => {
    for (const node of nodes) {
      if (node.id === rootId) return node;
      if (node.children && node.children.length > 0) {
        const found = findNode(node.children);
        if (found) return found;
      }
    }
    return null;
  };

  const parentNode = findNode(tree);
  if (!parentNode || !parentNode.children) {
    return { data: [] };
  }

  const subCategories: ApiCategory[] = parentNode.children.map((child: any) => ({
    _id: child.id,
    name: child.name,
    slug: child.slug,
    parentId: rootId,
    imageUrl: child.imageUrl,
  }));

  return { data: subCategories };
}

export async function fetchBrands(): Promise<ApiResponse<ApiBrand[]>> {
  const { data: res } = await get(API_ENDPOINTS.web.brands);
  const list = res?.data ?? [];
  const mapped = list.map((b: any) => ({
    ...b,
    _id: b.id || b._id,
  }));
  return { ...res, data: mapped };
}

// —— Vendor (auth required: vendor Bearer token) ——

export async function fetchVendorBrands(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<ApiResponse<ApiBrand[]>> {
  const { data } = await get(API_ENDPOINTS.vendor.brands, { params });
  return data;
}

export async function fetchVendorBrandById(brandId: string): Promise<ApiResponse<ApiBrand>> {
  const { data } = await get(API_ENDPOINTS.vendor.brandById(brandId));
  return data;
}

export async function fetchBanners(position?: string): Promise<ApiResponse<ApiBanner[]>> {
  const upperPosition = position?.toUpperCase();
  const res = await get(API_ENDPOINTS.web.banners, { params: upperPosition ? { position: upperPosition } : {} });
  const raw = res?.data ?? res;
  const list = Array.isArray(raw) ? raw : (raw as { data?: any[] })?.data ?? [];
  return { data: list };
}

export async function fetchAdminBanners(params?: {
  order?: "asc" | "desc";
  sortBy?: string;
  page?: number;
  limit?: number;
  position?: string;
}): Promise<ApiResponse<ApiBanner[]>> {
  const res = await get(API_ENDPOINTS.web.adminBanners, {
    params: params ?? { order: "desc", sortBy: "createdAt" },
  });
  const raw = res?.data ?? res;
  const list = Array.isArray(raw) ? raw : (raw as { data?: any[] })?.data ?? [];
  return { data: list };
}

export async function fetchActiveOffers(): Promise<ApiResponse<ApiOffer[]>> {
  const { data } = await get(API_ENDPOINTS.offers.active);
  return data;
}

export async function fetchTheme(): Promise<ApiResponse<Record<string, unknown>>> {
  const { data } = await get(API_ENDPOINTS.web.theme);
  return data;
}

export async function fetchBlogList(params?: {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}): Promise<ApiResponse<unknown>> {
  const res = await get(API_ENDPOINTS.web.blog, { params: params ?? {} });
  return res?.data ?? res;
}

export async function fetchBlogCategories(): Promise<ApiResponse<string[]>> {
  const { data } = await get(API_ENDPOINTS.web.blogCategories);
  return data;
}

export async function fetchBlogBySlug(slug: string): Promise<ApiResponse<unknown>> {
  const { data } = await get(API_ENDPOINTS.web.blogBySlug(slug));
  return data;
}

export async function forgotPassword(email: string): Promise<ApiResponse<unknown>> {
  const { data } = await post(API_ENDPOINTS.auth.forgotPassword(email), {});
  return data;
}

export async function resetPassword(
  email: string,
  body: {
    otp: string;
    password: string;
    confirmPassword: string;
  }
): Promise<ApiResponse<unknown>> {
  const { data } = await patch(API_ENDPOINTS.auth.resetPassword(email), body);
  return data;
}

// —— Auth (customer-auth) ——

export async function loginCustomer(body: { email: string; password: string }): Promise<
  ApiResponse<unknown> & { accessToken?: string; refreshToken?: string; data?: unknown }
> {
  const { data } = await post(API_ENDPOINTS.auth.login.URL, body);
  return data;
}

export async function loginWithOtp(body: { email?: string; phone?: string; otp: string }): Promise<
  ApiResponse<unknown> & { accessToken?: string; refreshToken?: string; data?: unknown }
> {
  const isPhone = body.phone != null;
  const endpoint = isPhone ? API_ENDPOINTS.auth.loginWithOtpPhone : API_ENDPOINTS.auth.loginWithOtpEmail;
  const res = await post(endpoint, body);
  return res.data;
}

export async function sendOtp(identifier: string, mode: "email" | "phone" = "email"): Promise<ApiResponse<unknown>> {
  const payload = mode === "phone" ? { phone: identifier, mode } : { email: identifier, mode };
  const { data } = await post(API_ENDPOINTS.auth.sendOtp, payload);
  return data;
}

export async function sendSignupOtp(email: string): Promise<ApiResponse<unknown>> {
  const { data } = await post(API_ENDPOINTS.auth.sendSignupOtp(email), {});
  return data;
}

export async function sendPhoneOtp(phone: string): Promise<ApiResponse<unknown>> {
  const { data } = await post(API_ENDPOINTS.customerAuth.sendPhoneOtp(phone), {});
  return data;
}

export async function verifyPhoneOtp(body: {
  phone: string;
  otp: string;
  password: string;
}): Promise<ApiResponse<unknown>> {
  const { data } = await post(API_ENDPOINTS.customerAuth.verifyPhoneOtp, body);
  return data;
}

/** Verify OTP only (e.g. for login). Not used for signup - use verifyOtpSignup. */
export async function verifyOtp(body: { email: string; otp: string }): Promise<ApiResponse<unknown>> {
  const { data } = await post(API_ENDPOINTS.auth.verifyOtp, body);
  return data;
}

/** Signup: verify OTP + set password. Body must match backend VerifyEmailOtpDto: email, otp, name, password. Returns tokens. */
export async function verifyOtpSignup(body: {
  email: string;
  otp: string;
  name: string;
  password: string;
}): Promise<
  ApiResponse<unknown> & { accessToken?: string; refreshToken?: string; data?: { id?: string; email?: string } }
> {
  const res = await post(API_ENDPOINTS.auth.registration, body);
  const payload = res.data as any;
  return payload;
}

export async function refreshToken(body: { userId: string; refreshToken: string }): Promise<
  ApiResponse<unknown> & { accessToken?: string; refreshToken?: string }
> {
  const { data } = await post(API_ENDPOINTS.auth.refreshToken, body);
  return data;
}

export async function getCustomerProfile(token: string): Promise<ApiResponse<unknown>> {
  const { data } = await get(API_ENDPOINTS.auth.me, { headers: authHeaders(token) });
  return data;
}

export async function changePassword(body: Record<string, string>): Promise<ApiResponse<unknown>> {
  const { data } = await patch(API_ENDPOINTS.auth.changePassword, body);
  return data;
}

// —— Newsletter (public) ——

export async function subscribeNewsletter(email: string): Promise<{ message: string }> {
  const { data } = await post(API_ENDPOINTS.newsletter.subscribe, { email });
  return data;
}

export async function fetchFaqs(): Promise<ApiResponse<ApiFaq[]>> {
  const { data } = await get(API_ENDPOINTS.faqs);
  return data;
}

// —— Customer (auth required; token set via setApiAccessToken or pass headers) ——

export async function fetchProfile(): Promise<ApiResponse<unknown>> {
  const { data } = await get(API_ENDPOINTS.auth.me);
  return data;
}

export async function updateProfile(body: Partial<{
  name: string;
  fullName: string;
  phone: string;
  email: string;
  avatar: string;
  gender: string;
  dob: string;
  gstin: string;

}>): Promise<ApiResponse<unknown>> {
  const { data } = await patch(API_ENDPOINTS.auth.profileUpdate, body);
  console.log("updateProfile", data);
  return data;
}

/** Upload customer avatar (auth required). */
export async function uploadAvatar(file: File): Promise<ApiResponse<{ url: string }>> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await post(API_ENDPOINTS.customer.avatarUpload, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
}

export async function fetchProfileStats(): Promise<ApiResponse<{
  orderCount: number;
  wishlistCount: number;
  reviewCount: number;
  addressCount: number;
  loyaltyPoints: number;
  memberSince: string | null;
  memberDays: number;
}>> {
  const { data } = await get(`${API_ENDPOINTS.auth.me}/stats`);
  return data;
}

export async function fetchCart(): Promise<ApiResponse<ApiCart[]>> {
  const res = await get(API_ENDPOINTS.customer.cart);
  const raw = res?.data ?? res;

  let list: ApiCart[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === "object") {
    // If it has data field containing array or cart
    if (Array.isArray((raw as any).data)) {
      list = (raw as any).data;
    } else if ((raw as any).data && typeof (raw as any).data === "object") {
      list = [(raw as any).data];
    } else if ((raw as any)._id || (raw as any).items) {
      list = [raw as ApiCart];
    }
  }
  return { data: list };
}

export async function addCartItem(body: {
  merchantId?: string;
  item: { productId: string; variantId?: string; quantity: number };
}): Promise<ApiResponse<ApiCart>> {
  // Backend expects { item: { productId, variantId?, quantity } }
  const payload = {
    item: {
      productId: body.item.productId,
      ...(body.item.variantId ? { variantId: body.item.variantId } : {}),
      quantity: body.item.quantity,
    },
  };
  const { data } = await post(API_ENDPOINTS.customer.cart + "/item", payload);
  return data;
}

/** Cart query key used by React Query */
export const CART_QUERY_KEY = ["customer", "cart"] as const;

/**
 * Merges the cart returned from addCartItem into the cart query cache so we don't need to refetch.
 * Pass the result of addCartItem (or the raw cart). Call instead of invalidateQueries after add.
 */
export function mergeCartIntoCache(
  // Narrow queryClient type just enough for our usage to keep this helper generic
  queryClient: { setQueryData: <TData>(key: unknown[], updater: (old: TData | undefined) => TData) => void },
  addCartResponse: ApiResponse<ApiCart> | ApiCart | undefined
) {
  const cart = addCartResponse && typeof addCartResponse === "object" && "_id" in addCartResponse
    ? (addCartResponse as ApiCart)
    : (addCartResponse as ApiResponse<ApiCart> | undefined)?.data;
  if (!cart?._id) return;
  queryClient.setQueryData<ApiResponse<ApiCart[]>>(
    [...CART_QUERY_KEY],
    (old) => {
      const list = old?.data ?? [];
      const idx = list.findIndex((c) => c._id === cart._id);
      const next = [...list];
      if (idx >= 0) next[idx] = cart;
      else next.push(cart);
      return { data: next };
    }
  );
}

export async function updateCartItem(
  cartId: string,
  body: { itemId: string; quantity: number }
): Promise<ApiResponse<ApiCart>> {
  const { data } = await patch(API_ENDPOINTS.customer.cartItem(cartId), body);
  return data;
}

export async function removeCartItem(
  cartId: string,
  body: { itemId: string }
): Promise<ApiResponse<ApiCart>> {
  const { data } = await del(API_ENDPOINTS.customer.cartItem(cartId), { data: body });
  return data;
}

export async function deleteCart(cartId: string): Promise<ApiResponse<ApiCart>> {
  const { data } = await del(API_ENDPOINTS.customer.cartById(cartId));
  return data;
}

export async function addGuestCartItem(body: {
  item: { productId: string; variantId?: string; quantity: number };
}): Promise<ApiResponse<ApiCart>> {
  const { data } = await post(API_ENDPOINTS.customer.guestCartAdd, body);
  return data;
}

export async function bulkAddGuestCartItems(body: {
  items: { productId: string; variantId?: string; quantity: number }[];
}): Promise<ApiResponse<ApiCart>> {
  const { data } = await post(API_ENDPOINTS.customer.guestCartBulkAdd, body);
  return data;
}

export async function mergeGuestCart(
  body: {
    sessionId?: string;
    cartId?: string;
    items?: { productId: string; variantId?: string; quantity: number }[];
  },
  token?: string
): Promise<ApiResponse<ApiCart>> {
  const { data } = await post(
    API_ENDPOINTS.customer.cartMerge,
    body,
    token ? { headers: authHeaders(token) } : undefined
  );
  return data;
}

export async function updateGuestCartItemApi(
  cartId: string,
  body: { itemId: string; quantity: number }
): Promise<ApiResponse<ApiCart>> {
  const { data } = await patch(API_ENDPOINTS.customer.guestCartItem(cartId), body);
  return data;
}

export async function updateGuestCartItemAltApi(
  cartId: string,
  body: { itemId: string; quantity: number }
): Promise<ApiResponse<ApiCart>> {
  const { data } = await patch(API_ENDPOINTS.customer.guestItemAlt(cartId), body);
  return data;
}

export async function fetchGuestCart(cartId: string): Promise<ApiResponse<ApiCart>> {
  const { data } = await get(API_ENDPOINTS.customer.guestCartById(cartId));
  return data;
}

export async function fetchWishlist(params?: {
  page?: number;
  limit?: number;
  productId?: string;
  variantId?: string;
  customerId?: string;
}): Promise<ApiResponse<ApiWishlistItem[]>> {
  const cleanParams: Record<string, any> = {};
  if (params && typeof params === "object") {
    if (typeof params.page === "number" || typeof params.page === "string") {
      const pVal = Number(params.page);
      if (!isNaN(pVal)) cleanParams.page = pVal;
    }
    if (typeof params.limit === "number" || typeof params.limit === "string") {
      const lVal = Number(params.limit);
      if (!isNaN(lVal)) cleanParams.limit = lVal;
    }
    if (typeof params.productId === "string") cleanParams.productId = params.productId;
    if (typeof params.variantId === "string") cleanParams.variantId = params.variantId;
    if (typeof params.customerId === "string") cleanParams.customerId = params.customerId;
  }
  const { data } = await get(API_ENDPOINTS.customer.wishlist, { params: cleanParams });
  return data;
}

export async function fetchWishlistIds(customerId: string): Promise<ApiResponse<any>> {
  const { data } = await get(API_ENDPOINTS.customer.wishlistIds(customerId));
  return data;
}

export async function toggleWishlistItem(body: {
  productId: string;
  variantId?: string;
}): Promise<ApiResponse<any>> {
  const { data } = await post(API_ENDPOINTS.customer.wishlistToggle, body);
  return data;
}

/**
 * @deprecated Use toggleWishlistItem instead.
 */
export async function addWishlistItem(body: {
  productId: string;
  variantId?: string;
  productSlug: string;
  productUrl: string;
}): Promise<ApiResponse<unknown>> {
  console.warn("addWishlistItem is deprecated. Use toggleWishlistItem instead.");
  return await toggleWishlistItem({ productId: body.productId, variantId: body.variantId });
}

// —— Payments (gateway integration) ——
export async function createPaymentOrder(body: {
  productOrderId: string;
  amount?: number;
  currency?: string;
  gateway?: string;
  notes?: Record<string, string>;
}): Promise<ApiResponse<unknown>> {
  const { data } = await post(API_ENDPOINTS.payment.createOrder, body);
  return data;
}

export async function verifyPayment(body: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<ApiResponse<unknown>> {
  const { data } = await post(API_ENDPOINTS.payment.verifyPayment, body);
  return data;
}

/**
 * @deprecated Use toggleWishlistItem instead.
 */
export async function removeWishlistItem(wishlistId: string): Promise<ApiResponse<unknown>> {
  console.warn("removeWishlistItem is deprecated. Use toggleWishlistItem instead.");
  try {
    const listRes = await fetchWishlist();
    const item = listRes.data?.find((i) => i._id === wishlistId);
    if (item) {
      const prodId = typeof item.productId === "string" ? item.productId : (item.productId as ApiProduct)?._id;
      const varId = typeof item.variantId === "string" ? item.variantId : (item.variantId as ApiProductVariant)?._id;
      if (prodId) {
        return await toggleWishlistItem({ productId: prodId, variantId: varId });
      }
    }
  } catch (e) {
    console.error("Failed to remove wishlist item in deprecated fallback:", e);
  }
  return { success: false, message: "Failed to remove wishlist item" };
}

export function normalizeOrder(o: any): ApiOrder {
  if (!o) return o;
  const idVal = o.id || o._id;
  const totalVal = o.total != null ? Number(o.total) : (o.totalAmount != null ? Number(o.totalAmount) : 0);
  const discountVal = o.discountAmount != null ? Number(o.discountAmount) : 0;

  const itemsMapped = Array.isArray(o.items) ? o.items.map((item: any) => {
    const itemPrice = Number(item.price || item.unitPrice || item.finalAmount || 0);
    const itemProduct = item.product ? normalizeProduct(item.product) : undefined;
    return {
      _id: item.id || item._id,
      productId: item.productId || itemProduct?._id,
      variantId: item.variantId,
      quantity: Number(item.quantity ?? 1),
      price: itemPrice,
      productName: item.productName || itemProduct?.title || item.product?.name,
      product: itemProduct,
      imageUrl: item.imageUrl || itemProduct?.thumbnail,
    };
  }) : [];

  return {
    ...o,
    _id: idVal,
    totalAmount: totalVal,
    discountAmount: discountVal,
    items: itemsMapped,
  };
}

export async function fetchOrders(params?: {
  search?: string;
  status?: string;
  fromDate?: string;
  lastDate?: string;
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
  customerId?: string;
}): Promise<ApiResponse<ApiOrder[]>> {
  const res = await get(API_ENDPOINTS.customer.orders, { params });
  const raw = res?.data ?? res;

  let list: any[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === "object") {
    if (Array.isArray(raw.data)) {
      list = raw.data;
    } else if (raw.data && typeof raw.data === "object" && Array.isArray(raw.data.orders)) {
      list = raw.data.orders;
    } else if (Array.isArray(raw.orders)) {
      list = raw.orders;
    }
  }

  const normalizedList = list.map(normalizeOrder);
  const meta = raw?.meta ?? raw?.data?.meta;
  return { data: normalizedList, meta };
}

export async function fetchOrderById(orderId: string): Promise<ApiResponse<ApiOrder>> {
  const res = await get(API_ENDPOINTS.customer.orderById(orderId));
  const raw = res?.data ?? res;
  const order = raw?.data ?? raw;
  return { data: normalizeOrder(order) };
}

export async function fetchOrderByOrderNumber(orderNumber: string): Promise<ApiResponse<ApiOrder>> {
  const res = await get(API_ENDPOINTS.customer.orderByNumber(orderNumber));
  const raw = res?.data ?? res;
  const order = raw?.data ?? raw;
  return { data: normalizeOrder(order) };
}

export async function fetchOrderInvoice(orderId: string): Promise<ApiResponse<Record<string, unknown>>> {
  const res = await get(API_ENDPOINTS.customer.orderInvoice(orderId));
  const raw = res?.data ?? res;
  const data = raw?.data ?? raw;
  return { data };
}

export type PaymentMethod = "wallet" | "card" | "upi" | "cod" | "online";

export interface DeliveryAddress {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country?: string;
  zipCode: string;
}

export interface CreateOrderAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface CreateOrderBody {
  items: { productId: string; variantId?: string; quantity: number }[];
  latitude: number;
  longitude: number;
  address: CreateOrderAddress;
  giftMessage?: string;
  discountCode?: string;
  onlinePaymentMethod: string;
  isInterState: boolean;
}

export interface CheckoutPreviewParams {
  latitude?: number;
  longitude?: number;
  fulfillmentPreference?: "SINGLE_ONLY" | "ALLOW_SPLIT" | "EMERGENCY_PARTIAL";
}

export interface CheckoutPreviewResponseItem {
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  requestedQuantity: number;
  allocatedQuantity: number;
  unitPrice: number;
  availableStock: number;
  shortfallQuantity: number;
}

export interface CheckoutPreviewResponse {
  success: boolean;
  mode: string;
  franchiseId?: string;
  franchiseName?: string;
  items: CheckoutPreviewResponseItem[];
  estimatedDelivery?: string;
  distanceKm?: number;
}

export async function fetchCheckoutPreview(
  cartId: string,
  params?: CheckoutPreviewParams
): Promise<ApiResponse<CheckoutPreviewResponse>> {
  const { data } = await get(API_ENDPOINTS.customer.checkoutPreview(cartId), { params });
  return data;
}

export async function createOrder(body: CreateOrderBody): Promise<ApiResponse<ApiOrder>> {
  const { data } = await post(API_ENDPOINTS.customer.orders, body);
  return data;
}

export interface CreateOrderFromCartBody {
  fulfillmentPreference?: "SINGLE_ONLY" | "ALLOW_SPLIT" | "EMERGENCY_PARTIAL";
  onlinePaymentMethod?: "COD" | "ONLINE";
  latitude?: number;
  longitude?: number;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  shippingFee?: number;
  discountCode?: string;
  referralCode?: string;
  isInterState?: boolean;
  giftMessage?: string;
}

export async function createOrderFromCart(
  cartId: string,
  body: CreateOrderFromCartBody
): Promise<ApiResponse<ApiOrder>> {
  const { data } = await post(API_ENDPOINTS.customer.orderFromCart(cartId), body);
  return data;
}

export async function cancelOrder(orderId: string): Promise<ApiResponse<ApiOrder>> {
  const { data } = await patch(API_ENDPOINTS.customer.orderCancel(orderId));
  return data;
}

export async function trackOrder(orderNumber: string): Promise<ApiResponse<ApiOrder>> {
  const res = await get(API_ENDPOINTS.customer.orderTrack(orderNumber));
  const raw = res?.data ?? res;
  const order = raw?.data ?? raw;
  return { data: normalizeOrder(order) };
}

export type ReturnRequestType = "return" | "refund" | "replacement";

export async function returnRequestOrder(
  orderId: string,
  body: { requestType: ReturnRequestType; reason: string; comment?: string }
): Promise<ApiResponse<unknown>> {
  const { data } = await post(API_ENDPOINTS.customer.orderReturnRequest(orderId), body);
  return data;
}

export type SupportTicketType = "ORDER" | "PAYMENT" | "DELIVERY" | "RETURN" | "OTHER";
export type SupportTicketPriority = "low" | "medium" | "high";

export async function createSupportTicket(body: {
  subject: string;
  description: string;
  type: SupportTicketType;
  priority: SupportTicketPriority;
  orderId?: string;
  attachments?: string[];
}): Promise<ApiResponse<unknown>> {
  const payload = {
    subject: body.subject.trim(),
    description: body.description.trim(),
    type: body.type,
    priority: body.priority,
    ...(body.orderId ? { orderId: body.orderId } : {}),
    ...(body.attachments ? { attachments: body.attachments } : {}),
  };
  const { data } = await post(API_ENDPOINTS.support.tickets, payload);
  return data;
}

export async function fetchReturnRequests(params?: {
  search?: string;
  requestType?: ReturnRequestType;
  sortBy?: "createdAt";
  fromDate?: string;
  lastDate?: string;
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}): Promise<ApiResponse<unknown[]>> {
  const { data } = await get(API_ENDPOINTS.customer.returnRequests, { params });
  return data;
}

export async function fetchReturnRequestByOrderNumber(orderNumber: string): Promise<ApiResponse<unknown>> {
  const { data } = await get(API_ENDPOINTS.customer.returnRequestByOrderNumber(orderNumber));
  return data;
}

export async function reorder(
  orderId: string,
  body?: { paymentMethod?: PaymentMethod; shippingAddress?: DeliveryAddress }
): Promise<ApiResponse<ApiOrder>> {
  const { data } = await post(API_ENDPOINTS.customer.reorder(orderId), body ?? {});
  return data;
}

export function normalizeAddress(addr: any): ApiAddress {
  if (!addr) return addr;
  return {
    ...addr,
    _id: addr._id || addr.id || "",
    id: addr.id || addr._id || "",
    is_default: addr.isDefault ?? addr.is_default ?? false,
    isDefault: addr.isDefault ?? addr.is_default ?? false,
    postal_code: addr.postalCode ?? addr.zipCode ?? addr.postal_code ?? "",
    zipCode: addr.postalCode ?? addr.zipCode ?? addr.postal_code ?? "",
  };
}

export async function fetchAddresses(): Promise<ApiResponse<ApiAddress[]>> {
  const { data } = await get(API_ENDPOINTS.customer.addressesList);
  if (data && Array.isArray(data.data)) {
    data.data = data.data.map(normalizeAddress);
  }
  return data;
}

/** Backend accepts `billing` | `shipping` (maps UI "pickup" / delivery to shipping). */
export type CustomerAddressApiType = "billing" | "shipping";

export function toCustomerAddressApiType(formType?: string): CustomerAddressApiType {
  const t = (formType ?? "billing").toLowerCase();
  if (t === "shipping" || t === "pickup" || t === "warehouse") return "shipping";
  return "billing";
}

export interface AddCustomerAddressBody {
  fullName?: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

export async function addAddress(body: AddCustomerAddressBody): Promise<ApiResponse<ApiAddress>> {
  const payload = {
    fullName: body.fullName?.trim(),
    phone: body.phone?.trim(),
    addressLine1: body.addressLine1.trim(),
    addressLine2: (body.addressLine2 ?? "").trim(),
    city: body.city.trim(),
    state: body.state.trim(),
    postalCode: body.postalCode.trim(),
    country: body.country.trim().toUpperCase(),
    latitude: body.latitude,
    longitude: body.longitude,
    isDefault: body.isDefault ?? false,
  };
  const { data } = await post(API_ENDPOINTS.customer.address, payload);
  if (data && data.data) {
    data.data = normalizeAddress(data.data);
  }
  return data;
}

export type UpdateCustomerAddressBody = Partial<{
  fullName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}>;

export async function updateAddress(
  addressId: string,
  body: UpdateCustomerAddressBody,
): Promise<ApiResponse<ApiAddress>> {
  const patchBody: Record<string, unknown> = {};
  if (body.fullName !== undefined) patchBody.fullName = body.fullName.trim();
  if (body.phone !== undefined) patchBody.phone = body.phone.trim();
  if (body.addressLine1 !== undefined) patchBody.addressLine1 = body.addressLine1.trim();
  if (body.addressLine2 !== undefined) patchBody.addressLine2 = body.addressLine2.trim();
  if (body.city !== undefined) patchBody.city = body.city.trim();
  if (body.state !== undefined) patchBody.state = body.state.trim();
  if (body.postalCode !== undefined) patchBody.postalCode = body.postalCode.trim();
  if (body.country !== undefined) patchBody.country = body.country.trim().toUpperCase();
  if (body.latitude !== undefined) patchBody.latitude = body.latitude;
  if (body.longitude !== undefined) patchBody.longitude = body.longitude;
  if (body.isDefault !== undefined) patchBody.isDefault = body.isDefault;
  const { data } = await patch(API_ENDPOINTS.customer.addressById(addressId), patchBody);
  if (data && data.data) {
    data.data = normalizeAddress(data.data);
  }
  return data;
}

export async function deleteAddress(addressId: string): Promise<ApiResponse<unknown>> {
  const { data } = await del(API_ENDPOINTS.customer.addressById(addressId));
  return data;
}

export async function setDefaultAddress(addressId: string): Promise<ApiResponse<ApiAddress>> {
  const { data } = await patch(API_ENDPOINTS.customer.addressSetDefault(addressId), {});
  if (data && data.data) {
    data.data = normalizeAddress(data.data);
  }
  return data;
}

/** Submit a product review (auth required). */
export async function submitReview(body: {
  productId: string;
  rating: number;
  comment?: string;
  orderId?: string;
}): Promise<ApiResponse<unknown>> {
  const payload = {
    productId: body.productId,
    rating: body.rating,
    comment: body.comment || "",
    orderId: body.orderId || "",
  };
  const { data } = await post(API_ENDPOINTS.customer.reviews, payload);
  return data;
}

/** Get a single product review by ID. */
export async function fetchReviewById(id: string): Promise<ApiResponse<unknown>> {
  const { data } = await get(API_ENDPOINTS.customer.reviewById(id));
  return data;
}

/** Update an existing product review (auth required). You can pass only the fields you wish to update (e.g., only the comment). */
export async function updateReview(
  id: string,
  body: {
    rating?: number;
    comment?: string;
    approved?: boolean;
  }
): Promise<ApiResponse<unknown>> {
  const payload: Record<string, any> = {};
  if (body.rating !== undefined) payload.rating = body.rating;
  if (body.comment !== undefined) payload.comment = body.comment;
  if (body.approved !== undefined) payload.approved = body.approved;

  const { data } = await patch(API_ENDPOINTS.customer.reviewById(id), payload);
  return data;
}

/** Record a search for personalized recommendations (auth required). */
export async function recordSearchHistory(body: {
  query?: string;
  categoryId?: string;
  customerId?: string;
}): Promise<ApiResponse<{ recorded: boolean }>> {
  const { data } = await post(API_ENDPOINTS.customer.searchHistory, body);
  return data;
}

/** Search history query key used by React Query */
export const SEARCH_HISTORY_QUERY_KEY = ["customer", "searchHistory"] as const;

/** Fetch customer search history. */
export async function fetchSearchHistory(): Promise<ApiResponse<{ id: string; query: string; categoryId?: string; createdAt: string }[]>> {
  const { data } = await get(API_ENDPOINTS.customer.searchHistory);
  return data;
}

/** Clear all search history. */
export async function clearAllSearchHistory(): Promise<ApiResponse<{ success: boolean; message: string }>> {
  const { data } = await del(API_ENDPOINTS.customer.searchHistoryClearAll);
  return data;
}

/** Delete a specific search history record. */
export async function deleteSearchHistoryItem(id: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
  const { data } = await del(API_ENDPOINTS.customer.searchHistoryDelete(id));
  return data;
}

/** Record a product view for personalized recommendations + popularity tracking (auth required). */
export async function trackProductView(body: {
  productId: string;
  categoryId?: string;
  customerId?: string;
}): Promise<void> {
  try {
    await post(API_ENDPOINTS.customer.viewProduct, body);
  } catch {
    // Fire-and-forget — do not propagate errors to the UI
  }
}

/** Recommended products response (personalized or trending). */
export interface CustomerRecommendedResponse {
  products: ApiProduct[];
  personalized: boolean;
  reason: string;
}

/** Get recommended products based on your browsing + search history (auth required). */
export async function fetchCustomerRecommended(params?: {
  customerId?: string;
  limit?: number;
}): Promise<ApiResponse<CustomerRecommendedResponse>> {
  const res = await get(API_ENDPOINTS.customer.recommended, {
    params: params ?? {},
  });
  const raw = res?.data ?? res;
  const inner = (raw as { data?: CustomerRecommendedResponse })?.data ?? raw;
  // Handle both old shape (array) and new shape ({ products, personalized, reason })
  if (Array.isArray(inner)) {
    return {
      data: {
        products: inner as ApiProduct[],
        personalized: false,
        reason: 'Trending products',
      },
    };
  }
  return { data: inner as CustomerRecommendedResponse };
}

// —— Customer RFQ (B2C) ——

export interface RfqShippingAddress {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  country?: string;
}

export interface RfqItem {
  productId: string;
  variantId?: string;  // optional for base products
  quantity: number;
  targetPrice?: number;
}

export interface SubmitRfqBody {
  items: RfqItem[];
  shippingAddress: RfqShippingAddress;
  note?: string;
}

export interface ApiRfq {
  _id: string;
  rfqNumber?: string;
  vendorName?: string;
  customerId: string | { _id: string; name?: string; email?: string };
  vendorId: string | { _id: string; businessName?: string };
  status: 'requested' | 'accepted' | 'rejected' | 'cancelled';
  items: (RfqItem & { _id?: string })[];
  shippingAddress: RfqShippingAddress;
  note?: string | null;
  rejectReason?: string | null;
  orderId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Submit a B2C Request for Quote (customer auth required). */
export async function submitRfq(body: SubmitRfqBody): Promise<ApiResponse<ApiRfq>> {
  const { data } = await post(API_ENDPOINTS.customer.rfq, body);
  return data;
}

/** Fetch all RFQs submitted by the current customer (auth required). */
export async function fetchCustomerRfqs(): Promise<ApiResponse<ApiRfq[]>> {
  const { data } = await get(API_ENDPOINTS.customer.rfq);
  return data;
}

/** Fetch a single RFQ by ID (customer auth required). */
export async function fetchCustomerRfqById(rfqId: string): Promise<ApiResponse<ApiRfq>> {
  const { data } = await get(API_ENDPOINTS.customer.rfqById(rfqId));
  return data;
}

/** Cancel an RFQ (auth required). */
export async function cancelRfq(rfqId: string): Promise<ApiResponse<ApiRfq>> {
  const { data } = await patch(API_ENDPOINTS.customer.rfqCancel(rfqId), {});
  return data;
}

// ─── Vendor B2C RFQ ─────────────────────────────────────────────────────────

/** Fetch all customer RFQs addressed to this vendor (vendor auth required). */
export async function fetchVendorB2cRfqs(
  params: { status?: string; page?: number; limit?: number } = {},
): Promise<ApiResponse<{ data: ApiRfq[]; meta: { total: number; page: number; limit: number; totalPages: number } }>> {
  const { data } = await get(API_ENDPOINTS.vendor.b2cRfq, { params });
  return data;
}

/** Fetch detail of a single customer RFQ (vendor auth required). */
export async function fetchVendorB2cRfqById(rfqId: string): Promise<ApiResponse<ApiRfq>> {
  const { data } = await get(API_ENDPOINTS.vendor.b2cRfqById(rfqId));
  return data;
}

/** Accept a customer RFQ (vendor auth required). */
export async function acceptB2cRfq(rfqId: string): Promise<ApiResponse<ApiRfq>> {
  const { data } = await patch(API_ENDPOINTS.vendor.b2cRfqAccept(rfqId), {});
  return data;
}

/** Reject a customer RFQ with an optional reason (vendor auth required). */
export async function rejectB2cRfq(rfqId: string, reason?: string): Promise<ApiResponse<ApiRfq>> {
  const { data } = await patch(API_ENDPOINTS.vendor.b2cRfqReject(rfqId), { reason });
  return data;
}

export interface ApiCoupon {
  _id: string;
  code: string;
  discountType: "fixed" | "percentage";
  discountValue: number;
  minPurchaseAmount: number;
  maxDiscountAmount: number;
  isActive: boolean;
}

export async function validateCoupon(code: string): Promise<ApiResponse<ApiCoupon>> {
  const { data } = await get(API_ENDPOINTS.coupons.validate(code.trim().toUpperCase()));
  return data;
}
