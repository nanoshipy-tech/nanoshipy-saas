'use client';

import React, { useEffect, useState } from 'react';
import { UserPlus, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import toast from 'react-hot-toast';

interface Admin {
  id: string;
  name: string;
  email: string;
}

export default function AssignTicketDropdown({ 
  ticketId, 
  assignedToId, 
  onSuccess 
}: { 
  ticketId: string; 
  assignedToId: string | null; 
  onSuccess: () => void 
}) {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const fetchAdmins = async () => {
      setLoading(true);
      try {
        const response = await apiClient.get('/platform/auth/admins');
        if (response.data.success) {
          setAdmins(response.data.data);
        }
      } catch (err) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchAdmins();
  }, []);

  const handleAssign = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) return;

    setUpdating(true);
    try {
      const response = await apiClient.put(`/platform/tickets/${ticketId}/assign`, {
        assigned_to: val,
      });

      if (response.data.success) {
        toast.success('Ticket assigned successfully.');
        onSuccess();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to assign ticket.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-1">
      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
        Assign Support Owner
      </label>
      <div className="relative flex items-center">
        {updating ? (
          <Loader2 className="h-4 w-4 animate-spin text-[#8410DC] mr-2" />
        ) : (
          <UserPlus className="absolute left-3 h-4 w-4 text-gray-400 pointer-events-none" />
        )}
        <select
          value={assignedToId || ''}
          disabled={updating || loading}
          onChange={handleAssign}
          className="w-full bg-gray-50 border border-gray-200/80 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:border-[#8410DC] transition"
        >
          <option value="" disabled>-- Assign Agent --</option>
          {admins.map((adm) => (
            <option key={adm.id} value={adm.id}>
              {adm.name} ({adm.email})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
