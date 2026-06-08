import { axiosInstance } from "@/lib/axios";
import { verifyPayment } from "@/lib/api";
import { API_ENDPOINTS } from "@/constants/api";

type RazorpayCreateOptions = {
  key: string;
  amount: number;
  currency?: string;
  name?: string;
  description?: string;
  order_id: string;
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  modal?: { ondismiss?: () => void };
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
};

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("Browser only"));
    if ((window as any).Razorpay) return resolve();
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay script"));
    document.head.appendChild(script);
  });
}

export async function openRazorpayCheckout(params: {
  productOrderId?: string;
  productOrderNumber?: string;
  amountInINR: number;
  currency?: string;
  name?: string;
  description?: string;
  notes?: Record<string, string>;
  prefill?: { name?: string; email?: string; contact?: string };
  orderPayload?: Record<string, any>;
}) {
  // Create a gateway order on server (supports pay-first when productOrderId is omitted and orderPayload provided)
  const amountPaise = Math.round(params.amountInINR * 100);

  // Use axiosInstance — it automatically includes the auth Bearer token (set via setApiAccessToken)
  // and routes through Next.js proxy rewrite (/api/v1 → backend).
  const requestBody = params.productOrderNumber
    ? {
        paymentFor: "PRODUCTS",
        productOrderNumber: params.productOrderNumber,
        currency: params.currency ?? "INR",
      }
    : {
        productOrderId: params.productOrderId ?? "",
        amount: amountPaise,
        currency: params.currency ?? "INR",
        notes: params.notes,
        gateway: "razorpay",
        ...(params.orderPayload ? { orderPayload: params.orderPayload } : {}),
      };

  const createRes = await axiosInstance.post(API_ENDPOINTS.payment.createOrder, requestBody);
  console.log("[payments] createOrder response:", createRes.data);

  const res = createRes.data;
  const orderData = (res && (res as any).data) ? (res as any).data : (res as any);
  const gatewayOrderId = orderData?.gatewayOrderId ?? orderData?.gateway_order_id ?? orderData?.id;
  const amountFromServer = orderData?.amount ?? amountPaise;

  if (!gatewayOrderId) {
    console.error("[payments] gatewayOrderId is missing. Full orderData:", orderData);
    throw new Error("Failed to create payment order");
  }

  await loadRazorpayScript();

  const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";
  if (!key) throw new Error("Razorpay key is not configured. Please contact support.");

  return new Promise<void>((resolve, reject) => {
    let isPaymentResolved = false;
    
    const options: RazorpayCreateOptions = {
      key,
      amount: amountFromServer,
      currency: params.currency ?? "INR",
      name: params.name ?? "Gift Factory",
      description: params.description ?? "Order Payment",
      order_id: gatewayOrderId,
      handler: async (response) => {
        isPaymentResolved = true;
        // Debug logs to ensure order/payment ids align
        // eslint-disable-next-line no-console
        console.log('[openRazorpayCheckout] expectedOrderId:', gatewayOrderId, 'checkout response:', response);
        try {
          await verifyPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          resolve();
        } catch (err) {
          reject(err);
        }
      },
      modal: {
        ondismiss: () => {
          if (!isPaymentResolved) {
            reject(new Error('Payment cancelled'));
          }
        }
      },
      prefill: params.prefill,
      notes: params.notes,
    };

    const rzp = new (window as any).Razorpay(options);
    
    // Handle payment failed event
    if (typeof rzp.on === "function") {
      rzp.on('payment.failed', function (response: any) {
        isPaymentResolved = true;
        reject(new Error(response?.error?.description || 'Payment failed'));
      });
    }
    
    rzp.open();
  });
}
