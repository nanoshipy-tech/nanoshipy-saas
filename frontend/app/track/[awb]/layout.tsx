import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Track Your Shipment | Nanoshipy Logistics',
  description: 'Track your shipment in real time. Enter your AWB number to see live delivery updates.',
};

export default function PublicTrackingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#14121F] text-white">
      {/* Branded Header */}
      <header className="border-b border-white/10 backdrop-blur-md bg-white/5 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/track" className="flex items-center space-x-3">
            <img src="/logo.png" alt="Nanoshipy Logo" className="w-8 h-8 rounded-lg object-contain" />
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-base tracking-tight font-sans">Nanoshipy</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#D6A8FF]/20 text-[#D6A8FF] font-semibold border border-[#D6A8FF]/30">
                Shipment Tracker
              </span>
            </div>
          </Link>
          <Link href="/track" className="text-xs font-semibold text-white/70 hover:text-white transition-all">
            Search another AWB →
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {children}
      </main>

      <footer className="border-t border-white/10 mt-16 py-8 text-center bg-black/20 space-y-1.5">
        <p className="text-white/40 text-xs">
          Powered by Nanoshipy Logistics Engine · Real-Time Tracking & Status Logs
        </p>
        <p className="text-white/50 text-xs">
          © {new Date().getFullYear()} Nanoshipy Logistics. All rights reserved. -{' '}
          <a
            href="https://growax360.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-300 hover:underline font-semibold"
          >
            Growax360
          </a>
        </p>
      </footer>
    </div>
  );
}
