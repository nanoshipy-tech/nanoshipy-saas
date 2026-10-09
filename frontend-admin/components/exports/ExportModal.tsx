'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import {
  FileSpreadsheet,
  Download,
  X,
  Loader2,
  CheckSquare,
  Square,
  AlertCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface ExportColumn {
  key: string;
  header: string;
  selected?: boolean;
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entity: string;
  entityLabel?: string;
  activeFilters?: Record<string, any>;
  onExportSuccess?: (jobId?: string) => void;
}

export default function ExportModal({
  isOpen,
  onClose,
  entity,
  entityLabel,
  activeFilters = {},
  onExportSuccess,
}: ExportModalProps) {
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [columns, setColumns] = useState<ExportColumn[]>([]);
  const [selectedColumnKeys, setSelectedColumnKeys] = useState<string[]>([]);
  const [asyncJobInfo, setAsyncJobInfo] = useState<{ id: string; status: string; total_rows?: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAsyncJobInfo(null);
      loadEntityConfig();
    }
  }, [isOpen, entity]);

  const loadEntityConfig = async () => {
    try {
      setLoadingConfig(true);
      const res = await apiClient.get('/admin/exports/entities');
      if (res.data?.success) {
        const entityConfig = res.data.data.find((e: any) => e.key === entity);
        if (entityConfig && Array.isArray(entityConfig.defaultColumns)) {
          setColumns(entityConfig.defaultColumns);
          setSelectedColumnKeys(entityConfig.defaultColumns.map((c: any) => c.key));
          return;
        }
      }
      // Fallback if registry response doesn't have it
      setColumns([]);
      setSelectedColumnKeys([]);
    } catch {
      // Default to empty subset
      setColumns([]);
      setSelectedColumnKeys([]);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleToggleColumn = (key: string) => {
    setSelectedColumnKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSelectAll = () => {
    setSelectedColumnKeys(columns.map((c) => c.key));
  };

  const handleDeselectAll = () => {
    setSelectedColumnKeys([]);
  };

  const handleStartExport = async () => {
    try {
      setExporting(true);
      const payload = {
        entity,
        filters: activeFilters,
        columns: selectedColumnKeys.length > 0 ? selectedColumnKeys : undefined,
      };

      const res = await apiClient.post('/admin/exports', payload);

      if (res.data?.success) {
        const data = res.data.data;
        if (data.is_sync && data.download_url) {
          // Direct download
          toast.success('Export generated successfully! Downloading...');
          window.open(data.download_url, '_blank');
          onExportSuccess?.();
          onClose();
        } else {
          // Queued asynchronously
          setAsyncJobInfo(data);
          toast.success('Large export queued! Processing in the background.');
          onExportSuccess?.(data.id);
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to start export';
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  const displayTitle = entityLabel || entity.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // Filter out empty or null filter values for clean UI preview
  const readableFilters = Object.entries(activeFilters).filter(
    ([, v]) => v !== undefined && v !== null && v !== '' && v !== 'ALL'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-[#8410DC] dark:text-[#D6A8FF] flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Export {displayTitle} to Excel
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate an IST-formatted .xlsx spreadsheet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {asyncJobInfo ? (
            <div className="p-6 text-center space-y-4 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-900">
              <div className="w-12 h-12 rounded-full bg-[#8410DC]/10 text-[#8410DC] dark:text-[#D6A8FF] flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Export Job Enqueued (#{asyncJobInfo.id.slice(0, 8)})
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                  Your dataset has {asyncJobInfo.total_rows || 'many'} rows and is processing in the background. Webhooks will be dispatched upon completion.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <Link
                  href="/reports/exports"
                  className="px-4 py-2 bg-[#8410DC] text-white rounded-xl font-semibold flex items-center gap-1.5 hover:bg-purple-700 transition"
                  onClick={onClose}
                >
                  View in Exports Hub <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Active Filters Summary */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Applied Filters ({readableFilters.length})
                </label>
                {readableFilters.length === 0 ? (
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-slate-500">
                    No custom filters applied. All accessible records will be exported.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    {readableFilters.map(([k, v]) => (
                      <span
                        key={k}
                        className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-mono text-[11px] text-slate-700 dark:text-slate-300"
                      >
                        <span className="font-bold text-[#8410DC] dark:text-[#D6A8FF]">{k}:</span>{' '}
                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Column Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Select Columns ({selectedColumnKeys.length} / {columns.length || 'All'})
                  </label>
                  {columns.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-[11px] text-[#8410DC] dark:text-[#D6A8FF] font-semibold hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={handleDeselectAll}
                        className="text-[11px] text-slate-500 hover:underline"
                      >
                        Deselect
                      </button>
                    </div>
                  )}
                </div>

                {loadingConfig ? (
                  <div className="p-6 text-center text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#8410DC]" />
                    <span>Loading available columns...</span>
                  </div>
                ) : columns.length === 0 ? (
                  <div className="p-3 text-slate-500 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                    All default columns for {displayTitle} will be included.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto p-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/20">
                    {columns.map((col) => {
                      const isSelected = selectedColumnKeys.includes(col.key);
                      return (
                        <button
                          key={col.key}
                          type="button"
                          onClick={() => handleToggleColumn(col.key)}
                          className={`flex items-center gap-2 p-2 rounded-lg text-left transition border ${
                            isSelected
                              ? 'bg-purple-50 dark:bg-purple-950/30 border-[#8410DC]/30 text-slate-900 dark:text-white font-medium'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                          }`}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-3.5 h-3.5 text-[#8410DC] dark:text-[#D6A8FF] flex-shrink-0" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          )}
                          <span className="truncate">{col.header}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Informational tip */}
              <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-[11px] text-blue-800 dark:text-blue-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
                <span>
                  Large datasets (&gt; 5,000 rows) run asynchronously in flat-memory batches. You will receive an Excel download link and registered webhooks will be triggered when ready.
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!asyncJobInfo && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-900/50">
            <button
              type="button"
              onClick={onClose}
              disabled={exporting}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStartExport}
              disabled={exporting || (columns.length > 0 && selectedColumnKeys.length === 0)}
              className="px-5 py-2 rounded-xl bg-[#8410DC] hover:bg-purple-700 text-white font-bold flex items-center gap-2 shadow-md hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Preparing Export...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download .xlsx</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
