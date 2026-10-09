'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function AdminGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled Admin Console Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F8F7FD] flex flex-col items-center justify-center p-6 text-center" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Glow effect */}
      <div className="relative mb-6">
        <div className="absolute -inset-4 bg-rose-500/20 rounded-full blur-xl" />
        <div className="relative w-20 h-20 rounded-3xl bg-white border border-rose-200 shadow-xl flex items-center justify-center text-rose-600">
          <AlertTriangle className="w-10 h-10" />
        </div>
      </div>

      <span className="text-[12px] font-extrabold uppercase tracking-widest text-rose-700 bg-rose-50 px-3.5 py-1 rounded-full border border-rose-200 mb-3">
        Admin Console Fault
      </span>

      <h1 className="text-3xl sm:text-4xl font-black text-[#14121F] tracking-tight mb-2">
        System Exception Caught
      </h1>
      <p className="text-[14px] text-[#534F66] max-w-md leading-relaxed mb-8">
        An unhandled exception occurred in the superadmin control plane. The event has been logged for security audit.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm">
        <button
          type="button"
          onClick={() => reset()}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[14px] font-bold text-white bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:opacity-95 active:scale-[0.98] transition-all shadow-md shadow-violet-900/20"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Reload Console</span>
        </button>
        <Link
          href="/dashboard"
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[14px] font-bold text-[#534F66] bg-white border border-[#E8DEF2] hover:bg-slate-50 active:scale-[0.98] transition-all"
        >
          <Home className="w-4 h-4" />
          <span>Admin Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
