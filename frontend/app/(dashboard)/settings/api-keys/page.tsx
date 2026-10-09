'use client';

import React, { useState, useEffect } from 'react';
import ApiKeyTable from '@/components/developer/ApiKeyTable';
import ApiKeyCreateModal from '@/components/developer/ApiKeyCreateModal';
import ApiUsageChart from '@/components/developer/ApiUsageChart';
import { apiClient as api } from '@/lib/apiClient';
import { toast } from 'react-hot-toast';

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [usageLogs, setUsageLogs] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api-keys');
      setApiKeys(res.data.data);
      // Auto-select first key for usage chart if available
      if (res.data.data.length > 0 && !selectedKey) {
        setSelectedKey(res.data.data[0]);
        fetchUsage(res.data.data[0].id);
      }
    } catch (err) {
      toast.error('Failed to fetch API keys');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsage = async (keyId) => {
    try {
      const res = await api.get(`/api-keys/${keyId}/usage`);
      setUsageLogs(res.data.data);
    } catch (err) {
      toast.error('Failed to fetch usage logs');
    }
  };

  const handleCreate = async (data) => {
    try {
      const res = await api.post('/api-keys', data);
      toast.success('API Key created successfully');
      fetchKeys();
      return res.data.data; // Return full data so modal can show the raw key
    } catch (err) {
      toast.error('Failed to create API key');
      throw err;
    }
  };

  const handleRevoke = async (id) => {
    try {
      await api.put(`/api-keys/${id}/revoke`);
      toast.success('API Key revoked');
      fetchKeys();
    } catch (err) {
      toast.error('Failed to revoke API key');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">API Keys</h1>
          <p className="mt-1 text-sm text-gray-500">Manage API keys for server-to-server integrations.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2]"
        >
          Create New Key
        </button>
      </div>

      <div className="bg-white shadow rounded-lg mb-8">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : (
          <ApiKeyTable apiKeys={apiKeys} onRevoke={handleRevoke} />
        )}
      </div>

      {apiKeys.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-medium text-gray-900">Usage Analytics</h2>
            <select
              className="border-gray-300 rounded-md text-sm shadow-sm focus:ring-purple-500 focus:border-[#8410DC]"
              value={selectedKey?.id || ''}
              onChange={(e) => {
                const key = apiKeys.find(k => k.id === e.target.value);
                setSelectedKey(key);
                fetchUsage(key.id);
              }}
            >
              {apiKeys.map(key => (
                <option key={key.id} value={key.id}>{key.name} ({key.key_prefix})</option>
              ))}
            </select>
          </div>
          <ApiUsageChart logs={usageLogs} />
        </div>
      )}

      {isModalOpen && (
        <ApiKeyCreateModal 
          onClose={() => setIsModalOpen(false)} 
          onCreate={handleCreate} 
        />
      )}
    </div>
  );
}
