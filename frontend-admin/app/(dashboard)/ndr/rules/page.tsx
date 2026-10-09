'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, Settings, RefreshCw, Zap, ShieldCheck, ArrowRight } from 'lucide-react';

export default function NdrRulesPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-[#E8DEF2] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F6EFFF] text-[#5B069A] border border-[#D6A8FF] text-[11.5px] font-bold uppercase tracking-wider mb-2">
            <AlertTriangle className="w-3.5 h-3.5" /> NDR Engine
          </div>
          <h1 className="text-[26px] font-extrabold text-[#14121F] tracking-tight font-heading">
            Automated NDR Rules & SLA Triggers
          </h1>
          <p className="text-[13.5px] text-[#534F66] font-medium mt-1">
            Configure automated buyer IVR calls, WhatsApp reattempt workflows, and RTO conversion rules.
          </p>
        </div>
        <Link
          href="/ndr"
          className="inline-flex items-center gap-2 bg-white border border-[#E8DEF2] text-[#14121F] hover:bg-[#F6EFFF] px-4 py-2.5 rounded-xl font-bold text-xs transition-colors"
        >
          ← Back to NDR Queue
        </Link>
      </div>

      {/* Rules Config List */}
      <div className="bg-white p-6 rounded-2xl border border-[#E8DEF2] shadow-sm space-y-6">
        <h3 className="text-lg font-bold text-[#14121F]">Standard System NDR Workflows</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-5 rounded-2xl border border-[#E8DEF2] bg-[#F8F7FD] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#F6EFFF] text-[#5B069A] border border-[#D6A8FF] flex items-center justify-center mb-3">
                <Zap className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-[#14121F] text-base">Attempt 1 Failure</h4>
              <p className="text-xs text-[#534F66] mt-1 font-medium leading-relaxed">
                Trigger immediate WhatsApp notification to buyer requesting delivery address verification or preferred delivery time slot.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#E8DEF2] flex items-center justify-between text-xs font-bold text-[#16a34a]">
              <span>Active</span>
              <span className="w-2 h-2 rounded-full bg-[#16a34a]" />
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-[#E8DEF2] bg-[#F8F7FD] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#F6EFFF] text-[#5B069A] border border-[#D6A8FF] flex items-center justify-center mb-3">
                <RefreshCw className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-[#14121F] text-base">Attempt 2 Failure</h4>
              <p className="text-xs text-[#534F66] mt-1 font-medium leading-relaxed">
                Escalate to merchant seller dashboard for direct customer phone contact and automated courier reattempt dispatch.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#E8DEF2] flex items-center justify-between text-xs font-bold text-[#16a34a]">
              <span>Active</span>
              <span className="w-2 h-2 rounded-full bg-[#16a34a]" />
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-[#E8DEF2] bg-[#F8F7FD] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#F6EFFF] text-[#5B069A] border border-[#D6A8FF] flex items-center justify-center mb-3">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-[#14121F] text-base">Attempt 3 Failure (RTO Auto-Trigger)</h4>
              <p className="text-xs text-[#534F66] mt-1 font-medium leading-relaxed">
                If buyer remains unreachable after 3 consecutive attempts, system automatically marks package for Return to Origin (RTO).
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#E8DEF2] flex items-center justify-between text-xs font-bold text-[#16a34a]">
              <span>Active</span>
              <span className="w-2 h-2 rounded-full bg-[#16a34a]" />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
