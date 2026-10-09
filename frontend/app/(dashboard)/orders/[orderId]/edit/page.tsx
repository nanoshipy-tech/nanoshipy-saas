'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { OrderForm } from '@/components/orders/OrderForm';
import { Spinner } from '@/components/ui/Spinner';

export default function EditOrderPage() {
  const { orderId } = useParams();
  const [initialData, setInitialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/orders/${orderId}`);
      const order = res.data.data;
      
      // Map database order fields back to form format
      setInitialData({
        order_reference: order.order_reference,
        pickup_address_id: order.pickup_address_id,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_email: order.customer_email || '',
        shipping_address_line1: order.shipping_address_line1,
        shipping_address_line2: order.shipping_address_line2 || '',
        shipping_city: order.shipping_city,
        shipping_state: order.shipping_state,
        shipping_pincode: order.shipping_pincode,
        shipping_country: order.shipping_country,
        payment_mode: order.payment_mode,
        cod_amount: parseFloat(order.cod_amount || '0'),
        weight_kg: parseFloat(order.weight_kg),
        length_cm: parseFloat(order.length_cm),
        width_cm: parseFloat(order.width_cm),
        height_cm: parseFloat(order.height_cm),
        items: order.items.map((i: any) => ({
          product_name: i.product_name,
          sku: i.sku || '',
          quantity: i.quantity,
          unit_price: parseFloat(i.unit_price)
        }))
      });
    } catch (err: any) {
      console.error('Failed to fetch order', err);
      setError(err.response?.data?.error?.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    }
  }, [orderId, fetchOrder]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Spinner className="h-8 w-8 text-[#8410DC]" />
        <p className="text-sm text-gray-500 font-medium">Loading order details...</p>
      </div>
    );
  }

  if (error || !initialData) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center space-x-3 text-sm">
        <ShieldAlert className="h-5 w-5 shrink-0" />
        <span>{error || 'Order not found'}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center space-x-3 border-b pb-4">
        <Link
          href={`/orders/${orderId}`}
          className="text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Edit Order: {initialData.order_reference}</h1>
          <p className="text-xs text-gray-500">Update order destination, packaging, or items listing window.</p>
        </div>
      </div>

      <OrderForm initialValues={initialData} orderId={orderId as string} />
    </div>
  );
}
