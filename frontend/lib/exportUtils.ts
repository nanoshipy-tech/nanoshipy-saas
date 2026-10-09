import { apiClient } from './apiClient';
import toast from 'react-hot-toast';

/**
 * Initiates an immediate browser file download from a Blob.
 */
export function downloadBlob(blob: Blob, filename: string) {
  if (typeof window === 'undefined') return;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 200);
}

/**
 * Converts headers and row objects into a formatted CSV file and triggers an instant download.
 */
export function exportDataToCsv(
  filename: string,
  columns: { key: string; header: string }[],
  data: Record<string, any>[]
) {
  if (!data || data.length === 0) {
    toast.error('No records available to export.');
    return;
  }

  const escapeCell = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerLine = columns.map((c) => escapeCell(c.header)).join(',');
  const rowLines = data.map((row) =>
    columns.map((c) => escapeCell(row[c.key])).join(',')
  );

  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
  toast.success(`Exported ${data.length} records to ${filename}`);
}

/**
 * Downloads an export file from an authenticated API endpoint.
 */
export async function downloadReportFile(
  endpoint: string,
  params: Record<string, any> = {},
  fallbackFilename: string = 'nanoshipy_report.csv'
) {
  try {
    const toastId = toast.loading('Generating export file...');
    const res = await apiClient.get(endpoint, {
      params,
      responseType: 'blob',
    });

    let filename = fallbackFilename;
    const disposition = typeof res.headers['content-disposition'] === 'string' ? res.headers['content-disposition'] : '';
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    const contentType = typeof res.headers['content-type'] === 'string' ? res.headers['content-type'] : 'text/csv';
    const blob = new Blob([res.data], { type: contentType });
    downloadBlob(blob, filename);

    toast.success('Report downloaded successfully', { id: toastId });
  } catch (err: any) {
    toast.error('Failed to download report. Please try again.');
  }
}
