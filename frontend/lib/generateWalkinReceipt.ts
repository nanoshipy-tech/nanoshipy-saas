import { apiClient } from './apiClient';
import toast from 'react-hot-toast';

export interface PrintReceiptOptions {
  autoPrint?: boolean;
  download?: boolean;
}

/**
 * Generates and opens or downloads the Walk-in Customer Retail Courier Receipt PDF.
 * @param orderId Order ID string
 * @param options Auto-print or download options
 */
export async function generateWalkinReceipt(
  orderId: string,
  options: PrintReceiptOptions = { autoPrint: true }
): Promise<string | null> {
  const toastId = toast.loading('Generating customer receipt PDF...');
  try {
    const res = await apiClient.get(`/orders/${orderId}/receipt`, {
      responseType: 'blob',
    });

    const blob = new Blob([res.data], { type: 'application/pdf' });
    const blobUrl = window.URL.createObjectURL(blob);

    if (options.download) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `receipt-${orderId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('Receipt downloaded successfully', { id: toastId });
      return blobUrl;
    }

    // Open in a new window/tab for preview and printing
    const printWindow = window.open(blobUrl, '_blank');
    if (printWindow) {
      printWindow.focus();
      toast.success('Receipt opened for printing', { id: toastId });
    } else {
      // Fallback if popup blocker intercepted
      const a = document.createElement('a');
      a.href = blobUrl;
      a.target = '_blank';
      a.click();
      toast.success('Receipt opened', { id: toastId });
    }

    return blobUrl;
  } catch (err: any) {
    console.error('Failed to generate walkin receipt:', err);
    toast.error(err.response?.data?.error?.message || 'Failed to generate customer receipt PDF', { id: toastId });
    return null;
  }
}
