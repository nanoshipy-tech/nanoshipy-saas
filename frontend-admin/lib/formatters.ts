/**
 * Utility formatters for Nanoshipy Admin
 */

export function formatINR(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '₹0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₹0.00';
  const isNegative = num < 0;
  const formatted = Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (isNegative ? '-₹' : '₹') + formatted;
}

export function formatDate(date: string | number | Date | null | undefined): string {
  if (!date) return '-';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
}

export function formatDateTime(date: string | number | Date | null | undefined): string {
  if (!date) return '-';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '-';
  }
}

export function formatWeight(weight: number | string | null | undefined, unit: 'g' | 'kg' = 'kg'): string {
  if (weight === null || weight === undefined || weight === '') return '0 kg';
  const num = typeof weight === 'string' ? parseFloat(weight) : weight;
  if (isNaN(num)) return '0 kg';
  if (unit === 'g') {
    return num >= 1000 ? `${(num / 1000).toFixed(2)} kg` : `${num} g`;
  }
  return `${num.toFixed(2)} kg`;
}

export function formatStatus(status: string | null | undefined): string {
  if (!status) return 'Unknown';
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
