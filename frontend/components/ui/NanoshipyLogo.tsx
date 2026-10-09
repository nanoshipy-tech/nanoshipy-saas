'use client';

import React from 'react';

export function NanoshipyLogo({ className = "w-8 h-8", size = 32 }: { className?: string; size?: number }) {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="transform transition-transform hover:scale-105 duration-200"
      >
        <rect width="40" height="40" rx="12" fill="url(#tenantLogoGrad)" />
        
        <path
          d="M11 20L20 11L29 20M11 28L20 19L29 28"
          stroke="white"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        <circle cx="20" cy="11" r="2.5" fill="#38BDF8" />

        <defs>
          <linearGradient id="tenantLogoGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2563EB" />
            <stop offset="1" stopColor="#1D4ED8" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
