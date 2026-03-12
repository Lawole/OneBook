// Currencies where Intl outputs a code text instead of the proper symbol
const CURRENCY_SYMBOLS = {
  NGN: '₦',
  GHS: '₵',
  KES: 'KSh',
  AED: 'د.إ',
  SAR: '﷼',
};

export const formatCurrency = (amount, currency = 'USD') => {
  const code = currency || 'USD';
  try {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
    }).format(amount || 0);

    // Replace code-text symbols with proper symbols where Intl falls back to code
    if (CURRENCY_SYMBOLS[code]) {
      return formatted.replace(new RegExp(`^${code}\\s?`), CURRENCY_SYMBOLS[code]);
    }
    return formatted;
  } catch {
    const sym = CURRENCY_SYMBOLS[code] || code;
    return `${sym}${(amount || 0).toFixed(2)}`;
  }
};

export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const downloadFile = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};