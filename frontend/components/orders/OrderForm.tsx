import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '../../lib/apiClient';
import { validateOrder, OrderInput, OrderItemInput } from '../../lib/orderValidators';
import { OrderItemsEditor } from './OrderItemsEditor';
import { Alert } from '../ui/Alert';
import { Card, CardContent } from '../ui/Card';
import { MapPin, Truck, ShieldCheck, Box, User, CreditCard, Plus, CheckCircle2, AlertTriangle, X, Loader2, Search, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface Address {
  id: string;
  label: string;
  city?: string;
  state?: string;
  pincode?: string;
  is_default: boolean;
}

interface OrderFormProps {
  initialValues?: Partial<OrderInput>;
  orderId?: string;
  onSubmitSuccess?: () => void;
}

export const OrderForm: React.FC<OrderFormProps> = ({ initialValues, orderId, onSubmitSuccess }) => {
  const router = useRouter();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [form, setForm] = useState<Partial<OrderInput>>({
    order_reference: initialValues?.order_reference || `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
    pickup_address_id: '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    shipping_address_line1: '',
    shipping_address_line2: '',
    shipping_city: '',
    shipping_state: '',
    shipping_pincode: '',
    shipping_country: 'India',
    payment_mode: 'prepaid',
    cod_amount: 0,
    weight_kg: 0.5,
    length_cm: 10,
    width_cm: 10,
    height_cm: 10,
    items: [
      { product_name: '', sku: '', quantity: 1, unit_price: 0 }
    ],
    ...initialValues,
  });

  // Local string states for smooth numeric input without jumping to 0
  const [weightStr, setWeightStr] = useState<string>(String(initialValues?.weight_kg ?? 0.5));
  const [lengthStr, setLengthStr] = useState<string>(String(initialValues?.length_cm ?? 10));
  const [widthStr, setWidthStr] = useState<string>(String(initialValues?.width_cm ?? 10));
  const [heightStr, setHeightStr] = useState<string>(String(initialValues?.height_cm ?? 10));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [pincodeVerifiedInfo, setPincodeVerifiedInfo] = useState<string | null>(null);

  // Google Places Autocomplete States (Delivery Address)
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{
    description: string;
    place_id: string;
    main_text?: string;
    secondary_text?: string;
  }>>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const [autofillSuccessMsg, setAutofillSuccessMsg] = useState<string | null>(null);

  // Google Places Autocomplete States (Pickup Address Modal)
  const [modalAddressSuggestions, setModalAddressSuggestions] = useState<Array<{
    description: string;
    place_id: string;
    main_text?: string;
    secondary_text?: string;
  }>>([]);
  const [isSearchingModalAddress, setIsSearchingModalAddress] = useState(false);
  const [showModalAddressDropdown, setShowModalAddressDropdown] = useState(false);

  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const modalSearchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Quick Add Pickup Address Modal State
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: 'Primary Warehouse',
    contact_name: 'Warehouse Manager',
    contact_phone: '',
    address_line1: '',
    city: '',
    state: '',
    pincode: '',
    is_default: true,
  });

  const loadAddresses = async () => {
    try {
      const { data } = await apiClient.get('/addresses?limit=100');
      const addrList = data?.data?.addresses || data?.addresses || [];
      setAddresses(addrList);
      if (!form.pickup_address_id && addrList.length > 0) {
        const def = addrList.find((a: Address) => a.is_default) || addrList[0];
        setForm(prev => ({ ...prev, pickup_address_id: def.id }));
      }
    } catch (err) {
      console.error('Failed to load pickup addresses', err);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  // Determine if current delivery is Tamil Nadu
  const isTamilNadu = (() => {
    const pin = form.shipping_pincode || '';
    const state = (form.shipping_state || '').toLowerCase();
    if (state.includes('tamil') || state === 'tn') return true;
    const pinNum = parseInt(pin, 10);
    return !isNaN(pinNum) && pinNum >= 600000 && pinNum <= 643999;
  })();

  // Handle Address Autocomplete Search
  const searchPlaces = async (query: string, isModal = false) => {
    if (!query || query.trim().length < 2) {
      if (isModal) {
        setModalAddressSuggestions([]);
        setShowModalAddressDropdown(false);
      } else {
        setAddressSuggestions([]);
        setShowAddressDropdown(false);
      }
      return;
    }

    if (isModal) {
      setIsSearchingModalAddress(true);
    } else {
      setIsSearchingAddress(true);
    }

    try {
      const res = await apiClient.get(`/location/places-autocomplete?input=${encodeURIComponent(query.trim())}`);
      const predictions = res.data?.predictions || [];
      if (isModal) {
        setModalAddressSuggestions(predictions);
        setShowModalAddressDropdown(predictions.length > 0);
      } else {
        setAddressSuggestions(predictions);
        setShowAddressDropdown(predictions.length > 0);
      }
    } catch (err) {
      console.error('Failed to fetch address suggestions', err);
    } finally {
      if (isModal) {
        setIsSearchingModalAddress(false);
      } else {
        setIsSearchingAddress(false);
      }
    }
  };

  const handleAddressInputChange = (val: string, isModal = false) => {
    if (isModal) {
      setNewAddress(prev => ({ ...prev, address_line1: val }));
      if (modalSearchTimeoutRef.current) clearTimeout(modalSearchTimeoutRef.current);
      modalSearchTimeoutRef.current = setTimeout(() => {
        searchPlaces(val, true);
      }, 250);
    } else {
      handleFieldChange('shipping_address_line1', val);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        searchPlaces(val, false);
      }, 250);
    }
  };

  // Select place from autocomplete
  const selectPlace = async (place: { place_id: string; description: string; main_text?: string }, isModal = false) => {
    try {
      if (isModal) {
        setShowModalAddressDropdown(false);
        setIsSearchingModalAddress(true);
      } else {
        setShowAddressDropdown(false);
        setIsSearchingAddress(true);
      }

      const res = await apiClient.get(`/location/place-details?place_id=${encodeURIComponent(place.place_id)}`);
      const data = res.data?.data;

      if (data) {
        if (isModal) {
          setNewAddress(prev => ({
            ...prev,
            address_line1: data.street_address || place.main_text || place.description,
            city: data.city || prev.city,
            state: data.state || prev.state,
            pincode: data.pincode || prev.pincode,
          }));
        } else {
          setForm(prev => ({
            ...prev,
            shipping_address_line1: data.street_address || place.main_text || place.description,
            shipping_address_line2: data.area_landmark || prev.shipping_address_line2,
            shipping_city: data.city || prev.shipping_city,
            shipping_state: data.state || prev.shipping_state,
            shipping_pincode: data.pincode || prev.shipping_pincode,
          }));
          setAutofillSuccessMsg(`Address autofilled: ${data.city ? data.city + ', ' : ''}${data.state}`);
          if (data.pincode) {
            setPincodeVerifiedInfo(`${data.city || 'Verified'}, ${data.state}`);
          }
          setTimeout(() => setAutofillSuccessMsg(null), 4000);
        }
      } else {
        if (isModal) {
          setNewAddress(prev => ({ ...prev, address_line1: place.description }));
        } else {
          setForm(prev => ({ ...prev, shipping_address_line1: place.description }));
        }
      }
    } catch (err) {
      console.error('Error fetching place details', err);
      if (isModal) {
        setNewAddress(prev => ({ ...prev, address_line1: place.description }));
      } else {
        setForm(prev => ({ ...prev, shipping_address_line1: place.description }));
      }
    } finally {
      if (isModal) {
        setIsSearchingModalAddress(false);
      } else {
        setIsSearchingAddress(false);
      }
    }
  };

  const handlePincodeChange = async (pincode: string) => {
    handleFieldChange('shipping_pincode', pincode);
    setPincodeVerifiedInfo(null);

    // Auto-lookup city/state if 6 digits
    if (/^[1-9][0-9]{5}$/.test(pincode.trim())) {
      setLookupLoading(true);
      try {
        const res = await apiClient.get(`/location/pincode/${pincode.trim()}`);
        if (res.data?.data) {
          const { city, district, state } = res.data.data;
          const detectedCity = city || district;
          const detectedState = state;
          setForm(prev => ({
            ...prev,
            shipping_city: detectedCity || prev.shipping_city,
            shipping_state: detectedState || prev.shipping_state,
          }));
          setPincodeVerifiedInfo(`${detectedCity ? detectedCity + ', ' : ''}${detectedState}`);
        }
      } catch {
        // Fallback Tamil Nadu detection by range
        const pNum = parseInt(pincode, 10);
        if (pNum >= 600000 && pNum <= 643999) {
          setForm(prev => ({ ...prev, shipping_state: prev.shipping_state || 'Tamil Nadu' }));
          setPincodeVerifiedInfo('Tamil Nadu');
        }
      } finally {
        setLookupLoading(false);
      }
    }
  };

  const handleFieldChange = (field: keyof OrderInput, val: any) => {
    setForm(prev => {
      const next = { ...prev, [field]: val };
      // Sync cod_amount with order value estimate if switching payment mode
      if (field === 'payment_mode' && val === 'cod' && prev.items) {
        const total = prev.items.reduce((sum, item) => sum + (item.quantity * item.unit_price || 0), 0);
        next.cod_amount = total;
      }
      return next;
    });
    // Clear validation error when editing field
    if (errors[field]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const handlePhoneBlur = () => {
    if (!form.customer_phone) return;
    // Clean up spaces, dashes, leading 0 or +91
    let raw = form.customer_phone.replace(/\D/g, '');
    if (raw.length === 12 && raw.startsWith('91')) {
      raw = raw.slice(2);
    } else if (raw.length === 11 && raw.startsWith('0')) {
      raw = raw.slice(1);
    }
    if (raw.length === 10) {
      handleFieldChange('customer_phone', raw);
    }
  };

  const handleItemsChange = (items: OrderItemInput[]) => {
    setForm(prev => {
      const next = { ...prev, items };
      if (prev.payment_mode === 'cod') {
        const total = items.reduce((sum, item) => sum + (item.quantity * item.unit_price || 0), 0);
        next.cod_amount = total;
      }
      return next;
    });
  };

  const handleCreatePickupAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddress.address_line1 || !newAddress.city || !newAddress.state || !newAddress.pincode || !newAddress.contact_phone) {
      toast.error('Please fill all required warehouse address fields');
      return;
    }
    setAddressLoading(true);
    try {
      const res = await apiClient.post('/addresses', {
        ...newAddress,
        country: 'India',
      });
      const created = res.data?.data;
      toast.success('Pickup address added successfully!');
      setShowAddressModal(false);
      await loadAddresses();
      if (created?.id) {
        setForm(prev => ({ ...prev, pickup_address_id: created.id }));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to create pickup address');
    } finally {
      setAddressLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent, shipNow: boolean = false) => {
    e.preventDefault();
    setServerError(null);

    // Ensure customer phone is sanitized
    const cleanedPhone = (form.customer_phone || '').replace(/[\s\-]/g, '');

    const payload: Partial<OrderInput> = {
      ...form,
      customer_phone: cleanedPhone,
      weight_kg: parseFloat(weightStr) || form.weight_kg || 0.5,
      length_cm: parseFloat(lengthStr) || form.length_cm || 10,
      width_cm: parseFloat(widthStr) || form.width_cm || 10,
      height_cm: parseFloat(heightStr) || form.height_cm || 10,
    };

    const validation = validateOrder(payload);
    if (!validation.isValid) {
      setErrors(validation.errors);
      const firstErr = Object.values(validation.errors)[0];
      if (firstErr) {
        toast.error(`Please review form: ${firstErr}`);
      }
      return;
    }

    setLoading(true);
    try {
      let targetOrderId = orderId;
      if (orderId) {
        await apiClient.put(`/orders/${orderId}`, payload);
        toast.success('Order updated successfully!');
      } else {
        const res = await apiClient.post('/orders', payload);
        targetOrderId = res.data?.data?.id;
        toast.success('Order created successfully!');
      }

      if (onSubmitSuccess) {
        onSubmitSuccess();
      } else if (shipNow && targetOrderId) {
        // Direct jump into courier selection and immediate shipping
        router.push(`/orders/${targetOrderId}/ship`);
      } else {
        router.push('/orders');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to save order';
      setServerError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const orderTotalValue = (form.items || []).reduce(
    (sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)),
    0
  );

  return (
    <>
      <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-6">
        {serverError && (
          <Alert type="error" message={serverError} />
        )}

        {/* Warning if no pickup warehouse exists */}
        {addresses.length === 0 && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-amber-900 dark:text-amber-200">No Pickup Warehouse Address Found</p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Every order requires a pickup warehouse origin address so couriers know where to collect the package.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAddressModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] text-white rounded-xl font-bold text-xs shadow-sm transition shrink-0 cursor-pointer"
            >
              + Add Warehouse Now
            </button>
          </div>
        )}

        {/* Geo-Routing Allocation Banner */}
        {form.shipping_pincode && form.shipping_pincode.length === 6 && (
          <div className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
            isTamilNadu
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
              : 'bg-purple-500/10 border-purple-500/30 text-purple-900 dark:text-purple-300'
          }`}>
            <div className="flex items-center space-x-3">
              <Truck className={`h-5 w-5 flex-shrink-0 ${isTamilNadu ? 'text-emerald-600' : 'text-[#8410DC]'}`} />
              <div>
                <span className="font-semibold text-sm">
                  {isTamilNadu ? 'Tamil Nadu Delivery Pincode' : 'Interstate Delivery Pincode'}
                </span>
                <p className="text-xs opacity-90">
                  {isTamilNadu
                    ? 'Auto-allocated to Tamil Nadu Regional Network (ST Courier) for maximum speed and lowest intra-state rate.'
                    : 'Auto-allocated to National Express Network (Delhivery, Blue Dart, Xpressbees) for reliable pan-India reach.'}
                </p>
              </div>
            </div>
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full uppercase tracking-wider ${
              isTamilNadu
                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                : 'bg-purple-500/20 text-purple-800 dark:text-purple-300 border border-purple-500/40'
            }`}>
              {isTamilNadu ? 'ST Courier Network' : 'National Express Network'}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - order references, shipping address & items */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pickup & Order Info */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.06] pb-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-[#8410DC]" />
                    <h2 className="text-base font-semibold text-slate-800 dark:text-white">Pickup Location & Reference</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddressModal(true)}
                    className="text-xs font-semibold text-[#8410DC] hover:text-[#5B069A] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add New Warehouse</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Order Reference / ID *</label>
                      <button
                        type="button"
                        onClick={() => handleFieldChange('order_reference', `ORD-${Math.floor(100000 + Math.random() * 900000)}`)}
                        className="text-xs font-medium text-[#8410DC] hover:text-[#5B069A] dark:text-[#D6A8FF] hover:underline cursor-pointer"
                      >
                        Auto-generate
                      </button>
                    </div>
                    <input
                      type="text"
                      value={form.order_reference}
                      onChange={(e) => handleFieldChange('order_reference', e.target.value)}
                      placeholder="e.g. ORD-10023, #4920"
                      className={`w-full text-sm rounded-lg border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-slate-900 dark:text-white shadow-sm focus:ring-purple-500 focus:border-purple-500 p-2.5 border outline-none ${errors.order_reference ? 'border-red-500 dark:border-red-500/50' : ''}`}
                    />
                    {errors.order_reference && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{errors.order_reference}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pickup Location / Warehouse *</label>
                    <select
                      value={form.pickup_address_id}
                      onChange={(e) => handleFieldChange('pickup_address_id', e.target.value)}
                      className={`w-full text-sm rounded-lg border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-slate-900 dark:text-white shadow-sm focus:ring-purple-500 focus:border-purple-500 p-2.5 border outline-none ${errors.pickup_address_id ? 'border-red-500 dark:border-red-500/50' : ''}`}
                    >
                      <option value="">Select pickup address</option>
                      {addresses.map(addr => (
                        <option key={addr.id} value={addr.id}>
                          {addr.label} {addr.city ? `(${addr.city})` : ''} {addr.is_default ? '(Default)' : ''}
                        </option>
                      ))}
                    </select>
                    {errors.pickup_address_id && <p className="text-xs text-red-500 mt-1">{errors.pickup_address_id}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customer & Delivery Address */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-white/[0.06] pb-3 mb-4">
                  <User className="h-4 w-4 text-[#8410DC]" />
                  <h2 className="text-base font-semibold text-slate-800 dark:text-white">Customer & Delivery Address</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Customer Name *</label>
                    <input
                      type="text"
                      value={form.customer_name}
                      onChange={(e) => handleFieldChange('customer_name', e.target.value)}
                      placeholder="Recipient Full Name"
                      className={`w-full text-sm rounded-lg border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-slate-900 dark:text-white shadow-sm focus:ring-purple-500 focus:border-purple-500 p-2.5 border outline-none ${errors.customer_name ? 'border-red-500 dark:border-red-500/50' : ''}`}
                    />
                    {errors.customer_name && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{errors.customer_name}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mobile Number *</label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={form.customer_phone}
                        onChange={(e) => handleFieldChange('customer_phone', e.target.value)}
                        onBlur={handlePhoneBlur}
                        placeholder="10-digit Mobile No."
                        className={`w-full text-sm rounded-lg border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-slate-900 dark:text-white shadow-sm focus:ring-purple-500 focus:border-purple-500 p-2.5 border outline-none ${errors.customer_phone ? 'border-red-500 dark:border-red-500/50' : ''}`}
                      />
                    </div>
                    {errors.customer_phone && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{errors.customer_phone}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Customer Email <span className="text-xs text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="email"
                      value={form.customer_email}
                      onChange={(e) => handleFieldChange('customer_email', e.target.value)}
                      placeholder="customer@example.com (for live SMS & email tracking updates)"
                      className={`w-full text-sm rounded-lg border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-slate-900 dark:text-white shadow-sm focus:ring-purple-500 focus:border-purple-500 p-2.5 border outline-none ${errors.customer_email ? 'border-red-500 dark:border-red-500/50' : ''}`}
                    />
                    {errors.customer_email && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{errors.customer_email}</p>}
                  </div>

                  <div className="sm:col-span-2 relative">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Street Address Line 1 *
                      </label>
                      <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#8410DC]" /> Google Maps Autocomplete
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={form.shipping_address_line1}
                        onChange={(e) => handleAddressInputChange(e.target.value, false)}
                        onFocus={() => {
                          if (addressSuggestions.length > 0) setShowAddressDropdown(true);
                        }}
                        placeholder="Type address, building, colony, or area for suggestions..."
                        className={`w-full text-sm rounded-lg border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-slate-900 dark:text-white shadow-sm focus:ring-purple-500 focus:border-purple-500 p-2.5 pr-10 border outline-none ${errors.shipping_address_line1 ? 'border-red-500 dark:border-red-500/50' : ''}`}
                      />
                      <div className="absolute right-3 top-3 flex items-center pointer-events-none">
                        {isSearchingAddress ? (
                          <Loader2 className="h-4 w-4 animate-spin text-[#8410DC]" />
                        ) : (
                          <MapPin className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Google Places Dropdown Suggestions */}
                    {showAddressDropdown && addressSuggestions.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-[#161922] rounded-xl shadow-2xl border border-slate-200 dark:border-white/[0.12] overflow-hidden max-h-64 overflow-y-auto">
                        <div className="px-3 py-1.5 bg-slate-50 dark:bg-white/[0.03] border-b border-slate-100 dark:border-white/[0.06] text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                          <span>SUGGESTED ADDRESSES (GOOGLE MAPS)</span>
                          <button
                            type="button"
                            onClick={() => setShowAddressDropdown(false)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {addressSuggestions.map((sug, idx) => (
                          <button
                            key={sug.place_id || idx}
                            type="button"
                            onClick={() => selectPlace(sug, false)}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-purple-50 dark:hover:bg-[#8410DC]/10 transition flex items-start gap-2.5 border-b border-slate-100/70 dark:border-white/[0.04] last:border-0"
                          >
                            <MapPin className="h-4 w-4 text-[#8410DC] mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 dark:text-white truncate">
                                {sug.main_text || sug.description}
                              </p>
                              {sug.secondary_text && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                  {sug.secondary_text}
                                </p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {autofillSuccessMsg && (
                      <div className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{autofillSuccessMsg}</span>
                      </div>
                    )}

                    {errors.shipping_address_line1 && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{errors.shipping_address_line1}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Address Line 2 <span className="text-xs text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={form.shipping_address_line2}
                      onChange={(e) => handleFieldChange('shipping_address_line2', e.target.value)}
                      placeholder="Landmark, Area, Colony"
                      className="w-full text-sm rounded-lg border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-slate-900 dark:text-white shadow-sm focus:ring-purple-500 focus:border-purple-500 p-2.5 border outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Delivery Pincode *</label>
                      {pincodeVerifiedInfo && (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          {pincodeVerifiedInfo}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={6}
                        value={form.shipping_pincode}
                        onChange={(e) => handlePincodeChange(e.target.value)}
                        placeholder="6-digit PIN code"
                        className={`w-full text-sm rounded-lg border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-slate-900 dark:text-white shadow-sm focus:ring-purple-500 focus:border-purple-500 p-2.5 border outline-none ${errors.shipping_pincode ? 'border-red-500 dark:border-red-500/50' : ''}`}
                      />
                      {lookupLoading && (
                        <span className="absolute right-3 top-3 text-xs text-[#8410DC] font-medium flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> Checking...
                        </span>
                      )}
                    </div>
                    {errors.shipping_pincode && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{errors.shipping_pincode}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">City *</label>
                    <input
                      type="text"
                      value={form.shipping_city}
                      onChange={(e) => handleFieldChange('shipping_city', e.target.value)}
                      placeholder="City"
                      className={`w-full text-sm rounded-lg border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-slate-900 dark:text-white shadow-sm focus:ring-purple-500 focus:border-purple-500 p-2.5 border outline-none ${errors.shipping_city ? 'border-red-500 dark:border-red-500/50' : ''}`}
                    />
                    {errors.shipping_city && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{errors.shipping_city}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">State *</label>
                    <input
                      type="text"
                      value={form.shipping_state}
                      onChange={(e) => handleFieldChange('shipping_state', e.target.value)}
                      placeholder="State"
                      className={`w-full text-sm rounded-lg border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-slate-900 dark:text-white shadow-sm focus:ring-purple-500 focus:border-purple-500 p-2.5 border outline-none ${errors.shipping_state ? 'border-red-500 dark:border-red-500/50' : ''}`}
                    />
                    {errors.shipping_state && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{errors.shipping_state}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Country</label>
                    <input
                      type="text"
                      value={form.shipping_country}
                      disabled
                      className="w-full text-sm rounded-lg border-slate-300 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 p-2.5 border outline-none"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Product Items (SKU, Name, Quantity, Value) */}
            <Card>
              <CardContent className="p-6">
                <OrderItemsEditor
                  items={form.items || []}
                  onChange={handleItemsChange}
                  errors={errors}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right column - Package dimensions, weight, payment & summary */}
          <div className="space-y-6">
            {/* Parcel Weight & Dimensions */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-white/[0.06] pb-3 mb-4">
                  <Box className="h-4 w-4 text-[#8410DC]" />
                  <h2 className="text-base font-semibold text-slate-800 dark:text-white">Weight & Dimensions</h2>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Weight (kg) *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.01"
                    value={weightStr}
                    onChange={(e) => {
                      setWeightStr(e.target.value);
                      const parsed = parseFloat(e.target.value);
                      if (!isNaN(parsed)) handleFieldChange('weight_kg', parsed);
                    }}
                    className={`w-full text-sm rounded-lg border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-slate-900 dark:text-white shadow-sm focus:ring-purple-500 focus:border-purple-500 p-2.5 border outline-none ${errors.weight_kg ? 'border-red-500 dark:border-red-500/50' : ''}`}
                  />
                  {errors.weight_kg && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{errors.weight_kg}</p>}
                  <p className="text-[11px] text-slate-400 mt-1">E.g., 0.5 for 500g, 1.0 for 1kg.</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">L (cm) *</label>
                    <input
                      type="number"
                      min="1"
                      value={lengthStr}
                      onChange={(e) => {
                        setLengthStr(e.target.value);
                        const parsed = parseFloat(e.target.value);
                        if (!isNaN(parsed)) handleFieldChange('length_cm', parsed);
                      }}
                      className={`w-full text-sm rounded-lg border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-slate-900 dark:text-white shadow-sm focus:ring-purple-500 focus:border-purple-500 p-2 border outline-none ${errors.length_cm ? 'border-red-500' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">W (cm) *</label>
                    <input
                      type="number"
                      min="1"
                      value={widthStr}
                      onChange={(e) => {
                        setWidthStr(e.target.value);
                        const parsed = parseFloat(e.target.value);
                        if (!isNaN(parsed)) handleFieldChange('width_cm', parsed);
                      }}
                      className={`w-full text-sm rounded-lg border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-slate-900 dark:text-white shadow-sm focus:ring-purple-500 focus:border-purple-500 p-2 border outline-none ${errors.width_cm ? 'border-red-500' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">H (cm) *</label>
                    <input
                      type="number"
                      min="1"
                      value={heightStr}
                      onChange={(e) => {
                        setHeightStr(e.target.value);
                        const parsed = parseFloat(e.target.value);
                        if (!isNaN(parsed)) handleFieldChange('height_cm', parsed);
                      }}
                      className={`w-full text-sm rounded-lg border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-slate-900 dark:text-white shadow-sm focus:ring-purple-500 focus:border-purple-500 p-2 border outline-none ${errors.height_cm ? 'border-red-500' : ''}`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Mode */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-white/[0.06] pb-3 mb-4">
                  <CreditCard className="h-4 w-4 text-[#8410DC]" />
                  <h2 className="text-base font-semibold text-slate-800 dark:text-white">Payment Method</h2>
                </div>

                <div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`flex items-center justify-center p-3 rounded-xl border cursor-pointer transition ${
                      form.payment_mode === 'prepaid'
                        ? 'border-[#8410DC] bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-[#D6A8FF] font-semibold shadow-xs ring-1 ring-[#8410DC]/40'
                        : 'border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                    }`}>
                      <input
                        type="radio"
                        name="payment_mode"
                        value="prepaid"
                        checked={form.payment_mode === 'prepaid'}
                        onChange={() => handleFieldChange('payment_mode', 'prepaid')}
                        className="sr-only"
                      />
                      <span>Prepaid</span>
                    </label>

                    <label className={`flex items-center justify-center p-3 rounded-xl border cursor-pointer transition ${
                      form.payment_mode === 'cod'
                        ? 'border-[#8410DC] bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-[#D6A8FF] font-semibold shadow-xs ring-1 ring-[#8410DC]/40'
                        : 'border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                    }`}>
                      <input
                        type="radio"
                        name="payment_mode"
                        value="cod"
                        checked={form.payment_mode === 'cod'}
                        onChange={() => handleFieldChange('payment_mode', 'cod')}
                        className="sr-only"
                      />
                      <span>COD (Cash)</span>
                    </label>
                  </div>
                </div>

                {form.payment_mode === 'cod' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      COD Amount to Collect (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.cod_amount}
                      onChange={(e) => handleFieldChange('cod_amount', parseFloat(e.target.value) || 0)}
                      className={`w-full text-sm rounded-lg border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-slate-900 dark:text-white shadow-sm focus:ring-purple-500 focus:border-purple-500 p-2.5 border outline-none ${errors.cod_amount ? 'border-red-500 dark:border-red-500/50' : ''}`}
                    />
                    {errors.cod_amount && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{errors.cod_amount}</p>}
                  </div>
                )}

                {/* Order Summary Box */}
                <div className="bg-slate-50 dark:bg-[#0f1117] p-3.5 rounded-xl border border-slate-100 dark:border-white/[0.06] space-y-2 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Declared Value:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">₹{orderTotalValue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Items:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {(form.items || []).reduce((acc, item) => acc + (Number(item.quantity) || 0), 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Routing Strategy:</span>
                    <span className="font-semibold text-[#8410DC] dark:text-[#D6A8FF]">
                      {isTamilNadu ? 'Local Courier (TN)' : 'National Multi-Carrier'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={(e) => handleSubmit(e, true)}
                className="w-full bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] text-white font-bold py-3.5 rounded-xl text-sm transition shadow-md shadow-purple-900/30 hover:shadow-lg disabled:opacity-50 cursor-pointer outline-none flex items-center justify-center space-x-2 border border-[#D6A8FF]/30"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>{loading ? 'Processing...' : orderId ? 'Update & Proceed to Shipping' : 'Create & Ship Now (Instant AWB)'}</span>
              </button>

              <div className="flex space-x-3">
                <button
                  type="button"
                  disabled={loading}
                  onClick={(e) => handleSubmit(e, false)}
                  className="flex-1 bg-white dark:bg-[#14121F] hover:bg-slate-50 dark:hover:bg-white/[0.04] border border-slate-300 dark:border-white/[0.12] text-slate-800 dark:text-slate-200 font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer text-center outline-none shadow-xs disabled:opacity-50"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/orders')}
                  className="flex-1 bg-transparent hover:bg-slate-100 dark:hover:bg-white/[0.04] text-slate-600 dark:text-slate-400 font-medium py-2.5 rounded-xl text-xs transition cursor-pointer text-center outline-none"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Quick Add Pickup Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#14121F] border border-slate-200 dark:border-white/[0.10] rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.06] pb-3">
              <div className="flex items-center space-x-2">
                <MapPin className="h-5 w-5 text-[#8410DC]" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Add Pickup Warehouse Address</h3>
              </div>
              <button
                onClick={() => setShowAddressModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePickupAddress} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Warehouse Label / Name *</label>
                <input
                  type="text"
                  required
                  value={newAddress.label}
                  onChange={e => setNewAddress({ ...newAddress, label: e.target.value })}
                  placeholder="e.g. Primary Warehouse, Chennai Depot"
                  className="w-full rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0f1117] p-2 text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Contact Manager Name *</label>
                  <input
                    type="text"
                    required
                    value={newAddress.contact_name}
                    onChange={e => setNewAddress({ ...newAddress, contact_name: e.target.value })}
                    placeholder="Manager Name"
                    className="w-full rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0f1117] p-2 text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Contact Phone *</label>
                  <input
                    type="tel"
                    required
                    value={newAddress.contact_phone}
                    onChange={e => setNewAddress({ ...newAddress, contact_phone: e.target.value })}
                    placeholder="10-digit Mobile"
                    className="w-full rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0f1117] p-2 text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">Address Line 1 (Premises, Street) *</label>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5 text-[#8410DC]" /> Google Maps
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={newAddress.address_line1}
                    onChange={e => handleAddressInputChange(e.target.value, true)}
                    onFocus={() => {
                      if (modalAddressSuggestions.length > 0) setShowModalAddressDropdown(true);
                    }}
                    placeholder="Search address or enter building, street..."
                    className="w-full rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0f1117] p-2 pr-8 text-slate-900 dark:text-white outline-none"
                  />
                  <div className="absolute right-2.5 top-2.5 flex items-center pointer-events-none">
                    {isSearchingModalAddress ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8410DC]" />
                    ) : (
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    )}
                  </div>
                </div>

                {showModalAddressDropdown && modalAddressSuggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-[#161922] rounded-xl shadow-2xl border border-slate-200 dark:border-white/[0.12] overflow-hidden max-h-48 overflow-y-auto">
                    <div className="px-3 py-1 bg-slate-50 dark:bg-white/[0.03] border-b border-slate-100 dark:border-white/[0.06] text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>SUGGESTED ADDRESSES</span>
                      <button
                        type="button"
                        onClick={() => setShowModalAddressDropdown(false)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    {modalAddressSuggestions.map((sug, idx) => (
                      <button
                        key={sug.place_id || idx}
                        type="button"
                        onClick={() => selectPlace(sug, true)}
                        className="w-full text-left px-3 py-2 hover:bg-purple-50 dark:hover:bg-[#8410DC]/10 transition flex items-start gap-2 border-b border-slate-100/70 dark:border-white/[0.04] last:border-0"
                      >
                        <MapPin className="h-3.5 w-3.5 text-[#8410DC] mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-800 dark:text-white truncate">
                            {sug.main_text || sug.description}
                          </p>
                          {sug.secondary_text && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {sug.secondary_text}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Pincode *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={newAddress.pincode}
                    onChange={async (e) => {
                      const pin = e.target.value;
                      setNewAddress(prev => ({ ...prev, pincode: pin }));
                      if (/^[1-9][0-9]{5}$/.test(pin.trim())) {
                        try {
                          const res = await apiClient.get(`/location/pincode/${pin.trim()}`);
                          if (res.data?.data) {
                            const { city, district, state } = res.data.data;
                            setNewAddress(prev => ({
                              ...prev,
                              city: city || district || prev.city,
                              state: state || prev.state,
                            }));
                          }
                        } catch (_) {}
                      }
                    }}
                    placeholder="6-digit PIN"
                    className="w-full rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0f1117] p-2 text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={newAddress.city}
                    onChange={e => setNewAddress({ ...newAddress, city: e.target.value })}
                    placeholder="City"
                    className="w-full rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0f1117] p-2 text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">State *</label>
                  <input
                    type="text"
                    required
                    value={newAddress.state}
                    onChange={e => setNewAddress({ ...newAddress, state: e.target.value })}
                    placeholder="State"
                    className="w-full rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#0f1117] p-2 text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="make_default"
                  checked={newAddress.is_default}
                  onChange={e => setNewAddress({ ...newAddress, is_default: e.target.checked })}
                  className="rounded border-slate-300 text-[#8410DC] focus:ring-[#8410DC]"
                />
                <label htmlFor="make_default" className="text-slate-700 dark:text-slate-300 cursor-pointer">
                  Set as default pickup location
                </label>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowAddressModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-white/[0.1] rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addressLoading}
                  className="px-5 py-2 bg-gradient-to-r from-[#5B069A] to-[#8410DC] text-white rounded-xl font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {addressLoading ? 'Saving...' : 'Save & Select Warehouse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
