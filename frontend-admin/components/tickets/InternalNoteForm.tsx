'use client';

import React, { useState } from 'react';
import { Send, Loader2, Lock } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import toast from 'react-hot-toast';

export default function InternalNoteForm({ 
  ticketId, 
  onSuccess 
}: { 
  ticketId: string; 
  onSuccess: () => void 
}) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      toast.error('Please enter an internal note.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post(`/platform/tickets/${ticketId}/internal-note`, {
        message: note,
      });

      if (response.data.success) {
        setNote('');
        toast.success('Internal note added successfully.');
        onSuccess();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to add internal note.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-amber-50/50 p-4 border border-amber-100 rounded-2xl space-y-3">
      <div className="flex items-center space-x-1.5 text-xs text-amber-800 font-bold uppercase tracking-wider">
        <Lock className="h-3.5 w-3.5" />
        <span>Add Internal Support Note</span>
      </div>
      
      <p className="text-[10px] text-amber-600 font-medium leading-normal">
        * Internal notes are only visible to support team members. They will NEVER be visible to the tenant customer.
      </p>

      <div className="relative">
        <textarea
          rows={2}
          required
          placeholder="Write internal findings, logs review comments, or team directions..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full bg-white border border-amber-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-700 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
        />
        <button
          type="submit"
          disabled={loading}
          className="absolute right-3 bottom-3 p-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg transition"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </form>
  );
}
