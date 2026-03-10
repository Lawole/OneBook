import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/helpers';

/**
 * Returns a fmt() function bound to the company's base currency.
 * Usage:  const { fmt, currency } = useCurrency();
 *         fmt(1234.56)  →  "₦1,234.56"  (for NGN companies)
 */
const useCurrency = () => {
  const { user } = useAuth();
  const currency = user?.base_currency || 'USD';
  const fmt = (amount) => formatCurrency(amount, currency);
  return { fmt, currency };
};

export default useCurrency;
