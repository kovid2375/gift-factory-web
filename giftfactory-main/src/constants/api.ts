/**
 * Backend API base path: api/v1 (set in axios baseURL).
 * All paths below are relative to that.
 */
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export const API_ENDPOINTS = {
  auth: {
    login: { ID: "_loginUserId", URL: `${BASE}/customer/login` },
    loginWithOtpEmail: `${BASE}/customer/login-with-otp/by-email`,
    loginWithOtpPhone: `${BASE}/customer/login-with-otp/by-phone`,
    sendOtp: `${BASE}/customer/send-otp-login`,
    sendSignupOtp: (email: string) => `${BASE}/customer/${encodeURIComponent(email)}/otp`,
    verifyOtp: `${BASE}/customer-auth/otp-verification`,
    registration: `${BASE}/customer/email/registration`,
    refreshToken: `${BASE}/customer/refresh-token`,
    forgotPassword: (email: string) => `${BASE}/customer/${encodeURIComponent(email)}/forgot-password`,
    resetPassword: (email: string) => `${BASE}/customer/reset-password/${encodeURIComponent(email)}`,
    logout: `${BASE}/customer/logout`,
    me: `${BASE}/customer/me`,//not done
    profileUpdate: `${BASE}/customer/profile-update`,
    changePassword: `${BASE}/customer/change-password`,
  },
  /** Customer auth (same as auth) – alias for clarity in docs */
  customerAuth: {
    login: `${BASE}/customer/login`,
    sendOtp: `${BASE}/customer/send-otp-login`,
    verifyOtp: `${BASE}/customer-auth/otp-verification`,
    // Backend currently exposes phone OTP send on vendor-auth route and verify on customer-auth.
    sendPhoneOtp: (phone: string) => `${BASE}/vendor-auth/${encodeURIComponent(phone)}/otp`,//not done
    verifyPhoneOtp: `${BASE}/customer-auth/phone/otp-verification`,//not done
    forgotPassword: (email: string) => `${BASE}/customer-auth/${encodeURIComponent(email)}/forgot-password`,//not done
    resetPassword: `${BASE}/customer-auth/reset-password`,//not done
    me: `${BASE}/customer/me`,//not done
    profileUpdate: `${BASE}/customer/profile-update`,
  },
  // Controller is @Controller('api/v1/search') with global prefix api/v1 → /api/v1/search/...
  search: {
    products: `/api/v1/search/products`,
    autoComplete: `/search/products`,
  },
  elasticSearch: {
    products: `${BASE}/elastic-search/products`,
    suggest: `${BASE}/elastic-search/suggest`,
  },
  web: {
    products: `${BASE}/web/products`,
    productById: (id: string) => `${BASE}/web/products/${encodeURIComponent(id)}`,
    productSuggest: `${BASE}/web/products/suggest`,
    productFeatured: `${BASE}/web/products/featured`,
    productDeals: `${BASE}/web/products/deals`,
    productRecommended: `${BASE}/web/products/recommended`,
    productRelated: (id: string) => `${BASE}/web/products/${encodeURIComponent(id)}/related`,
    productReviews: `${BASE}/product-reviews`,
    productNotifyStock: (id: string) => `${BASE}/web/products/${encodeURIComponent(id)}/notify-in-stock`,
    sellers: `${BASE}/web/sellers`,
    sellerById: (id: string) => `${BASE}/web/sellers/${id}`,
    categories: `${BASE}/web-categories/categories/tree`,
    categorySub: (rootId: string) => `${BASE}/web/categories/${rootId}/sub`,
    brands: `${BASE}/web-brands/brands`,
    banners: `${BASE}/banners/public`,
    adminBanners: `${BASE}/admin/banner`,
    theme: `${BASE}/web/theme`,
    blog: `${BASE}/web/blog`,
    blogCategories: `${BASE}/web/blog/categories`,
    blogBySlug: (slug: string) => `${BASE}/web/blog/${encodeURIComponent(slug)}`,
  },
  customer: {
    cart: `${BASE}/cart`,
    cartById: (id: string) => `${BASE}/cart/${id}`,
    cartItem: (cartId: string) => `${BASE}/cart/${cartId}/item`,
    guestCartById: (cartId: string) => `${BASE}/cart/guest/${cartId}`,
    guestCartItem: (cartId: string) => `${BASE}/fcart/guest/${cartId}/item`,
    guestItemAlt: (cartId: string) => `${BASE}/guest/${cartId}/item`,
    guestCartAdd: `${BASE}/cart/guest/item`,
    guestCartBulkAdd: `${BASE}/cart/guest/items`,
    cartMerge: `${BASE}/cart/merge`,
    wishlist: `${BASE}/wishlist`,
    wishlistIds: (customerId: string) => `${BASE}/wishlist/ids?customerId=${encodeURIComponent(customerId)}`,
    wishlistToggle: `${BASE}/wishlist/toggle`,
    orders: `${BASE}/orders`,
    orderById: (id: string) => `${BASE}/orders/${id}`,
    orderByNumber: (orderNumber: string) => `${BASE}/orders/by-number/${encodeURIComponent(orderNumber)}`,
    orderTrack: (orderNumber: string) => `${BASE}/orders/track/${encodeURIComponent(orderNumber)}`,
    orderInvoice: (id: string) => `${BASE}/orders/${id}/invoice`,
    orderCancel: (id: string) => `${BASE}/orders/${id}/cancel`,
    orderFromCart: (cartId: string) => `${BASE}/customer/order/from-cart/${encodeURIComponent(cartId)}`,
    checkoutPreview: (cartId: string) => `${BASE}/customer/order/checkout-preview/${encodeURIComponent(cartId)}`,
    orderReturnRequest: (id: string) => `${BASE}/orders/${id}/return-request`,
    returnRequests: `${BASE}/orders/return-requests/list`,
    returnRequestByOrderNumber: (orderNumber: string) => `${BASE}/orders/return-requests/by-order-number/${encodeURIComponent(orderNumber)}`,
    reorder: (orderId: string) => `${BASE}/orders/reorder/${orderId}`,
    addressesList: `${BASE}/address/list`,
    address: `${BASE}/address`,
    addressById: (id: string) => `${BASE}/address/${encodeURIComponent(id)}`,
    addressSetDefault: (id: string) => `${BASE}/address/${encodeURIComponent(id)}/set-default`,
    reviews: `${BASE}/product-reviews`,
    reviewById: (id: string) => `${BASE}/product-reviews/${encodeURIComponent(id)}`,
    notifications: `${BASE}/notifications`,
    notificationRead: (id: string) => `${BASE}/notifications/${encodeURIComponent(id)}/read`,
    avatarUpload: `${BASE}/uploads/customer/avtar`,
    searchHistory: `${BASE}/customer/search-history`,
    recommended: `${BASE}/customer/recommended`,
    viewProduct: `${BASE}/customer/view-product`,
    rfq: `${BASE}/customer/rfq`,
    rfqById: (id: string) => `${BASE}/customer/rfq/${id}`,
    rfqCancel: (id: string) => `${BASE}/customer/rfq/${id}/cancel`,
  },
  payment: {
    createOrder: `${BASE}/payment/orders`,
    verifyPayment: `${BASE}/payment/verify`,
    capture: `${BASE}/payment/capture`,
    webhook: `${BASE}/payment/webhook`,
    getOrder: (id: string) => `${BASE}/payment/order/${id}`,
    getPayment: (paymentId: string) => `${BASE}/payment/payment/${paymentId}`,
  },
  vendor: {
    brands: `${BASE}/brands/vendor`,
    brandById: (id: string) => `${BASE}/brands/vendor/${id}`,
    b2cRfq: `${BASE}/vendor/b2c-rfq`,
    b2cRfqById: (id: string) => `${BASE}/vendor/b2c-rfq/${id}`,
    b2cRfqAccept: (id: string) => `${BASE}/vendor/b2c-rfq/${id}/accept`,
    b2cRfqReject: (id: string) => `${BASE}/vendor/b2c-rfq/${id}/reject`,
  },
  offers: {
    list: `${BASE}/offers`,
    active: `${BASE}/offers/active`,
  },
  coupons: {
    validate: (code: string) => `${BASE}/coupons/validate/${code}`,
  },
  discounts: {
    validate: (code: string) => `${BASE}/discounts/validate/${code}`,
  },
  support: {
    tickets: `${BASE}/tickets`,
  },
  newsletter: {
    subscribe: `${BASE}/newsletter/subscribe`,
    unsubscribe: `${BASE}/newsletter/unsubscribe`,
  },
  faqs: `${BASE}/faqs`,
} as const;

/** Backend API origin (no /api/v1). From env; in development only, fallback to localhost. */
function getApiBaseOrigin(): string {
  const url = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (url) return url.replace(/\/$/, "");
  if (typeof process !== "undefined" && process.env.NODE_ENV === "development")
    return 'https://dev-api.ezzme.com/api/v1';
  return "";
}

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") return "/api/v1";
  const origin = getApiBaseOrigin();
  if (origin) return `${origin}/api/v1`;
  return "";
}
