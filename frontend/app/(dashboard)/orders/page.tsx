'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Upload, RefreshCw, AlertCircle, Store, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/lib/authStore';
import { exportDataToCsv } from '@/lib/exportUtils';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { OrderTable, OrderListItem } from '@/components/orders/OrderTable';
import { Spinner } from '@/components/ui/Spinner';

interface DashboardSummary {
  pending: number;
  processing: number;
  ready_to_ship: number;
  cancelled: number;
}

export default function OrdersListPage() {
  const { user } = useAuth();
  const isBookingOffice = Boolean(user?.tenant?.is_booking_office);

  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [summary, setSummary] = useState<DashboardSummary>({
    pending: 0,
    processing: 0,
    ready_to_ship: 0,
    cancelled: 0,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0,
  });

  const [filters, setFilters] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async (pageIndex: number, currentFilters: Record<string, any>) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: pageIndex,
        limit: pagination.limit,
        ...currentFilters,
      };

      const [ordersRes, summaryRes] = await Promise.all([
        apiClient.get('/orders', { params }),
        apiClient.get('/orders/summary')
      ]);

      setOrders(ordersRes.data?.data?.items || ordersRes.data?.data || []);
      if (ordersRes.data?.data?.pagination) {
        setPagination(ordersRes.data.data.pagination);
      }
      if (summaryRes.data?.data) {
        setSummary(summaryRes.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load orders', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch orders data. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  }, [pagination.limit]);

  useEffect(() => {
    fetchOrders(1, filters);
  }, [filters, fetchOrders]);

  useEffect(() => {
    const onOrdersUpdated = () => {
      fetchOrders(pagination.page, filters);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('orders_updated', onOrdersUpdated);
      if (sessionStorage.getItem('orders_need_refresh') === 'true') {
        sessionStorage.removeItem('orders_need_refresh');
        fetchOrders(pagination.page, filters);
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('orders_updated', onOrdersUpdated);
      }
    };
  }, [fetchOrders, pagination.page, filters]);

  const handlePageChange = (newPage: number) => {
    fetchOrders(newPage, filters);
  };

  const handleRefresh = () => {
    fetchOrders(pagination.page, filters);
  };

  const handleExportOrders = () => {
    if (!orders || orders.length === 0) {
      toast.error('No orders available to export.');
      return;
    }
    const cols = [
      { key: 'order_reference', header: 'Order Reference' },
      { key: 'customer_name', header: 'Customer Name' },
      { key: 'customer_phone', header: 'Phone' },
      { key: 'shipping_city', header: 'City' },
      { key: 'shipping_state', header: 'State' },
      { key: 'shipping_pincode', header: 'Pincode' },
      { key: 'payment_mode', header: 'Payment Mode' },
      { key: 'order_value', header: 'Order Value (INR)' },
      { key: 'status', header: 'Status' },
      { key: 'created_at', header: 'Created Date' },
    ];
    exportDataToCsv(`nanoshipy_orders_${new Date().toISOString().substring(0, 10)}.csv`, cols, orders);
  };

  return (
    <div className="space-y-[14px]">
      {/* 4 KPI Cards: New, Packed, Ready to ship, Cancelled today */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[14px]">
        {/* KPI 1: New */}
        <div
          onClick={() => setFilters((prev) => ({ ...prev, status: 'pending' }))}
          className="nano-card flex flex-col justify-between cursor-pointer transition-colors hover:border-[var(--brand)]"
        >
          <div className="nano-kpi-label">New</div>
          <div className="nano-kpi-value my-1.5 text-[var(--warn)]">
            {summary.pending}
          </div>
          <div className="text-[12px] text-[var(--muted)]">Inward pending triage</div>
        </div>

        {/* KPI 2: Packed */}
        <div
          onClick={() => setFilters((prev) => ({ ...prev, status: 'processing' }))}
          className="nano-card flex flex-col justify-between cursor-pointer transition-colors hover:border-[var(--brand)]"
        >
          <div className="nano-kpi-label">Packed</div>
          <div className="nano-kpi-value my-1.5 text-[var(--info)]">
            {summary.processing}
          </div>
          <div className="text-[12px] text-[var(--muted)]">Boxed & labeled</div>
        </div>

        {/* KPI 3: Ready to ship */}
        <div
          onClick={() => setFilters((prev) => ({ ...prev, status: 'ready_to_ship' }))}
          className="nano-card flex flex-col justify-between cursor-pointer transition-colors hover:border-[var(--brand)]"
        >
          <div className="nano-kpi-label">Ready to ship</div>
          <div className="nano-kpi-value my-1.5 text-[var(--ok)]">
            {summary.ready_to_ship}
          </div>
          <div className="text-[12px] text-[var(--muted)]">Ready for courier handover</div>
        </div>

        {/* KPI 4: Cancelled today */}
        <div
          onClick={() => setFilters((prev) => ({ ...prev, status: 'cancelled' }))}
          className="nano-card flex flex-col justify-between cursor-pointer transition-colors hover:border-[var(--brand)]"
        >
          <div className="nano-kpi-label">Cancelled today</div>
          <div className="nano-kpi-value my-1.5 text-[var(--bad)]">
            {summary.cancelled}
          </div>
          <div className="text-[12px] text-[var(--muted)]">Aborted or buyer voided</div>
        </div>
      </div>

      {/* Action Header & Quick Actions */}
      <div className="nano-card flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            className="nano-btn-secondary py-2 text-[13px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExportOrders}
            className="nano-btn-secondary py-2 text-[13px]"
            title="Download current orders as CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#8410DC]" />
            <span>Export CSV</span>
          </button>
          {!isBookingOffice && (
            <Link
              href="/orders/bulk-upload"
              className="nano-btn-secondary py-2 text-[13px]"
              title="Bulk import orders via CSV / Excel"
            >
              <Upload className="w-3.5 h-3.5 text-[#8410DC]" />
              <span>Bulk import</span>
            </Link>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isBookingOffice ? (
            <Link
              href="/walkin-booking"
              className="nano-btn-primary py-2 text-[13px]"
              title="Retail counter walk-in consignment booking"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Walk-in booking</span>
            </Link>
          ) : (
            <Link
              href="/orders/new"
              className="nano-btn-primary py-2 text-[13px]"
              title="Create a new single order"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create order</span>
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-[10px] text-[13px] flex items-center gap-2" style={{ backgroundColor: 'var(--bad-bg)', color: 'var(--bad)' }}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter panel */}
      <div className="nano-card">
        <OrderFilters onFilterChange={setFilters} />
      </div>

      {/* Order List / Table */}
      <div className="nano-card !p-0 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-2">
            <Spinner className="h-7 w-7 text-[var(--brand)]" />
            <p className="text-[12.5px] text-[var(--muted)] font-medium">Fetching orders list...</p>
          </div>
        ) : (
          <OrderTable
            orders={orders}
            pagination={pagination}
            onPageChange={handlePageChange}
            onRefresh={handleRefresh}
          />
        )}
      </div>
    </div>
  );
}
