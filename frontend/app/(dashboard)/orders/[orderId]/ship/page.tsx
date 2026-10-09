'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, AlertCircle, CheckCircle, Package, ArrowRight, Printer, AlertTriangle, Sparkles, Zap } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { Spinner } from '@/components/ui/Spinner';
import { Card, CardContent } from '@/components/ui/Card';
import { RateComparisonTable, RateQuote } from '@/components/shipments/RateComparisonTable';
import { generateWalkinReceipt } from '@/lib/generateWalkinReceipt';

interface OrderDetail {
  id: string;
  order_reference: string;
  customer_name: string;
  shipping_pincode: string;
  weight_kg: string;
  status: string;
  is_walkin?: boolean;
  pickupAddress: {
    pincode: string;
    label: string;
  };
}

interface UnavailableProvider {
  display_name: string;
  reason: string;
}

export default function OrderShipPage() {
  const router = useRouter();
  const { orderId } = useParams();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [rates, setRates] = useState<RateQuote[]>([]);
  const [unavailableProviders, setUnavailableProviders] = useState<UnavailableProvider[]>([]);
  const [quoteExpiry, setQuoteExpiry] = useState<string | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<RateQuote | null>(null);

  const [loadingOrder, setLoadingOrder] = useState(true);
  const [loadingRates, setLoadingRates] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [ratesError, setRatesError] = useState<string | null>(null);

  const [bookedShipment, setBookedShipment] = useState<{
    id: string;
    awb_number: string;
    label_url: string | null;
    estimated_delivery_date: string | null;
  } | null>(null);

  useEffect(() => {
    async function fetchOrder() {
      try {
        setLoadingOrder(true);
        setError(null);
        const res = await apiClient.get(`/orders/${orderId}`);
        const orderData = res.data.data;
        setOrder(orderData);

        if (!['pending', 'processing', 'ready_to_ship', 'cancelled'].includes(orderData.status)) {
          setError(`Order is in status "${orderData.status}" and is not shippable.`);
        } else {
          // Trigger rate comparison automatically
          fetchRates();
        }
      } catch (err: any) {
        setError(err.response?.data?.error?.message || 'Failed to fetch order details');
      } finally {
        setLoadingOrder(false);
      }
    }

    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  const fetchRates = async () => {
    setLoadingRates(true);
    setRatesError(null);
    setSelectedQuote(null);
    try {
      const res = await apiClient.post(`/orders/${orderId}/rates`);
      const fetchedRates: RateQuote[] = res.data.data.rates || [];
      setUnavailableProviders(res.data.data.unavailable_providers || []);
      setQuoteExpiry(res.data.data.quote_expires_at);

      // Auto-allocation: show only the single optimal courier as per routing rules
      // Backend enforces is_allocated=true for index 0 (top-ranked by routing & price)
      const allocated = fetchedRates.find((r) => r.is_allocated) || fetchedRates[0];
      setRates(allocated ? [allocated] : []);
      setSelectedQuote(allocated ?? null);
    } catch (err: any) {
      setRatesError(err.response?.data?.error?.message || 'Failed to retrieve shipping quotes');
    } finally {
      setLoadingRates(false);
    }
  };

  const handleBookShipment = async () => {
    if (!selectedQuote || !order) return;

    setBooking(true);
    setBookingError(null);
    try {
      const totalPrice = Math.round((selectedQuote.price + (selectedQuote.cod_charge || 0)) * 100) / 100;
      const res = await apiClient.post('/shipments', {
        order_id: order.id,
        courier_provider_id: selectedQuote.courier_provider_id,
        service_type: selectedQuote.service_type,
        quoted_rate: totalPrice,
      });

      setBookedShipment(res.data.data);
    } catch (err: any) {
      const backendErr = err.response?.data?.error;
      let msg = backendErr?.message || 'Failed to book shipment';
      if (backendErr?.fields && typeof backendErr.fields === 'object') {
        const fieldDetails = Object.entries(backendErr.fields)
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ');
        msg = `${msg} (${fieldDetails})`;
      }
      setBookingError(msg);
    } finally {
      setBooking(false);
    }
  };

  const [printingLabel, setPrintingLabel] = useState(false);

  const handlePrintLabel = async () => {
    if (!bookedShipment) return;
    setPrintingLabel(true);
    try {
      const res = await apiClient.post(`/shipments/${bookedShipment.id}/label?format=4x6&force=true`);
      const url = res.data?.data?.label_url || bookedShipment.label_url;
      if (url) {
        window.open(url, '_blank');
      }
    } catch {
      if (bookedShipment.label_url) {
        window.open(bookedShipment.label_url, '_blank');
      }
    } finally {
      setPrintingLabel(false);
    }
  };

  if (loadingOrder) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Spinner className="h-8 w-8 text-[#8410DC]" />
        <p className="text-sm text-gray-500 font-medium">Loading shipment scheduler...</p>
      </div>
    );
  }

  if (error && !bookedShipment) {
    return (
      <div className="space-y-4 max-w-xl mx-auto py-12">
        <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-2xl flex items-start space-x-3 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
          <div>
            <h4 className="font-bold text-gray-900 mb-1">Cannot Schedule Shipment</h4>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
        <div className="text-center">
          <Link
            href={`/orders/${orderId}`}
            className="inline-flex items-center space-x-2 text-sm font-semibold text-[#8410DC] hover:text-[#4D0582] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Order Details</span>
          </Link>
        </div>
      </div>
    );
  }

  if (bookedShipment) {
    return (
      <div className="max-w-2xl mx-auto py-12 space-y-6">
        <div className="bg-white border border-gray-200/80 rounded-3xl p-8 text-center shadow-xl space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-50 flex items-center justify-center text-green-600">
            <CheckCircle className="h-10 w-10 animate-bounce" style={{ animationDuration: '2s' }} />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-gray-900">Shipment Successfully Booked!</h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Your order is now booked with the carrier. The AWB waybill number has been generated.
            </p>
          </div>

          <div className="bg-gray-50 rounded-2xl p-6 max-w-md mx-auto border border-gray-100 text-left space-y-4 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-400 font-medium">AWB Waybill Number</span>
              <span className="font-bold text-gray-900 font-mono select-all">{bookedShipment.awb_number}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-400 font-medium">Estimated Pickup</span>
              <span className="font-semibold text-gray-900">
                {bookedShipment.estimated_delivery_date
                  ? new Date(bookedShipment.estimated_delivery_date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'Tomorrow'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 font-medium">Courier Partner</span>
              <span className="font-semibold text-gray-900">{selectedQuote?.display_name}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            {bookedShipment && (
              <button
                onClick={handlePrintLabel}
                disabled={printingLabel}
                className="flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white font-bold text-sm px-6 py-3 rounded-2xl w-full sm:w-auto shadow-md transition cursor-pointer disabled:opacity-60"
              >
                <Printer className="h-4 w-4" />
                <span>{printingLabel ? 'Generating Branded Label...' : 'Print Shipping Label'}</span>
              </button>
            )}
            {bookedShipment && order?.is_walkin && (
              <button
                onClick={() => generateWalkinReceipt(order.id)}
                className="flex items-center justify-center space-x-2 bg-[#8410DC] hover:bg-[#6c0cb5] text-white font-bold text-sm px-6 py-3 rounded-2xl w-full sm:w-auto shadow-md transition cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>Print Customer Receipt</span>
              </button>
            )}
            <Link
              href="/shipments"
              className="flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm px-6 py-3 rounded-2xl w-full sm:w-auto transition"
            >
              <span>Manage Shipments</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center space-x-3 border-b pb-4">
        <Link
          href={`/orders/${orderId}`}
          className="text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Auto-Allocated Courier & Ship</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Booking for Order <strong className="text-gray-700">{order?.order_reference}</strong> • Weight: {order?.weight_kg} kg • Origin: {order?.pickupAddress?.pincode} • <span className="text-[#8410DC] font-semibold">Courier auto-routed by network rules</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Courier Quotes Shopping */}
        <div className="md:col-span-2 space-y-6">
          {loadingRates ? (
            <Card>
              <CardContent className="p-12 text-center flex flex-col items-center justify-center space-y-3">
                <Spinner className="h-7 w-7 text-[#8410DC] animate-spin" />
                <p className="text-sm font-semibold text-gray-700">Resolving optimal courier via network routing rules...</p>
                <p className="text-xs text-gray-400">Auto-allocating the best-fit carrier for this shipment route</p>
              </CardContent>
            </Card>
          ) : ratesError ? (
            <Card className="border-red-200 bg-red-50/50">
              <CardContent className="p-8 text-center space-y-4">
                <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
                <div>
                  <h4 className="font-bold text-red-800 text-sm">Failed to Fetch Shipping Rates</h4>
                  <p className="text-xs text-red-600/90 mt-1">{ratesError}</p>
                </div>
                <button
                  onClick={fetchRates}
                  className="bg-white border border-red-200 hover:bg-red-50 text-red-700 px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition"
                >
                  Retry Quote Search
                </button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Smart Auto-Allocation Banner */}
              {selectedQuote?.is_allocated && (
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200/80 rounded-2xl p-4 flex items-start space-x-3 text-xs text-purple-900 shadow-sm">
                  <div className="p-2 rounded-xl bg-purple-100 text-[#8410DC] shrink-0 mt-0.5">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-[#5B069A] text-sm flex items-center gap-1.5"><Zap className="h-4 w-4 shrink-0 text-[#5B069A]" /> Network Routing Auto-Allocated</span>
                    <p className="text-purple-800/90 mt-0.5 font-medium">
                      {selectedQuote.routing_reason ||
                        (selectedQuote.display_name.includes('ST Courier')
                          ? 'Tamil Nadu regional order: Auto-routed via ST Courier Regional Network for rapid next-day dispatch.'
                          : 'Interstate order: Auto-routed via National Express Logistics Network for multi-zone fulfillment.')}
                    </p>
                  </div>
                </div>
              )}

              <RateComparisonTable
                rates={rates}
                selectedQuote={selectedQuote}
                onSelectQuote={setSelectedQuote}
                booking={booking}
                loading={loadingRates}
              />

              {/* Partial failures / Unavailable providers list */}
              {unavailableProviders.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2 text-xs text-amber-800">
                  <div className="flex items-center space-x-2 font-bold mb-1">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span>Some carriers did not respond:</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-gray-600 font-medium">
                    {unavailableProviders.map((p, idx) => (
                      <li key={idx}>
                        <strong className="text-gray-800">{p.display_name}</strong>: {p.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Checkout / Booking Details */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardContent className="p-6 space-y-6">
              <h3 className="text-sm font-bold text-gray-900 border-b pb-2 flex items-center space-x-2">
                <Package className="h-4 w-4 text-[#8410DC]" />
                <span>Shipment Summary</span>
              </h3>

              {selectedQuote ? (
                <div className="space-y-4 text-sm">
                  <div className="flex flex-col p-4 bg-gray-50 border rounded-2xl border-gray-100">
                    <span className="text-xs text-gray-400 font-medium">Selected Courier</span>
                    <span className="font-extrabold text-gray-950 mt-1">{selectedQuote.display_name}</span>
                    <span className="text-[10px] text-gray-500 mt-0.5 capitalize">Service type: {selectedQuote.service_type}</span>
                  </div>

                  <div className="space-y-2 border-b pb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Freight Charge</span>
                      <span className="font-bold text-gray-900">₹{selectedQuote.price.toFixed(2)}</span>
                    </div>
                    {selectedQuote.cod_charge > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">COD Aggregator Fee</span>
                        <span className="font-bold text-gray-900">₹{selectedQuote.cod_charge.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-end">
                    <span className="font-bold text-gray-800">Total Price</span>
                    <span className="text-2xl font-black text-[#8410DC]">
                      ₹{(selectedQuote.price + selectedQuote.cod_charge).toFixed(2)}
                    </span>
                  </div>

                  {quoteExpiry && (
                    <div className="text-[10px] text-gray-400 italic text-center">
                      Rates expire in {Math.max(1, Math.round((new Date(quoteExpiry).getTime() - Date.now()) / 60000))} minutes
                    </div>
                  )}

                  {bookingError && (
                    <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 space-y-1">
                      <div className="flex items-center space-x-1.5 font-bold text-red-800">
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                        <span>Cannot Schedule Shipment</span>
                      </div>
                      <p className="font-medium text-red-600 pl-5">{bookingError}</p>
                    </div>
                  )}

                  <button
                    disabled={booking}
                    onClick={handleBookShipment}
                    className="w-full bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer disabled:bg-purple-300"
                  >
                    {booking ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Generating Waybill...</span>
                      </>
                    ) : (
                      <>
                        <span>Book & Pay ₹{(selectedQuote.price + (selectedQuote.cod_charge || 0)).toFixed(2)}</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Please select a shipping rate quote from the available network list to generate waybill and shipping label.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
