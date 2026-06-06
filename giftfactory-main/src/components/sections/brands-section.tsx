"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchBrands } from "@/lib/api";
import { type ApiBrand, getValidImageUrl } from "@/types/api";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import gsap from "gsap";

const defaultBrands: ApiBrand[] = [
  { _id: "b1", name: "Apple", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" },
  { _id: "b2", name: "Samsung", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/24/Samsung_Logo.svg" },
  { _id: "b3", name: "Sony", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/ca/Sony_logo.svg" },
  { _id: "b4", name: "Dell", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/18/Dell_logo_2016.svg" },
  { _id: "b5", name: "HP", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/a/ad/HP_logo_2012.svg" },
  { _id: "b6", name: "Nike", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg" },
  { _id: "b7", name: "Adidas", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/20/Adidas_Logo.svg" },
  { _id: "b8", name: "Canon", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/bd/Canon_logo.svg" },
  { _id: "b9", name: "JBL", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/22/JBL_logo.svg" },
  { _id: "b10", name: "Bose", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ec/Bose_logo.svg" },
];

// ─── Marquee Row ─────────────────────────────────────────────────────────────
function MarqueeRow({
  brands,
  direction = "left",
  speed = 55,
}: {
  brands: ApiBrand[];
  direction?: "left" | "right";
  speed?: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const isPaused = useRef(false);
  const loopBrands = [...brands, ...brands, ...brands];

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !brands.length) return;

    const raf = requestAnimationFrame(() => {
      const totalWidth = track.scrollWidth / 3;
      const startX = direction === "right" ? -totalWidth : 0;
      gsap.set(track, { x: startX });

      tweenRef.current = gsap.to(track, {
        x: direction === "left" ? `-=${totalWidth}` : `+=${totalWidth}`,
        duration: totalWidth / speed,
        ease: "none",
        repeat: -1,
        modifiers: {
          x: gsap.utils.unitize((v) => {
            const val = parseFloat(v) % totalWidth;
            return direction === "left"
              ? val > 0 ? val - totalWidth : val
              : val < -totalWidth ? val + totalWidth : val;
          }),
        },
      });
    });

    return () => {
      cancelAnimationFrame(raf);
      tweenRef.current?.kill();
    };
  }, [brands, direction, speed]);

  const pause = () => { if (!isPaused.current) { tweenRef.current?.pause(); isPaused.current = true; } };
  const resume = () => { if (isPaused.current) { tweenRef.current?.play(); isPaused.current = false; } };

  return (
    <div
      className="flex items-center whitespace-nowrap will-change-transform py-2"
      ref={trackRef}
      onMouseEnter={pause}
      onMouseLeave={resume}
    >
      {loopBrands.map((brand, i) => {
        const rawLogo = brand.imageUrl ?? brand.icon?.secure_url ?? brand.logoUrl;
        const logo = rawLogo ? getValidImageUrl(rawLogo) : null;
        return (
          <Link
            key={`${brand._id}-${i}`}
            href={`/products?brandId=${brand._id}`}
            className="group inline-flex items-center gap-3 mx-3 shrink-0 cursor-pointer"
            onMouseEnter={(e) => gsap.to(e.currentTarget, { scale: 1.05, duration: 0.22, ease: "power2.out" })}
            onMouseLeave={(e) => gsap.to(e.currentTarget, { scale: 1, duration: 0.22, ease: "power2.out" })}
          >
            <div className="flex items-center gap-3 px-6 py-4 rounded-xl border border-gray-100 bg-white hover:border-[#cc176b]/20 hover:shadow-md transition-all duration-300 shadow-2xs">
              {logo ? (
                <div className="relative h-6 w-16 shrink-0">
                  <Image
                    src={logo}
                    alt={brand.name}
                    fill
                    className="object-contain grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300"
                  />
                </div>
              ) : null}
              <span
                className={`text-lg font-bold text-gray-500 group-hover:text-[#cc176b] transition-colors duration-300 ${logo ? "hidden sm:inline" : ""}`}
              >
                {brand.name}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Main Section ─────────────────────────────────────────────────────────────
export const BrandShowcase = () => {
  const { data: res } = useQuery({
    queryKey: ["web", "brands"],
    queryFn: fetchBrands,
  });
  
  const rawBrands = (res?.data ?? []) as ApiBrand[];
  const brands = rawBrands.length > 0 ? rawBrands : defaultBrands;

  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden py-12 bg-white"
    >
      {/* Header with Title and View All */}
      <div className="container mx-auto px-4 mb-8 flex items-center justify-between">
        <h2 className="text-xl md:text-2xl font-black  text-gray-900 tracking-tight">Featured Brands</h2>
        <Link href="/products?sortBy=brand" className="text-xs font-bold text-[#cc176b] hover:underline flex items-center gap-1 cursor-pointer">
          View all brands <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Progressive Edge Blurs / Gradients */}
      <div 
        className="pointer-events-none absolute inset-y-0 left-0 w-32 z-10 hidden md:block"
        style={{ background: "linear-gradient(to right, #ffffff, transparent)" }} 
      />
      <div 
        className="pointer-events-none absolute inset-y-0 right-0 w-32 z-10 hidden md:block"
        style={{ background: "linear-gradient(to left, #ffffff, transparent)" }} 
      />

      {/* Row 1 — scroll left */}
      <div className="overflow-hidden mb-3 text-2xl">
        <MarqueeRow brands={brands} direction="left" speed={40} />
      </div>

      {/* Row 2 — scroll right (offset brands) */}
      <div className="overflow-hidden text-2xl">
        <MarqueeRow
          brands={[...brands.slice(Math.floor(brands.length / 2)), ...brands.slice(0, Math.floor(brands.length / 2))]}
          direction="right"
          speed={35}
        />
      </div>
    </section>
  );
};
