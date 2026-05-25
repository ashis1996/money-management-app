/**
 * MoneyMind Database Seed Script
 *
 * Populates the database with:
 * - System categories
 * - Sample user (for testing)
 * - Sample transactions from SMS
 * - Sample subscriptions
 * - Sample budgets
 */

import { PrismaClient, TransactionType, TransactionSource, AccountType, NotificationType, NotificationPriority } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ============================================================
// SYSTEM CATEGORIES
// ============================================================

const SYSTEM_CATEGORIES = [
  // Income
  { name: 'Income', icon: '💰', color: '#10B981', description: 'Salary, wages, and other income' },
  { name: 'Refund', icon: '↩️', color: '#34D399', description: 'Refunds and cashback' },

  // Essential Expenses
  { name: 'Food & Dining', icon: '🍔', color: '#F59E0B', description: 'Restaurants, food delivery, groceries' },
  { name: 'Transport', icon: '🚗', color: '#3B82F6', description: 'Fuel, taxi, public transport' },
  { name: 'Shopping', icon: '🛍️', color: '#8B5CF6', description: 'Retail purchases, online shopping' },
  { name: 'Bills & Utilities', icon: '📱', color: '#6366F1', description: 'Electricity, water, internet, phone' },
  { name: 'Healthcare', icon: '🏥', color: '#EC4899', description: 'Medical, pharmacy, hospital' },
  { name: 'Education', icon: '📚', color: '#14B8A6', description: 'Tuition, courses, books' },
  { name: 'Entertainment', icon: '🎬', color: '#F43F5E', description: 'Movies, streaming, gaming' },

  // Financial
  { name: 'ATM', icon: '🏧', color: '#6B7280', description: 'Cash withdrawals' },
  { name: 'Transfer', icon: '💸', color: '#9CA3AF', description: 'Money transfers, UPI, IMPS' },
  { name: 'Investment', icon: '📈', color: '#059669', description: 'Stocks, mutual funds, SIP' },
  { name: 'Insurance', icon: '🛡️', color: '#0891B2', description: 'Life, health, vehicle insurance' },
  { name: 'Loan', icon: '💳', color: '#DC2626', description: 'Loan EMI payments' },
  { name: 'Tax', icon: '📄', color: '#7C3AED', description: 'Income tax, GST' },

  // Subscriptions
  { name: 'Subscription', icon: '🔄', color: '#EA580C', description: 'Recurring payments, memberships' },

  // Other
  { name: 'Other', icon: '📦', color: '#9CA3AF', description: 'Uncategorized transactions' },
];

// ============================================================
// SAMPLE DATA
// ============================================================

const SAMPLE_USER = {
  email: 'demo@moneymind.app',
  password: 'Demo@123456',
  name: 'Demo User',
  phone: '+919876543210',
};

const SAMPLE_ACCOUNTS = [
  {
    accountName: 'HDFC Salary Account',
    accountType: AccountType.BANK,
    providerName: 'HDFC Bank',
    maskedAccountNumber: '****5678',
    ifscCode: 'HDFC0001234',
    balance: 125000.00,
    isPrimary: true,
    color: '#4F46E5',
    icon: 'bank',
  },
  {
    accountName: 'SBI Savings',
    accountType: AccountType.BANK,
    providerName: 'State Bank of India',
    maskedAccountNumber: '****9012',
    ifscCode: 'SBIN0005678',
    balance: 45000.00,
    isPrimary: false,
    color: '#0891B2',
    icon: 'bank',
  },
  {
    accountName: 'HDFC Credit Card',
    accountType: AccountType.CREDIT_CARD,
    providerName: 'HDFC Bank',
    maskedAccountNumber: '****3456',
    balance: -15000.00,
    isPrimary: false,
    color: '#DC2626',
    icon: 'credit-card',
  },
  {
    accountName: 'Paytm Wallet',
    accountType: AccountType.WALLET,
    providerName: 'Paytm',
    balance: 5000.00,
    isPrimary: false,
    color: '#00BAFF',
    icon: 'wallet',
  },
];

const SAMPLE_TRANSACTIONS = [
  // Salary (Credit)
  {
    merchantName: 'ABC Technologies Pvt Ltd',
    description: 'Salary credit for March 2024',
    amount: 85000.00,
    type: TransactionType.CREDIT,
    categoryName: 'Income',
    transactionDate: new Date('2024-03-01T00:00:00Z'),
    source: TransactionSource.SMS,
    rawSmsText: 'Dear Customer, INR 85,000.00 credited to your account ending 5678 on 01-MAR-24. Available balance: INR 1,25,000.00',
    smsSenderId: 'HD-BANK',
  },
  // Rent
  {
    merchantName: 'Property Management Co',
    description: 'Monthly rent payment',
    amount: 25000.00,
    type: TransactionType.DEBIT,
    categoryName: 'Bills & Utilities',
    transactionDate: new Date('2024-03-02T00:00:00Z'),
    source: TransactionSource.MANUAL,
  },
  // Netflix Subscription
  {
    merchantName: 'Netflix India',
    description: 'Netflix subscription',
    amount: 649.00,
    type: TransactionType.DEBIT,
    categoryName: 'Subscription',
    transactionDate: new Date('2024-03-03T00:00:00Z'),
    source: TransactionSource.SMS,
    rawSmsText: 'INR 649.00 debited from A/C XX3456 on 03-Mar-24 via Netflix India. Balance: INR 44,351.00',
    smsSenderId: 'HD-BANK',
    isSubscription: true,
  },
  // Zomato Order
  {
    merchantName: 'Zomato',
    description: 'Food delivery',
    amount: 450.00,
    type: TransactionType.DEBIT,
    categoryName: 'Food & Dining',
    transactionDate: new Date('2024-03-04T19:30:00Z'),
    source: TransactionSource.SMS,
    rawSmsText: 'Rs. 450.00 debited from your account ending 3456 at ZOMATO on 04/03/24. Balance: Rs. 43,901.00',
    smsSenderId: 'HD-BANK',
  },
  // Uber Ride
  {
    merchantName: 'Uber India',
    description: 'Cab ride',
    amount: 285.00,
    type: TransactionType.DEBIT,
    categoryName: 'Transport',
    transactionDate: new Date('2024-03-05T08:15:00Z'),
    source: TransactionSource.SMS,
    rawSmsText: 'INR 285 debited from A/C XX3456 on 05-Mar-24 via UBER. Balance: INR 43,616.00',
    smsSenderId: 'HD-BANK',
  },
  // Amazon Shopping
  {
    merchantName: 'Amazon India',
    description: 'Online shopping',
    amount: 3999.00,
    type: TransactionType.DEBIT,
    categoryName: 'Shopping',
    transactionDate: new Date('2024-03-06T14:20:00Z'),
    source: TransactionSource.SMS,
    rawSmsText: 'Dear Customer, Rs. 3,999.00 debited from your account ending 3456 at AMAZON on 06/03/24. Balance: Rs. 39,617.00',
    smsSenderId: 'HD-BANK',
  },
  // Fuel
  {
    merchantName: 'Indian Oil Petrol Pump',
    description: 'Fuel purchase',
    amount: 2000.00,
    type: TransactionType.DEBIT,
    categoryName: 'Transport',
    transactionDate: new Date('2024-03-07T10:00:00Z'),
    source: TransactionSource.SMS,
    rawSmsText: 'Rs. 2,000.00 debited from your account ending 5678 at IOC PETROL on 07/03/24. Balance: Rs. 1,23,000.00',
    smsSenderId: 'HD-BANK',
  },
  // Spotify Subscription
  {
    merchantName: 'Spotify AB',
    description: 'Spotify Premium',
    amount: 119.00,
    type: TransactionType.DEBIT,
    categoryName: 'Subscription',
    transactionDate: new Date('2024-03-08T00:00:00Z'),
    source: TransactionSource.SMS,
    isSubscription: true,
  },
  // ATM Withdrawal
  {
    merchantName: 'HDFC ATM',
    description: 'Cash withdrawal',
    amount: 5000.00,
    type: TransactionType.DEBIT,
    categoryName: 'ATM',
    transactionDate: new Date('2024-03-09T16:45:00Z'),
    source: TransactionSource.SMS,
    rawSmsText: 'INR 5,000.00 debited from A/C XX5678 on 09-Mar-24 via ATM withdrawal. Balance: INR 1,18,000.00',
    smsSenderId: 'HD-BANK',
  },
  // UPI Transfer
  {
    merchantName: 'John Doe',
    description: 'UPI transfer to friend',
    amount: 1000.00,
    type: TransactionType.DEBIT,
    categoryName: 'Transfer',
    transactionDate: new Date('2024-03-10T12:30:00Z'),
    source: TransactionSource.SMS,
    rawSmsText: 'Rs. 1,000.00 debited from your account ending 5678 via UPI to JOHN DOE on 10/03/24. Balance: Rs. 1,17,000.00',
    smsSenderId: 'HD-BANK',
  },
  // Medical
  {
    merchantName: 'Apollo Pharmacy',
    description: 'Medicine purchase',
    amount: 850.00,
    type: TransactionType.DEBIT,
    categoryName: 'Healthcare',
    transactionDate: new Date('2024-03-11T18:00:00Z'),
    source: TransactionSource.SMS,
  },
  // Electricity Bill
  {
    merchantName: 'BESCOM Electricity',
    description: 'Electricity bill payment',
    amount: 1850.00,
    type: TransactionType.DEBIT,
    categoryName: 'Bills & Utilities',
    transactionDate: new Date('2024-03-12T00:00:00Z'),
    source: TransactionSource.SMS,
  },
  // Entertainment
  {
    merchantName: 'PVR Cinemas',
    description: 'Movie tickets',
    amount: 800.00,
    type: TransactionType.DEBIT,
    categoryName: 'Entertainment',
    transactionDate: new Date('2024-03-13T20:00:00Z'),
    source: TransactionSource.SMS,
  },
  // Investment
  {
    merchantName: 'Zerodha Broking',
    description: 'Stock investment',
    amount: 10000.00,
    type: TransactionType.DEBIT,
    categoryName: 'Investment',
    transactionDate: new Date('2024-03-15T00:00:00Z'),
    source: TransactionSource.SMS,
  },
  // Freelance Income
  {
    merchantName: 'Upwork Inc',
    description: 'Freelance project payment',
    amount: 15000.00,
    type: TransactionType.CREDIT,
    categoryName: 'Income',
    transactionDate: new Date('2024-03-16T00:00:00Z'),
    source: TransactionSource.SMS,
  },
];

const SAMPLE_SUBSCRIPTIONS = [
  {
    name: 'Netflix Premium',
    merchantName: 'Netflix India',
    amount: 649.00,
    frequency: 'MONTHLY' as const,
    status: 'ACTIVE' as const,
    categoryName: 'Subscription',
    nextBillingDate: new Date('2024-04-03'),
    lastPaymentDate: new Date('2024-03-03'),
  },
  {
    name: 'Spotify Premium',
    merchantName: 'Spotify AB',
    amount: 119.00,
    frequency: 'MONTHLY' as const,
    status: 'ACTIVE' as const,
    categoryName: 'Subscription',
    nextBillingDate: new Date('2024-04-08'),
    lastPaymentDate: new Date('2024-03-08'),
  },
  {
    name: 'Amazon Prime',
    merchantName: 'Amazon India',
    amount: 1499.00,
    frequency: 'YEARLY' as const,
    status: 'ACTIVE' as const,
    categoryName: 'Subscription',
    nextBillingDate: new Date('2025-01-15'),
    lastPaymentDate: new Date('2024-01-15'),
  },
  {
    name: 'Gym Membership',
    merchantName: 'Gold\'s Gym',
    amount: 2500.00,
    frequency: 'MONTHLY' as const,
    status: 'ACTIVE' as const,
    categoryName: 'Healthcare',
    nextBillingDate: new Date('2024-04-01'),
    lastPaymentDate: new Date('2024-03-01'),
  },
];

const SAMPLE_BUDGETS = [
  {
    name: 'Food & Dining Budget',
    categoryName: 'Food & Dining',
    amountLimit: 8000.00,
    period: 'MONTHLY' as const,
    startDate: new Date('2024-03-01'),
    endDate: new Date('2024-03-31'),
    alertThreshold: 0.80,
  },
  {
    name: 'Shopping Budget',
    categoryName: 'Shopping',
    amountLimit: 10000.00,
    period: 'MONTHLY' as const,
    startDate: new Date('2024-03-01'),
    endDate: new Date('2024-03-31'),
    alertThreshold: 0.80,
  },
  {
    name: 'Transport Budget',
    categoryName: 'Transport',
    amountLimit: 5000.00,
    period: 'MONTHLY' as const,
    startDate: new Date('2024-03-01'),
    endDate: new Date('2024-03-31'),
    alertThreshold: 0.80,
  },
  {
    name: 'Entertainment Budget',
    categoryName: 'Entertainment',
    amountLimit: 3000.00,
    period: 'MONTHLY' as const,
    startDate: new Date('2024-03-01'),
    endDate: new Date('2024-03-31'),
    alertThreshold: 0.80,
  },
];

// ============================================================
// SEED FUNCTIONS
// ============================================================

async function seedSystemCategories() {
  console.log('📁 Seeding system categories...');

  const categories = [];
  for (const cat of SYSTEM_CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: { name: cat.name, isSystem: true },
    });

    if (existing) {
      categories.push(existing);
      continue;
    }

    const category = await prisma.category.create({
      data: {
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        description: cat.description,
        isSystem: true,
      },
    });
    categories.push(category);
  }

  console.log(`   ✅ Created ${categories.length} system categories`);
  return categories;
}

async function seedSampleUser() {
  console.log('👤 Seeding sample user...');

  const passwordHash = await bcrypt.hash(SAMPLE_USER.password, 10);

  const user = await prisma.user.upsert({
    where: { email: SAMPLE_USER.email },
    update: {
      name: SAMPLE_USER.name,
      phone: SAMPLE_USER.phone,
      passwordHash,
    },
    create: {
      email: SAMPLE_USER.email,
      passwordHash,
      name: SAMPLE_USER.name,
      phone: SAMPLE_USER.phone,
      emailVerified: true,
      phoneVerified: true,
    },
  });

  console.log(`   ✅ Created user: ${user.email}`);
  return user;
}

async function seedAccounts(userId: string) {
  console.log('🏦 Seeding accounts...');

  const accounts = [];
  for (const acc of SAMPLE_ACCOUNTS) {
    const existing = await prisma.account.findFirst({
      where: { userId, accountName: acc.accountName },
    });

    if (existing) {
      accounts.push(existing);
      continue;
    }

    const account = await prisma.account.create({
      data: {
        userId,
        ...acc,
      },
    });
    accounts.push(account);
  }

  console.log(`   ✅ Created ${accounts.length} accounts`);
  return accounts;
}

async function seedTransactions(userId: string, categories: any[]) {
  console.log('💳 Seeding transactions...');

  const categoryMap = new Map(categories.map(c => [c.name, c.id]));
  let created = 0;

  for (const tx of SAMPLE_TRANSACTIONS) {
    const categoryId = categoryMap.get(tx.categoryName);

    const existing = await prisma.transaction.findFirst({
      where: {
        userId,
        merchantName: tx.merchantName,
        amount: tx.amount,
        transactionDate: tx.transactionDate,
      },
    });

    if (!existing) {
      await prisma.transaction.create({
        data: {
          userId,
          accountId: null,
          categoryId,
          merchantName: tx.merchantName,
          description: tx.description,
          amount: tx.amount,
          type: tx.type,
          transactionDate: tx.transactionDate,
          source: tx.source,
          rawSmsText: tx.rawSmsText,
          smsSenderId: tx.smsSenderId,
          isSubscription: tx.isSubscription || false,
        },
      });
      created++;
    }
  }

  console.log(`   ✅ Created ${created} transactions`);
}

async function seedSubscriptions(userId: string, categories: any[]) {
  console.log('🔄 Seeding subscriptions...');

  const categoryMap = new Map(categories.map(c => [c.name, c.id]));
  let created = 0;

  for (const sub of SAMPLE_SUBSCRIPTIONS) {
    const categoryId = categoryMap.get(sub.categoryName);

    const existing = await prisma.subscription.findFirst({
      where: {
        userId,
        merchantName: sub.merchantName,
      },
    });

    if (!existing) {
      await prisma.subscription.create({
        data: {
          userId,
          categoryId,
          name: sub.name,
          merchantName: sub.merchantName,
          amount: sub.amount,
          frequency: sub.frequency,
          status: sub.status,
          nextBillingDate: sub.nextBillingDate,
          lastPaymentDate: sub.lastPaymentDate,
        },
      });
      created++;
    }
  }

  console.log(`   ✅ Created ${created} subscriptions`);
}

async function seedBudgets(userId: string, categories: any[]) {
  console.log('📊 Seeding budgets...');

  const categoryMap = new Map(categories.map(c => [c.name, c.id]));

  for (const budget of SAMPLE_BUDGETS) {
    const categoryId = categoryMap.get(budget.categoryName);

    await prisma.budget.create({
      data: {
        userId,
        categoryId,
        name: budget.name,
        amountLimit: budget.amountLimit,
        period: budget.period,
        startDate: budget.startDate,
        endDate: budget.endDate,
        alertThreshold: budget.alertThreshold,
      },
    });
  }

  console.log(`   ✅ Created ${SAMPLE_BUDGETS.length} budgets`);
}

async function seedNotifications(userId: string) {
  console.log('🔔 Seeding sample notifications...');

  const notifications = [
    {
      type: NotificationType.REMINDER,
      priority: NotificationPriority.NORMAL,
      title: 'Welcome to MoneyMind!',
      message: 'Start tracking your finances and get AI-powered insights.',
    },
    {
      type: NotificationType.SUBSCRIPTION,
      priority: NotificationPriority.HIGH,
      title: 'Upcoming Payment',
      message: 'Netflix Premium of ₹649 is due soon.',
    },
    {
      type: NotificationType.BUDGET_ALERT,
      priority: NotificationPriority.NORMAL,
      title: 'Budget Alert',
      message: 'You have spent 75% of your Food & Dining budget.',
    },
  ];

  for (const notif of notifications) {
    await prisma.notification.create({
      data: {
        userId,
        type: notif.type,
        priority: notif.priority,
        title: notif.title,
        message: notif.message,
      },
    });
  }

  console.log(`   ✅ Created ${notifications.length} notifications`);
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('\n🌱 Starting database seed...\n');

  // Seed system categories first
  const categories = await seedSystemCategories();

  // Create sample user
  const user = await seedSampleUser();

  // Create accounts for user
  await seedAccounts(user.id);

  // Create transactions
  await seedTransactions(user.id, categories);

  // Create subscriptions
  await seedSubscriptions(user.id, categories);

  // Create budgets
  await seedBudgets(user.id, categories);

  // Create notifications
  await seedNotifications(user.id);

  console.log('\n✅ Database seeding completed successfully!\n');
  console.log('📝 Sample credentials:');
  console.log(`   Email: ${SAMPLE_USER.email}`);
  console.log(`   Password: ${SAMPLE_USER.password}\n`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
