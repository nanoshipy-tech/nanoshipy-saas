'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import toast from 'react-hot-toast';
import { Save, Edit2, X, Check, Clock, Plus, Sliders, RefreshCw } from 'lucide-react';

interface PlatformSettingRow {
  id: string;
  setting_key: string;
  setting_value: string;
  value_type: 'string' | 'number' | 'boolean' | 'json';
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

const VALUE_TYPE_BADGES: Record<string, string> = {
  number: 'bg-purple-50 text-[#5B069A] border-purple-200',
  boolean: 'bg-amber-50 text-amber-700 border-amber-200',
  string: 'bg-slate-100 text-slate-700 border-slate-200',
  json: 'bg-violet-50 text-violet-700 border-violet-200',
};

export default function PlatformSettingsForm() {
  const [settings, setSettings] = useState<PlatformSettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/platform/settings');
      if (res.data.success) setSettings(res.data.data);
    } catch {
      toast.error('Failed to load platform settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const startEdit = (row: PlatformSettingRow) => {
    setEditingKey(row.setting_key);
    setEditValue(row.setting_value);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
  };

  const saveEdit = async (key: string) => {
    setSaving(true);
    try {
      await apiClient.put(`/platform/settings/${key}`, { setting_value: editValue });
      toast.success(`Setting "${key}" updated successfully!`);
      setEditingKey(null);
      await fetchSettings();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to update setting';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-6 h-6 text-[#8410DC] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 font-medium">
          {settings.length} system {settings.length === 1 ? 'parameter' : 'parameters'} active
        </span>
        <button
          onClick={fetchSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Current Value</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Last Updated</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {settings.map(row => (
              <tr key={row.setting_key} className="hover:bg-slate-50/60 transition">
                {/* Key */}
                <td className="px-4 py-3">
                  <span className="font-mono font-bold text-slate-900 text-xs">{row.setting_key}</span>
                </td>

                {/* Value — inline editable */}
                <td className="px-4 py-3">
                  {editingKey === row.setting_key ? (
                    <div className="flex items-center gap-2">
                      {row.value_type === 'boolean' ? (
                        <select
                          id={`platform-setting-edit-${row.setting_key}`}
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="bg-white border border-[#8410DC] rounded-lg px-3 py-1.5 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/20 shadow-xs"
                        >
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : (
                        <input
                          id={`platform-setting-edit-${row.setting_key}`}
                          type={row.value_type === 'number' ? 'number' : 'text'}
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="w-48 bg-white border border-[#8410DC] rounded-lg px-3 py-1.5 text-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/20 shadow-xs"
                          autoFocus
                        />
                      )}
                      <button
                        onClick={() => saveEdit(row.setting_key)}
                        disabled={saving}
                        className="p-1.5 text-white bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] rounded-lg transition shadow-xs"
                        title="Save"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition shadow-xs"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="font-mono font-bold text-slate-800 text-xs bg-slate-100 px-2.5 py-1 rounded-md">
                      {row.setting_value || <span className="italic text-slate-400">empty</span>}
                    </span>
                  )}
                </td>

                {/* Type badge */}
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${VALUE_TYPE_BADGES[row.value_type] || VALUE_TYPE_BADGES.string}`}>
                    {row.value_type}
                  </span>
                </td>

                {/* Description */}
                <td className="px-4 py-3 text-xs text-slate-600 max-w-[240px]">
                  {row.description || '—'}
                </td>

                {/* Last updated */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>
                      {row.updated_at
                        ? new Date(row.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </span>
                  </div>
                </td>

                {/* Edit button */}
                <td className="px-4 py-3 text-right">
                  {editingKey !== row.setting_key && (
                    <button
                      id={`edit-setting-${row.setting_key}`}
                      onClick={() => startEdit(row)}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-200 text-slate-700 hover:text-[#8410DC] font-bold rounded-lg transition"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
