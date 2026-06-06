"use client";

import Link from "next/link";
import { Facebook, Instagram, Twitter, Youtube } from "lucide-react";

// Custom premium payment method icons
const VisaIcon = () => (
  <div className="bg-white border border-gray-200/20 px-2.5 py-1 rounded-sm flex items-center justify-center h-6 w-11 shadow-xs shrink-0 select-none">
    <svg className="h-2.5 w-auto" viewBox="0 0 36 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13.685 0.3L9.123 11.23H6.177L3.743 2.508C3.593 1.944 3.195 1.545 2.684 1.291C2.062 0.966 0.984 0.655 0 0.444L0.098 0.3H4.93C5.553 0.3 6.113 0.697 6.257 1.346L7.458 7.37L10.74 0.3H13.685ZM25.32 7.632C25.32 4.966 21.644 4.82 21.666 3.44C21.677 3.023 22.078 2.57 22.946 2.456C23.376 2.399 24.562 2.349 25.342 2.709L25.82 0.499C25.176 0.271 24.316 0.076 23.238 0.076C20.428 0.076 18.448 1.564 18.428 3.693C18.406 6.275 22.096 6.417 22.072 7.99C22.059 8.468 21.579 8.948 20.579 9.079C19.967 9.158 18.89 9.102 18.069 8.724L17.575 10.973C18.232 11.229 19.262 11.455 20.448 11.455C23.385 11.455 25.32 9.907 25.32 7.632ZM32.32 0.3H30.016C29.309 0.3 28.769 0.708 28.487 1.378L24.347 11.23H27.348L27.947 9.584H31.603L31.947 11.23H34.6L32.32 0.3ZM28.796 7.288L30.347 3.022L31.237 7.288H28.796ZM17.915 0.3H15.088L12.87 11.23H15.698L17.915 0.3Z" fill="#1A1F71"/>
    </svg>
  </div>
);

const MastercardIcon = () => (
  <div className="bg-[#111111] border border-neutral-800 px-2 py-1 rounded-sm flex items-center justify-center h-6 w-11 shadow-xs shrink-0 select-none">
    <svg className="h-4.5 w-auto" viewBox="0 0 32 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="10" fill="#EB001B" />
      <circle cx="22" cy="10" r="10" fill="#F79E1B" fillOpacity="0.85" />
    </svg>
  </div>
);

const PaypalIcon = () => (
  <div className="bg-white border border-gray-200/20 px-2.5 py-1 rounded-sm flex items-center justify-center h-6 w-11 shadow-xs shrink-0 select-none">
    <span className="font-extrabold text-[9px] text-[#003087] italic tracking-tight">Pay</span>
    <span className="font-extrabold text-[9px] text-[#0079C1] italic tracking-tight">Pal</span>
  </div>
);

const ApplePayIcon = () => (
  <div className="bg-white border border-gray-200/20 px-2 py-1 rounded-sm flex items-center justify-center h-6 w-11 shadow-xs gap-0.5 shrink-0 select-none">
    <svg className="h-3 w-auto text-black" viewBox="0 0 170 170" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.34.13-9.13-1.92-14.37-6.15-2.83-2.38-6.66-6.86-11.47-13.43-5.12-7.07-9.35-15.02-12.69-23.85-3.34-8.83-5.03-17.65-5.03-26.47 0-12.87 3.32-23.47 9.97-31.81 6.65-8.34 15-12.51 25.07-12.51 4.48 0 9.28 1.16 14.42 3.49 5.14 2.33 8.78 3.49 10.92 3.49 1.94 0 5.66-1.16 11.17-3.49 5.51-2.33 10.12-3.41 13.82-3.24 13.2.53 23.44 5.37 30.73 14.51-11.4 6.9-17.01 16.28-16.82 28.16.19 9.17 3.44 16.92 9.75 23.23 6.31 6.31 13.87 9.94 22.69 10.87 0 .19-.08.58-.25 1.17-.16.59-.35 1.25-.57 1.96zM119.22 30.74c0-7.07 2.51-13.89 7.54-20.47 5.03-6.57 11.4-10.27 19.12-11.1 1.86 12.68-2.85 23.5-14.12 32.48-5.6 4.41-11.83 6.74-18.7 6.99.1-2.73.53-5.36 1.28-7.9z"/>
    </svg>
    <span className="font-semibold text-[9px] text-black tracking-tight leading-none">Pay</span>
  </div>
);

export function Footer() {
  return (
    <footer className="bg-[#050b18] text-slate-300 pt-16 pb-20 md:pb-16 relative overflow-hidden border-t border-slate-900">
      <div className="container mx-auto px-6 max-w-7xl relative z-10">
        
        {/* Main Columns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-10 mb-12">
          
          {/* Column 1: Brand Logo, Description & Socials */}
          <div className="flex flex-col items-start lg:col-span-1">
            <Link href="/" className="flex items-center gap-3">
              <img src="/favicon.png" alt="Logo" className="h-8 w-8 object-contain shrink-0" />
              <span className="font-bold text-white text-lg tracking-wider uppercase">GIFT FACTORY</span>
            </Link>
            <p className="text-[13px] text-slate-400 mt-4 max-w-[240px] leading-relaxed">
              Your one-stop shop for curated gifts, personalized hampers, and celebration essentials.
            </p>
            {/* Social media icons */}
            <div className="flex items-center gap-4 mt-5">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors" aria-label="Facebook">
                <Facebook className="h-4.5 w-4.5" />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors" aria-label="Instagram">
                <Instagram className="h-4.5 w-4.5" />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors" aria-label="Twitter">
                <Twitter className="h-4.5 w-4.5" />
              </a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors" aria-label="YouTube">
                <Youtube className="h-4.5 w-4.5" />
              </a>
            </div>
          </div>

          {/* Column 2: Shop */}
          <div className="flex flex-col items-start">
            <h3 className="font-semibold text-white text-sm tracking-wide mb-5">Shop</h3>
            <ul className="space-y-3.5 text-[13px]">
              <li>
                <Link href="/products" className="text-slate-400 hover:text-white transition-colors">
                  All Products
                </Link>
              </li>
              <li>
                <Link href="/products" className="text-slate-400 hover:text-white transition-colors">
                  New Arrivals
                </Link>
              </li>
              <li>
                <Link href="/products" className="text-slate-400 hover:text-white transition-colors">
                  Best Sellers
                </Link>
              </li>
              <li>
                <Link href="/products" className="text-slate-400 hover:text-white transition-colors">
                  Deals
                </Link>
              </li>
              <li>
                <Link href="/products" className="text-slate-400 hover:text-white transition-colors">
                  Brands
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Customer Service */}
          <div className="flex flex-col items-start">
            <h3 className="font-semibold text-white text-sm tracking-wide mb-5">Customer Service</h3>
            <ul className="space-y-3.5 text-[13px]">
              <li>
                <Link href="/orders" className="text-slate-400 hover:text-white transition-colors">
                  Track Order
                </Link>
              </li>
              <li>
                <Link href="/orders" className="text-slate-400 hover:text-white transition-colors">
                  Returns
                </Link>
              </li>
              <li>
                <Link href="/help" className="text-slate-400 hover:text-white transition-colors">
                  Shipping Info
                </Link>
              </li>
              <li>
                <Link href="/help" className="text-slate-400 hover:text-white transition-colors">
                  FAQs
                </Link>
              </li>
              <li>
                <Link href="/help" className="text-slate-400 hover:text-white transition-colors">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Company */}
          <div className="flex flex-col items-start">
            <h3 className="font-semibold text-white text-sm tracking-wide mb-5">Company</h3>
            <ul className="space-y-3.5 text-[13px]">
              <li>
                <Link href="/about" className="text-slate-400 hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-slate-400 hover:text-white transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="#" className="text-slate-400 hover:text-white transition-colors">
                  Careers
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-slate-400 hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/conditions" className="text-slate-400 hover:text-white transition-colors">
                  Terms & Conditions
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 5: Get in Touch */}
          <div className="flex flex-col items-start">
            <h3 className="font-semibold text-white text-sm tracking-wide mb-5">Get in Touch</h3>
            <div className="text-[13px] text-slate-400 space-y-3.5 leading-relaxed">
              <p>
                Email:{" "}
                <a href="mailto:support@giftfactory.com" className="hover:text-white transition-colors font-medium">
                  support@giftfactory.com
                </a>
              </p>
              <p>
                Phone:{" "}
                <a href="tel:+15551234567" className="hover:text-white transition-colors font-medium">
                  +1 (555) 123-4567
                </a>
              </p>
              <p className="text-slate-400">
                Address: 123 Commerce St,
                <br />
                New York, NY 10001
              </p>
            </div>
          </div>

        </div>

        {/* Divider line */}
        <hr className="border-slate-800/60 my-6" />

        {/* Bottom row */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[13px] text-slate-500">
            © 2026 Gift Factory. All rights reserved.
          </p>
          {/* Payment gateway icons */}
          <div className="flex items-center gap-2">
            <VisaIcon />
            <MastercardIcon />
            <PaypalIcon />
            <ApplePayIcon />
          </div>
        </div>
      </div>
    </footer>
  );
}
