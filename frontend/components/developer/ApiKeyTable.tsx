'use client';

import React, { useState } from 'react';
import { ConfirmModal } from '../ui/ConfirmModal';
import { formatDate } from '@/lib/formatters';

export default function ApiKeyTable({ apiKeys, onRevoke }: { apiKeys: any[]; onRevoke: (id: string) => Promise<void> }) {
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<any | null>(null);

  const handleOpenRevoke = (key: any) => {
    setSelectedKey(key);
    setModalOpen(true);
  };

  const handleConfirmRevoke = async () => {
    if (!selectedKey) return;
    setRevokingId(selectedKey.id);
    try {
      await onRevoke(selectedKey.id);
    } finally {
      setRevokingId(null);
      setModalOpen(false);
      setSelectedKey(null);
    }
  };

  if (!apiKeys || apiKeys.length === 0) {
    return (
      <div className="text-[#7E7994] p-8 border border-dashed border-[#E8DEF2] rounded-2xl bg-white text-xs text-center">
        No API keys generated yet. Generate an API key to access Nanoshipy programmatic shipping APIs.
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border border-[#E8DEF2] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#F2ECF7] text-xs">
            <thead className="bg-slate-50/60">
              <tr>
                <th className="px-6 py-3.5 text-left font-semibold text-[#534F66] uppercase tracking-wider">Name</th>
                <th className="px-6 py-3.5 text-left font-semibold text-[#534F66] uppercase tracking-wider">Key Prefix</th>
                <th className="px-6 py-3.5 text-left font-semibold text-[#534F66] uppercase tracking-wider">Status</th>
                <th className="px-6 py-3.5 text-left font-semibold text-[#534F66] uppercase tracking-wider">Created</th>
                <th className="px-6 py-3.5 text-left font-semibold text-[#534F66] uppercase tracking-wider">Last Used</th>
                <th className="px-6 py-3.5 text-right font-semibold text-[#534F66] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2ECF7] text-[#14121F]">
              {apiKeys.map((key) => (
                <tr key={key.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-[#14121F]">{key.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-[#534F66] font-mono">{key.key_prefix}••••••••</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {key.is_active ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                        Revoked
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-[#534F66]">
                    {formatDate(key.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-[#534F66]">
                    {key.last_used_at ? formatDate(key.last_used_at) : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                    {key.is_active && (
                      <button
                        onClick={() => handleOpenRevoke(key)}
                        disabled={revokingId === key.id}
                        className="text-rose-600 hover:text-rose-700 font-semibold disabled:opacity-50 transition-colors"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleConfirmRevoke}
        title="Revoke API Key"
        description={`Are you sure you want to revoke the key "${selectedKey?.name}"? This action cannot be undone and any automated systems or storefront integrations using this key will immediately fail.`}
        confirmText="Yes, Revoke Key"
        variant="danger"
        isLoading={revokingId !== null}
      />
    </>
  );
}
