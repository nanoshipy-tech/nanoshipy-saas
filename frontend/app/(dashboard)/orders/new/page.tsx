'use client';

import React from 'react';
import { ArrowLeft, Store } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/authStore';
import { OrderForm } from '@/components/orders/OrderForm';

export default function CreateOrderPage() {
  const { user } = useAuth();
  const isBookingOffice = Boolean(user?.tenant?.is_booking_office);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-[#E8DEF2] pb-4">
        <div className="flex items-center space-x-3">
          <Link
            href="/orders"
            className="text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Create Manual Order</h1>
            <p className="text-xs text-gray-500">Insert custom order details and product line items manually.</p>
          </div>
        </div>

        {/* No Switch to Walk-in Booking button when isBookingOffice is false */}
      </div>

      {isBookingOffice ? (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-8 text-center max-w-2xl mx-auto my-8 space-y-4">
          <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/50 rounded-2xl flex items-center justify-center mx-auto text-[#8410DC]">
            <Store className="w-7 h-7 text-[#8410DC]" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Standard Order Creation Disabled
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your account is enabled as a <strong>Booking Office</strong>. In this mode, standard manual order creation is disabled. Please use the Walk-in Retail Counter booking feature to process walk-in consignments.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/walkin-booking"
              className="nano-btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm"
            >
              <Store className="w-4 h-4" />
              <span>Go to Walk-in Booking</span>
            </Link>
          </div>
        </div>
      ) : (
        <OrderForm />
      )}
    </div>
  );
}
