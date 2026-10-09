'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import toast from 'react-hot-toast';
import {
  Store,
  Package,
  FileText,
  Search,
  MapPin,
  User,
  Phone,
  Banknote,
  QrCode,
  RotateCcw,
  Building2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  Layers,
  Filter,
} from 'lucide-react';

interface BookingOffice {
  id: string;
  tenantId: string;
  merchantName: string;
  label: string;
  contactName: string;
  contactPhone: string;
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
  isActive: boolean;
  isDefault: boolean;
  totalBookings: number;
  createdAt: string;
}

interface CounterOrder {
  id: string;
  orderReference: string;
  tenantId: string;
  merchantName: string;
  bookingOffice: {
    id: string;
    label: string;
    city: string;
    state: string;
    pincode: string;
    isActive: boolean;
  } | null;
  consignee: {
    name: string;
    phone: string;
    city: string;
    state: string;
    pincode: string;
    address: string;
  };
  courier: {
    name: string;
    awbNumber: string;
    provider_key?: string;
    status: string;
    labelUrl: string | null;
  };
  valueDetails: {
    declaredGoodsValue: number;
    freightAmountCollected: number;
    paymentMethod: string;
  };
  specs: {
    weightKg: number;
    consignmentType: string;
    notes?: string;
  };
  status: string;
  bookedAt: string;
}

interface SummaryValues {
  totalOrders: number;
  totalGoodsValue: number;
  totalFreightRevenue: number;
  totalCashCollected: number;
  totalUpiCollected: number;
  totalToPay: number;
  stCourierCount: number;
  shipwayCount: number;
}

export default function AdminBookingOfficePage() {
  const [activeTab, setActiveTab] = useState<'orders' | 'offices'>('orders');

  // Offices state
  const [offices, setOffices] = useState<BookingOffice[]>([]);
  const [loadingOffices, setLoadingOffices] = useState(false);
  const [officeSearch, setOfficeSearch] = useState('');
  const [officeStatusFilter, setOfficeStatusFilter] = useState<'all' | 'true' | 'false'>('all');
  const [togglingOfficeId, setTogglingOfficeId] = useState<string | null>(null);

  // Orders state
  const [orders, setOrders] = useState<CounterOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [summaryValues, setSummaryValues] = useState<SummaryValues | null>(null);
  const [selectedOfficeId, setSelectedOfficeId] = useState('');
  const [selectedMerchantId, setSelectedMerchantId] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [orderSearch, setOrderSearch] = useState('');

  // Initial load
  useEffect(() => {
    fetchOffices();
    fetchOrders();
  }, []);

  // Refetch orders on filter changes
  useEffect(() => {
    fetchOrders();
  }, [selectedOfficeId, selectedMerchantId, selectedPaymentMethod]);

  const fetchOffices = async () => {
    try {
      setLoadingOffices(true);
      const res = await apiClient.get('/counter-booking/offices', {
        params: {
          is_active: officeStatusFilter,
          search: officeSearch.trim() || undefined,
        },
      });
      if (res.data.success) {
        setOffices(res.data.data || []);
      }
    } catch (err: any) {
      toast.error('Failed to load booking offices');
    } finally {
      setLoadingOffices(false);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoadingOrders(true);
      const res = await apiClient.get('/counter-booking/orders', {
        params: {
          pickup_address_id: selectedOfficeId || undefined,
          tenant_id: selectedMerchantId || undefined,
          payment_method: selectedPaymentMethod || undefined,
          search: orderSearch.trim() || undefined,
          limit: 100,
        },
      });
      if (res.data.success) {
        setOrders(res.data.data.orders || []);
        setSummaryValues(res.data.data.summaryValues || null);
      }
    } catch (err: any) {
      toast.error('Failed to load counter orders');
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleToggleOfficeStatus = async (office: BookingOffice) => {
    try {
      setTogglingOfficeId(office.id);
      const newStatus = !office.isActive;
      const res = await apiClient.patch(`/counter-booking/offices/${office.id}/status`, {
        is_active: newStatus,
      });

      if (res.data.success) {
        toast.success(res.data.message || `Office status updated`);
        setOffices((prev) =>
          prev.map((o) => (o.id === office.id ? { ...o, isActive: newStatus } : o))
        );
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to update status';
      toast.error(msg);
    } finally {
      setTogglingOfficeId(null);
    }
  };

  // Get unique merchants list from loaded offices
  const merchants = Array.from(
    new Map(offices.map((o) => [o.tenantId, { id: o.tenantId, name: o.merchantName }])).values()
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#5B069A] text-white flex items-center justify-center shadow-md shadow-purple-900/20">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              Platform Booking Office Hub
              <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full bg-purple-100 text-[#5B069A] border border-purple-200">
                Operations
              </span>
            </h1>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Multi-branch booking oversight, financial value tracking & office activation controls
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-gray-100 p-1.5 rounded-2xl border border-gray-200 shadow-inner">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'orders'
                ? 'bg-white text-[#5B069A] shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Orders & Values</span>
            <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-[#5B069A]">
              {summaryValues?.totalOrders ?? orders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('offices')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'offices'
                ? 'bg-white text-[#5B069A] shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Offices & Access Control</span>
            <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
              {offices.length}
            </span>
          </button>
        </div>
      </div>

      {/* Financial Value Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">
            Total Bookings
          </span>
          <div className="text-xl font-black text-gray-900 mt-1">
            {summaryValues?.totalOrders ?? orders.length}
          </div>
          <div className="text-[10px] font-semibold text-gray-400 mt-0.5">Across All Branches</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">
            Goods Declared Value
          </span>
          <div className="text-xl font-black text-purple-700 mt-1">
            ₹{Number(summaryValues?.totalGoodsValue || 0).toFixed(2)}
          </div>
          <div className="text-[10px] font-semibold text-purple-600 mt-0.5">Package Value</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">
            Freight Revenue
          </span>
          <div className="text-xl font-black text-emerald-700 mt-1">
            ₹{Number(summaryValues?.totalFreightRevenue || 0).toFixed(2)}
          </div>
          <div className="text-[10px] font-semibold text-emerald-600 mt-0.5">Total Collected</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">
            Cash in Drawer
          </span>
          <div className="text-xl font-black text-emerald-600 mt-1">
            ₹{Number(summaryValues?.totalCashCollected || 0).toFixed(2)}
          </div>
          <div className="text-[10px] font-semibold text-gray-400 mt-0.5">Physical Tender</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">
            UPI / Digital
          </span>
          <div className="text-xl font-black text-blue-700 mt-1">
            ₹{Number(summaryValues?.totalUpiCollected || 0).toFixed(2)}
          </div>
          <div className="text-[10px] font-semibold text-blue-600 mt-0.5">Instant Transfer</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">
            To-Pay (COD)
          </span>
          <div className="text-xl font-black text-amber-700 mt-1">
            ₹{Number(summaryValues?.totalToPay || 0).toFixed(2)}
          </div>
          <div className="text-[10px] font-semibold text-amber-600 mt-0.5">Pay on Delivery</div>
        </div>
      </div>

      {/* TAB 1: ORDERS FROM DIFFERENT BOOKING OFFICES WITH VALUE DETAILS */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Filters Bar */}
          <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50">
            <div className="flex flex-wrap items-center gap-3">
              {/* Filter: Booking Office */}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 text-xs">
                <MapPin className="w-3.5 h-3.5 text-[#5B069A]" />
                <select
                  value={selectedOfficeId}
                  onChange={(e) => setSelectedOfficeId(e.target.value)}
                  className="font-bold text-gray-800 bg-transparent border-none focus:ring-0 p-0 cursor-pointer"
                >
                  <option value="">All Booking Offices</option>
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label || o.city} ({o.pincode}) — {o.merchantName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter: Merchant */}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 text-xs">
                <Building2 className="w-3.5 h-3.5 text-gray-500" />
                <select
                  value={selectedMerchantId}
                  onChange={(e) => setSelectedMerchantId(e.target.value)}
                  className="font-bold text-gray-800 bg-transparent border-none focus:ring-0 p-0 cursor-pointer"
                >
                  <option value="">All Merchants</option>
                  {merchants.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter: Payment Mode */}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 text-xs">
                <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                <select
                  value={selectedPaymentMethod}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  className="font-bold text-gray-800 bg-transparent border-none focus:ring-0 p-0 cursor-pointer"
                >
                  <option value="">All Payment Modes</option>
                  <option value="cash">Cash Counter</option>
                  <option value="upi">UPI / Online</option>
                  <option value="to_pay">To-Pay (COD)</option>
                </select>
              </div>
            </div>

            {/* Search Input & Refresh */}
            <div className="flex items-center gap-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  fetchOrders();
                }}
                className="relative"
              >
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search AWB, Ref, Phone, City..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-[#5B069A] focus:outline-none w-56"
                />
              </form>

              <button
                onClick={fetchOrders}
                disabled={loadingOrders}
                className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all"
                title="Refresh orders"
              >
                <RefreshCw className={`w-4 h-4 ${loadingOrders ? 'animate-spin text-[#5B069A]' : ''}`} />
              </button>
            </div>
          </div>

          {/* Orders Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/75 border-b border-gray-200 text-gray-500 font-extrabold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Order Reference</th>
                  <th className="py-3 px-4">Origin Booking Office</th>
                  <th className="py-3 px-4">Consignee & Destination</th>
                  <th className="py-3 px-4">Courier & AWB</th>
                  <th className="py-3 px-4 text-right">Declared Value</th>
                  <th className="py-3 px-4 text-right">Freight Collected</th>
                  <th className="py-3 px-4 text-center">Payment Mode</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingOrders ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#5B069A]" />
                      Loading orders from booking offices...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">
                      <Store className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      No booking office orders found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  orders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-purple-50/30 transition-colors">
                      {/* Order Reference */}
                      <td className="py-3 px-4">
                        <div className="font-extrabold text-gray-900">{ord.orderReference}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(ord.bookedAt).toLocaleString('en-IN', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </div>
                      </td>

                      {/* Origin Booking Office & Merchant */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#5B069A] flex-shrink-0" />
                          <span>{ord.bookingOffice?.label || ord.bookingOffice?.city || 'Origin Branch'}</span>
                        </div>
                        <div className="text-[10px] text-gray-500 pl-5">
                          {ord.bookingOffice?.pincode} • {ord.merchantName}
                        </div>
                      </td>

                      {/* Consignee & Destination */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900">{ord.consignee.name}</div>
                        <div className="text-[10px] text-gray-500">
                          {ord.consignee.city}, {ord.consignee.state} ({ord.consignee.pincode})
                        </div>
                      </td>

                      {/* Courier & AWB */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-purple-900">{ord.courier.name}</div>
                        <div className="font-mono text-[11px] text-gray-600 flex items-center gap-1.5">
                          <span>{ord.courier.awbNumber}</span>
                          {ord.courier.labelUrl && (
                            <a
                              href={ord.courier.labelUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-purple-600 hover:text-purple-800"
                              title="Print 4x6 Label"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Declared Goods Value */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-bold text-gray-800">
                          ₹{ord.valueDetails.declaredGoodsValue.toFixed(2)}
                        </span>
                        <div className="text-[10px] text-gray-400 capitalize">
                          {ord.specs.consignmentType.replace('_', ' ')} • {ord.specs.weightKg}kg
                        </div>
                      </td>

                      {/* Freight Collected */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-black text-emerald-700 text-sm">
                          ₹{ord.valueDetails.freightAmountCollected.toFixed(2)}
                        </span>
                      </td>

                      {/* Payment Mode */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            ord.valueDetails.paymentMethod === 'cash'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : ord.valueDetails.paymentMethod === 'upi'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {ord.valueDetails.paymentMethod === 'cash' ? (
                            <Banknote className="w-3 h-3" />
                          ) : ord.valueDetails.paymentMethod === 'upi' ? (
                            <QrCode className="w-3 h-3" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          {ord.valueDetails.paymentMethod.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-gray-100 text-gray-800">
                          {ord.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: BOOKING OFFICES & ACCESS CONTROL (ENABLE / DISABLE) */}
      {activeTab === 'offices' && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Top Filter & Search */}
          <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Filter:</span>
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 text-xs">
                <button
                  onClick={() => setOfficeStatusFilter('all')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    officeStatusFilter === 'all' ? 'bg-[#5B069A] text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All ({offices.length})
                </button>
                <button
                  onClick={() => setOfficeStatusFilter('true')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    officeStatusFilter === 'true' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setOfficeStatusFilter('false')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    officeStatusFilter === 'false' ? 'bg-red-600 text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Disabled
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  fetchOffices();
                }}
                className="relative"
              >
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search Office, City, Pincode..."
                  value={officeSearch}
                  onChange={(e) => setOfficeSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-[#5B069A] focus:outline-none w-56"
                />
              </form>

              <button
                onClick={fetchOffices}
                disabled={loadingOffices}
                className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all"
                title="Refresh offices"
              >
                <RefreshCw className={`w-4 h-4 ${loadingOffices ? 'animate-spin text-[#5B069A]' : ''}`} />
              </button>
            </div>
          </div>

          {/* Offices Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/75 border-b border-gray-200 text-gray-500 font-extrabold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Booking Office Hub</th>
                  <th className="py-3 px-4">Merchant Account</th>
                  <th className="py-3 px-4">Contact Details</th>
                  <th className="py-3 px-4">Location & Address</th>
                  <th className="py-3 px-4 text-center">Total Bookings</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Enable / Disable Option</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingOffices ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#5B069A]" />
                      Loading booking offices...
                    </td>
                  </tr>
                ) : offices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      <Building2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      No booking offices found.
                    </td>
                  </tr>
                ) : (
                  offices.map((off) => (
                    <tr key={off.id} className="hover:bg-gray-50/50 transition-colors">
                      {/* Office Label */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
                          <Store className="w-4 h-4 text-[#5B069A]" />
                          <span>{off.label || off.city}</span>
                          {off.isDefault && (
                            <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-50 text-[#5B069A] border border-purple-200">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {off.id.slice(0, 8)}...</div>
                      </td>

                      {/* Merchant Account */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-gray-400" />
                          <span>{off.merchantName}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 pl-5">Merchant ID: {off.tenantId.slice(0, 8)}...</div>
                      </td>

                      {/* Contact Details */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-gray-800 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          <span>{off.contactName || 'Branch Manager'}</span>
                        </div>
                        {off.contactPhone && (
                          <div className="text-[10px] text-gray-500 pl-5 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-gray-400" />
                            <span>{off.contactPhone}</span>
                          </div>
                        )}
                      </td>

                      {/* Location & Address */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900">
                          {off.city}, {off.state} ({off.pincode})
                        </div>
                        <div className="text-[10px] text-gray-500 truncate max-w-xs">{off.addressLine1}</div>
                      </td>

                      {/* Total Bookings */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-black bg-purple-50 text-[#5B069A]">
                          {off.totalBookings}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            off.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {off.isActive ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-red-600" />
                              Disabled
                            </>
                          )}
                        </span>
                      </td>

                      {/* Interactive Enable / Disable Toggle Option */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          disabled={togglingOfficeId === off.id}
                          onClick={() => handleToggleOfficeStatus(off)}
                          className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 ml-auto disabled:opacity-50 ${
                            off.isActive
                              ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                          }`}
                        >
                          {togglingOfficeId === off.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : off.isActive ? (
                            <>
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Disable Office</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Enable Office</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
