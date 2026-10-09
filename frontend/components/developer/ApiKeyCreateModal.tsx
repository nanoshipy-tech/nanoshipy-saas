'use client';

import React, { useState } from 'react';

const AVAILABLE_SCOPES = [
  'orders.read',
  'orders.write',
  'shipments.read',
  'shipments.write',
  'tracking.read'
];

export default function ApiKeyCreateModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState(null);

  const toggleScope = (scope) => {
    setSelectedScopes(prev => 
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await onCreate({ name, scopes: selectedScopes, expires_at: null });
      if (result && result.api_key) {
        setNewKey(result);
      } else {
        onClose(); // Close if no raw key returned for some reason
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        {newKey ? (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">API Key Created!</h3>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    {newKey.warning || 'This is the only time the full key will be shown. Store it securely.'}
                  </p>
                </div>
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Your API Key</label>
              <div className="flex items-center">
                <code className="block w-full bg-gray-100 p-3 rounded text-sm break-all">
                  {newKey.api_key}
                </code>
              </div>
            </div>
            <div className="mt-5 sm:mt-6">
              <button
                type="button"
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-[#8410DC] text-base font-medium text-white hover:bg-[#730ec2] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:text-sm"
                onClick={onClose}
              >
                I have saved this key
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New API Key</h3>
            
            <div className="mb-4">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Key Name</label>
              <input
                type="text"
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-[#8410DC] sm:text-sm p-2 border"
                placeholder="e.g. Shopify Integration"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Permissions (Scopes)</label>
              <div className="space-y-2">
                {AVAILABLE_SCOPES.map(scope => (
                  <div key={scope} className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id={scope}
                        type="checkbox"
                        checked={selectedScopes.includes(scope)}
                        onChange={() => toggleScope(scope)}
                        className="focus:ring-purple-500 h-4 w-4 text-[#8410DC] border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor={scope} className="font-medium text-gray-700">{scope}</label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 sm:mt-6 flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || selectedScopes.length === 0}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-[#8410DC] text-base font-medium text-white hover:bg-[#730ec2] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:text-sm disabled:bg-indigo-300"
              >
                {loading ? 'Creating...' : 'Create Key'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
