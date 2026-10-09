'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/authStore';
import { apiClient } from '@/lib/apiClient';
import {
  LayoutDashboard, ShoppingCart, Package, AlertTriangle,
  RotateCcw, Wallet, FileText, Settings, Zap,
  BarChart3, HelpCircle, ChevronLeft, ChevronRight,
  Receipt, X, Store, Truck
} from 'lucide-react';

import { hasUserPermission } from '@/lib/usePermission';

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  mobileOpen = false,
  onMobileClose,
  collapsed: controlledCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname() || '/dashboard';
  const { user } = useAuth();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const collapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  const toggleCollapse = onToggleCollapse || (() => setInternalCollapsed(!internalCollapsed));

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && href !== '/dashboard' && pathname.startsWith(href + '/'));

  const isBookingOffice = Boolean(user?.tenant?.is_booking_office);

  // Fetch real wallet balance for the bottom wallet card
  useEffect(() => {
    let cancelled = false;
    const fetchWallet = async () => {
      try {
        const res = await apiClient.get('/wallet');
        if (!cancelled && res?.data?.success) {
          setWalletBalance(parseFloat(res.data.data.balance ?? 0));
        }
      } catch {
        // Silently handled
      }
    };
    fetchWallet();
    const interval = setInterval(fetchWallet, 45_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Ordered strictly as per reference spec: Dashboard, Shipments, Orders, Delivery issues, Couriers, Billing, Reports
  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permissionKey: 'user.dashboard.view' },
    { label: 'Shipments', href: '/shipments', icon: Package, permissionKey: 'user.shipments.view' },
    { label: 'Orders', href: '/orders', icon: ShoppingCart, permissionKey: 'user.orders.view' },
    ...(isBookingOffice ? [{ label: 'Walk-in booking', href: '/walkin-booking', icon: Store, permissionKey: 'user.walkin.view' }] : []),
    { label: 'Delivery issues', href: '/ndr', icon: AlertTriangle, permissionKey: 'user.ndr.view' },
    { label: 'Couriers', href: '/rate-cards', icon: Truck, permissionKey: 'user.couriers.view' },
    { label: 'Billing', href: '/billing', icon: FileText, permissionKey: 'user.billing.view' },
    { label: 'Reports', href: '/analytics', icon: BarChart3, permissionKey: 'user.reports.view' },
    { label: 'Settings', href: '/settings', icon: Settings },
    { label: 'Stores & channels', href: '/integrations', icon: Zap, permissionKey: 'user.channels.view' },
    { label: 'Support', href: '/support', icon: HelpCircle, permissionKey: 'user.support.view' },
  ];

  const visibleNavItems = navItems.filter((item) => hasUserPermission(user, item.permissionKey));

  return (
    <>
      {mobileOpen && (
        <div
          onClick={onMobileClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      <aside
        className={`fixed md:sticky top-0 inset-y-0 left-0 flex flex-col h-screen flex-shrink-0 transition-all duration-200 ease-in-out z-50 md:z-30 select-none
          ${mobileOpen ? 'translate-x-0 w-[270px]' : '-translate-x-full md:translate-x-0'}
          ${collapsed ? 'md:w-[64px]' : 'md:w-[232px]'}`}
        style={{
          backgroundColor: 'var(--sidebar)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Floating Desktop Collapse/Expand Toggle Button (Never overlaps or squishes logo) */}
        <button
          type="button"
          onClick={toggleCollapse}
          className="absolute -right-3 top-[17px] z-30 hidden md:flex items-center justify-center w-6 h-6 rounded-full bg-[#1b1231] border border-purple-500/40 text-purple-300 hover:text-white hover:bg-[#281545] shadow-lg cursor-pointer transition-all duration-150"
          title={collapsed ? 'Expand sidebar' : 'Minimize sidebar'}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Top: Official Nanoshipy Brand Logo */}
        <div className={`h-[58px] flex items-center border-b border-white/10 ${collapsed && !mobileOpen ? 'justify-center px-0' : 'justify-between px-4'}`}>
          <Link
            href="/dashboard"
            onClick={() => onMobileClose?.()}
            className={`flex items-center gap-2.5 overflow-hidden transition-all ${collapsed && !mobileOpen ? 'justify-center' : ''}`}
            title="Nanoshipy"
          >
            <img
              src="/logo.png"
              alt="Nanoshipy"
              className="w-[32px] h-[32px] object-contain rounded-[8px] shrink-0 shadow-md shadow-purple-950/50"
            />
            {(!collapsed || mobileOpen) && (
              <span className="text-[18px] font-[800] text-white tracking-[-0.02em]">
                Nanoshipy
              </span>
            )}
          </Link>

          {/* Mobile close button */}
          {mobileOpen && (
            <button
              type="button"
              onClick={onMobileClose}
              className="md:hidden text-[#b8c4d0] hover:text-white p-1.5 rounded-[6px] hover:bg-white/10 transition cursor-pointer"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {visibleNavItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            const isMini = collapsed && !mobileOpen;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onMobileClose?.()}
                title={isMini ? item.label : undefined}
                className={`flex items-center gap-2.5 rounded-[8px] text-[13.5px] font-[600] transition-colors min-h-[40px]
                  ${isMini ? 'justify-center w-10 h-10 mx-auto p-0' : 'px-[11px] py-[9px] w-full'}
                  ${
                    active
                      ? 'bg-gradient-to-r from-[#5B069A]/35 to-[#8410DC]/25 text-white border-l-2 border-[#8410DC]'
                      : 'text-[var(--sidebar-text)] hover:bg-white/[0.06] hover:text-white'
                  }`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                {!isMini && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Bottom: Wallet Box */}
        {(!collapsed || mobileOpen) && (
          <div className="p-3 m-2.5 rounded-[12px] border border-white/12 bg-white/[0.04]">
            <div className="text-[12px] font-[500] text-[var(--sidebar-text)]">
              Wallet balance
            </div>
            <div className="text-[20px] font-[800] text-white my-1 tabular-nums">
              ₹
              {walletBalance !== null
                ? Number(walletBalance).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : '0.00'}
            </div>
            <Link
              href="/wallet/recharge"
              onClick={() => onMobileClose?.()}
              className="mt-2 w-full flex items-center justify-center py-2 px-3 rounded-[8px] font-[700] text-[13px] text-white transition-all bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] shadow-sm shadow-purple-950/40"
            >
              Add money
            </Link>
          </div>
        )}

        {/* Collapsed Mode (Desktop only): Compact Wallet Icon */}
        {collapsed && !mobileOpen && (
          <div className="p-2 mb-2 flex justify-center">
            <Link
              href="/wallet/recharge"
              className="w-10 h-10 rounded-[10px] flex items-center justify-center text-purple-300 hover:text-white bg-purple-950/40 border border-purple-500/20 hover:border-purple-400 transition-all cursor-pointer"
              title={`Wallet: ₹${walletBalance !== null ? Number(walletBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'} (Click to add money)`}
            >
              <Wallet className="w-[18px] h-[18px] text-[#c084fc]" />
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
