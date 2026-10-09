'use client';

import React, { useState } from 'react';
import { Search, Sun, Moon, Plus, Menu } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from '@/lib/themeStore';

const ROUTE_CONFIG: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': {
    title: 'Overview',
    subtitle: 'System-wide courier aggregation and platform metrics',
  },
  '/sellers': {
    title: 'Sellers',
    subtitle: 'Manage onboarded merchant accounts, KYC status, and wallet limits',
  },
  '/sellers/plans': {
    title: 'Subscription plans',
    subtitle: 'Configure seller subscription tiers and feature sets',
  },
  '/operations/booking-office': {
    title: 'Booking offices',
    subtitle: 'Configure offline walk-in parcels, counter terminals and operators',
  },
  '/shipments': {
    title: 'Shipments',
    subtitle: 'Carrier tracking, manifest generation, and shipment status audits',
  },
  '/couriers': {
    title: 'Courier configuration',
    subtitle: 'Carrier API integrations, account credentials and live toggles',
  },
  '/rate-cards': {
    title: 'Courier rate cards',
    subtitle: 'Configured zone pricing matrix and carrier freight cards',
  },
  '/configuration/address-settings': {
    title: 'Google Maps & Location',
    subtitle: 'Google Places API key, geocoding and address validation',
  },
  '/configuration/google-auth': {
    title: 'Google Login (OAuth)',
    subtitle: 'Client ID, secret and Google Sign-in authentication',
  },
  '/configuration/sms': {
    title: 'SMS Gateway',
    subtitle: 'Fast2SMS / DLT configuration, sender ID and SMS credentials',
  },
  '/configuration/smtp': {
    title: 'SMTP Email Gateway',
    subtitle: 'Outbound email delivery, SMTP credentials and port setup',
  },
  '/configuration/pincodes': {
    title: 'Serviceable pincodes',
    subtitle: 'Audit pickup and delivery availability across pin codes',
  },
  '/pricing/st-rates': {
    title: 'ST district rates',
    subtitle: 'Configure state and district specific surface freight tables',
  },
  '/kyc': {
    title: 'KYC approvals',
    subtitle: 'Review business GST, PAN, and bank documents for verified shipping',
  },
  '/finance': {
    title: 'COD remittances',
    subtitle: 'Automated COD payout batches, wallet ledgers, and remittances',
  },
  '/finance/invoices': {
    title: 'Tax invoices',
    subtitle: 'Review monthly GST invoices and billing logs',
  },
  '/finance/wallet': {
    title: 'Wallet adjustments',
    subtitle: 'Manual credit or debit adjustments to seller balances',
  },
  '/finance/coupons': {
    title: 'Platform coupons',
    subtitle: 'Promotional recharge codes and discount coupons',
  },
  '/operations/weight-disputes': {
    title: 'Weight disputes',
    subtitle: 'Weight discrepancies, carrier proof audits, and fee reconciliations',
  },
  '/reports': {
    title: 'Reports & analytics',
    subtitle: 'Consolidated operational, billing, and margin export statements',
  },
  '/orders': {
    title: 'Orders',
    subtitle: 'Aggregated seller orders and batch allocation queue',
  },
  '/ndr': {
    title: 'NDR queue',
    subtitle: 'Non-delivery exceptions and carrier re-attempt workflows',
  },
  '/returns': {
    title: 'Returns & RTO',
    subtitle: 'Return to origin package logs and reverse logistics',
  },
  '/pricing': {
    title: 'Pricing engine',
    subtitle: 'Cost rates, markups, and zone pricing configurations',
  },
  '/support': {
    title: 'Support tickets',
    subtitle: 'Merchant inquiries, technical support, and escalations',
  },
  '/configuration/payment-gateways': {
    title: 'Payment gateways',
    subtitle: 'Razorpay, Cashfree and custom payment credentials',
  },
  '/integrations': {
    title: 'Storefront apps',
    subtitle: 'Shopify, WooCommerce, Amazon and custom API connectors',
  },
  '/configuration/whatsapp': {
    title: 'WhatsApp bot',
    subtitle: 'Customer tracking alerts and automated notifications',
  },
  '/settings/banner': {
    title: 'Banner manager',
    subtitle: 'Platform-wide notification and promotional banners',
  },
  '/blogs': {
    title: 'Blogs & news',
    subtitle: 'Knowledge base and promotional articles',
  },
  '/team': {
    title: 'Team & RBAC',
    subtitle: 'Staff members, access permissions and audit roles',
  },
  '/activity-log': {
    title: 'Activity log',
    subtitle: 'Audit trail of administrative actions and overrides',
  },
  '/settings': {
    title: 'Platform settings',
    subtitle: 'System configuration, API limits, and staff roles',
  },
};

interface AdminTopbarProps {
  onToggleMobileSidebar?: () => void;
  onToggleCollapse?: () => void;
  collapsed?: boolean;
}

export function AdminTopbar({ onToggleMobileSidebar }: AdminTopbarProps) {
  const pathname = usePathname() || '/dashboard';
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');

  // Find matching route title or fallback
  const currentConfig = ROUTE_CONFIG[pathname] || {
    title: pathname.split('/')[1]?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Platform Admin',
    subtitle: 'Nanoshipy courier platform management',
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchTerm.trim();
    if (!query) return;

    if (query.toUpperCase().startsWith('NS') || /^\d{8,}$/.test(query)) {
      router.push(`/shipments?search=${encodeURIComponent(query)}`);
    } else {
      router.push(`/sellers?search=${encodeURIComponent(query)}`);
    }
  };

  return (
    <header
      className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-3.5 sm:px-7 py-2.5 sm:py-3 border-b transition-colors shrink-0"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--line)',
      }}
    >
      {/* Left: Mobile hamburger + Mobile Logo + Title & Subtitle */}
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
          <h1 className="truncate text-[15px] sm:text-[18px] font-extrabold text-[var(--ink)] tracking-tight">
            {currentConfig.title}
          </h1>
          <p className="truncate text-[11px] sm:text-[12.5px] font-medium text-[var(--muted)]">
            {currentConfig.subtitle}
          </p>
        </div>
      </div>

      {/* Right Controls: Search, Theme Toggle, Add Seller */}
      <div className="flex items-center gap-2 sm:gap-3 justify-end shrink-0 ml-auto">
        {/* Search Field */}
        <form
          onSubmit={handleSearchSubmit}
          className="relative hidden sm:block sm:w-56 md:w-64 lg:w-72"
        >
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
          <input
            id="admin-global-search"
            name="search"
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search seller, AWB or invoice"
            aria-label="Search platform records"
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
          aria-label="Toggle light or dark theme"
          className="p-2 sm:px-3 sm:py-2 rounded-[8px] sm:rounded-[10px] border text-[var(--ink)] hover:bg-[var(--bg)] transition cursor-pointer flex items-center gap-1.5 text-[13px] font-semibold"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--line)',
          }}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>

        {/* Primary Action Button: Add Seller */}
        <Link
          href="/sellers?action=add"
          className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 text-[12.5px] sm:text-[13px] font-bold rounded-[8px] sm:rounded-[10px] text-white transition-all bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] shadow-sm shadow-purple-950/30 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add seller</span>
        </Link>
      </div>
    </header>
  );
}
