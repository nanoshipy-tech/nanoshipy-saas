'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/authStore';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  // Close mobile sidebar on route transition
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  // Keyboard shortcut Ctrl+B / Cmd+B for Sidebar Minimize
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7FD]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#D6A8FF] border-t-[#5B069A] animate-spin" />
          <p className="text-[#534F66] text-xs font-semibold">Loading Seller Workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar
          onToggleMobileSidebar={() => setMobileSidebarOpen((prev) => !prev)}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          collapsed={sidebarCollapsed}
        />

        {/* Pending KYC / Approval Notice */}
        {(user?.tenant?.kyc_status === 'pending' || user?.tenant?.status === 'pending') && (
          <div
            className="border-b px-4 sm:px-7 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0"
            style={{
              backgroundColor: 'var(--warn-bg)',
              borderColor: 'var(--line)',
              color: 'var(--warn)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full shrink-0 animate-ping" style={{ backgroundColor: 'var(--warn)' }} />
              <p className="text-xs font-semibold">
                <span className="font-extrabold uppercase tracking-wide mr-1.5">[Account In KYC Review Queue]</span>
                Your account is currently awaiting administrative approval, warehouse configuration, and rate setup. Store connection and shipping will be unlocked as soon as verified.
              </p>
            </div>
            <span
              className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase w-fit shrink-0"
              style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--warn)' }}
            >
              Pending Admin Approval
            </span>
          </div>
        )}

        <main className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--bg)' }}>
          <div className="p-[16px_14px] sm:p-[20px_28px_40px] max-w-[1440px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
