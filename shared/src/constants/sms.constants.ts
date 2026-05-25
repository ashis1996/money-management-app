// SMS parsing constants

export const TRANSACTION_KEYWORDS = {
  CREDIT: [
    'credited', 'credited to', 'received', 'deposit', 'transfer to',
    'inward transfer', 'refund', 'cashback', 'interest',
  ],
  DEBIT: [
    'debited', 'debited from', 'paid', 'payment', 'purchase',
    'withdrawal', 'transfer from', 'outward transfer', 'spent',
  ],
};

export const CATEGORY_MAPPINGS: Record<string, string> = {
  'amazon': 'SHOPPING', 'flipkart': 'SHOPPING', 'myntra': 'SHOPPING', 'ajio': 'SHOPPING',
  'bigbasket': 'GROCERY', 'grofers': 'GROCERY', 'blinkit': 'GROCERY', 'zepto': 'GROCERY',
  'swiggy': 'FOOD', 'zomato': 'FOOD', 'uber eats': 'FOOD', 'dineout': 'FOOD',
  'uber': 'TRANSPORT', 'ola': 'TRANSPORT', 'rapido': 'TRANSPORT',
  'irctc': 'TRAVEL', 'makemytrip': 'TRAVEL', 'goibibo': 'TRAVEL', 'redbus': 'TRAVEL',
  'netflix': 'ENTERTAINMENT', 'prime video': 'ENTERTAINMENT', 'hotstar': 'ENTERTAINMENT',
  'jio': 'UTILITIES', 'airtel': 'UTILITIES', 'vi': 'UTILITIES',
  'pharmacy': 'HEALTHCARE', 'medicine': 'HEALTHCARE', '1mg': 'HEALTHCARE',
  'fuel': 'FUEL', 'petrol': 'FUEL', 'diesel': 'FUEL',
  'subscription': 'SUBSCRIPTION', 'recurring': 'SUBSCRIPTION', 'auto debit': 'SUBSCRIPTION',
};

export const SMS_PATTERNS = {
  AMOUNT: /(?:Rs\.?|₹)\s*(\d+(?:,\d{3})*(?:\.\d{2})?)|\b(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:Rs\.?|INR)?/i,
  DATE: /(\d{1,2}\/\d{1,2}\/\d{2,4})|(\d{1,2}-\d{1,2}-\d{2,4})/i,
  BALANCE: /(?:balance|avail.*balance)[^$₹Rs]*(?:Rs\.?|₹)?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
  ACCOUNT: /(?:A\/c|Account|A\/C)[\s#:]*([0-9X]{4,})/i,
  MERCHANT: /(?:at|to|from|@)\s+([A-Za-z\s\.&]+)/i,
};

export const BANK_SENDER_MAPPING: Record<string, string> = {
  'HDFCBK': 'HDFC Bank', 'HDFC': 'HDFC Bank',
  'ICICIB': 'ICICI Bank', 'ICICI': 'ICICI Bank',
  'SBIBNK': 'SBI', 'SBI': 'SBI',
  'AXIBNK': 'Axis Bank', 'AXIS': 'Axis Bank',
  'KKBK': 'Kotak Mahindra Bank', 'KOTAK': 'Kotak Mahindra Bank',
  'SWIGGY': 'Swiggy', 'ZOMATO': 'Zomato', 'UBER': 'Uber', 'OLA': 'Ola',
  'NETFLIX': 'Netflix', 'AMZN': 'Amazon', 'FLIPKART': 'Flipkart',
};
