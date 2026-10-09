'use client';

import React, { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/authStore';
import { useTheme } from '@/lib/themeStore';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import {
  Search, Sun, Moon, Plus, Menu, ChevronDown,
  Settings, LogOut, Wallet, ShieldCheck
} from 'lucide-react';

const PAGE_LABELS: Record<string, { title: string; subtitle?: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Overview & daily performance metrics' },
  '/orders': { title: 'Orders', subtitle: 'Manage all inward orders & fulfillment' },
  '/orders/new': { title: 'Create order', subtitle: 'Book single manual consignment' },
  '/shipments': { title: 'Shipments', subtitle: 'Live track shipments, AWBs & carrier logs' },
  '/ndr': { title: 'Delivery issues', subtitle: 'Resolve non-delivery exceptions & re-attempts' },
  '/rto': { title: 'Returns (RTO)', subtitle: 'Undelivered consignments returning to origin' },
  '/rate-cards': { title: 'Couriers & rates', subtitle: 'Integrated carrier pricing & delivery lanes' },
  '/wallet': { title: 'Billing & wallet', subtitle: 'Manage shipping balance & recharge' },
  '/wallet/recharge': { title: 'Recharge wallet', subtitle: 'Instant top-up via UPI, cards or netbanking' },
  '/wallet/remittances': { title: 'COD remittances', subtitle: 'Delivered COD reconciliation & payout ledger' },
  '/billing': { title: 'Billing & invoices', subtitle: 'GST tax invoices & freight statements' },
  '/analytics': { title: 'Reports & analytics', subtitle: 'Export operational & carrier performance data' },
  '/integrations': { title: 'Stores & channels', subtitle: 'Connect Shopify, WooCommerce & custom API' },
  '/settings': { title: 'Settings', subtitle: 'Company profile, pickup hubs & preferences' },
  '/support': { title: 'Support', subtitle: 'Merchant helpdesk & shipment dispute tickets' },
  '/walkin-booking': { title: 'Walk-in booking', subtitle: 'Counter walk-in parcel booking office' },
};

function getPageMeta(pathname: string) {
  if (PAGE_LABELS[pathname]) return PAGE_LABELS[pathname];
  const keys = Object.keys(PAGE_LABELS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (pathname.startsWith(k + '/') || pathname.startsWith(k)) return PAGE_LABELS[k];
  }
  return { title: 'Nanoshipy', subtitle: 'Courier aggregator seller portal' };
}

interface TopBarProps {
  onToggleMobileSidebar?: () => void;
  onToggleCollapse?: () => void;
  collapsed?: boolean;
}

export function TopBar({ onToggleMobileSidebar }: TopBarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const pageMeta = getPageMeta(pathname);
  const dateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    if (profileOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [profileOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/shipments?search=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  return (
    <header
      className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-3.5 sm:px-7 py-2.5 sm:py-3 border-b transition-colors"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--line)',
      }}
    >
      {/* Left: Mobile hamburger + Logo + Page Title & Subtitle */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {onToggleMobileSidebar && (
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            className="md:hidden p-2 rounded-[8px] border text-[var(--ink)] hover:bg-[var(--bg)] transition cursor-pointer shrink-0"
            style={{ borderColor: 'var(--line)' }}
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        <img
          src="/logo.png"
          alt="Nanoshipy"
          className="w-7 h-7 object-contain rounded-[7px] md:hidden shrink-0 shadow-xs"
        />
        <div className="min-w-0">
          <h1 className="nano-page-title truncate text-[15px] sm:text-[18px]">{pageMeta.title}</h1>
          <p className="nano-page-subtitle truncate text-[11px] sm:text-[12.5px]">
            {dateStr} • Last synced just now
          </p>
        </div>
      </div>

      {/* Center & Right Controls: Search, Theme Toggle, Create Shipment, Notifications, Profile */}
      <div className="flex items-center gap-2 sm:gap-3 justify-end shrink-0 ml-auto">
        {/* Search Field (Collapses to order-last on mobile full width, or neat desktop bar) */}
        <form
          onSubmit={handleSearchSubmit}
          className="relative hidden sm:block sm:w-56 md:w-64 lg:w-72"
        >
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
          <input
            id="topbar-global-search"
            name="search"
            type="text"
            aria-label="Search AWB, order ID or phone"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search AWB, order ID or phone"
            className="w-full pl-9 pr-3 py-1.5 sm:py-2 text-[13px] rounded-[10px] border outline-none transition-colors"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--line)',
              color: 'var(--ink)',
            }}
          />
        </form>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="nano-btn-secondary p-2 sm:px-3 sm:py-2 inline-flex items-center gap-1.5 select-none"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-[var(--muted)]" />
          )}
          <span className="hidden md:inline text-[12.5px]">Theme</span>
        </button>

        {/* Primary Create Shipment Button */}
        <Link
          href="/orders/new"
          className="nano-btn-primary py-2 px-3 sm:px-3.5 inline-flex items-center gap-1.5 text-[12.5px] sm:text-[13px]"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Create shipment</span>
          <span className="sm:hidden">Ship</span>
        </Link>

        {/* Notification Bell */}
        <NotificationBell />

        {/* User Profile Menu */}
        {user && (
          <div className="relative border-l pl-3" style={{ borderColor: 'var(--line)' }} ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((prev) => !prev)}
              className="flex items-center gap-2 p-1 rounded-[10px] hover:bg-[var(--bg)] transition cursor-pointer select-none"
              title="User Account Menu"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 bg-gradient-to-br from-[#5B069A] to-[#8410DC] shadow-sm shadow-purple-950/30"
              >
                {(user.name || 'U')[0].toUpperCase()}
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-[var(--muted)] transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileOpen && (
              <div
                className="absolute right-0 mt-2 w-60 rounded-[14px] border py-2 z-50 shadow-md"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--line)',
                }}
              >
                <div className="px-3.5 py-2 border-b" style={{ borderColor: 'var(--line)' }}>
                  <p className="text-[13px] font-[700] text-[var(--ink)] truncate">{user.name}</p>
                  <p className="text-[11.5px] text-[var(--muted)] truncate">{user.email}</p>
                  <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-[600] px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand)' }}>
                    <ShieldCheck className="w-3 h-3" />
                    {user.role?.name || (typeof user.role === 'string' ? user.role : 'Merchant')}
                  </span>
                </div>

                <div className="p-1.5 space-y-0.5">
                  <Link
                    href="/settings/company"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-[8px] text-[12.5px] font-[600] text-[var(--ink)] hover:bg-[var(--bg)] transition"
                  >
                    <Settings className="w-3.5 h-3.5 text-[var(--muted)]" />
                    <span>Company settings</span>
                  </Link>
                  <Link
                    href="/wallet"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-[8px] text-[12.5px] font-[600] text-[var(--ink)] hover:bg-[var(--bg)] transition"
                  >
                    <Wallet className="w-3.5 h-3.5 text-[var(--muted)]" />
                    <span>Wallet & billing</span>
                  </Link>
                </div>

                <div className="pt-1 mt-1 border-t px-1.5" style={{ borderColor: 'var(--line)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-[8px] text-[12.5px] font-[600] text-[var(--bad)] hover:bg-[var(--bad-bg)] transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
