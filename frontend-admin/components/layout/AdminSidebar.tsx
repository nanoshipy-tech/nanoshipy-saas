'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/authStore';
import { apiClient } from '@/lib/apiClient';
import {
  LayoutDashboard, Users, Package, DollarSign, ShieldCheck,
  CreditCard, Scale, BarChart3, ShoppingCart, AlertTriangle,
  RotateCcw, Store, Truck, Settings, Users2, Layers,
  MessageCircle, Ticket, ChevronDown, ChevronLeft, ChevronRight,
  MapPin, Tag, Newspaper, Activity, Image, LogOut, X,
  Key, MessageSquare, Mail, Sliders
} from 'lucide-react';

import { hasAdminPermission } from '@/lib/usePermission';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<any>;
  permissionKey?: string;
  badgeKey?: 'kyc_pending' | 'tickets_open' | 'disputes_open';
  isBadgeBad?: boolean;
  children?: { label: string; href: string }[];
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

const navSections: NavGroup[] = [
  {
    heading: 'Overview',
    items: [
      { label: 'Overview', href: '/dashboard', icon: LayoutDashboard, permissionKey: 'admin.dashboard.view' },
    ],
  },
  {
    heading: 'Platform & Sellers',
    items: [
      { label: 'Sellers', href: '/sellers', icon: Users, permissionKey: 'admin.sellers.view' },
      { label: 'Subscription Plans', href: '/sellers/plans', icon: Tag, permissionKey: 'admin.plans.view' },
      { label: 'Booking Office', href: '/operations/booking-office', icon: Store, permissionKey: 'admin.booking_office.view' },
    ],
  },
  {
    heading: 'Logistics & Couriers',
    items: [
      { label: 'Shipments', href: '/shipments', icon: Package, permissionKey: 'admin.shipments.view' },
      { label: 'Courier Configuration', href: '/couriers', icon: Truck, permissionKey: 'admin.couriers.view' },
      { label: 'Shipping Rules', href: '/logistics/shipping-rules', icon: Sliders, permissionKey: 'admin.couriers.view' },
      { label: 'Rate Cards', href: '/rate-cards', icon: DollarSign, permissionKey: 'admin.rate_cards.view' },
      { label: 'Serviceable Pincodes', href: '/configuration/pincodes', icon: MapPin, permissionKey: 'admin.pincodes.view' },
      { label: 'ST District Rates', href: '/pricing/st-rates', icon: DollarSign, permissionKey: 'admin.st_rates.view' },
    ],
  },
  {
    heading: 'Operations',
    items: [
      { label: 'Orders', href: '/orders', icon: ShoppingCart, permissionKey: 'admin.orders.view' },
      { label: 'NDR Queue', href: '/ndr', icon: AlertTriangle, permissionKey: 'admin.ndr.view' },
      { label: 'Returns & RTO', href: '/returns', icon: RotateCcw, permissionKey: 'admin.rto.view' },
      { label: 'Weight Disputes', href: '/operations/weight-disputes', icon: Scale, badgeKey: 'disputes_open', isBadgeBad: true, permissionKey: 'admin.weight_disputes.view' },
      { label: 'Support Tickets', href: '/support', icon: Ticket, badgeKey: 'tickets_open', permissionKey: 'admin.support.view' },
    ],
  },
  {
    heading: 'Approvals & Compliance',
    items: [
      { label: 'KYC Approvals', href: '/kyc', icon: ShieldCheck, badgeKey: 'kyc_pending', permissionKey: 'admin.kyc.view' },
    ],
  },
  {
    heading: 'Finance & Remittance',
    items: [
      { label: 'COD Remittances', href: '/finance', icon: DollarSign, permissionKey: 'admin.remittance.view' },
      { label: 'Invoices', href: '/finance/invoices', icon: CreditCard, permissionKey: 'admin.invoices.view' },
      { label: 'Wallet Adjustments', href: '/finance/wallet', icon: DollarSign, permissionKey: 'admin.wallet_adjust.view' },
      { label: 'Platform Coupons', href: '/finance/coupons', icon: Tag, permissionKey: 'admin.coupons.view' },
    ],
  },
  {
    heading: 'Reports & Analytics',
    items: [
      {
        label: 'Reports',
        href: '/reports',
        icon: BarChart3,
        permissionKey: 'admin.reports.view',
        children: [
          { label: 'All Reports', href: '/reports' },
          { label: 'Data Exports', href: '/reports/exports' },
          { label: 'Seller Overdue', href: '/reports/seller-overdue' },
          { label: 'Amount Received', href: '/reports/amount-received' },
          { label: 'Traffic Analytics', href: '/analytics' },
          { label: 'Operations & District', href: '/reports/operations' },
        ],
      },
    ],
  },
  {
    heading: 'Integrations & API Settings',
    items: [
      { label: 'Webhooks Gateway', href: '/configuration/webhooks', icon: Activity, permissionKey: 'admin.integrations.view' },
      { label: 'Google Maps API', href: '/configuration/address-settings', icon: MapPin, permissionKey: 'admin.integrations.view' },
      { label: 'Google Login (OAuth)', href: '/configuration/google-auth', icon: Key, permissionKey: 'admin.integrations.view' },
      { label: 'SMS Gateway', href: '/configuration/sms', icon: MessageSquare, permissionKey: 'admin.integrations.view' },
      { label: 'WhatsApp Bot', href: '/configuration/whatsapp', icon: MessageCircle, permissionKey: 'admin.integrations.view' },
      { label: 'SMTP Email', href: '/configuration/smtp', icon: Mail, permissionKey: 'admin.integrations.view' },
      { label: 'Payment Gateways', href: '/configuration/payment-gateways', icon: CreditCard, permissionKey: 'admin.integrations.view' },
      { label: 'Storefront Apps', href: '/integrations', icon: Layers, permissionKey: 'admin.integrations.view' },
    ],
  },
  {
    heading: 'System & Configuration',
    items: [
      { label: 'Pricing Engine', href: '/pricing', icon: Sliders, permissionKey: 'admin.pricing.view' },
      { label: 'Banner Manager', href: '/settings/banner', icon: Image, permissionKey: 'admin.banners.view' },
      { label: 'Blogs & News', href: '/blogs', icon: Newspaper, permissionKey: 'admin.blogs.view' },
      { label: 'Roles & Permissions', href: '/roles', icon: ShieldCheck, permissionKey: 'admin.team.view' },
      { label: 'Team & Staff', href: '/team', icon: Users2, permissionKey: 'admin.team.view' },
      { label: 'Activity Log', href: '/activity-log', icon: Activity, permissionKey: 'admin.activity_log.view' },
      { label: 'Platform Settings', href: '/settings', icon: Settings, permissionKey: 'admin.settings.view' },
    ],
  },
];

interface NavCounts {
  kyc_pending: number;
  tickets_open: number;
  disputes_open: number;
}

interface AdminSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function AdminSidebar({
  mobileOpen = false,
  onMobileClose,
  collapsed: controlledCollapsed,
  onToggleCollapse,
}: AdminSidebarProps) {
  const pathname = usePathname() || '/dashboard';
  const { user, logout } = useAuth();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [navCounts, setNavCounts] = useState<NavCounts>({
    kyc_pending: 0,
    tickets_open: 0,
    disputes_open: 0,
  });
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});

  const collapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  const toggleCollapse = onToggleCollapse || (() => setInternalCollapsed(!internalCollapsed));
  const isMini = collapsed && !mobileOpen;

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const { data } = await apiClient.get('/platform/nav-counts');
        if (data.success && data.data) {
          setNavCounts({
            kyc_pending: data.data.kyc_pending || 0,
            tickets_open: data.data.tickets_open || 0,
            disputes_open: data.data.disputes_open || data.data.ndr_fresh || 0,
          });
        }
      } catch {}
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 60000);
    return () => clearInterval(interval);
  }, []);

  const visibleSections = React.useMemo(() => {
    return navSections
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((item) => hasAdminPermission(user, item.permissionKey)),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [user]);

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const toggleSubmenu = (label: string) => {
    setOpenSubmenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const getBadgeCount = (item: NavItem): number => {
    if (!item.badgeKey) return 0;
    return navCounts[item.badgeKey] || 0;
  };

  return (
    <>
      {/* Mobile Drawer Backdrop Blur */}
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
        {/* Floating Desktop Collapse/Expand Toggle Button (Matches User Panel) */}
        <button
          type="button"
          onClick={toggleCollapse}
          className="absolute -right-3 top-[17px] z-30 hidden md:flex items-center justify-center w-6 h-6 rounded-full bg-[#1b1231] border border-purple-500/40 text-purple-300 hover:text-white hover:bg-[#281545] shadow-lg cursor-pointer transition-all duration-150"
          title={collapsed ? 'Expand sidebar' : 'Minimize sidebar'}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Brand Header */}
        <div
          className={`h-[58px] flex items-center border-b border-white/10 ${
            isMini ? 'justify-center px-0' : 'justify-between px-4'
          }`}
        >
          <Link
            href="/dashboard"
            onClick={() => onMobileClose?.()}
            className={`flex items-center gap-2.5 overflow-hidden transition-all ${
              isMini ? 'justify-center' : ''
            }`}
            title="Nanoshipy Admin"
          >
            <img
              src="/logo.png"
              alt="Nanoshipy"
              className="w-[32px] h-[32px] object-contain rounded-[8px] shrink-0 shadow-md shadow-purple-950/50"
            />
            {!isMini && (
              <span className="text-[18px] font-[800] text-white tracking-[-0.02em] flex items-center gap-1.5">
                Nanoshipy
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Admin
                </span>
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

        {/* Navigation List */}
        <nav aria-label="Main Admin Navigation" className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {visibleSections.map((sec, secIdx) => (
            <div key={sec.heading} className="space-y-1">
              {/* Group Heading (Visible only when expanded) */}
              {!isMini && (
                <p
                  className={`text-[10.5px] font-bold uppercase tracking-wider text-[rgba(184,196,208,0.5)] px-2.5 pt-3 pb-1 select-none ${
                    secIdx === 0 ? 'pt-0' : ''
                  }`}
                >
                  {sec.heading}
                </p>
              )}

              {sec.items.map((item) => {
                const active = isActive(item.href);
                const badge = getBadgeCount(item);
                const hasChildren = item.children && item.children.length > 0;
                const isSubmenuOpen = openSubmenus[item.label] || active;

                return (
                  <div key={item.label} className="relative">
                    <Link
                      href={item.href}
                      onClick={(e) => {
                        if (hasChildren && !isMini) {
                          e.preventDefault();
                          toggleSubmenu(item.label);
                        } else {
                          onMobileClose?.();
                        }
                      }}
                      title={isMini ? item.label : undefined}
                      className={`flex items-center gap-2.5 rounded-[8px] text-[13.5px] font-[600] transition-colors min-h-[40px] relative
                        ${isMini ? 'justify-center w-10 h-10 mx-auto p-0' : 'px-[11px] py-[9px] w-full'}
                        ${
                          active
                            ? 'bg-gradient-to-r from-[#5B069A]/35 to-[#8410DC]/25 text-white border-l-2 border-[#8410DC]'
                            : 'text-[var(--sidebar-text)] hover:bg-white/[0.06] hover:text-white'
                        }`}
                    >
                      <item.icon className="w-[18px] h-[18px] shrink-0" />

                      {/* Mini mode badge notification dot */}
                      {isMini && badge > 0 && (
                        <span
                          className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
                            item.isBadgeBad ? 'bg-[var(--bad)]' : 'bg-purple-400'
                          }`}
                        />
                      )}

                      {!isMini && (
                        <>
                          <span className="truncate flex-1">{item.label}</span>

                          {/* Badge Count */}
                          {badge > 0 && (
                            <span
                              className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold leading-[18px] ${
                                item.isBadgeBad
                                  ? 'bg-[var(--bad)] text-white'
                                  : 'bg-white/10 text-white'
                              }`}
                            >
                              {badge}
                            </span>
                          )}

                          {/* Submenu chevron */}
                          {hasChildren && (
                            <ChevronDown
                              className={`w-3.5 h-3.5 text-[var(--sidebar-text)] transition-transform ${
                                isSubmenuOpen ? 'rotate-180' : ''
                              }`}
                            />
                          )}
                        </>
                      )}
                    </Link>

                    {/* Submenu Dropdown (When expanded) */}
                    {!isMini && hasChildren && isSubmenuOpen && (
                      <div className="pl-7 pr-2 py-1 flex flex-col gap-1">
                        {item.children!.map((sub) => {
                          const subActive = pathname === sub.href;
                          return (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              onClick={() => onMobileClose?.()}
                              className={`py-1.5 px-2 rounded-lg text-[12.5px] font-medium transition-colors ${
                                subActive
                                  ? 'text-white font-bold bg-white/10'
                                  : 'text-[var(--sidebar-text)] hover:text-white hover:bg-white/5'
                              }`}
                            >
                              {sub.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Bottom: Signed In Card / Logout */}
        {!isMini ? (
          <div className="p-3 m-2 rounded-[12px] border border-white/10 bg-white/[0.03] mt-auto">
            <div className="text-[11px] font-[500] text-[var(--sidebar-text)]">Admin Console</div>
            <div className="text-[14px] font-[700] text-white my-0.5 truncate">
              {user?.name || user?.role?.toUpperCase() || 'Superadmin'}
            </div>
            <div className="text-[11px] text-[#b8c4d0] truncate mb-2">{user?.email || 'care@nanoshipy.com'}</div>
            <button
              type="button"
              onClick={logout}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-[8px] font-[700] text-[12px] text-white transition-all bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] shadow-sm shadow-purple-950/40 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        ) : (
          <div className="p-2 mb-2 mt-auto flex justify-center">
            <button
              type="button"
              onClick={logout}
              className="w-10 h-10 rounded-[10px] flex items-center justify-center text-purple-300 hover:text-white bg-purple-950/40 border border-purple-500/20 hover:border-purple-400 transition-all cursor-pointer"
              title="Sign out"
            >
              <LogOut className="w-[18px] h-[18px] text-[#c084fc]" />
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
