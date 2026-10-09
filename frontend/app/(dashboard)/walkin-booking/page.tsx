'use strict';

'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Store, ShieldAlert, Plus } from 'lucide-react';
import { useAuth } from '@/lib/authStore';
import { WalkinBookingForm } from '@/components/orders/WalkinBookingForm';

export default function WalkinBookingPage() {
  const { user } = useAuth();
  const isBookingOffice = Boolean(user?.tenant?.is_booking_office);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center space-x-3">
          <Link
            href="/orders"
            className="text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Store className="h-5 w-5 text-[#8410DC]" /> Walk-in Retail Counter Booking
            </h1>
            <p className="text-xs text-gray-500">
              Create counter courier bookings for walk-in customers with manual sender and receiver addresses.
            </p>
          </div>
        </div>

        <Link
          href="/orders"
          className="text-xs font-bold text-[#8410DC] hover:underline"
        >
          View All Orders
        </Link>
      </div>

      {!isBookingOffice ? (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-8 text-center max-w-2xl mx-auto my-8 space-y-4">
          <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/50 rounded-2xl flex items-center justify-center mx-auto text-[#8410DC]">
            <ShieldAlert className="w-7 h-7 text-[#8410DC]" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Walk-in Booking Disabled
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Walk-in Retail Counter Booking is only available for accounts enabled as a <strong>Booking Office</strong>. For standard e-commerce shipping, please use the standard manual order creation or bulk upload.
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Link
              href="/orders"
              className="nano-btn-secondary px-4 py-2 text-xs"
            >
              View Orders
            </Link>
            <Link
              href="/orders/new"
              className="nano-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Standard Order</span>
            </Link>
          </div>
        </div>
      ) : (
        /* Main Walk-in Booking Form */
        <WalkinBookingForm />
      )}
    </div>
  );
}
