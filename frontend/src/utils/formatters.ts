/**
 * Unified Formatting Helpers for Bighrissen Phone POS & Retail System.
 * Ensures strict currency, date, and numerical consistency across all pages.
 */

/**
 * Format currency in Moroccan Dirhams (DH) with consistent thousand separators and 2 decimals.
 * Example: 2700 -> "2 700,00 DH"
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '0,00 DH';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0,00 DH';

  const formatted = num.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).replace(/\u202F/g, ' '); // Standardize non-breaking narrow space to regular space

  return `${formatted} DH`;
}

/**
 * Format date in standard French/European DD/MM/YYYY format.
 * Example: "2026-10-16T18:02:00Z" -> "16/10/2026"
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Format date and time in DD/MM/YYYY HH:mm (24h) format.
 * Example: "2026-10-16T18:02:00Z" -> "16/10/2026 18:02"
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Format plain integer or float numbers with space thousands separators.
 * Example: 12500 -> "12 500"
 */
export function formatNumber(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return '0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0';

  return num.toLocaleString('fr-FR').replace(/\u202F/g, ' ');
}
