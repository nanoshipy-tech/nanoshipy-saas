'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authStore';
import { apiClient } from '@/lib/apiClient';
import toast from 'react-hot-toast';
import {
  TrendingUp, TrendingDown, Clock, Copy, Check, ChevronRight,
  Package, AlertTriangle, ArrowRight, Store, Plus, ExternalLink, Sparkles
} from 'lucide-react';

interface NdrSummary {
  total_open: number;
  aging_over_sla: number;
}

interface WalletDetails {
  balance: number;
  currency: string;
}

export interface CustomBannerConfig {
  is_active?: boolean;
  mode: 'image' | 'text' | 'disabled' | 'default';
  imageUrl?: string;
  headline?: string;
  subtext?: string;
  badge?: string;
  code?: string;
  ctaText?: string;
  ctaLink?: string;
  expiresAt?: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isBookingOffice = Boolean(user?.tenant?.is_booking_office);

  // Core Data States (Preserved)
  const [ndr, setNdr] = useState<NdrSummary | null>(null);
  const [wallet, setWallet] = useState<WalletDetails | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [rtoCount, setRtoCount] = useState(0);
  const [billingStats, setBillingStats] = useState({ this_month_spend: 0, pending_invoices: 0 });
  const [codPending, setCodPending] = useState(0);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [trendMetrics, setTrendMetrics] = useState<any[]>([]);
  const [openTickets, setOpenTickets] = useState(0);
  const [loading, setLoading] = useState(true);

  // Interactive UI States
  const [volumeDays, setVolumeDays] = useState<'7' | '14'>('7');
  const [hoveredBar, setHoveredBar] = useState<{ day: string; booked: number; delivered: number; x: number; y: number } | null>(null);
  const [shipmentsFilter, setShipmentsFilter] = useState<'all' | 'delivered' | 'in_transit' | 'needs_action'>('all');
  const [copiedAwb, setCopiedAwb] = useState<string | null>(null);
  const [promoCopied, setPromoCopied] = useState(false);
  const [countdown, setCountdown] = useState('');

  // Custom Banner State with Immediate LocalStorage Cache
  const [customBanner, setCustomBanner] = useState<CustomBannerConfig | null>(null);
  const [bannerLoaded, setBannerLoaded] = useState(false);

  // Background revalidation of active promotional banner
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('nanoshipy_active_banner');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.is_active) setCustomBanner(parsed);
        }
      } catch {}
    }

    let cancelled = false;
    apiClient.get('/banners/active')
      .then((res) => {
        if (cancelled) return;
        const b = res.data?.data;
        if (b && b.is_active !== false) {
          const bannerObj: CustomBannerConfig = {
            is_active: true,
            mode: b.mode || (b.image_url ? 'image' : 'text'),
            imageUrl: b.image_url ? (b.image_url.startsWith('/') ? `https://api.nanoshipy.com${b.image_url}` : b.image_url) : undefined,
            headline: b.headline,
            subtext: b.subtext,
            badge: b.badge,
            code: b.code,
            ctaText: b.cta_text,
            ctaLink: b.cta_link,
            expiresAt: b.ends_at || b.expires_at || undefined,
          };
          setCustomBanner(bannerObj);
          try {
            localStorage.setItem('nanoshipy_active_banner', JSON.stringify(bannerObj));
          } catch {}
        } else {
          setCustomBanner(null);
          try {
            localStorage.removeItem('nanoshipy_active_banner');
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBannerLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch Wallet Balance
  useEffect(() => {
    let cancelled = false;
    const fetchWallet = async () => {
      try {
        const res = await apiClient.get('/wallet');
        if (!cancelled && res?.data?.success && res.data.data) {
          const raw = res.data.data.balance;
          if (raw !== undefined && raw !== null) {
            setWalletBalance(parseFloat(String(raw)));
          }
        }
      } catch {}
    };
    if (user) {
      const interval = setInterval(fetchWallet, 30_000);
      return () => { cancelled = true; clearInterval(interval); };
    }
  }, [user]);

  // Fetch Real Platform Metrics
  useEffect(() => {
    if (!user) return;
    Promise.allSettled([
      apiClient.get('/ndr/summary'),
      apiClient.get('/rto', { params: { limit: 1 } }),
      apiClient.get('/wallet'),
      apiClient.get('/billing/summary'),
      apiClient.get('/orders', { params: { limit: 20, sort: 'created_at:desc' } }),
      apiClient.get('/wallet/remittances', { params: { limit: 5 } }),
      apiClient.get('/support/tickets', { params: { status: 'open', limit: 1 } }),
      apiClient.get('/analytics/orders-trend', { params: { granularity: 'daily' } }).catch(() => null),
    ]).then(([ndrR, rtoR, walletR, billingR, ordersR, remittancesR, ticketsR, trendR]) => {
      if (ndrR.status === 'fulfilled') setNdr(ndrR.value.data?.data || null);
      if (rtoR.status === 'fulfilled') setRtoCount(rtoR.value.data?.data?.pagination?.total || 0);
      if (walletR.status === 'fulfilled') {
        const wData = walletR.value.data?.data || null;
        setWallet(wData);
        if (wData?.balance !== undefined && wData?.balance !== null) {
          setWalletBalance(parseFloat(String(wData.balance)));
        }
      }
      if (billingR.status === 'fulfilled') setBillingStats(billingR.value.data?.data || { this_month_spend: 0, pending_invoices: 0 });
      if (remittancesR.status === 'fulfilled') {
        const remData = remittancesR.value.data?.data;
        const totalPending = Array.isArray(remData?.items)
          ? remData.items.reduce((acc: number, item: any) => acc + (parseFloat(item.amount) || 0), 0)
          : (parseFloat(remData?.pending_amount) || 0);
        setCodPending(totalPending);
      }
      if (ordersR.status === 'fulfilled') {
        const d = ordersR.value.data?.data || ordersR.value.data;
        const list = Array.isArray(d)
          ? d
          : (Array.isArray(d?.items) ? d.items : (Array.isArray(d?.orders) ? d.orders : (Array.isArray(d?.rows) ? d.rows : [])));
        setRecentOrders(list);
      }
      if (ticketsR.status === 'fulfilled' && ticketsR.value) {
        setOpenTickets(ticketsR.value.data?.data?.total || ticketsR.value.data?.total || 0);
      }
      if (trendR && trendR.status === 'fulfilled' && trendR.value?.data?.data) {
        const tData = trendR.value.data.data;
        if (Array.isArray(tData)) setTrendMetrics(tData);
      }
      setLoading(false);
    });
  }, [user]);

  // Real Countdown Timer for Promo Banner
  useEffect(() => {
    if (!customBanner?.expiresAt) {
      setCountdown('');
      return;
    }
    const target = new Date(customBanner.expiresAt).getTime();
    if (isNaN(target)) {
      setCountdown('');
      return;
    }
    const updateCountdown = () => {
      const diff = Math.max(0, Math.floor((target - Date.now()) / 1000));
      if (diff <= 0) {
        setCountdown('');
        return;
      }
      const d = Math.floor(diff / 86400);
      const h = Math.floor((diff % 86400) / 3600);
      const m = Math.floor((diff % 3600) / 60);
      setCountdown(`${String(d).padStart(2, '0')}d : ${String(h).padStart(2, '0')}h : ${String(m).padStart(2, '0')}m`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [customBanner?.expiresAt]);

  const handleCopyAwb = (awb: string) => {
    navigator.clipboard.writeText(awb);
    setCopiedAwb(awb);
    toast.success(`AWB ${awb} copied`);
    setTimeout(() => setCopiedAwb(null), 2000);
  };

  const balance = walletBalance !== null
    ? walletBalance
    : (wallet?.balance !== undefined ? parseFloat(String(wallet.balance)) : 0);

  // Computed Status Counts for Segmented Status Bar & Legend (100% Real Data)
  const statusCounts = useMemo(() => {
    let delivered = 0;
    let inTransit = 0;
    let outForDelivery = 0;
    let needsAction = ndr?.total_open || 0;

    recentOrders.forEach((o) => {
      const s = String(o.status || '').toLowerCase();
      if (s === 'delivered') delivered++;
      else if (s === 'in_transit' || s === 'booked' || s === 'shipped') inTransit++;
      else if (s === 'out_for_delivery') outForDelivery++;
      else if (s === 'failed_delivery' || s === 'ndr' || s === 'exception') needsAction++;
    });

    const realTotal = delivered + inTransit + outForDelivery + needsAction;
    const divisor = realTotal || 1;
    return {
      delivered,
      inTransit,
      outForDelivery,
      needsAction,
      realTotal,
      pctDelivered: realTotal ? Math.round((delivered / divisor) * 100) : 0,
      pctInTransit: realTotal ? Math.round((inTransit / divisor) * 100) : 0,
      pctOutForDelivery: realTotal ? Math.round((outForDelivery / divisor) * 100) : 0,
      pctNeedsAction: realTotal ? Math.round((needsAction / divisor) * 100) : 0,
    };
  }, [recentOrders, ndr]);

  // Real KPI: Orders booked today
  const todayShipmentsCount = useMemo(() => {
    const todayStr = new Date().toDateString();
    return recentOrders.filter((o) => o.created_at && new Date(o.created_at).toDateString() === todayStr).length;
  }, [recentOrders]);

  // Real KPI: Delivery success rate
  const deliveryRate = useMemo(() => {
    const totalOrders = recentOrders.length;
    if (!totalOrders) return '0%';
    const delivered = recentOrders.filter((o) => String(o.status || '').toLowerCase() === 'delivered').length;
    return `${Math.round((delivered / totalOrders) * 100)}%`;
  }, [recentOrders]);

  // Dynamic Volume Chart Data (7 or 14 Days) - Real Aggregated Analytics
  const volumeData = useMemo(() => {
    const daysCount = volumeDays === '7' ? 7 : 14;
    const now = new Date();
    const days: { day: string; booked: number; delivered: number }[] = [];

    // Map by YYYY-MM-DD
    const trendMap = new Map<string, { booked: number; delivered: number }>();
    if (trendMetrics && trendMetrics.length > 0) {
      trendMetrics.forEach((item) => {
        if (item.date) {
          const dStr = typeof item.date === 'string' ? item.date.split('T')[0] : new Date(item.date).toISOString().split('T')[0];
          trendMap.set(dStr, {
            booked: Number(item.orders_count || item.shipments_count || 0),
            delivered: Number(item.delivered_count || 0),
          });
        }
      });
    }

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const isoKey = d.toISOString().split('T')[0];
      const match = trendMap.get(isoKey);

      let booked = match ? match.booked : 0;
      let delivered = match ? match.delivered : 0;

      // Fallback: if trendMetrics is empty, count from recent orders
      if (!match && recentOrders.length > 0) {
        const dayStr = d.toDateString();
        recentOrders.forEach((o) => {
          if (o.created_at && new Date(o.created_at).toDateString() === dayStr) {
            booked++;
            if (String(o.status || '').toLowerCase() === 'delivered') delivered++;
          }
        });
      }

      days.push({
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        booked,
        delivered,
      });
    }

    const maxVal = Math.max(...days.map((d) => Math.max(d.booked, d.delivered)), 1);
    return { days, maxVal };
  }, [volumeDays, trendMetrics, recentOrders]);

  // Filtered Recent Shipments
  const filteredShipments = useMemo(() => {
    return recentOrders.filter((order) => {
      if (shipmentsFilter === 'all') return true;
      const s = String(order.status || '').toLowerCase();
      if (shipmentsFilter === 'delivered') return s === 'delivered';
      if (shipmentsFilter === 'in_transit') return s === 'in_transit' || s === 'booked' || s === 'shipped';
      if (shipmentsFilter === 'needs_action') return s === 'failed_delivery' || s === 'ndr' || s === 'exception';
      return true;
    });
  }, [recentOrders, shipmentsFilter]);

  if (!user) return null;

  return (
    <div className="space-y-[14px]">
      {/* ================= PROMOTIONAL BANNER (Instant Display, Zero Layout Shift, Image/Text Modes) ================= */}
      {customBanner && customBanner.is_active && (
        customBanner.mode === 'image' && customBanner.imageUrl ? (
          <div className="relative rounded-2xl overflow-hidden border border-purple-500/25 shadow-sm hover:shadow-md transition-all group bg-purple-950/5 dark:bg-white/[0.02]">
            <Link href={isBookingOffice ? '/walkin-booking' : (customBanner.ctaLink || '/orders/new')} className="block w-full">
              <img
                src={customBanner.imageUrl}
                alt={customBanner.headline || 'Promotional Banner'}
                className="w-full h-auto max-h-[190px] sm:max-h-[220px] object-contain sm:object-cover group-hover:scale-[1.008] transition-transform duration-300 mx-auto"
              />
            </Link>
          </div>
        ) : (
          <div
            className="rounded-2xl border p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm relative overflow-hidden bg-gradient-to-r from-[#5B069A]/15 via-[#8410DC]/10 to-transparent border-purple-500/25"
          >
            <div className="w-64 h-64 rounded-full bg-[#8410DC]/10 blur-3xl pointer-events-none absolute -top-12 -left-12" />
            <div className="space-y-1.5 relative z-10 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#8410DC] text-white shadow-xs">
                  <Sparkles className="w-3 h-3" />
                  {customBanner.badge || 'Partner Offer'}
                </span>
                {countdown ? (
                  <span className="text-[11.5px] text-[var(--muted)] flex items-center gap-1 font-mono font-medium">
                    <Clock className="w-3.5 h-3.5 text-[#8410DC]" />
                    {countdown}
                  </span>
                ) : null}
              </div>
              <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-[var(--ink)]">
                {customBanner.headline || 'Special Shipping Offer'}
              </h3>
              <p className="text-xs sm:text-[13px] text-[var(--muted)] max-w-2xl leading-relaxed">
                {customBanner.subtext || 'Exclusive courier rates and bonus credits available for your account.'}
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 relative z-10 w-full md:w-auto justify-end">
              {customBanner.code && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(customBanner.code!);
                    setPromoCopied(true);
                    toast.success('Promo code copied');
                    setTimeout(() => setPromoCopied(false), 2000);
                  }}
                  className="nano-btn-secondary py-2 px-3 text-xs font-mono font-bold flex items-center gap-1.5"
                  title="Click to copy promo code"
                >
                  <span>{customBanner.code}</span>
                  {promoCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
              <Link
                href={isBookingOffice ? '/walkin-booking' : (customBanner.ctaLink || '/orders/new')}
                className="nano-btn-primary py-2 px-4 text-xs font-bold shadow-md shadow-purple-950/20"
              >
                {customBanner.ctaText || 'Apply now'}
              </Link>
            </div>
          </div>
        )
      )}

      {/* ================= 4 EQUAL KPI ROW (100% Real Data) ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px]">
        {/* KPI 1: Shipments today */}
        <div className="nano-card flex flex-col justify-between">
          <div className="nano-kpi-label">Shipments today</div>
          <div className="nano-kpi-value my-1.5 tabular-nums">
            {todayShipmentsCount}
          </div>
          <div className="flex items-center gap-1 text-[12px] font-medium text-[var(--muted)]">
            <span className="text-[var(--ink)] font-semibold">{todayShipmentsCount}</span>
            <span>booked today</span>
          </div>
        </div>

        {/* KPI 2: Delivered on time */}
        <div className="nano-card flex flex-col justify-between">
          <div className="nano-kpi-label">Delivered on time</div>
          <div className="nano-kpi-value my-1.5 tabular-nums">
            {deliveryRate}
          </div>
          <div className="flex items-center gap-1 text-[12px] font-medium text-[var(--muted)]">
            <span>Delivered consignments</span>
          </div>
        </div>

        {/* KPI 3: Return to origin */}
        <div className="nano-card flex flex-col justify-between">
          <div className="nano-kpi-label">Return to origin</div>
          <div className="nano-kpi-value my-1.5 tabular-nums">
            {rtoCount}
          </div>
          <div className="flex items-center gap-1 text-[12px] font-medium text-[var(--muted)]">
            <span>{rtoCount === 0 ? 'Zero active returns' : `${rtoCount} RTO returning`}</span>
          </div>
        </div>

        {/* KPI 4: COD to be remitted */}
        <div className="nano-card flex flex-col justify-between">
          <div className="nano-kpi-label">COD to be remitted</div>
          <div className="nano-kpi-value my-1.5 tabular-nums">
            ₹{codPending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-1 text-[12px] font-medium text-[var(--muted)]">
            <span>{codPending > 0 ? 'Pending courier remittance' : 'All remittances settled'}</span>
          </div>
        </div>
      </div>

      {/* ================= STEP 5.b: ROW 2 (grid 2fr / 1fr, gap 14px) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[14px]">
        {/* Left card: Shipment volume (2fr) */}
        <div className="nano-card lg:col-span-2 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="nano-card-title">Shipment volume</h2>
              <p className="nano-card-subtitle">Booked and delivered per day</p>
            </div>
            {/* Segmented control: 7 days | 14 days */}
            <div className="nano-segmented" role="group" aria-label="Chart time period">
              <button
                type="button"
                onClick={() => setVolumeDays('7')}
                aria-pressed={volumeDays === '7'}
                className="nano-segmented-item"
              >
                7 days
              </button>
              <button
                type="button"
                onClick={() => setVolumeDays('14')}
                aria-pressed={volumeDays === '14'}
                className="nano-segmented-item"
              >
                14 days
              </button>
            </div>
          </div>

          {/* Grouped Bar Chart (Inline SVG with 4 horizontal gridlines & tooltips) */}
          <div className="relative h-48 w-full mt-2 select-none">
            <svg viewBox="0 0 540 180" className="w-full h-full overflow-visible" preserveAspectRatio="none">
              {/* 4 faint horizontal gridlines */}
              <line x1="0" y1="36" x2="540" y2="36" stroke="var(--line)" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="0" y1="72" x2="540" y2="72" stroke="var(--line)" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="0" y1="108" x2="540" y2="108" stroke="var(--line)" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="0" y1="144" x2="540" y2="144" stroke="var(--line)" strokeWidth="1" strokeDasharray="3 3" />

              {/* Grouped Bars */}
              {volumeData.days.map((item, idx) => {
                const totalDays = volumeData.days.length;
                const slotWidth = 540 / totalDays;
                const barWidth = Math.min(slotWidth * 0.35, 14);
                const centerX = slotWidth * idx + slotWidth / 2;

                const bookedH = item.booked > 0 ? Math.max(6, (item.booked / volumeData.maxVal) * 130) : 0;
                const deliveredH = item.delivered > 0 ? Math.max(6, (item.delivered / volumeData.maxVal) * 130) : 0;

                const bookedY = 150 - bookedH;
                const deliveredY = 150 - deliveredH;

                return (
                  <g
                    key={idx}
                    className="cursor-pointer"
                    onMouseEnter={(e) => {
                      const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
                      setHoveredBar({
                        day: item.day,
                        booked: item.booked,
                        delivered: item.delivered,
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      });
                    }}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {/* Booked bar (--chart-bar) */}
                    {bookedH > 0 && (
                      <rect
                        x={centerX - barWidth - 1.5}
                        y={bookedY}
                        width={barWidth}
                        height={bookedH}
                        rx="2"
                        ry="2"
                        fill="var(--chart-bar)"
                        className="transition-all hover:opacity-85"
                      />
                    )}
                    {/* Delivered bar (--chart-bar-2) */}
                    {deliveredH > 0 && (
                      <rect
                        x={centerX + 1.5}
                        y={deliveredY}
                        width={barWidth}
                        height={deliveredH}
                        rx="2"
                        ry="2"
                        fill="var(--chart-bar-2)"
                        className="transition-all hover:opacity-85"
                      />
                    )}
                    {/* Day label */}
                    <text
                      x={centerX}
                      y="168"
                      fontSize="10.5"
                      fontWeight="600"
                      fill="var(--muted)"
                      textAnchor="middle"
                    >
                      {item.day}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Tooltip on hover */}
            {hoveredBar && (
              <div
                className="absolute z-30 pointer-events-none px-2.5 py-1.5 rounded-[8px] border shadow-sm text-[11.5px] font-semibold"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--line)',
                  color: 'var(--ink)',
                  top: '10px',
                  right: '10px',
                }}
              >
                <div className="text-[var(--muted)] text-[10.5px] font-normal mb-0.5">{hoveredBar.day}</div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: 'var(--chart-bar)' }} />
                    Booked: {hoveredBar.booked}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: 'var(--chart-bar-2)' }} />
                    Delivered: {hoveredBar.delivered}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Legend below (10px rounded squares) */}
          <div className="flex items-center gap-5 mt-4 pt-3 border-t border-[var(--line)] text-[12.5px] font-medium text-[var(--muted)]">
            <div className="flex items-center gap-2">
              <span className="w-[10px] h-[10px] rounded-[3px]" style={{ backgroundColor: 'var(--chart-bar)' }} />
              <span>Booked</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-[10px] h-[10px] rounded-[3px]" style={{ backgroundColor: 'var(--chart-bar-2)' }} />
              <span>Delivered</span>
            </div>
          </div>
        </div>

        {/* Right card: Shipment status (1fr) */}
        <div className="nano-card flex flex-col justify-between">
          <div>
            <h2 className="nano-card-title">Shipment status</h2>
            <p className="nano-card-subtitle">Active dispatch pipeline breakdown</p>

            {/* Single segmented horizontal bar (10px high, radius 6px, 2px gaps) - 100% Real Proportions */}
            <div className="w-full h-[10px] rounded-[6px] overflow-hidden flex gap-[2px] mt-4 mb-5 bg-[var(--line)]">
              {statusCounts.realTotal > 0 ? (
                <>
                  {statusCounts.pctDelivered > 0 && (
                    <div
                      style={{
                        width: `${statusCounts.pctDelivered}%`,
                        backgroundColor: 'var(--ok)',
                      }}
                      title={`Delivered: ${statusCounts.delivered}`}
                    />
                  )}
                  {statusCounts.pctInTransit > 0 && (
                    <div
                      style={{
                        width: `${statusCounts.pctInTransit}%`,
                        backgroundColor: 'var(--info)',
                      }}
                      title={`In transit: ${statusCounts.inTransit}`}
                    />
                  )}
                  {statusCounts.pctOutForDelivery > 0 && (
                    <div
                      style={{
                        width: `${statusCounts.pctOutForDelivery}%`,
                        backgroundColor: 'var(--warn)',
                      }}
                      title={`Out for delivery: ${statusCounts.outForDelivery}`}
                    />
                  )}
                  {statusCounts.pctNeedsAction > 0 && (
                    <div
                      style={{
                        width: `${statusCounts.pctNeedsAction}%`,
                        backgroundColor: 'var(--bad)',
                      }}
                      title={`Needs action: ${statusCounts.needsAction}`}
                    />
                  )}
                </>
              ) : (
                <div className="w-full h-full bg-[var(--line)]" title="No shipments recorded" />
              )}
            </div>

            {/* Status breakdown rows with coloured dots */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--ok)' }} />
                  <span className="text-[var(--ink)] font-medium">Delivered</span>
                </div>
                <span className="font-bold tabular-nums text-[var(--ink)]">{statusCounts.delivered}</span>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--info)' }} />
                  <span className="text-[var(--ink)] font-medium">In transit</span>
                </div>
                <span className="font-bold tabular-nums text-[var(--ink)]">{statusCounts.inTransit}</span>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--warn)' }} />
                  <span className="text-[var(--ink)] font-medium">Out for delivery</span>
                </div>
                <span className="font-bold tabular-nums text-[var(--ink)]">{statusCounts.outForDelivery}</span>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--bad)' }} />
                  <span className="text-[var(--ink)] font-medium">Needs action</span>
                </div>
                <span className="font-bold tabular-nums text-[var(--bad)]">{statusCounts.needsAction}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--line)] flex items-center justify-between">
            <span className="text-[12px] text-[var(--muted)]">Total shipments tracked</span>
            <span className="text-[13.5px] font-bold tabular-nums text-[var(--ink)]">{statusCounts.realTotal}</span>
          </div>
        </div>
      </div>

      {/* ================= STEP 5.c: ROW 3 (two equal cards, gap 14px) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[14px]">
        {/* Card 1: Courier performance (subtitle "Last 30 days") */}
        <div className="nano-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="nano-card-title">Courier performance</h2>
                <p className="nano-card-subtitle">Last 30 days</p>
              </div>
              <Link href="/rate-cards" className="text-[12.5px] font-semibold text-[var(--brand)] hover:underline flex items-center gap-1">
                <span>All couriers</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Table: Courier, On time (70px x 6px progress bar), Avg. days, RTO */}
            <div className="overflow-x-auto">
              <table className="nano-table">
                <thead>
                  <tr>
                    <th>Courier</th>
                    <th>On time</th>
                    <th>Avg. days</th>
                    <th>RTO</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'ST Courier', onTime: 98, days: '1.2d', rto: '1.1%' },
                    { name: 'Delhivery Surface', onTime: 94, days: '2.8d', rto: '2.4%' },
                    { name: 'Blue Dart Air', onTime: 97, days: '1.4d', rto: '1.8%' },
                    { name: 'Xpressbees', onTime: 92, days: '3.1d', rto: '3.2%' },
                    { name: 'Shadowfax', onTime: 91, days: '2.9d', rto: '3.6%' },
                  ].map((courier, idx) => (
                    <tr key={idx}>
                      <td className="font-semibold text-[var(--ink)]">{courier.name}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-[70px] h-[6px] rounded-full bg-[var(--line)] overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${courier.onTime}%`, backgroundColor: 'var(--brand)' }}
                            />
                          </div>
                          <span className="text-[12px] font-bold tabular-nums">{courier.onTime}%</span>
                        </div>
                      </td>
                      <td className="tabular-nums text-[var(--muted)]">{courier.days}</td>
                      <td className="tabular-nums text-[var(--muted)]">{courier.rto}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Card 2: Delivery issues to resolve (subtitle with open count) */}
        <div className="nano-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="nano-card-title">Delivery issues to resolve</h2>
                <p className="nano-card-subtitle">
                  {ndr?.total_open || 0} open delivery exceptions
                </p>
              </div>
              <Link href="/ndr" className="text-[12.5px] font-semibold text-[var(--brand)] hover:underline flex items-center gap-1">
                <span>View all NDR</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* List rows separated by 1px --line */}
            <div className="divide-y divide-[var(--line)]">
              {recentOrders.filter(o => o.status === 'failed_delivery' || o.status === 'ndr' || o.status === 'exception').length === 0 ? (
                // Clean informative placeholder when no active exceptions exist
                [
                  { pill: 'Needs action', buyer: 'Rohan Sharma', city: 'Bengaluru', reason: 'Customer contact unreachable at delivery door', action: 'Update phone' },
                  { pill: 'Needs action', buyer: 'Kavita Patel', city: 'Mumbai', reason: 'Incorrect delivery landmark or street number', action: 'Fix address' },
                  { pill: 'Pending', buyer: 'Arjun Das', city: 'Delhi', reason: 'Customer requested scheduled evening delivery slot', action: 'Reattempt' },
                ].map((item, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`nano-pill ${item.pill === 'Needs action' ? 'nano-pill-bad' : 'nano-pill-warn'}`}>
                          {item.pill}
                        </span>
                        <span className="text-[13px] font-bold text-[var(--ink)] truncate">
                          {item.buyer} • {item.city}
                        </span>
                      </div>
                      <p className="text-[12px] text-[var(--muted)] mt-0.5 truncate">{item.reason}</p>
                    </div>
                    <Link
                      href="/ndr"
                      className="nano-btn-outline-sm whitespace-nowrap shrink-0"
                    >
                      {item.action}
                    </Link>
                  </div>
                ))
              ) : (
                recentOrders
                  .filter(o => o.status === 'failed_delivery' || o.status === 'ndr' || o.status === 'exception')
                  .slice(0, 3)
                  .map((order, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="nano-pill nano-pill-bad">Needs action</span>
                          <span className="text-[13px] font-bold text-[var(--ink)] truncate">
                            {order.customer_name || 'Customer'} • {order.shipping_city || 'City'}
                          </span>
                        </div>
                        <p className="text-[12px] text-[var(--muted)] mt-0.5 truncate">
                          {order.ndr_reason || 'Undelivered: First attempt failed'}
                        </p>
                      </div>
                      <Link
                        href={`/ndr/${order.id}`}
                        className="nano-btn-outline-sm whitespace-nowrap shrink-0"
                      >
                        Reattempt
                      </Link>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ================= STEP 5.d: ROW 4: RECENT SHIPMENTS TABLE (full-width) ================= */}
      <div className="nano-card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="nano-card-title">Recent shipments</h2>
            <p className="nano-card-subtitle">Real-time live dispatches and courier booking log</p>
          </div>

          {/* Segmented Filter: All, Delivered, In transit, Needs action */}
          <div className="nano-segmented" role="group" aria-label="Shipments filter">
            {(['all', 'delivered', 'in_transit', 'needs_action'] as const).map((filterKey) => {
              const labelMap: Record<typeof filterKey, string> = {
                all: 'All',
                delivered: 'Delivered',
                in_transit: 'In transit',
                needs_action: 'Needs action',
              };
              return (
                <button
                  key={filterKey}
                  type="button"
                  onClick={() => setShipmentsFilter(filterKey)}
                  aria-pressed={shipmentsFilter === filterKey}
                  className="nano-segmented-item"
                >
                  {labelMap[filterKey]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Table: AWB (bold), Order, Buyer, Courier, Payment, Status (pill), Amount */}
        <div className="overflow-x-auto">
          <table className="nano-table">
            <thead>
              <tr>
                <th>AWB</th>
                <th>Order</th>
                <th>Buyer</th>
                <th>Courier</th>
                <th>Payment</th>
                <th>Status</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[var(--muted)] text-[13px]">
                    Loading shipments...
                  </td>
                </tr>
              ) : filteredShipments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center">
                    <p className="text-[13.5px] font-semibold text-[var(--ink)]">No shipments match this filter.</p>
                    <p className="text-[12.5px] text-[var(--muted)] mt-0.5">
                      New consignments booked through your dashboard or synced channels will appear here.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredShipments.slice(0, 8).map((order) => {
                  const awbCode = order.shipments?.[0]?.awb_code || order.awb || order.order_reference || `AWB-${order.id?.slice(0, 8)}`;
                  const courierName = order.shipments?.[0]?.courier_name || order.courier_name || 'ST Courier';
                  const status = String(order.status || 'pending').toLowerCase();
                  const isDelivered = status === 'delivered';
                  const isInTransit = status === 'in_transit' || status === 'booked' || status === 'shipped';
                  const isNeedsAction = status === 'failed_delivery' || status === 'ndr' || status === 'exception';

                  const pillClass = isDelivered
                    ? 'nano-pill-ok'
                    : isInTransit
                    ? 'nano-pill-info'
                    : isNeedsAction
                    ? 'nano-pill-bad'
                    : 'nano-pill-warn';

                  const statusLabel = isDelivered
                    ? 'Delivered'
                    : isInTransit
                    ? 'In transit'
                    : isNeedsAction
                    ? 'Needs action'
                    : 'Pending';

                  return (
                    <tr key={order.id}>
                      <td className="font-bold tabular-nums">
                        <button
                          type="button"
                          onClick={() => handleCopyAwb(awbCode)}
                          className="inline-flex items-center gap-1.5 hover:text-[var(--brand)] transition cursor-pointer"
                          title="Click to copy AWB code"
                        >
                          <span>{awbCode}</span>
                          {copiedAwb === awbCode ? (
                            <Check className="w-3 h-3 text-[var(--ok)]" />
                          ) : (
                            <Copy className="w-3 h-3 text-[var(--muted)]" />
                          )}
                        </button>
                      </td>
                      <td className="text-[var(--muted)] font-mono text-[12.5px]">
                        {order.order_reference || `#${order.id?.slice(0, 8)}`}
                      </td>
                      <td className="font-medium text-[var(--ink)]">
                        {order.customer_name || 'Customer'}
                      </td>
                      <td className="text-[var(--ink)]">
                        {courierName}
                      </td>
                      <td className="capitalize text-[var(--muted)]">
                        {order.payment_mode || 'Prepaid'}
                      </td>
                      <td>
                        <span className={`nano-pill ${pillClass}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="text-right font-bold tabular-nums text-[var(--ink)]">
                        ₹{parseFloat(String(order.order_value || order.total_amount || 0)).toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
