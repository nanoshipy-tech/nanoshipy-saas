'use strict';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import { generateWalkinReceipt } from '@/lib/generateWalkinReceipt';
import {
  Store, User, MapPin, Package, CreditCard, Printer, CheckCircle2,
  AlertCircle, ArrowRight, RefreshCw, Box, Truck, ShieldCheck,
  FileText, Sparkles, Plus, Copy, Check, Banknote, QrCode, CreditCard as CardIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import { resolveCourierLogo } from '@/lib/courierLogos';

interface RateQuote {
  courier_provider_id: string;
  display_name: string;
  logo_url?: string | null;
  service_type: string;
  price: number;
  cod_charge?: number;
  total_price?: number;
  delivery_days?: number;
  is_allocated?: boolean;
  allocation_badge?: string;
  routing_reason?: string;
}

interface PickupAddressOption {
  id: string;
  label: string;
  contact_name: string;
  contact_phone: string;
  address_line1: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
}

export function WalkinBookingForm() {
  const router = useRouter();

  // Step flow: 'input' -> 'rates' -> 'completed'
  const [step, setStep] = useState<'input' | 'rates' | 'completed'>('input');
  const [submitting, setSubmitting] = useState(false);
  const [bookingShipment, setBookingShipment] = useState(false);
  const [printingLabel, setPrintingLabel] = useState(false);
  const [printingReceipt, setPrintingReceipt] = useState(false);
  const [copiedAwb, setCopiedAwb] = useState(false);

  // Available store pickup locations
  const [pickupAddresses, setPickupAddresses] = useState<PickupAddressOption[]>([]);
  const [selectedPickupAddressId, setSelectedPickupAddressId] = useState<string>('');

  // Form State
  const [form, setForm] = useState({
    // Sender (Walk-in Customer)
    sender_name: '',
    sender_phone: '',
    sender_email: '',
    sender_address_line1: '',
    sender_address_line2: '',
    sender_city: '',
    sender_state: 'Tamil Nadu',
    sender_pincode: '',

    // Receiver (Consignee)
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    shipping_address_line1: '',
    shipping_address_line2: '',
    shipping_city: '',
    shipping_state: 'Tamil Nadu',
    shipping_pincode: '',

    // Package Details
    consignment_type: 'non_document' as 'document' | 'non_document',
    item_description: 'General Goods / Parcel',
    weight_kg: 0.5,
    length_cm: 10,
    width_cm: 10,
    height_cm: 10,
    order_value: 100,

    // Retail Counter Billing (Dynamic based on selected courier)
    amount_collected: 0,
    counter_payment_method: 'cash' as 'cash' | 'upi' | 'card' | 'to_pay',
    counter_notes: '',
  });

  // Created Order & Shipment State
  const [createdOrder, setCreatedOrder] = useState<any | null>(null);
  const [rates, setRates] = useState<RateQuote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<RateQuote | null>(null);
  const [bookedShipment, setBookedShipment] = useState<any | null>(null);

  // Quick weight presets
  const weightPresets = [0.25, 0.5, 1.0, 2.0, 5.0];

  // Load existing store pickup addresses on mount
  useEffect(() => {
    async function loadAddresses() {
      try {
        const res = await apiClient.get('/addresses?limit=50');
        const list = res.data?.data?.addresses || res.data?.addresses || [];
        setPickupAddresses(list);
        if (list.length > 0) {
          const defaultAddr = list.find((a: PickupAddressOption) => a.is_default) || list[0];
          setSelectedPickupAddressId(defaultAddr.id);
        }
      } catch (_) {}
    }
    loadAddresses();
  }, []);

  const handleFieldChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Auto-fill city/state for sender pincode
  const handleSenderPincodeChange = async (pin: string) => {
    handleFieldChange('sender_pincode', pin);
    if (pin.length === 6) {
      try {
        const res = await apiClient.get(`/location/pincode/${pin}`);
        const d = res.data?.data;
        if (d) {
          setForm((prev) => ({
            ...prev,
            sender_city: d.city || d.district || prev.sender_city,
            sender_state: d.state || prev.sender_state,
          }));
        }
      } catch (_) {}
    }
  };

  // Auto-fill city/state for receiver pincode
  const handleReceiverPincodeChange = async (pin: string) => {
    handleFieldChange('shipping_pincode', pin);
    if (pin.length === 6) {
      try {
        const res = await apiClient.get(`/location/pincode/${pin}`);
        const d = res.data?.data;
        if (d) {
          setForm((prev) => ({
            ...prev,
            shipping_city: d.city || d.district || prev.shipping_city,
            shipping_state: d.state || prev.shipping_state,
          }));
        }
      } catch (_) {}
    }
  };

  // When a quote is selected, AUTOMATICALLY set the Amount Collected based on this courier
  const handleSelectQuote = (quote: RateQuote) => {
    setSelectedQuote(quote);
    const suggestedPrice = Math.round(Number(quote.price || quote.total_price || 0) * 100) / 100;
    setForm((prev) => ({
      ...prev,
      amount_collected: suggestedPrice,
    }));
  };

  // Validate form
  const validateForm = () => {
    if (!form.sender_name.trim()) {
      toast.error('Sender (Walk-in Customer) name is required');
      return false;
    }
    if (!form.sender_phone.trim() || form.sender_phone.replace(/\D/g, '').length < 10) {
      toast.error('Valid 10-digit sender phone number is required');
      return false;
    }
    if (!form.sender_address_line1.trim() || !form.sender_city.trim() || !form.sender_pincode.trim()) {
      toast.error('Complete sender address (Address, City, 6-digit Pincode) is required');
      return false;
    }

    if (!form.customer_name.trim()) {
      toast.error('Receiver name is required');
      return false;
    }
    if (!form.customer_phone.trim() || form.customer_phone.replace(/\D/g, '').length < 10) {
      toast.error('Valid 10-digit receiver phone number is required');
      return false;
    }
    if (!form.shipping_address_line1.trim() || !form.shipping_city.trim() || !form.shipping_pincode.trim()) {
      toast.error('Complete receiver destination address is required');
      return false;
    }

    if (!form.weight_kg || form.weight_kg <= 0) {
      toast.error('Valid package weight in KG is required');
      return false;
    }

    return true;
  };

  // Step 1: Create Order & Fetch Available Courier Rates
  const handleProceedToCourierRates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      // 1. Resolve Store Dispatch Warehouse (Seller's registered warehouse)
      let pickupAddressId = selectedPickupAddressId;
      if (!pickupAddressId && pickupAddresses.length > 0) {
        const defaultAddr = pickupAddresses.find((a) => a.is_default) || pickupAddresses[0];
        pickupAddressId = defaultAddr.id;
        setSelectedPickupAddressId(pickupAddressId);
      }

      if (!pickupAddressId) {
        // Fetch existing warehouse list as final fallback without creating new records
        try {
          const listRes = await apiClient.get('/addresses?limit=10');
          const addrs = listRes.data?.data?.addresses || listRes.data?.addresses || [];
          if (addrs.length > 0) {
            const defaultAddr = addrs.find((a: any) => a.is_default) || addrs[0];
            pickupAddressId = defaultAddr.id;
            setSelectedPickupAddressId(pickupAddressId);
          }
        } catch (_) {}
      }

      if (!pickupAddressId) {
        throw new Error('No store pickup warehouse found. Please configure a warehouse in Settings > Pickup Addresses before booking.');
      }

      // 2. Create Order via Existing Order Endpoint with walk-in customer sender details
      let savedOrder = createdOrder;
      const orderRef = createdOrder?.order_reference || `WB-${Math.floor(100000 + Math.random() * 900000)}`;
      const orderPayload = {
        order_reference: orderRef,
        pickup_address_id: pickupAddressId,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone.replace(/\D/g, '').slice(-10),
        customer_email: form.customer_email || undefined,
        shipping_address_line1: form.shipping_address_line1,
        shipping_address_line2: form.shipping_address_line2 || undefined,
        shipping_city: form.shipping_city,
        shipping_state: form.shipping_state,
        shipping_pincode: form.shipping_pincode,
        shipping_country: 'India',
        sender_name: form.sender_name,
        sender_phone: form.sender_phone.replace(/\D/g, '').slice(-10),
        sender_address_line1: form.sender_address_line1,
        sender_address_line2: form.sender_address_line2 || undefined,
        sender_city: form.sender_city,
        sender_state: form.sender_state,
        sender_pincode: form.sender_pincode,
        booking_type: 'booking_office',
        consignment_type: form.consignment_type,
        is_walkin: true,
        amount_collected: parseFloat(String(form.amount_collected)) || 0,
        counter_amount_collected: parseFloat(String(form.amount_collected)) || 0,
        counter_payment_method: form.counter_payment_method,
        counter_notes: form.counter_notes || 'Walk-in Counter Customer',
        order_value: parseFloat(String(form.order_value)) || 100,
        payment_mode: form.counter_payment_method === 'to_pay' ? 'cod' : 'prepaid',
        weight_kg: parseFloat(String(form.weight_kg)) || 0.5,
        length_cm: parseFloat(String(form.length_cm)) || 10,
        width_cm: parseFloat(String(form.width_cm)) || 10,
        height_cm: parseFloat(String(form.height_cm)) || 10,
        items: [
          {
            product_name: form.item_description || (form.consignment_type === 'document' ? 'Documents / Letters' : 'General Goods / Parcel'),
            sku: 'WALKIN-ITEM',
            quantity: 1,
            unit_price: parseFloat(String(form.order_value)) || 100,
          },
        ],
      };

      if (!savedOrder) {
        const orderRes = await apiClient.post('/orders', orderPayload);
        savedOrder = orderRes.data?.data;
        setCreatedOrder(savedOrder);
      } else {
        const updateRes = await apiClient.put(`/orders/${savedOrder.id}`, orderPayload);
        savedOrder = updateRes.data?.data || savedOrder;
        setCreatedOrder(savedOrder);
      }

      toast.success('Calculating courier allocation & rates...');

      // 3. Query Rates via Existing Pricing Endpoint
      const ratesRes = await apiClient.post(`/orders/${savedOrder.id}/rates`);
      const fetchedRates: RateQuote[] = ratesRes.data?.data?.rates || [];

      // Auto-allocation: show only the single optimal courier as per routing rules
      // Backend enforces is_allocated=true for index 0 (top-ranked by routing & price)
      const allocated = fetchedRates.find((r) => r.is_allocated) || fetchedRates[0];
      setRates(allocated ? [allocated] : []);

      if (allocated) {
        handleSelectQuote(allocated);
      }

      setStep('rates');
    } catch (err: any) {
      console.error('Walkin order creation/rates failed:', err);
      toast.error(err.response?.data?.error?.message || err.message || 'Failed to fetch courier rates');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Confirm Shipment & Generate AWB
  const handleConfirmShipment = async () => {
    if (!createdOrder || !selectedQuote) return;
    setBookingShipment(true);
    try {
      // 1. Update order with final amount collected and counter payment mode
      const finalCollected = parseFloat(String(form.amount_collected)) || Number(selectedQuote.price);
      try {
        await apiClient.put(`/orders/${createdOrder.id}`, {
          amount_collected: finalCollected,
          counter_amount_collected: finalCollected,
          counter_payment_method: form.counter_payment_method,
          counter_notes: form.counter_notes,
          payment_mode: form.counter_payment_method === 'to_pay' ? 'cod' : 'prepaid',
          cod_amount: form.counter_payment_method === 'to_pay' ? finalCollected : 0,
        });
      } catch (_) {}

      // 2. Book shipment with assigned courier
      const res = await apiClient.post('/shipments', {
        order_id: createdOrder.id,
        courier_provider_id: selectedQuote.courier_provider_id,
        service_type: selectedQuote.service_type,
        quoted_rate: selectedQuote.price,
      });

      const shipment = res.data?.data;
      setBookedShipment(shipment);
      toast.success('Shipment booked successfully! AWB assigned.');
      setStep('completed');
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to book shipment');
    } finally {
      setBookingShipment(false);
    }
  };

  // Print Shipping Label
  const handlePrintShippingLabel = async () => {
    if (!bookedShipment) return;
    setPrintingLabel(true);
    try {
      const res = await apiClient.post(`/shipments/${bookedShipment.id}/label?format=4x6&force=true`);
      const url = res.data?.data?.label_url || bookedShipment.label_url;
      if (url) {
        window.open(url, '_blank');
      } else {
        toast.error('Label URL not ready yet');
      }
    } catch {
      if (bookedShipment.label_url) {
        window.open(bookedShipment.label_url, '_blank');
      } else {
        toast.error('Failed to generate shipping label');
      }
    } finally {
      setPrintingLabel(false);
    }
  };

  // Print Customer Receipt (A6 PDF with Code128 Barcode)
  const handlePrintCustomerReceipt = async () => {
    if (!createdOrder) return;
    setPrintingReceipt(true);
    try {
      await generateWalkinReceipt(createdOrder.id, { autoPrint: true });
    } finally {
      setPrintingReceipt(false);
    }
  };

  const resetFormForNextCustomer = () => {
    setCreatedOrder(null);
    setBookedShipment(null);
    setRates([]);
    setSelectedQuote(null);
    setForm({
      sender_name: '',
      sender_phone: '',
      sender_email: '',
      sender_address_line1: '',
      sender_address_line2: '',
      sender_city: '',
      sender_state: 'Tamil Nadu',
      sender_pincode: '',
      customer_name: '',
      customer_phone: '',
      customer_email: '',
      shipping_address_line1: '',
      shipping_address_line2: '',
      shipping_city: '',
      shipping_state: 'Tamil Nadu',
      shipping_pincode: '',
      consignment_type: 'non_document',
      item_description: 'General Goods / Parcel',
      weight_kg: 0.5,
      length_cm: 10,
      width_cm: 10,
      height_cm: 10,
      order_value: 100,
      amount_collected: 0,
      counter_payment_method: 'cash',
      counter_notes: '',
    });
    setStep('input');
  };

  // -------------------------------------------------------------
  // VIEW: STEP 3 - COMPLETED (Print Actions)
  // -------------------------------------------------------------
  if (step === 'completed' && bookedShipment) {
    return (
      <div className="max-w-2xl mx-auto py-8 space-y-6 animate-in fade-in duration-300">
        <div className="bg-white border border-slate-200/90 rounded-3xl p-8 text-center shadow-xl space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
            <CheckCircle2 className="w-10 h-10 animate-bounce" style={{ animationDuration: '2s' }} />
          </div>

          <div className="space-y-1.5">
            <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase bg-emerald-100 text-emerald-800 tracking-wider">
              Walk-in Booking Confirmed
            </span>
            <h2 className="text-2xl font-black text-slate-900 mt-2">Retail Courier Parcel Booked!</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Waybill AWB number has been assigned and registered with the carrier. Print the receipt for the customer and attach the shipping label to the parcel.
            </p>
          </div>

          {/* Details Card */}
          <div className="bg-slate-50 rounded-2xl p-5 max-w-lg mx-auto border border-slate-200 text-left space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-bold">Booking Reference</span>
              <span className="font-mono font-black text-slate-900">{createdOrder?.order_reference}</span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-bold">Tracking AWB #</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-base text-purple-700 select-all">
                  {bookedShipment.awb_number}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(bookedShipment.awb_number);
                    setCopiedAwb(true);
                    setTimeout(() => setCopiedAwb(false), 2000);
                  }}
                  className="p-1 rounded hover:bg-slate-200 text-slate-600 transition"
                  title="Copy AWB"
                >
                  {copiedAwb ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-bold">Assigned Carrier</span>
              <span className="font-extrabold text-slate-900">{selectedQuote?.display_name || 'Assigned Courier'}</span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-bold">Sender (Customer)</span>
              <span className="font-bold text-slate-800">{form.sender_name} ({form.sender_phone})</span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-bold">Consignee Destination</span>
              <span className="font-bold text-slate-800">{form.shipping_city}, {form.shipping_state} ({form.shipping_pincode})</span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-500 font-bold">Retail Amount Collected</span>
              <span className="font-black text-base text-emerald-700">
                ₹{parseFloat(String(form.amount_collected)).toFixed(2)} ({form.counter_payment_method.toUpperCase()})
              </span>
            </div>
          </div>

          {/* TWO PRIMARY PRINT ACTIONS */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={handlePrintCustomerReceipt}
              disabled={printingReceipt}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
            >
              <Printer className="w-4 h-4" />
              <span>{printingReceipt ? 'Generating Receipt...' : 'Print Customer Receipt (PDF)'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrintShippingLabel}
              disabled={printingLabel}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] text-white font-extrabold text-xs shadow-md shadow-purple-900/20 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
            >
              <Box className="w-4 h-4" />
              <span>{printingLabel ? 'Loading Label...' : 'Print Shipping Label'}</span>
            </button>
          </div>

          {/* Next Action */}
          <div className="border-t border-slate-200/80 pt-4">
            <button
              type="button"
              onClick={resetFormForNextCustomer}
              className="text-xs font-black text-purple-700 hover:text-purple-900 hover:underline inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Book Another Walk-in Parcel for Next Customer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: STEP 2 - AUTO-ALLOCATED COURIER & RETAIL COUNTER COLLECTION
  // -------------------------------------------------------------
  if (step === 'rates') {
    const courierCost = Number(selectedQuote?.price || 0);
    const retailCollected = parseFloat(String(form.amount_collected)) || courierCost;
    const margin = Math.max(0, retailCollected - courierCost);

    return (
      <div className="max-w-3xl mx-auto py-6 space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-xl font-black text-slate-900">Auto-Allocated Courier</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ref: <span className="font-mono font-bold text-slate-800">{createdOrder?.order_reference}</span> • Route: {form.sender_city} ({form.sender_pincode}) → {form.shipping_city} ({form.shipping_pincode}) • <span className="text-[#8410DC] font-semibold">Auto-routed by network rules</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStep('input')}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          >
            ← Back to Form
          </button>
        </div>

        {rates.length === 0 ? (
          <div className="p-8 text-center bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
            <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
            <p className="font-bold text-amber-900 text-sm">No Active Rates Available</p>
            <p className="text-xs text-amber-700">Please verify destination pincode and serviceable carriers.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Single Auto-Allocated Courier Card */}
            {rates.map((r) => (
              <div
                key={`${r.courier_provider_id}-${r.service_type}`}
                className="p-5 rounded-2xl border-2 border-[#8410DC] bg-purple-50/50 shadow-md ring-2 ring-[#8410DC]/20 relative"
              >
                {/* Auto-Allocation Badge */}
                <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {r.allocation_badge || '⚡ Auto-Allocated Route'}
                </span>

                <div className="flex items-center gap-4">
                  {(() => {
                    const logoSrc = resolveCourierLogo(r.display_name, r.logo_url, r.service_type);
                    if (logoSrc) {
                      return (
                        <div className="w-16 h-12 rounded-xl bg-white border border-purple-200 shadow-xs flex items-center justify-center p-1.5 shrink-0 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={logoSrc}
                            alt={`${r.display_name} logo`}
                            className="object-contain w-full h-full"
                          />
                        </div>
                      );
                    }
                    return (
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-[#8410DC] text-white">
                        <Truck className="w-6 h-6" />
                      </div>
                    );
                  })()}
                  <div>
                    <h4 className="font-black text-base text-slate-900">{r.display_name}</h4>
                    <p className="text-[11px] text-slate-500 uppercase font-bold">
                      {r.service_type} • {r.delivery_days ? `${r.delivery_days} days` : 'Express Service'}
                    </p>
                  </div>
                </div>

                {r.routing_reason && (
                  <div className="mt-3 p-3 bg-purple-100/60 rounded-xl text-xs text-purple-900 font-medium">
                    <span className="font-black text-[#5B069A]">Routing Reason: </span>{r.routing_reason}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-bold">Carrier Rate:</span>
                  <span className="font-black text-xl text-[#8410DC]">₹{r.price.toFixed(2)}</span>
                </div>
              </div>
            ))}

            {/* DYNAMIC RETAIL COUNTER COLLECTION CARD (BASED ON AUTO-ALLOCATED COURIER) */}
            {selectedQuote && (
              <div className="bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/40 border-2 border-emerald-300 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-emerald-200/80 pb-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-emerald-700" />
                    <div>
                      <h3 className="font-black text-sm text-emerald-950">
                        Counter Collection for {selectedQuote.display_name}
                      </h3>
                      <p className="text-[11px] text-emerald-800 font-medium">
                        Amount to be collected from the walk-in customer based on the auto-allocated courier.
                      </p>
                    </div>
                  </div>
                  {margin > 0 && (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-200 text-emerald-900">
                      Margin: +₹{margin.toFixed(2)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Amount to collect input */}
                  <div>
                    <label className="block text-xs font-black text-slate-800 mb-1">
                      Amount Collected from Customer (₹) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-base font-black text-emerald-700">₹</span>
                      <input
                        type="number"
                        step="1"
                        required
                        value={form.amount_collected}
                        onChange={(e) => handleFieldChange('amount_collected', parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border-2 border-emerald-400 rounded-xl pl-8 pr-4 py-2 text-lg font-black text-emerald-950 focus:outline-none focus:border-emerald-600 shadow-xs"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium mt-1">
                      Defaulted to auto-allocated courier rate ₹{courierCost.toFixed(2)}. Adjust if charging extra counter fee.
                    </p>
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="block text-xs font-black text-slate-800 mb-1">
                      Counter Payment Method *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'cash', label: 'Cash in Hand', icon: Banknote },
                        { id: 'upi', label: 'UPI / QR', icon: QrCode },
                        { id: 'card', label: 'Card Swipe', icon: CardIcon },
                        { id: 'to_pay', label: 'To-Pay (COD)', icon: Truck },
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleFieldChange('counter_payment_method', m.id)}
                          className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                            form.counter_payment_method === m.id
                              ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <m.icon className="w-3.5 h-3.5" />
                          <span>{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Optional Counter Notes */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Counter Clerk Notes (Optional)</label>
                  <input
                    type="text"
                    value={form.counter_notes}
                    onChange={(e) => handleFieldChange('counter_notes', e.target.value)}
                    placeholder="e.g. Paid in cash at counter, parcel received in good condition"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>
            )}

            {/* Confirm & Book Shipment Button */}
            <button
              type="button"
              disabled={!selectedQuote || bookingShipment}
              onClick={handleConfirmShipment}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] text-white font-extrabold text-sm shadow-md shadow-purple-900/30 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              {bookingShipment ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Allocating AWB & Booking Shipment...</span>
                </>
              ) : (
                <>
                  <span>Confirm & Generate Waybill AWB (Collect ₹{retailCollected.toFixed(2)})</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: STEP 1 - INPUT FORM (Dual Manual Sender & Receiver)
  // -------------------------------------------------------------
  return (
    <form onSubmit={handleProceedToCourierRates} className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-950 text-white flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-[#D6A8FF] shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight">Retail Counter Walk-in Parcel Booking</h2>
            <p className="text-[11px] text-[#D6A8FF]/80 font-medium">
              Manual origin sender & destination receiver entry. Rates & retail collection are dynamically computed upon carrier selection.
            </p>
          </div>
        </div>
        <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
          Booking Office Active
        </span>
      </div>

      {/* Booking Office Store Dispatch Warehouse */}
      {pickupAddresses.length > 0 && (
        <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-[#8410DC]" />
            <div>
              <span className="font-black text-slate-900">Store Dispatch Warehouse: </span>
              <span className="text-slate-600 font-medium">Couriers will collect the parcel from this constant seller warehouse.</span>
            </div>
          </div>
          {pickupAddresses.length > 1 ? (
            <select
              value={selectedPickupAddressId}
              onChange={(e) => setSelectedPickupAddressId(e.target.value)}
              className="bg-white border border-purple-300 rounded-xl px-3 py-1.5 font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
            >
              {pickupAddresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} ({a.city} - {a.pincode}) {a.is_default ? '★ Default' : ''}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-1.5 font-bold text-purple-900 bg-purple-100/80 px-3 py-1.5 rounded-xl border border-purple-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-700" />
              <span>
                {pickupAddresses[0]?.label} ({pickupAddresses[0]?.city} - {pickupAddresses[0]?.pincode})
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD 1: SENDER (WALK-IN CUSTOMER) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-[#8410DC]" /> Sender (Walk-in Customer)
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Origin Details</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Customer / Sender Full Name *</label>
              <input
                type="text"
                required
                value={form.sender_name}
                onChange={(e) => handleFieldChange('sender_name', e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC] focus:bg-white transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Mobile Phone *</label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={form.sender_phone}
                  onChange={(e) => handleFieldChange('sender_phone', e.target.value)}
                  placeholder="10-digit mobile"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC] focus:bg-white transition"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Sender Email (Optional)</label>
                <input
                  type="email"
                  value={form.sender_email}
                  onChange={(e) => handleFieldChange('sender_email', e.target.value)}
                  placeholder="sender@gmail.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC] focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Street Address Line 1 *</label>
              <input
                type="text"
                required
                value={form.sender_address_line1}
                onChange={(e) => handleFieldChange('sender_address_line1', e.target.value)}
                placeholder="Door No, Street Name, Building"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC] focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Area / Landmark (Optional)</label>
              <input
                type="text"
                value={form.sender_address_line2}
                onChange={(e) => handleFieldChange('sender_address_line2', e.target.value)}
                placeholder="Near Bus Stand, Opposite Bank"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC] focus:bg-white transition"
              />
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Pincode *</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={form.sender_pincode}
                  onChange={(e) => handleSenderPincodeChange(e.target.value)}
                  placeholder="600001"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#8410DC] focus:bg-white transition"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">City *</label>
                <input
                  type="text"
                  required
                  value={form.sender_city}
                  onChange={(e) => handleFieldChange('sender_city', e.target.value)}
                  placeholder="Chennai"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC] focus:bg-white transition"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">State *</label>
                <input
                  type="text"
                  required
                  value={form.sender_state}
                  onChange={(e) => handleFieldChange('sender_state', e.target.value)}
                  placeholder="Tamil Nadu"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC] focus:bg-white transition"
                />
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: RECEIVER (CONSIGNEE) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600" /> Receiver (Consignee)
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Destination Details</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Receiver Full Name *</label>
              <input
                type="text"
                required
                value={form.customer_name}
                onChange={(e) => handleFieldChange('customer_name', e.target.value)}
                placeholder="e.g. Priya Sundaram"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC] focus:bg-white transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Receiver Mobile *</label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={form.customer_phone}
                  onChange={(e) => handleFieldChange('customer_phone', e.target.value)}
                  placeholder="10-digit mobile"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC] focus:bg-white transition"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Receiver Email (Optional)</label>
                <input
                  type="email"
                  value={form.customer_email}
                  onChange={(e) => handleFieldChange('customer_email', e.target.value)}
                  placeholder="receiver@gmail.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC] focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Delivery Address Line 1 *</label>
              <input
                type="text"
                required
                value={form.shipping_address_line1}
                onChange={(e) => handleFieldChange('shipping_address_line1', e.target.value)}
                placeholder="Plot / Flat No, Street, Colony"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC] focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Area / Landmark (Optional)</label>
              <input
                type="text"
                value={form.shipping_address_line2}
                onChange={(e) => handleFieldChange('shipping_address_line2', e.target.value)}
                placeholder="Near Temple / Metro Station"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC] focus:bg-white transition"
              />
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Destination Pincode *</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={form.shipping_pincode}
                  onChange={(e) => handleReceiverPincodeChange(e.target.value)}
                  placeholder="641001"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#8410DC] focus:bg-white transition"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">City *</label>
                <input
                  type="text"
                  required
                  value={form.shipping_city}
                  onChange={(e) => handleFieldChange('shipping_city', e.target.value)}
                  placeholder="Coimbatore"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC] focus:bg-white transition"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">State *</label>
                <input
                  type="text"
                  required
                  value={form.shipping_state}
                  onChange={(e) => handleFieldChange('shipping_state', e.target.value)}
                  placeholder="Tamil Nadu"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC] focus:bg-white transition"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CARD 3: PACKAGE & CONSIGNMENT SPECS */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-600" /> Package Specifications
          </h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase">Weight & Dimensions</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Consignment Type</label>
                <select
                  value={form.consignment_type}
                  onChange={(e) => handleFieldChange('consignment_type', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                >
                  <option value="non_document">Parcel / Non-Document</option>
                  <option value="document">Document / Letter</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Contents Description</label>
                <input
                  type="text"
                  value={form.item_description}
                  onChange={(e) => handleFieldChange('item_description', e.target.value)}
                  placeholder="e.g. Books, Clothes, Letter"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700">Package Weight (KG) *</label>
                <div className="flex items-center gap-1.5">
                  {weightPresets.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => handleFieldChange('weight_kg', w)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                        form.weight_kg === w
                          ? 'bg-purple-100 text-purple-800 border border-purple-300'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {w} kg
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                step="0.01"
                min="0.05"
                required
                value={form.weight_kg}
                onChange={(e) => handleFieldChange('weight_kg', parseFloat(e.target.value) || 0.1)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-black text-slate-900 focus:outline-none focus:border-[#8410DC]"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Dimensions (L × W × H in cm)</label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min="1"
                  value={form.length_cm}
                  onChange={(e) => handleFieldChange('length_cm', parseFloat(e.target.value) || 10)}
                  placeholder="L"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                />
                <input
                  type="number"
                  min="1"
                  value={form.width_cm}
                  onChange={(e) => handleFieldChange('width_cm', parseFloat(e.target.value) || 10)}
                  placeholder="W"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                />
                <input
                  type="number"
                  min="1"
                  value={form.height_cm}
                  onChange={(e) => handleFieldChange('height_cm', parseFloat(e.target.value) || 10)}
                  placeholder="H"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Declared Consignment Value (₹)</label>
              <input
                type="number"
                value={form.order_value}
                onChange={(e) => handleFieldChange('order_value', parseFloat(e.target.value) || 100)}
                placeholder="100"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#8410DC]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* SUBMIT BUTTON */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={resetFormForNextCustomer}
          className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
        >
          Clear Form
        </button>

        <button
          type="submit"
          disabled={submitting}
          className="px-8 py-3.5 bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] text-white font-extrabold text-xs rounded-xl shadow-md shadow-purple-900/30 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
        >
          {submitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Calculating Rates & Routing...</span>
            </>
          ) : (
            <>
              <span>Proceed to Courier Rates & Allocation</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
