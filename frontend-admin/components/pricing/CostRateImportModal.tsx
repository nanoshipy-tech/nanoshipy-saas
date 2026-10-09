'use client';

import React, { useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import { X } from 'lucide-react';

interface CostRateImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CostRateImportModal({ isOpen, onClose, onSuccess }: CostRateImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: any[] } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvText(event.target?.result as string || '');
      };
      reader.readAsText(selected);
    }
  };

  const handleImport = async () => {
    if (!csvText && !file) {
      setErrorMsg('Please select a CSV file to upload.');
      return;
    }

    setUploading(true);
    setErrorMsg('');
    setResult(null);

    try {
      const res = await apiClient.post('/platform/cost-rates/import', { csv: csvText });

      if (!res.data?.success) {
        throw new Error(res.data?.error?.message || 'Failed to import cost rates');
      }

      setResult(res.data.data);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || err.message || 'Error uploading CSV');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b pb-4 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Import Shipway Cost CSV</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Upload Shipway’s actual courier cost sheet (CSV). Format must include headers:
            <code className="ml-1 rounded bg-slate-100 px-1 py-0.5 font-mono text-xs dark:bg-slate-800">
              Courier Name, Service Mode, Base Weight (kg), Additional Weight (kg), Zone, Base Cost, Additional Cost
            </code>
          </p>

          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="w-full rounded-lg border p-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />

          {errorMsg && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">
              {errorMsg}
            </div>
          )}

          {result && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/50 dark:text-green-300">
              <p className="font-semibold">Import Complete!</p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                <li>Imported: {result.imported} rows</li>
                <li>Skipped / Errors: {result.skipped} rows</li>
              </ul>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto rounded bg-red-100 p-2 text-xs text-red-900 dark:bg-red-900/40 dark:text-red-200">
                  {result.errors.map((e, idx) => (
                    <div key={idx}>Row {e.row}: {e.reason}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t pt-4 dark:border-slate-800">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={uploading}
            className="rounded-lg bg-[#8410DC] px-5 py-2 text-sm font-semibold text-white hover:bg-[#730ec2] disabled:opacity-50"
          >
            {uploading ? 'Importing...' : 'Upload & Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
