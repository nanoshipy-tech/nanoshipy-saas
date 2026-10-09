import React from 'react';
import Link from 'next/link';
import { ShieldAlert, Home } from 'lucide-react';

export default function AdminNotFound() {
  return (
    <div className="min-h-screen bg-[#F8F7FD] flex flex-col items-center justify-center p-6 text-center" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Glow effect */}
      <div className="relative mb-6">
        <div className="absolute -inset-4 bg-gradient-to-r from-[#5B069A]/20 to-[#8410DC]/20 rounded-full blur-xl" />
        <div className="relative w-20 h-20 rounded-3xl bg-white border border-[#E8DEF2] shadow-xl flex items-center justify-center text-[#5B069A]">
          <ShieldAlert className="w-10 h-10" />
        </div>
      </div>

      <span className="text-[12px] font-extrabold uppercase tracking-widest text-[#5B069A] bg-[#F3E8FF] px-3.5 py-1 rounded-full border border-[#D6A8FF]/40 mb-3">
        404 &bull; Console Resource Not Found
      </span>

      <h1 className="text-3xl sm:text-4xl font-black text-[#14121F] tracking-tight mb-2">
        Admin Page Not Found
      </h1>
      <p className="text-[14px] text-[#534F66] max-w-md leading-relaxed mb-8">
        The administration module, seller account, or system resource you requested does not exist or your session lacks privileges.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs">
        <Link
          href="/dashboard"
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[14px] font-bold text-white bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:opacity-95 active:scale-[0.98] transition-all shadow-md shadow-violet-900/20"
        >
          <Home className="w-4 h-4" />
          <span>Admin Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
