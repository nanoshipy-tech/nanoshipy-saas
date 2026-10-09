'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Edit3, Trash2, Calendar, MapPin, Package, RefreshCw, ShieldAlert, CreditCard, Printer, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/apiClient';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { Spinner } from '@/components/ui/Spinner';
import { Card, CardContent } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { generateWalkinReceipt } from '@/lib/generateWalkinReceipt';
import { openPdfDocument } from '@/lib/urlUtils';

interface OrderItem {
  id: string;
  product_name: string;
  sku: string | null;
  quantity: number;
  unit_price: string;
}

interface PickupAddress {
  label: string;
  contact_name: string;
  contact_phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  pincode: string;
}

interface StatusHistory {
  id: string;
  old_status: string | null;
  new_status: string;
  note: string | null;
  created_at: string;
  changedByUser?: {
    name: string;
  };
}

interface OrderDetail {
  id: string;
  order_reference: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  shipping_address_line1: string;
  shipping_address_line2: string | null;
  shipping_city: string;
  shipping_state: string;
  shipping_pincode: string;
  shipping_country: string;
  order_value: string;
  payment_mode: 'prepaid' | 'cod';
  cod_amount: string | null;
  weight_kg: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  status: 'pending' | 'processing' | 'ready_to_ship' | 'cancelled';
  source: 'manual' | 'bulk_import' | 'api';
  is_walkin?: boolean;
  sender_name?: string | null;
  sender_phone?: string | null;
  amount_collected?: string | number | null;
  created_at: string;
  items: OrderItem[];
  pickupAddress: PickupAddress;
  statusHistory: StatusHistory[];
}

export default function OrderDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.orderId as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [syncingShopify, setSyncingShopify] = useState(false);

  const fetchOrderDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/orders/${orderId}`);
      setOrder(res.data.data);
    } catch (err: any) {
      console.error('Failed to load order detail', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch order detail');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const handleSyncToShopify = async () => {
    if (!order) return;
    try {
      setSyncingShopify(true);
      const res = await apiClient.post(`/integrations/shopify/orders/${order.id}/fulfill`);
      if (res.data?.success) {
        toast.success(res.data.data?.message || 'Shopify tracking and fulfillment updated!');
        fetchOrderDetail();
      } else {
        toast.error(res.data?.error?.message || 'Shopify update failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.error || err.message || 'Failed to update Shopify fulfillment');
    } finally {
      setSyncingShopify(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrderDetail();
    }
  }, [orderId, fetchOrderDetail]);

  const handleStatusChange = async (newStatus: string) => {
    if (!order) return;
    setTransitioning(true);
    try {
      await apiClient.put(`/orders/${order.id}/status`, { status: newStatus, note: `Status transitioned to ${newStatus}` });
      toast.success(`Order transitioned to ${newStatus.replace('_', ' ')}`);
      
      // Invalidate parent orders list cache (Fix #31)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('orders_updated'));
        sessionStorage.setItem('orders_need_refresh', 'true');
      }
      router.refresh();
      fetchOrderDetail();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Status transition failed');
    } finally {
      setTransitioning(false);
    }
  };

  const confirmCancelOrder = async () => {
    if (!order) return;
    setTransitioning(true);
    try {
      await apiClient.delete(`/orders/${order.id}`, { data: { note: 'Cancelled from details view' } });
      toast.success('Order cancelled successfully');
      setIsCancelModalOpen(false);

      // Invalidate parent orders list cache (Fix #31)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('orders_updated'));
        sessionStorage.setItem('orders_need_refresh', 'true');
      }
      router.refresh();
      fetchOrderDetail();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Cancellation failed');
    } finally {
      setTransitioning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Spinner className="h-8 w-8 text-[#8410DC]" />
        <p className="text-sm text-gray-500 font-medium">Loading order details...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center space-x-3 text-sm">
        <ShieldAlert className="h-5 w-5 shrink-0" />
        <span>{error || 'Order not found'}</span>
      </div>
    );
  }

  const isEditable = ['pending', 'processing', 'ready_to_ship', 'cancelled'].includes(order.status);
  const isCancellable = ['pending', 'processing', 'ready_to_ship', 'shipped'].includes(order.status);
  const shipments: any[] = (order as any)?.shipments || [];
  const activeShipment = shipments.find((s: any) => !['cancelled', 'failed'].includes(s.status));
  const hasAwb = !!activeShipment?.awb_number;
  const isShopifyOrder = Boolean(
    (order as any)?.external_order_id ||
    (order as any)?.storefront_connection_id ||
    order?.order_reference?.startsWith('SHP-') ||
    order?.order_reference?.startsWith('#')
  );

  return (
    <div className="space-y-6">
      {/* Header action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 border-b pb-4">
        <div className="flex items-center space-x-3">
          <Link
            href="/orders"
            className="text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-gray-900">{order.order_reference}</h1>
              <OrderStatusBadge status={order.status} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Created on {new Date(order.created_at).toLocaleString('en-IN')}</p>
          </div>
        </div>

        {/* Header CTA action buttons */}
        <div className="flex items-center space-x-2 shrink-0 flex-wrap gap-y-2">
          {isShopifyOrder && hasAwb && (
            <button
              disabled={syncingShopify}
              onClick={handleSyncToShopify}
              className="flex items-center space-x-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50 shadow-sm"
              title="Push tracking & update fulfillment in Shopify"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncingShopify ? 'animate-spin' : ''}`} />
              <span>{syncingShopify ? 'Syncing...' : 'Sync to Shopify'}</span>
            </button>
          )}

          <button
            onClick={() => {
              const preOpenedWindow = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
              openPdfDocument(`/orders/${order.id}/pdf`, preOpenedWindow);
              toast.success('Opening customer order invoice...');
            }}
            className="flex items-center space-x-1.5 bg-white border border-gray-200 hover:bg-purple-50 hover:text-[#5B069A] text-gray-700 px-3.5 py-2 rounded-lg text-xs font-semibold transition shadow-sm cursor-pointer"
            title="Print or download Customer Order Invoice"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Invoice</span>
          </button>

          {isEditable && (
            <Link
              href={`/orders/${order.id}/edit`}
              className="flex items-center space-x-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3.5 py-2 rounded-lg text-xs font-semibold transition shadow-sm cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Edit Order</span>
            </Link>
          )}

          {order.status === 'pending' && (
            <button
              disabled={transitioning}
              onClick={() => handleStatusChange('processing')}
              className="flex items-center space-x-1.5 bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] text-white px-3.5 py-2 rounded-lg text-xs font-semibold transition shadow-sm cursor-pointer disabled:bg-blue-300"
            >
              <RefreshCw className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: '3s' }} />
              <span>Start Processing</span>
            </button>
          )}

          {order.status === 'processing' && (
            <button
              disabled={transitioning}
              onClick={() => handleStatusChange('ready_to_ship')}
              className="flex items-center space-x-1.5 bg-green-600 hover:bg-green-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold transition shadow-sm cursor-pointer disabled:bg-green-300"
            >
              <Package className="h-3.5 w-3.5" />
              <span>Mark Ready to Ship</span>
            </button>
          )}

          {['pending', 'processing', 'ready_to_ship', 'cancelled'].includes(order.status) && (
            <Link
              href={`/orders/${order.id}/ship`}
              className="flex items-center space-x-1.5 bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] text-white px-3.5 py-2 rounded-lg text-xs font-semibold transition shadow-sm cursor-pointer"
            >
              <Package className="h-3.5 w-3.5" />
              <span>{order.status === 'cancelled' ? 'Re-Ship Order' : 'Ship Order / Book Courier'}</span>
            </Link>
          )}

          {order.is_walkin && (
            <button
              onClick={() => generateWalkinReceipt(order.id)}
              className="flex items-center space-x-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer"
              title="Print Customer Retail Courier Receipt"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Receipt</span>
            </button>
          )}

          {isCancellable && (
            <button
              disabled={transitioning}
              onClick={() => setIsCancelModalOpen(true)}
              className="flex items-center space-x-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Cancel Order</span>
            </button>
          )}
        </div>
      </div>

      {/* Detail grids */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer & Shipping cards */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-sm font-semibold text-gray-800 border-b pb-2 flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-[#8410DC]" />
                <span>Shipping & Origin Addresses</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Destination */}
                <div className="space-y-1.5 text-sm">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Shipping Destination</p>
                  <p className="font-semibold text-gray-900">{order.customer_name}</p>
                  <p className="text-gray-600">{order.shipping_address_line1}</p>
                  {order.shipping_address_line2 && <p className="text-gray-600">{order.shipping_address_line2}</p>}
                  <p className="text-gray-600">{order.shipping_city}, {order.shipping_state} - {order.shipping_pincode}</p>
                  <p className="text-gray-600">{order.shipping_country}</p>
                  <p className="text-gray-600 font-medium pt-1">Phone: {order.customer_phone}</p>
                  {order.customer_email && <p className="text-gray-600">Email: {order.customer_email}</p>}
                </div>

                {/* Origin */}
                <div className="space-y-1.5 text-sm">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pickup Warehouse</p>
                  <p className="font-semibold text-gray-900">{order.pickupAddress.label}</p>
                  <p className="text-gray-600">{order.pickupAddress.address_line1}</p>
                  {order.pickupAddress.address_line2 && <p className="text-gray-600">{order.pickupAddress.address_line2}</p>}
                  <p className="text-gray-600">{order.pickupAddress.city}, {order.pickupAddress.state} - {order.pickupAddress.pincode}</p>
                  <p className="text-gray-600">Contact: {order.pickupAddress.contact_name} ({order.pickupAddress.contact_phone})</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items card */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold text-gray-800 border-b pb-2 mb-4">Products Summary</h2>
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="py-2">Item Name</th>
                    <th className="py-2">SKU</th>
                    <th className="py-2 text-center">Qty</th>
                    <th className="py-2 text-right">Unit Price</th>
                    <th className="py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 text-gray-950 font-medium">{item.product_name}</td>
                      <td className="py-3 text-gray-500 font-mono text-xs">{item.sku || '-'}</td>
                      <td className="py-3 text-center text-gray-600">{item.quantity}</td>
                      <td className="py-3 text-right text-gray-600">₹{parseFloat(item.unit_price).toFixed(2)}</td>
                      <td className="py-3 text-right text-gray-900 font-semibold">₹{(item.quantity * parseFloat(item.unit_price)).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={4} className="py-3 font-semibold text-right text-gray-500">Order Value:</td>
                    <td className="py-3 font-bold text-right text-[#8410DC] text-base">₹{parseFloat(order.order_value).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Package & Billing cards */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-sm font-semibold text-gray-800 border-b pb-2 flex items-center space-x-2">
                <Package className="h-4 w-4 text-[#8410DC]" />
                <span>Package Logistics</span>
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Volumetric Weight:</span>
                  <span className="font-semibold text-gray-800">{order.weight_kg} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Dimensions:</span>
                  <span className="font-semibold text-gray-800">
                    {order.length_cm} × {order.width_cm} × {order.height_cm} cm
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="text-gray-500">Order Source:</span>
                  <span className="font-medium text-gray-800 capitalize">{order.source}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-sm font-semibold text-gray-800 border-b pb-2 flex items-center space-x-2">
                <CreditCard className="h-4 w-4 text-[#8410DC]" />
                <span>Payment & Invoicing</span>
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment Mode:</span>
                  <span className="font-semibold text-gray-800 uppercase">{order.payment_mode}</span>
                </div>
                {order.payment_mode === 'cod' && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">COD Collectible:</span>
                    <span className="font-bold text-red-600">₹{parseFloat(order.cod_amount || '0').toFixed(2)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Courier & Tracking card */}
      {activeShipment && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center space-x-2">
                <Truck className="h-4 w-4 text-[#8410DC]" />
                <span>Courier & Tracking Details</span>
              </h2>
              {isShopifyOrder && (
                <button
                  disabled={syncingShopify}
                  onClick={handleSyncToShopify}
                  className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-300 disabled:opacity-50 transition shadow-sm"
                >
                  <RefreshCw className={`h-3 w-3 ${syncingShopify ? 'animate-spin' : ''}`} />
                  <span>{syncingShopify ? 'Updating...' : 'Sync to Shopify'}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 font-medium">AWB Number</p>
                <p className="font-mono font-bold text-gray-900 mt-0.5">{activeShipment.awb_number}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Shipment Status</p>
                <p className="font-semibold capitalize text-emerald-700 mt-0.5">{activeShipment.status}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Courier Provider</p>
                <p className="font-semibold text-gray-800 mt-0.5">{activeShipment.courier_provider_id || 'ST Courier / Shipway'}</p>
              </div>
            </div>

            {activeShipment.label_url && (
              <div className="pt-2 border-t">
                <a
                  href={activeShipment.label_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1.5 text-xs text-[#8410DC] hover:underline font-semibold"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Download Shipping Label</span>
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* History timeline card */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800 border-b pb-2 flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-[#8410DC]" />
            <span>Order History & Timeline</span>
          </h2>

          <div className="relative pl-6 border-l-2 border-gray-100 space-y-6">
            {order.statusHistory.map((history) => (
              <div key={history.id} className="relative">
                {/* Bullet */}
                <div className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#8410DC] shadow-sm" />
                
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold bg-gray-150 text-gray-700 px-2 py-0.5 rounded border border-gray-200">
                      {history.new_status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(history.created_at).toLocaleString()}
                    </span>
                  </div>
                  {history.note && (
                    <p className="text-sm text-gray-600 mt-1">{history.note}</p>
                  )}
                  {history.changedByUser && (
                    <p className="text-xs text-gray-400 mt-0.5">Updated by {history.changedByUser.name}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ConfirmModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={confirmCancelOrder}
        title="Cancel Order"
        description="Are you sure you want to cancel this order? This action will set the order status to cancelled and cannot be undone."
        confirmText="Yes, Cancel Order"
        variant="danger"
        isLoading={transitioning}
      />
    </div>
  );
}
