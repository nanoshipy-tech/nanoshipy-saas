import { API_URL } from './env';
import { apiClient } from './apiClient';

/**
 * Resolves a storage path or URL to an absolute URL pointing to the backend static storage.
 * @param pathOrUrl Path like "/uploads/shipments/labels/abc.pdf" or full URL
 * @returns Fully qualified absolute URL
 */
export function resolveAssetUrl(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://') || pathOrUrl.startsWith('blob:')) {
    return pathOrUrl;
  }
  const apiOrigin = API_URL.replace(/\/api\/v1\/?$/, '');
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${apiOrigin}${cleanPath}`;
}

/**
 * Fetches an authenticated PDF document via apiClient, generates a Blob URL,
 * and opens it in a browser window or triggers direct download.
 */
export async function openAuthenticatedPdf(
  endpointOrPath: string,
  defaultFilename: string = 'document.pdf',
  preOpenedWindow: Window | null = null
): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const cleanEndpoint = endpointOrPath.replace(/^\/api\/v1/, '');
    const res = await apiClient.get(cleanEndpoint, { responseType: 'blob' });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const blobUrl = window.URL.createObjectURL(blob);

    if (preOpenedWindow && !preOpenedWindow.closed) {
      preOpenedWindow.location.href = blobUrl;
      return;
    }

    const newWin = window.open(blobUrl, '_blank');
    if (!newWin) {
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = defaultFilename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  } catch (err) {
    if (preOpenedWindow && !preOpenedWindow.closed) {
      preOpenedWindow.close();
    }
    throw err;
  }
}

/**
 * Opens a PDF document URL in a browser window safely without triggering Chromium
 * synthetic anchor navigation errors ("reportAllChanges" / "startTime").
 *
 * @param pathOrUrl PDF URL or storage path
 * @param preOpenedWindow Optional Window pre-opened in the synchronous click gesture
 */
export function openPdfDocument(
  pathOrUrl: string | null | undefined,
  preOpenedWindow: Window | null = null
): void {
  if (!pathOrUrl || typeof window === 'undefined') {
    if (preOpenedWindow && !preOpenedWindow.closed) {
      preOpenedWindow.close();
    }
    return;
  }

  // If path is a dynamic authenticated API route (e.g. /orders/:id/pdf, /invoices/:id/pdf)
  if (
    (pathOrUrl.startsWith('/orders/') || pathOrUrl.startsWith('/invoices/')) &&
    pathOrUrl.includes('/pdf') &&
    !pathOrUrl.startsWith('/uploads/')
  ) {
    openAuthenticatedPdf(pathOrUrl, 'order-invoice.pdf', preOpenedWindow).catch((err) => {
      console.error('Failed to open authenticated PDF:', err);
    });
    return;
  }

  const fullUrl = resolveAssetUrl(pathOrUrl);

  // 1. If caller pre-opened a window synchronously in the user click gesture
  if (preOpenedWindow && !preOpenedWindow.closed) {
    try {
      preOpenedWindow.location.href = fullUrl;
      return;
    } catch (_) {}
  }

  // 2. Try window.open directly
  try {
    const newWindow = window.open(fullUrl, '_blank', 'noopener,noreferrer');
    if (newWindow && !newWindow.closed) {
      return;
    }
  } catch (_) {}

  // 3. Safe fallback: use an invisible iframe without synthetic <a> clicks
  // This avoids the Chromium Soft Navigation bug: "TypeError: Cannot read properties of undefined (reading 'startTime')"
  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = fullUrl;
    document.body.appendChild(iframe);
    setTimeout(() => {
      try {
        document.body.removeChild(iframe);
      } catch (_) {}
    }, 60000);
  } catch (_) {
    window.location.assign(fullUrl);
  }
}
