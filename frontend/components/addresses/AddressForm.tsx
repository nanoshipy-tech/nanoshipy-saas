'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import { AddressAutocompleteInput } from '../ui/AddressAutocompleteInput';
import toast from 'react-hot-toast';

export const AddressForm = ({ addressId }: { addressId?: string }) => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    label: '',
    contact_name: '',
    contact_phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    is_default: false,
    address_source: 'manual',
    pincode_verified: false,
    shipway_location_id: ''
  });
  const [loading, setLoading] = useState(!!addressId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (addressId) {
      setLoading(true);
      apiClient.get(`/addresses/${addressId}`)
        .then(({ data }) => {
          const d = data?.data || {};
          setFormData({
            label: d.label || '',
            contact_name: d.contact_name || '',
            contact_phone: d.contact_phone || '',
            address_line1: d.address_line1 || '',
            address_line2: d.address_line2 || '',
            city: d.city || '',
            state: d.state || '',
            pincode: String(d.pincode || ''),
            is_default: Boolean(d.is_default),
            address_source: ['manual', 'pincode_lookup', 'google_autocomplete'].includes(d.address_source) ? d.address_source : 'manual',
            pincode_verified: Boolean(d.pincode_verified),
            shipway_location_id: d.shipway_location_id || '',
          });
        })
        .catch(err => {
          console.error('Failed to load address:', err);
          setError('Failed to load address details');
          toast.error('Failed to load address details');
        })
        .finally(() => setLoading(false));
    }
  }, [addressId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleLocationAutofill = (location: { city: string; state: string; addressSource: string; isVerified: boolean }) => {
    const validSource = ['manual', 'pincode_lookup', 'google_autocomplete'].includes(location.addressSource)
      ? location.addressSource
      : 'pincode_lookup';
    setFormData(prev => ({
      ...prev,
      city: location.city || prev.city,
      state: location.state || prev.state,
      address_source: validSource,
      pincode_verified: Boolean(location.isVerified),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const validSource = ['manual', 'pincode_lookup', 'google_autocomplete'].includes(formData.address_source)
        ? formData.address_source
        : 'pincode_lookup';

      const payload: any = {
        label: String(formData.label || '').trim(),
        contact_name: String(formData.contact_name || '').trim(),
        contact_phone: String(formData.contact_phone || '').trim(),
        address_line1: String(formData.address_line1 || '').trim(),
        address_line2: formData.address_line2 ? String(formData.address_line2).trim() : '',
        city: String(formData.city || '').trim(),
        state: String(formData.state || '').trim(),
        pincode: String(formData.pincode || '').trim(),
        is_default: Boolean(formData.is_default),
        address_source: validSource,
        pincode_verified: Boolean(formData.pincode_verified),
        shipway_location_id: formData.shipway_location_id ? String(formData.shipway_location_id).trim() : null,
      };

      if (addressId) {
        await apiClient.put(`/addresses/${addressId}`, payload);
        toast.success('Pickup address updated successfully!');
      } else {
        await apiClient.post('/addresses', payload);
        toast.success('Pickup address created successfully!');
      }
      router.push('/settings/addresses');
    } catch (err: any) {
      const fields = err.response?.data?.error?.fields;
      let errorMsg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Failed to save address';
      if (fields && typeof fields === 'object') {
        const details = Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join(' | ');
        if (details) errorMsg = details;
      }
      setError(errorMsg);
      toast.error(errorMsg);
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500 font-medium">Loading address details...</div>;

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-[#131620] p-6 rounded-xl shadow-sm border border-slate-100 dark:border-white/[0.06] max-w-2xl space-y-6">
      {error && <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 p-3 rounded-md text-sm border border-red-200 dark:border-red-900/30">{error}</div>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Label (e.g. Warehouse 1)</label>
          <input required type="text" name="label" value={formData.label} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-slate-900 dark:text-white shadow-sm focus:border-[#8410DC] focus:ring-purple-500 sm:text-sm p-2 border outline-none" />
        </div>
        <div>
          <AddressAutocompleteInput
            pincodeValue={formData.pincode}
            onPincodeChange={(val) => setFormData(prev => ({ ...prev, pincode: val }))}
            onLocationAutofill={handleLocationAutofill}
          />
        </div>
        
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Address Line 1</label>
          <input required type="text" name="address_line1" value={formData.address_line1} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-slate-900 dark:text-white shadow-sm focus:border-[#8410DC] focus:ring-purple-500 sm:text-sm p-2 border outline-none" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Address Line 2 (Optional)</label>
          <input type="text" name="address_line2" value={formData.address_line2 || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-slate-900 dark:text-white shadow-sm focus:border-[#8410DC] focus:ring-purple-500 sm:text-sm p-2 border outline-none" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">City</label>
          <input required type="text" name="city" value={formData.city} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-slate-900 dark:text-white shadow-sm focus:border-[#8410DC] focus:ring-purple-500 sm:text-sm p-2 border outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">State</label>
          <input required type="text" name="state" value={formData.state} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-slate-900 dark:text-white shadow-sm focus:border-[#8410DC] focus:ring-purple-500 sm:text-sm p-2 border outline-none" />
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-white/[0.06] md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Contact Name</label>
            <input required type="text" name="contact_name" value={formData.contact_name} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-slate-900 dark:text-white shadow-sm focus:border-[#8410DC] focus:ring-purple-500 sm:text-sm p-2 border outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Contact Phone</label>
            <input required type="text" name="contact_phone" value={formData.contact_phone} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-slate-900 dark:text-white shadow-sm focus:border-[#8410DC] focus:ring-purple-500 sm:text-sm p-2 border outline-none" />
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Warehouse Fulfillment Code / Hub ID <span className="text-xs text-slate-400 font-normal">(Optional — maps this warehouse to your regional carrier hub identifier)</span>
          </label>
          <input
            type="text"
            name="shipway_location_id"
            value={formData.shipway_location_id || ''}
            onChange={handleChange}
            placeholder="e.g. WH-NOIDA-01 or 12345"
            className="mt-1 block w-full rounded-md border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-slate-900 dark:text-white shadow-sm focus:border-[#8410DC] focus:ring-purple-500 sm:text-sm p-2 border outline-none font-mono"
          />
        </div>
      </div>

      <div className="flex items-center mt-4">
        <input type="checkbox" name="is_default" id="is_default" checked={formData.is_default} onChange={handleChange} className="h-4 w-4 text-[#8410DC] focus:ring-purple-500 border-slate-300 dark:border-white/[0.08] rounded bg-white dark:bg-[#0f1117]" />
        <label htmlFor="is_default" className="ml-2 block text-sm text-slate-900 dark:text-slate-200">Set as default pickup address</label>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
        <button type="button" onClick={() => router.back()} className="px-4 py-2 border border-slate-300 dark:border-white/[0.08] rounded-md text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-transparent hover:bg-slate-50 dark:hover:bg-white/[0.02] transition">Cancel</button>
        <button type="submit" disabled={saving} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 transition">
          {saving ? 'Saving...' : 'Save Address'}
        </button>
      </div>
    </form>
  );
};
