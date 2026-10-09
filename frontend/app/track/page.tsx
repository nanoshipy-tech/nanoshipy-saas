'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Package, Truck, ArrowRight, ShieldCheck, MapPin, Loader2 } from 'lucide-react';

function TrackingSearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [awb, setAwb] = useState('');
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const queryAwb = (
      searchParams.get('awb') ||
      searchParams.get('awb_number') ||
      searchParams.get('tracking_number') ||
      searchParams.get('trackingNumber') ||
      searchParams.get('waybill')
    )?.trim();

    if (queryAwb) {
      setRedirecting(true);
      router.replace(`/track/${encodeURIComponent(queryAwb)}`);
    }
  }, [searchParams, router]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!awb.trim()) return;
    router.push(`/track/${encodeURIComponent(awb.trim())}`);
  };

  if (redirecting) {
    return (
      <div className="min-h-screen bg-[#14121F] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 border-2 border-[#8410DC]/40 rounded-full animate-ping" />
            <div className="absolute inset-2 border-2 border-[#D6A8FF] rounded-full animate-spin border-t-transparent" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white tracking-tight">Loading Live Tracking...</h2>
            <p className="text-white/50 text-sm">Fetching real-time consignment updates from Nanoshipy</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#14121F] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow elements */}
      <div className="absolute top-[-150px] right-[-150px] w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(132,16,220,0.2) 0%, transparent 70%)' }} />
      <div className="absolute bottom-[-150px] left-[-150px] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(91,6,154,0.15) 0%, transparent 70%)' }} />

      <div className="relative z-10 w-full max-w-2xl text-center space-y-8">
        {/* Brand header */}
        <div className="flex items-center justify-center gap-3 mb-2">
          <img src="/logo.png" alt="Nanoshipy" className="w-10 h-10 rounded-xl object-contain shadow-lg" />
          <span className="text-2xl font-bold tracking-tight">Nanoshipy Logistics</span>
        </div>

        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-[#D6A8FF]">
            <Truck className="w-3.5 h-3.5 text-[#D6A8FF]" />
            <span>Live Multi-Carrier Tracking Engine</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
            Track your shipment in <span className="bg-gradient-to-r from-[#D6A8FF] to-[#E7D3FF] bg-clip-text text-transparent">real time.</span>
          </h1>
          <p className="text-white/60 text-sm md:text-base max-w-lg mx-auto leading-relaxed">
            Enter your AWB tracking number below to view instant status updates, courier checkpoints, and estimated delivery times.
          </p>
        </div>

        {/* Search Box */}
        <form onSubmit={handleSearch} className="relative max-w-xl mx-auto">
          <div className="flex items-center bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-2 shadow-2xl focus-within:border-[#D6A8FF] transition-all">
            <div className="pl-4 pr-2 text-white/40">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={awb}
              onChange={(e) => setAwb(e.target.value)}
              placeholder="Enter AWB Tracking Number (e.g. 90668242055)"
              className="w-full bg-transparent border-none text-white text-base placeholder-white/40 outline-none px-2 py-3 font-mono font-medium"
              required
            />
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:opacity-95 shadow-lg shadow-purple-900/40 transition-all flex-shrink-0 cursor-pointer"
            >
              <span>Track</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Features badges */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 text-left max-w-xl mx-auto">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-start gap-3">
            <Package className="w-5 h-5 text-[#D6A8FF] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-white">18+ Couriers</h4>
              <p className="text-[11px] text-white/50">Delhivery, Bluedart, Xpressbees, Shadowfax & more</p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-start gap-3">
            <MapPin className="w-5 h-5 text-[#D6A8FF] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-white">Live Checkpoints</h4>
              <p className="text-[11px] text-white/50">Real-time status updates and delivery logs</p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#D6A8FF] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-white">Verified Security</h4>
              <p className="text-[11px] text-white/50">Direct API integration with partner logistics</p>
            </div>
          </div>
        </div>

        <div className="text-xs text-white/50 pt-4">
          © {new Date().getFullYear()} Nanoshipy Logistics. All rights reserved. -{' '}
          <a
            href="https://growax360.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#D6A8FF] hover:underline font-semibold"
          >
            Growax360
          </a>
        </div>
      </div>
    </div>
  );
}

export default function PublicTrackingSearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#14121F] text-white flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#D6A8FF]" />
        </div>
      }
    >
      <TrackingSearchContent />
    </Suspense>
  );
}
