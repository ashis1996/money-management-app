// SMS parsing constants

export const TRANSACTION_KEYWORDS: Record<string, string[]> = {
  CREDIT: [
    'credited',
    'credited to',
    'received',
    'deposit',
    'transfer to',
    'inward transfer',
    'refund',
    'cashback',
    'interest',
  ],
  DEBIT: [
    'debited',
    'debited from',
    'paid',
    'payment',
    'purchase',
    'withdrawal',
    'transfer from',
    'outward transfer',
    'spent',
  ],
  ATM: ['atm', 'cash withdrawal', 'cash withdraw'],
  SUBSCRIPTION: ['subscription', 'recurring', 'auto debit', 'autopay', 'standing instruction'],
  TRANSFER: ['transfer', 'imps', 'neft', 'rtgs', 'upi'],
};

export const CATEGORY_MAPPINGS: Record<string, string[]> = {
  SHOPPING: ['amazon', 'flipkart', 'myntra', 'ajio'],
  GROCERY: ['bigbasket', 'grofers', 'blinkit', 'zepto'],
  // Renamed from FOOD → FOOD_DINING to match the canonical category
  // identifier used everywhere else (notification DTOs, dashboard, the
  // mobile category picker). The keyword list now also catches
  // table-service / quick-service merchants whose names don't include a
  // delivery brand (e.g. Pizza Hut, Domino's, Starbucks).
  FOOD_DINING: [
    'swiggy',
    'zomato',
    'uber eats',
    'dineout',
    'pizza',
    'pizza hut',
    'dominos',
    "domino's",
    'kfc',
    'mcdonald',
    'starbucks',
    'cafe',
    'restaurant',
  ],
  TRANSPORT: ['uber', 'ola', 'rapido'],
  TRAVEL: ['irctc', 'makemytrip', 'goibibo', 'redbus'],
  ENTERTAINMENT: ['netflix', 'prime video', 'hotstar'],
  UTILITIES: ['jio', 'airtel', 'vi', 'electricity', 'gas'],
  HEALTHCARE: ['pharmacy', 'medicine', '1mg', 'apollo'],
  FUEL: ['fuel', 'petrol', 'diesel', 'hpcl', 'iocl', 'bpcl'],
  SUBSCRIPTION: ['subscription', 'recurring', 'auto debit'],
};

export const SMS_PATTERNS = {
  AMOUNT:
    /(?:Rs\.?|₹)\s*(\d+(?:,\d{3})*(?:\.\d{2})?)|\b(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:Rs\.?|INR)?/i,
  DATE: /(\d{1,2}\/\d{1,2}\/\d{2,4})|(\d{1,2}-\d{1,2}-\d{2,4})/i,
  BALANCE: /(?:balance|avail.*balance)[^$₹Rs]*(?:Rs\.?|₹)?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
  ACCOUNT: /(?:A\/c|Account|A\/C)[\s#:]*([0-9X]{4,})/i,
  MERCHANT: /(?:at|to|from|@)\s+([A-Za-z\s.&]+)/i,
};

export const BANK_SENDER_MAPPING: Record<string, string> = {
  HDFCBK: 'HDFC Bank',
  HDFC: 'HDFC Bank',
  ICICIB: 'ICICI Bank',
  ICICI: 'ICICI Bank',
  SBIBNK: 'SBI',
  SBI: 'SBI',
  AXIBNK: 'Axis Bank',
  AXIS: 'Axis Bank',
  KKBK: 'Kotak Mahindra Bank',
  KOTAK: 'Kotak Mahindra Bank',
  SWIGGY: 'Swiggy',
  ZOMATO: 'Zomato',
  UBER: 'Uber',
  OLA: 'Ola',
  NETFLIX: 'Netflix',
  AMZN: 'Amazon',
  FLIPKART: 'Flipkart',
};
