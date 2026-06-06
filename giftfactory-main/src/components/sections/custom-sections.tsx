"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { 
  ChevronRight, 
  ChevronLeft, 
  ShoppingBag, 
  Heart, 
  Star, 
  Eye,
  Truck, 
  ShieldCheck, 
  Clock, 
  RotateCcw,
  Sparkles,
  Search,
  MessageCircle,
  HelpCircle,
  Play,
  Gift,
  Flower2,
  Candy,
  Utensils,
  Briefcase,
  Smile,
  Gem,
  Home
} from "lucide-react";
import type { ApiCategory, ApiProduct, ApiBrand } from "@/types/api";
import { mapApiProductToDisplay } from "@/types/api";
import { ProductCard } from "@/components/card/main-product-card";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────────────────────
// 1. SERVICES GRID SECTION
// ─────────────────────────────────────────────────────────────────────────────
export function ServicesGrid() {
  const services = [
    {
      icon: <Truck className="h-6 w-6 text-[#cc176b]" />,
      title: "Free Shipping",
      desc: "On orders over $99"
    },
    {
      icon: <ShieldCheck className="h-6 w-6 text-[#cc176b]" />,
      title: "Secure Payment",
      desc: "100% secure checkout"
    },
    {
      icon: <RotateCcw className="h-6 w-6 text-[#cc176b]" />,
      title: "Easy Returns",
      desc: "30-day return policy"
    },
    {
      icon: <Clock className="h-6 w-6 text-[#cc176b]" />,
      title: "24/7 Support",
      desc: "We're here to help"
    }
  ];

  return (
    <section className="py-6 bg-white border-b border-gray-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {services.map((item, idx) => (
            <div 
              key={idx} 
              className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:shadow-sm transition-all"
            >
              <div className="p-2 bg-pink-50 rounded-full shrink-0">
                {item.icon}
              </div>
              <div>
                <h3 className="font-bold text-md text-gray-900 leading-tight">{item.title}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SHOP BY CATEGORY SECTION (RIBBON)
// ─────────────────────────────────────────────────────────────────────────────
function getCategoryIcon(name: string) {
  const n = name.toLowerCase();
  
  if (n.includes("gift")) {
    return {
      icon: Gift,
      bg: "bg-pink-50 border-pink-100",
      color: "text-[#cc176b]"
    };
  }
  if (n.includes("hamper") || n.includes("bundle")) {
    return {
      icon: ShoppingBag,
      bg: "bg-purple-50 border-purple-100",
      color: "text-purple-600"
    };
  }
  if (n.includes("flower") || n.includes("bouquet")) {
    return {
      icon: Flower2,
      bg: "bg-red-50 border-red-100",
      color: "text-red-500"
    };
  }
  if (n.includes("chocolate") || n.includes("sweet") || n.includes("candy")) {
    return {
      icon: Candy,
      bg: "bg-amber-50 border-amber-100",
      color: "text-amber-700"
    };
  }
  if (n.includes("food") || n.includes("gourmet") || n.includes("confection")) {
    return {
      icon: Utensils,
      bg: "bg-emerald-50 border-emerald-100",
      color: "text-emerald-600"
    };
  }
  if (n.includes("corporate") || n.includes("business")) {
    return {
      icon: Briefcase,
      bg: "bg-blue-50 border-blue-100",
      color: "text-blue-600"
    };
  }
  if (n.includes("him") || n.includes("her") || n.includes("recipient")) {
    return {
      icon: Heart,
      bg: "bg-rose-50 border-rose-100",
      color: "text-rose-500"
    };
  }
  if (n.includes("kid") || n.includes("toy")) {
    return {
      icon: Smile,
      bg: "bg-sky-50 border-sky-100",
      color: "text-sky-500"
    };
  }
  if (n.includes("jewel") || n.includes("gem")) {
    return {
      icon: Gem,
      bg: "bg-teal-50 border-teal-100",
      color: "text-teal-600"
    };
  }
  if (n.includes("decor") || n.includes("home")) {
    return {
      icon: Home,
      bg: "bg-indigo-50 border-indigo-100",
      color: "text-indigo-600"
    };
  }
  
  // Default fallback
  return {
    icon: Sparkles,
    bg: "bg-gray-50 border-gray-100",
    color: "text-gray-500"
  };
}

export function CategoryRibbon({ categories }: { categories: ApiCategory[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.7;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth"
    });
  };

  return (
    <section className="py-10 bg-white">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Shop by Category</h2>
          <div className="flex items-center gap-3">
            <Link href="/products" className="text-xs font-bold text-[#cc176b] hover:underline flex items-center gap-1">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => handleScroll("left")}
                className="p-1 rounded-full border border-gray-100 hover:bg-gray-50 text-gray-600"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button 
                onClick={() => handleScroll("right")}
                className="p-1 rounded-full border border-gray-100 hover:bg-gray-50 text-gray-600"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Scroll list */}
        <div 
          ref={scrollRef}
          className="flex items-center gap-6 overflow-x-auto pb-4 scrollbar-hide scroll-smooth snap-x"
        >
          {categories.map((c) => {
            const { icon: IconComponent, bg: bgClass, color: colorClass } = getCategoryIcon(c.name);
            return (
              <Link
                key={c._id}
                href={`/products?categoryId=${c._id}`}
                className="flex-none snap-start w-36 flex flex-col items-center group cursor-pointer"
              >
                {/* Icon circle */}
                <div className={`w-24 h-24 rounded-full ${bgClass} border flex items-center justify-center relative group-hover:scale-105 transition-transform duration-200`}>
                  <IconComponent className={`h-10 w-10 ${colorClass} stroke-[1.5] group-hover:scale-110 transition-transform duration-200`} />
                  
                  {/* Floating arrow */}
                  <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-[#cc176b] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                </div>
                {/* Title */}
                <h3 className="font-bold text-xs text-gray-900 mt-3 group-hover:text-[#cc176b] transition-colors line-clamp-1">{c.name}</h3>
                <span className="text-[10px] text-gray-400 mt-0.5 font-medium">Shop Now →</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. FLASH DEALS WITH COUNTDOWN TIMER
// ─────────────────────────────────────────────────────────────────────────────
export function FlashDeals({ products, isLoading }: { products: ApiProduct[], isLoading: boolean }) {
  const [timeLeft, setTimeLeft] = useState({ days: 2, hours: 17, minutes: 43, seconds: 12 });
  const scrollRef = useRef<HTMLDivElement>(null);

  // Simple reactive timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        if (prev.days > 0) return { ...prev, days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 };
        clearInterval(timer);
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleScroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const step = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" });
  };

  const displayProducts = products.map(mapApiProductToDisplay);

  const pad = (num: number) => String(num).padStart(2, "0");

  return (
    <section className="py-10 bg-gray-50">
      <div className="container mx-auto px-4">
        {/* Header with timer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Flash Deals</h2>
            {/* Timer blocks */}
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#cc176b]">
              <div className="flex flex-col items-center">
                <span className="bg-[#cc176b] text-white rounded-md px-2 py-1 min-w-[28px] text-center font-mono text-xs">{pad(timeLeft.days)}</span>
                <span className="text-[9px] text-gray-400 mt-0.5 uppercase tracking-wider">Days</span>
              </div>
              <span>:</span>
              <div className="flex flex-col items-center">
                <span className="bg-[#cc176b] text-white rounded-md px-2 py-1 min-w-[28px] text-center font-mono text-xs">{pad(timeLeft.hours)}</span>
                <span className="text-[9px] text-gray-400 mt-0.5 uppercase tracking-wider">Hours</span>
              </div>
              <span>:</span>
              <div className="flex flex-col items-center">
                <span className="bg-[#cc176b] text-white rounded-md px-2 py-1 min-w-[28px] text-center font-mono text-xs">{pad(timeLeft.minutes)}</span>
                <span className="text-[9px] text-gray-400 mt-0.5 uppercase tracking-wider">Mins</span>
              </div>
              <span>:</span>
              <div className="flex flex-col items-center">
                <span className="bg-[#cc176b] text-white rounded-md px-2 py-1 min-w-[28px] text-center font-mono text-xs">{pad(timeLeft.seconds)}</span>
                <span className="text-[9px] text-gray-400 mt-0.5 uppercase tracking-wider">Secs</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/products?deals=1" className="text-xs font-bold text-[#cc176b] hover:underline flex items-center gap-1">
              View all deals <ChevronRight className="h-3 w-3" />
            </Link>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => handleScroll("left")}
                className="p-1 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 shadow-sm"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button 
                onClick={() => handleScroll("right")}
                className="p-1 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 shadow-sm"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Horizontal scroll cards */}
        <div 
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto pb-4 scroll-smooth scrollbar-hide snap-x"
        >
          {isLoading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="w-[280px] shrink-0 bg-white rounded-xl h-[360px] animate-pulse" />
            ))
          ) : (
            displayProducts.map((p) => (
              <div key={p.id} className="w-[280px] shrink-0 snap-start bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative">
                {/* Discount Tag */}
                {p.discountPercentage > 0 && (
                  <span className="absolute top-3 left-3 bg-red-500 text-white font-bold text-[10px] px-2 py-0.5 rounded-full z-10">
                    -{p.discountPercentage}%
                  </span>
                )}
                {/* Product Card renders directly */}
                <ProductCard product={p} className="h-full w-full" />
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PROMOTIONAL BANNERS GRID (3 COLUMNS)
// ─────────────────────────────────────────────────────────────────────────────
export function PromoGrid() {
  const banners = [
    {
      title: "Up to 30% Off",
      subtitle: "On selected premium products",
      image: "https://images.unsplash.com/photo-1592078615290-033ee584e267?q=80&w=300&auto=format&fit=crop",
      bgClass: "bg-gradient-to-r from-[#5b21b6] to-[#7c3aed] text-white",
      href: "/products"
    },
    {
      title: "HP Pavilion",
      subtitle: "Power your every day",
      image: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?q=80&w=300&auto=format&fit=crop",
      bgClass: "bg-gradient-to-r from-[#9d174d] to-[#db2777] text-white",
      href: "/products"
    },
    {
      title: "Zebronics Mouse",
      subtitle: "Precision. Performance. Perfected.",
      image: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?q=80&w=300&auto=format&fit=crop",
      bgClass: "bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] text-white",
      href: "/products"
    }
  ];

  return (
    <section className="py-8 bg-white">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {banners.map((b, idx) => (
            <div 
              key={idx} 
              className={`rounded-2xl overflow-hidden p-6 min-h-[160px] flex items-center justify-between relative shadow-sm hover:-translate-y-0.5 transition-all duration-200 ${b.bgClass}`}
            >
              <div className="z-10 max-w-[60%] flex flex-col justify-center">
                <h3 className="text-lg font-black tracking-tight leading-tight">{b.title}</h3>
                <p className="text-xs text-white/90 mt-1 line-clamp-2 leading-snug">{b.subtitle}</p>
                <Link href={b.href} className="inline-flex items-center gap-1 bg-white text-gray-900 rounded-full px-4 py-1.5 text-[10px] font-bold mt-4 w-max hover:bg-pink-50 transition-colors">
                  Shop Now →
                </Link>
              </div>
              <div className="absolute right-3 bottom-3 w-28 h-28 flex items-center justify-center shrink-0">
                <img src={b.image} alt={b.title} className="max-h-full max-w-full object-contain drop-shadow-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. FEATURED BRANDS
// ─────────────────────────────────────────────────────────────────────────────
export function FeaturedBrands({ brands }: { brands: ApiBrand[] }) {
  const popularBrands = [
    { name: "Apple", logo: "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" },
    { name: "Samsung", logo: "https://upload.wikimedia.org/wikipedia/commons/2/24/Samsung_Logo.svg" },
    { name: "Sony", logo: "https://upload.wikimedia.org/wikipedia/commons/c/ca/Sony_logo.svg" },
    { name: "Dell", logo: "https://upload.wikimedia.org/wikipedia/commons/1/18/Dell_logo_2016.svg" },
    { name: "HP", logo: "https://upload.wikimedia.org/wikipedia/commons/a/ad/HP_logo_2012.svg" },
    { name: "Nike", logo: "https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg" },
    { name: "Adidas", logo: "https://upload.wikimedia.org/wikipedia/commons/2/20/Adidas_Logo.svg" },
    { name: "Canon", logo: "https://upload.wikimedia.org/wikipedia/commons/b/bd/Canon_logo.svg" },
    { name: "JBL", logo: "https://upload.wikimedia.org/wikipedia/commons/2/22/JBL_logo.svg" },
    { name: "Bose", logo: "https://upload.wikimedia.org/wikipedia/commons/e/ec/Bose_logo.svg" }
  ];

  return (
    <section className="py-10 bg-white border-t border-gray-100">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Featured Brands</h2>
          <Link href="/products" className="text-xs font-bold text-[#cc176b] hover:underline flex items-center gap-1">
            View all brands <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-5 gap-4">
          {popularBrands.map((b, idx) => (
            <div 
              key={idx}
              className="flex items-center justify-center p-4 border border-gray-100 rounded-xl bg-white hover:shadow-sm transition-shadow h-16 cursor-pointer"
            >
              <img src={b.logo} alt={b.name} className="max-h-7 max-w-full object-contain grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. TRENDING PRODUCTS & WHY SHOP WITH US (SIDE-BY-SIDE)
// ─────────────────────────────────────────────────────────────────────────────
export function TrendingAndWhy({ products, categories }: { products: ApiProduct[], categories: ApiCategory[] }) {
  const [activeTab, setActiveTab] = useState("all");

  const filteredProducts = activeTab === "all"
    ? products.slice(0, 4)
    : products.filter(p => p.categoryId === activeTab || (p as any).category?.name?.toLowerCase() === activeTab.toLowerCase()).slice(0, 4);

  const displayProducts = filteredProducts.map(mapApiProductToDisplay);

  const tabs = ["All", "Electronics", "Accessories", "Gadgets", "Gaming"];

  return (
    <section className="py-10 bg-white">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Columns: Trending Products */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Trending Products</h2>
              <Link href="/products" className="text-xs font-bold text-[#cc176b] hover:underline flex items-center gap-1">
                View all products <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Tab header */}
            <div className="flex items-center gap-3 overflow-x-auto pb-3 border-b border-gray-100 mb-6 scrollbar-hide">
              <button 
                onClick={() => setActiveTab("all")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === "all" 
                    ? "bg-pink-50 text-[#cc176b] border border-pink-100/50" 
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                All
              </button>
              {categories.slice(0, 4).map((c) => (
                <button 
                  key={c._id}
                  onClick={() => setActiveTab(c._id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === c._id
                      ? "bg-pink-50 text-[#cc176b] border border-pink-100/50" 
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Product List */}
            {displayProducts.length === 0 ? (
              <p className="text-sm text-gray-500 py-6">No trending products available in this category.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {displayProducts.map((p) => (
                  <Link 
                    key={p.id}
                    href={`/products/${p.id}`}
                    className="flex items-center gap-4 py-4 hover:bg-gray-50/50 transition-colors px-2 rounded-xl group cursor-pointer"
                  >
                    <div className="relative w-16 h-16 bg-gray-50 border border-gray-100 rounded-lg overflow-hidden shrink-0">
                      <img src={p.thumbnail || "https://picsum.photos/seed/gift/100/100"} alt={p.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-gray-900 truncate group-hover:text-[#cc176b] transition-colors">{p.title}</h4>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className="flex items-center text-yellow-400">
                          <Star className="h-3 w-3 fill-current" />
                          <span className="text-xs font-bold text-gray-700 ml-0.5">{p.rating.toFixed(1)}</span>
                        </div>
                        <span className="text-xs text-gray-500">({p.reviewCount ?? 0})</span>
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-sm font-black text-[#cc176b]">₹{p.price.toLocaleString("en-IN")}</span>
                        {p.mrp && p.mrp > p.price && (
                          <span className="text-xs text-gray-400 line-through">₹{p.mrp.toLocaleString("en-IN")}</span>
                        )}
                        {p.discountPercentage > 0 && (
                          <span className="text-[10px] bg-red-50 text-red-500 font-bold px-1 rounded">-{p.discountPercentage}%</span>
                        )}
                      </div>
                    </div>
                    <button className="p-2 text-gray-400 hover:text-red-500">
                      <Heart className="h-5 w-5" />
                    </button>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Why Shop With Us? */}
          <div className="bg-pink-50/40 border border-pink-100/40 rounded-2xl p-6 flex flex-col justify-between h-max">
            <div>
              <h2 className="text-lg font-black text-gray-900 tracking-tight mb-6">Why Shop With Us?</h2>
              <div className="space-y-6">
                {[
                  { title: "Trusted by Thousands", desc: "Join 50,000+ happy shoppers", icon: <Star className="h-5 w-5 text-[#cc176b]" /> },
                  { title: "Best Prices Guaranteed", desc: "Find lower prices? We match them", icon: <ShieldCheck className="h-5 w-5 text-[#cc176b]" /> },
                  { title: "Fast & Free Delivery", desc: "Free shipping on orders over $99", icon: <Truck className="h-5 w-5 text-[#cc176b]" /> },
                  { title: "Easy Returns & Refund", desc: "Hassle-free 30-day refund policy", icon: <RotateCcw className="h-5 w-5 text-[#cc176b]" /> }
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="p-2.5 bg-pink-100/60 rounded-full h-10 w-10 flex items-center justify-center shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-gray-900 leading-tight">{item.title}</h4>
                      <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Frequently Asked Questions (FAQ Section Grid)
// ─────────────────────────────────────────────────────────────────────────────
export function HomeFaqSection({ faqs }: { faqs: { question: string, answer: string }[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(0);

  const supportPanels = [
    { title: "Track Your Order", desc: "Get real-time updates on your order", icon: <Clock className="h-5 w-5 text-pink-500" /> },
    { title: "Returns & Refunds", desc: "Easy returns within 30 days", icon: <RotateCcw className="h-5 w-5 text-pink-500" /> },
    { title: "Customer Support", desc: "We're here to help you 24/7", icon: <HelpCircle className="h-5 w-5 text-pink-500" /> },
    { title: "Secure Payments", desc: "100% safe and secure checkout", icon: <ShieldCheck className="h-5 w-5 text-pink-500" /> }
  ];

  return (
    <section className="py-4 bg-white border-t border-gray-100">
      <div className="container mx-auto px-1">
        <div className="grid grid-cols-1 lg:grid-cols-4  items-start">
          
          {/* Column 1: Title & View All */}
          <div className="lg:col-span-1 flex flex-col justify-start">
            <h2 className="text-2xl md:text-2xl lg:text-3xl font-black text-gray-900 leading-tight tracking-tight lg:mt-15 lg:ml-15 md:ml-6 ml-4 mt-6">
              Frequently <br className="hidden lg:block" />
              Asked <br className="hidden lg:block" />
              Questions
            </h2>
            <Link href="/help" className="text-lg font-bold text-[#cc176b] hover:underline flex items-center gap-1 lg:ml-15 md:ml-6 ml-4 mt-2">
              View all FAQs <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Column 2: Accordion questions list (takes up 2 grid columns for width) */}
          <div className="lg:col-span-2 border border-gray-100 rounded-2xl bg-white shadow-2xs divide-y divide-gray-100 p-1">
            {faqs.slice(0, 4).map((f, idx) => {
              const isOpen = activeIndex === idx;
              return (
                <div key={idx} className="p-4 transition-colors">
                  <button
                    onClick={() => setActiveIndex(isOpen ? null : idx)}
                    className="w-[80%] flex items-center justify-between text-left font-bold text-sm text-gray-900  transition-colors cursor-pointer"
                  >
                    <span>{f.question}</span>
                    <span className="text-[#cc176b] font-black text-lg select-none ml-4">{isOpen ? "−" : "+"}</span>
                  </button>
                  <div 
                    className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
                      isOpen ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="text-md text-[#cc176b] leading-relaxed pt-2">
                        {f.answer}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Column 3: Support services list */}
          <div className="lg:col-span-1 flex flex-col gap-6 justify-center">
            <h2></h2>
            {supportPanels.map((p, idx) => (
              <div key={idx} className="flex gap-4 items-center">
                <div className="p-2.5 bg-pink-50 border border-pink-100/10 rounded-full h-10 w-10 flex items-center justify-center shrink-0">
                  {p.icon}
                </div>
                <div>
                  <h4 className="font-bold text-xs text-gray-900 leading-tight">{p.title}</h4>
                  <p className="text-[10px] text-gray-400 mt-1">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
