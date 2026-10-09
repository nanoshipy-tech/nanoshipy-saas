'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient';
import { AddressCard } from './AddressCard';
import { Search, MapPin } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../ui/ConfirmModal';
import { EmptyState } from '../ui/EmptyState';

export const AddressTable = () => {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id?: string }>({ isOpen: false });
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAddresses = async () => {
    try {
      const { data } = await apiClient.get('/addresses', { params: { search } });
      const raw = data?.data;
      const list = Array.isArray(raw) ? raw : raw?.addresses || raw?.rows || [];
      setAddresses(Array.isArray(list) ? list : []);
    } catch {
      setError('Failed to load addresses');
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, [search]);

  const handleSetDefault = async (id: string) => {
    try {
      await apiClient.put(`/addresses/${id}/set-default`);
      toast.success('Default address updated');
      fetchAddresses();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to set default');
    }
  };

  const confirmDeleteAddress = async () => {
    if (!deleteModal.id) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/addresses/${deleteModal.id}`);
      toast.success('Address deleted successfully');
      setDeleteModal({ isOpen: false });
      fetchAddresses();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to delete address');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-[#7E7994]" />
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-3 py-2 border border-[#E8DEF2] rounded-xl leading-5 bg-white text-[#14121F] placeholder-[#7E7994] focus:outline-none focus:border-[#5B069A] focus:ring-1 focus:ring-[#5B069A] text-xs transition-shadow outline-none shadow-sm"
            placeholder="Search addresses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Link
          href="/settings/addresses/new"
          className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-xl shadow-sm text-white bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:opacity-95 transition-all active:scale-[0.98]"
        >
          Add New Address
        </Link>
      </div>

      {error && <div className="text-rose-600 text-xs font-medium">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5B069A]"></div>
        </div>
      ) : addresses.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No addresses found"
          description="Add your warehouse, pickup points, and RTO return addresses to enable shipping dispatch."
          actionText="Add New Address"
          actionHref="/settings/addresses/new"
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {addresses.map((addr) => (
            <AddressCard
              key={addr.id}
              address={addr}
              onSetDefault={handleSetDefault}
              onDelete={(id) => setDeleteModal({ isOpen: true, id })}
            />
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false })}
        onConfirm={confirmDeleteAddress}
        title="Delete Address"
        description="Are you sure you want to delete this address? Any orders linked to this pickup address will need to be re-assigned."
        confirmText="Delete Address"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
