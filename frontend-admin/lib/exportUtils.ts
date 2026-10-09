import { apiClient } from './apiClient';
import toast from 'react-hot-toast';

/**
 * Initiates a browser download from a Blob.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Downloads an export file from an authenticated API endpoint.
 */
export async function downloadReportFile(
  endpoint: string,
  params: Record<string, any> = {},
  fallbackFilename: string = 'report.csv'
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
