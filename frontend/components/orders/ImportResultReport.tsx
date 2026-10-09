import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, ArrowDownToLine } from 'lucide-react';
import { getAccessToken } from '@/lib/apiClient';

interface ImportRecord {
  id: string;
  file_name: string;
  total_rows: number;
  success_count: number;
  failed_count: number;
  error_report_url: string | null;
  status: 'processing' | 'completed' | 'failed';
  created_at: string;
}

interface ImportResultReportProps {
  record: ImportRecord;
}

export const ImportResultReport: React.FC<ImportResultReportProps> = ({ record }) => {
  const isFailed = record.status === 'failed';
  const isCompleted = record.status === 'completed';

  return (
    <div className="bg-white dark:bg-[#131620] rounded-xl border border-slate-100 dark:border-white/[0.06] shadow-sm p-6 space-y-6">
      <div className="flex items-center space-x-3 border-b border-slate-100 dark:border-white/[0.06] pb-4">
        {isCompleted && record.failed_count === 0 && (
          <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
        )}
        {isCompleted && record.failed_count > 0 && (
          <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0" />
        )}
        {isFailed && (
          <AlertCircle className="h-6 w-6 text-rose-500 shrink-0" />
        )}
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-white truncate">Import Summary: {record.file_name}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Uploaded on {new Date(record.created_at).toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Total rows */}
        <div className="bg-slate-50 dark:bg-[#0f1117] p-4 rounded-xl border border-slate-100/50 dark:border-white/[0.04] text-center">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Rows</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{record.total_rows}</p>
        </div>

        {/* Success count */}
        <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 text-center">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1">Successful</p>
          <p className="text-2xl font-bold text-emerald-950 dark:text-emerald-300">{record.success_count}</p>
        </div>

        {/* Failed count */}
        <div className="bg-rose-50 dark:bg-rose-950/20 p-4 rounded-xl border border-rose-100 dark:border-rose-900/30 text-center">
          <p className="text-xs font-medium text-rose-700 dark:text-rose-450 uppercase tracking-wider mb-1">Failed</p>
          <p className="text-2xl font-bold text-rose-950 dark:text-rose-300">{record.failed_count}</p>
        </div>
      </div>

      {/* Partial failure error download banner */}
      {record.failed_count > 0 && record.error_report_url && (() => {
        const token = getAccessToken();
        const separator = record.error_report_url.includes('?') ? '&' : '?';
        const downloadUrl = token ? `${record.error_report_url}${separator}token=${encodeURIComponent(token)}` : record.error_report_url;

        return (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-3 sm:space-y-0 sm:space-x-4">
            <div className="text-sm text-amber-800 dark:text-amber-300">
              <p className="font-semibold mb-0.5">Import completed with errors</p>
              <p className="text-xs">Some rows failed database insertion or pattern validation. Click download to get the error report sheet.</p>
            </div>
            <a
              href={downloadUrl}
              download={`import-errors-${record.id || 'batch'}.csv`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1.5 bg-amber-600 dark:bg-amber-700 hover:bg-amber-750 dark:hover:bg-amber-800 text-white font-semibold text-xs py-2 px-4 rounded-lg shadow transition cursor-pointer shrink-0 outline-none"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              <span>Download Error Report</span>
            </a>
          </div>
        );
      })()}
    </div>
  );
};
