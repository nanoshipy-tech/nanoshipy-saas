'use client';

import { API_URL } from '@/lib/env';
import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Upload, Download, FileText, CheckCircle2, AlertTriangle, XCircle, RefreshCw, History, Table, Layers, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RateCardManagementPage() {
  const [activeTab, setActiveTab] = useState<'upload' | 'current' | 'history'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [rateCardsList, setRateCardsList] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const fetchHistory = async () => {
    try {
      const res = await apiClient.get('/rate-cards/history');
      if (res.data.success) {
        setHistoryList(res.data.data || []);
      }
    } catch {
      toast.error('Failed to load upload history');
    }
  };

  const fetchRateCards = async () => {
    setLoadingList(true);
    try {
      const res = await apiClient.get('/rate-cards');
      if (res.data.success) {
        setRateCardsList(res.data.data || []);
      }
    } catch {
      toast.error('Failed to load current rate cards');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
    if (activeTab === 'current') fetchRateCards();
  }, [activeTab]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      parseFile(selected);
    }
  };

  const parseFile = async (fileToParse: File) => {
    setParsing(true);
    setPreviewData(null);
    try {
      const text = await fileToParse.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length <= 1) {
        toast.error('CSV file is empty or only contains headers.');
        setParsing(false);
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
      const rows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
        const obj: any = {};
        headers.forEach((h, idx) => {
          obj[h] = values[idx] || '';
        });
        return obj;
      });

      const res = await apiClient.post('/rate-cards/preview', { rows });
      if (res.data.success) {
        setPreviewData(res.data.data);
        toast.success(`Parsed ${rows.length} rows successfully!`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to parse CSV file');
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!previewData || !previewData.results) {
      toast.error('No validated data available for import.');
      return;
    }

    const validRowsData = previewData.results.filter((r: any) => r.valid).map((r: any) => r.data);
    if (validRowsData.length === 0) {
      toast.error('Cannot import because all rows failed validation.');
      return;
    }

    setImporting(true);
    try {
      const res = await apiClient.post('/rate-cards/import', {
        rows: validRowsData,
        file_name: file?.name || 'rate_card_upload.csv',
        import_mode: importMode,
      });

      if (res.data.success) {
        toast.success(res.data.data?.message || 'Rate Card imported successfully!');
        setPreviewData(null);
        setFile(null);
        setActiveTab('current');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = [
      'courier_name,service_mode,base_weight_kg,additional_weight_increment_kg,zone,base_price,additional_price,effective_from',
      'Delhivery,Surface,0.5,0.5,A,38.00,32.00,2026-01-01',
      'Delhivery,Surface,0.5,0.5,B,44.00,38.00,2026-01-01',
      'Delhivery,Surface,0.5,0.5,C,52.00,45.00,2026-01-01',
      'Delhivery,Surface,0.5,0.5,D,60.00,52.00,2026-01-01',
      'Delhivery,Surface,0.5,0.5,E,72.00,65.00,2026-01-01',
      'Bluedart,Air,0.5,0.5,A,55.00,48.00,2026-01-01',
      'Bluedart,Air,0.5,0.5,B,65.00,58.00,2026-01-01',
      'Bluedart,Air,0.5,0.5,C,78.00,70.00,2026-01-01',
      'Bluedart,Air,0.5,0.5,D,92.00,82.00,2026-01-01',
      'Bluedart,Air,0.5,0.5,E,110.00,98.00,2026-01-01'
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'rate_card_sample_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Downloaded sample rate card CSV template');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-[#14121F] flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#8410DC]" />
            Rate Card Upload & Management
          </h1>
          <p className="text-xs text-[#7E7994] mt-1">
            Upload courier shipping rate cards, validate zone pricing schemas, and import active carrier rate sheets.
          </p>
        </div>

        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200 dark:hover:bg-white/[0.1] text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold border border-slate-200 dark:border-[#E8DEF2] transition"
        >
          <Download className="w-4 h-4 text-[#8410DC]" />
          <span>Download Sample CSV Template</span>
        </button>
      </div>

      {/* Tabs Nav */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#F2ECF7] pb-3">
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'upload'
              ? 'bg-[#8410DC] text-white shadow-sm'
              : 'text-slate-600 dark:text-[#534F66] hover:bg-slate-100 dark:hover:bg-white/[0.04]'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Upload & Preview</span>
        </button>
        <button
          onClick={() => setActiveTab('current')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'current'
              ? 'bg-[#8410DC] text-white shadow-sm'
              : 'text-slate-600 dark:text-[#534F66] hover:bg-slate-100 dark:hover:bg-white/[0.04]'
          }`}
        >
          <Table className="w-4 h-4" />
          <span>Active Rate Cards</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'history'
              ? 'bg-[#8410DC] text-white shadow-sm'
              : 'text-slate-600 dark:text-[#534F66] hover:bg-slate-100 dark:hover:bg-white/[0.04]'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Upload History</span>
        </button>
      </div>

      {/* TAB 1: UPLOAD & PREVIEW */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          {/* File Dropzone Card */}
          <div className="bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#F2ECF7] rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-[#14121F] flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#8410DC]" />
              Step 1: Select & Upload Rate Card File
            </h2>

            <div className="border-2 border-dashed border-slate-200 dark:border-[#E8DEF2] rounded-2xl p-8 text-center hover:border-[#8410DC] transition cursor-pointer bg-slate-50 dark:bg-white/[0.02]">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                className="hidden"
                id="rate-card-file-input"
              />
              <label htmlFor="rate-card-file-input" className="cursor-pointer flex flex-col items-center">
                <FileSpreadsheet className="w-10 h-10 text-[#8410DC] mb-3" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {file ? file.name : 'Click to choose or drag & drop CSV Rate Card file'}
                </span>
                <span className="text-[11px] text-[#534F66] mt-1">Supports CSV file format</span>
              </label>
            </div>

            {parsing && (
              <div className="flex items-center gap-2 text-xs font-semibold text-[#8410DC]">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Parsing and validating rate card structure...
              </div>
            )}
          </div>

          {/* Validation & Preview Table */}
          {previewData && (
            <div className="bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#F2ECF7] rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-[#F2ECF7] pb-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-[#14121F] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Step 2: Preview & Confirm Import
                  </h2>
                  <div className="flex items-center gap-4 text-xs font-semibold mt-1">
                    <span className="text-slate-600 dark:text-[#534F66]">Total: {previewData.total_rows} rows</span>
                    <span className="text-emerald-600">Valid: {previewData.valid_rows}</span>
                    <span className="text-rose-600">Errors: {previewData.invalid_rows}</span>
                  </div>
                </div>

                {/* Import Mode Selector & Trigger */}
                <div className="flex items-center gap-3">
                  <select
                    value={importMode}
                    onChange={(e: any) => setImportMode(e.target.value)}
                    className="px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-[#E8DEF2] rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="append">Append to existing rate cards</option>
                    <option value="replace">Replace all existing rate cards</option>
                  </select>

                  <button
                    onClick={handleImport}
                    disabled={importing || previewData.valid_rows === 0}
                    className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
                  >
                    {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                    <span>{importing ? 'Importing...' : 'Confirm & Import Database'}</span>
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-[#F2ECF7] bg-slate-50 dark:bg-white/[0.02] text-[#7E7994] font-bold">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Courier</th>
                      <th className="py-2.5 px-3">Zone</th>
                      <th className="py-2.5 px-3">Service</th>
                      <th className="py-2.5 px-3">Min Wt</th>
                      <th className="py-2.5 px-3">Max Wt</th>
                      <th className="py-2.5 px-3">Base Rate</th>
                      <th className="py-2.5 px-3">Add Wt</th>
                      <th className="py-2.5 px-3">Add Rate</th>
                      <th className="py-2.5 px-3">COD Flat</th>
                      <th className="py-2.5 px-3">COD %</th>
                      <th className="py-2.5 px-3">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                    {previewData.results.map((row: any) => (
                      <tr key={row.row_number} className={row.valid ? 'hover:bg-slate-50 dark:hover:bg-white/[0.02]' : 'bg-rose-50/40 dark:bg-rose-955/10'}>
                        <td className="py-2.5 px-3 font-mono text-[#534F66]">{row.row_number}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{row.data.courier_name}</td>
                        <td className="py-2.5 px-3 font-semibold text-[#8410DC]">{row.data.zone}</td>
                        <td className="py-2.5 px-3 capitalize">{row.data.service_type}</td>
                        <td className="py-2.5 px-3">{row.data.min_weight_kg.toFixed(3)} kg</td>
                        <td className="py-2.5 px-3">{row.data.max_weight_kg.toFixed(3)} kg</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-600">₹{row.data.base_rate.toFixed(2)}</td>
                        <td className="py-2.5 px-3">{row.data.additional_weight_kg.toFixed(3)} kg</td>
                        <td className="py-2.5 px-3">₹{row.data.additional_rate.toFixed(2)}</td>
                        <td className="py-2.5 px-3">₹{row.data.cod_charge_flat.toFixed(2)}</td>
                        <td className="py-2.5 px-3">{row.data.cod_charge_percent.toFixed(2)}%</td>
                        <td className="py-2.5 px-3">
                          {row.valid ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">Valid</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">{row.errors.join(', ')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ACTIVE RATE CARDS */}
      {activeTab === 'current' && (
        <div className="bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#F2ECF7] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#F2ECF7] pb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-[#14121F] flex items-center gap-2">
              <Table className="w-4 h-4 text-[#8410DC]" />
              Active Rate Cards ({rateCardsList.length})
            </h2>
            <button onClick={fetchRateCards} className="p-2 text-[#534F66] hover:text-slate-600 rounded-lg">
              <RefreshCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingList ? (
            <div className="p-8 text-center text-xs font-semibold text-[#534F66]">Loading rate cards...</div>
          ) : rateCardsList.length === 0 ? (
            <div className="p-12 text-center text-xs font-semibold text-[#534F66]">
              No rate cards imported yet. Switch to "Upload & Preview" tab to import your first rate card.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-[#F2ECF7] bg-slate-50 dark:bg-white/[0.02] text-[#7E7994] font-bold">
                    <th className="py-3 px-4">Courier Name</th>
                    <th className="py-3 px-4">Zone</th>
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4">Min Wt</th>
                    <th className="py-3 px-4">Max Wt</th>
                    <th className="py-3 px-4">Base Rate</th>
                    <th className="py-3 px-4">Add Wt</th>
                    <th className="py-3 px-4">Add Rate</th>
                    <th className="py-3 px-4">COD Charge</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                  {rateCardsList.map((rc) => (
                    <tr key={rc.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{rc.courier_name}</td>
                      <td className="py-3 px-4 font-semibold text-[#8410DC]">{rc.zone}</td>
                      <td className="py-3 px-4 capitalize">{rc.service_type}</td>
                      <td className="py-3 px-4">{parseFloat(rc.min_weight_kg).toFixed(3)} kg</td>
                      <td className="py-3 px-4">{parseFloat(rc.max_weight_kg).toFixed(3)} kg</td>
                      <td className="py-3 px-4 font-bold text-emerald-600">₹{parseFloat(rc.base_rate).toFixed(2)}</td>
                      <td className="py-3 px-4">{parseFloat(rc.additional_weight_kg || 0.5).toFixed(3)} kg</td>
                      <td className="py-3 px-4">₹{parseFloat(rc.additional_rate || 0).toFixed(2)}</td>
                      <td className="py-3 px-4">₹{parseFloat(rc.cod_charge_flat || 0).toFixed(2)} ({parseFloat(rc.cod_charge_percent || 0).toFixed(1)}%)</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600">Active</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: UPLOAD HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-[#131620] border border-slate-200 dark:border-[#F2ECF7] rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-[#14121F] flex items-center gap-2 border-b border-slate-100 dark:border-[#F2ECF7] pb-4">
            <History className="w-4 h-4 text-[#8410DC]" />
            Upload History Log
          </h2>

          {historyList.length === 0 ? (
            <div className="p-8 text-center text-xs font-semibold text-[#534F66]">No upload history records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-[#F2ECF7] bg-slate-50 dark:bg-white/[0.02] text-[#7E7994] font-bold">
                    <th className="py-3 px-4">File Name</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4">Success</th>
                    <th className="py-3 px-4">Failed</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Uploaded At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                  {historyList.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#534F66]" />
                        {log.file_name}
                      </td>
                      <td className="py-3 px-4 capitalize font-medium">{log.import_mode}</td>
                      <td className="py-3 px-4 font-semibold">{log.total_rows}</td>
                      <td className="py-3 px-4 font-bold text-emerald-600">{log.success_rows}</td>
                      <td className="py-3 px-4 font-bold text-rose-600">{log.failed_rows}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          log.status === 'success' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#7E7994]">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
