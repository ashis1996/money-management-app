import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { PrismaService } from '../../config/prisma.service';
import { RabbitMQService } from '../../config/rabbitmq.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: PrismaService;
  let rabbitMQ: RabbitMQService;

  const mockNotification = {
    id: 'notif-1',
    userId: 'user-1',
    type: 'TRANSACTION',
    title: 'Money Debited',
    body: '₹500 at Amazon',
    data: null,
    channel: 'IN_APP',
    priority: 'NORMAL',
    read: false,
    readAt: null,
    sent: false,
    sentAt: null,
    createdAt: new Date(),
  };

  const mockPrismaService = {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockRabbitMQService = {
    publishNotificationRequest: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RabbitMQService, useValue: mockRabbitMQService },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    prisma = module.get<PrismaService>(PrismaService);
    rabbitMQ = module.get<RabbitMQService>(RabbitMQService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a notification', async () => {
      mockPrismaService.notification.create.mockResolvedValue(mockNotification);

      const result = await service.create('user-1', {
        type: 'TRANSACTION',
        title: 'Money Debited',
        body: '₹500 at Amazon',
        priority: 'NORMAL',
      });

      expect(result).toBeDefined();
      expect(result.type).toBe('TRANSACTION');
      expect(result.sent).toBe(false);
    });

    it('should send push notification when sendPush is true', async () => {
      mockPrismaService.notification.create.mockResolvedValue(mockNotification);
      mockPrismaService.notification.update.mockResolvedValue({ ...mockNotification, sent: true });

      await service.create('user-1', {
        type: 'TRANSACTION',
        title: 'Money Debited',
        body: '₹500 at Amazon',
        priority: 'NORMAL',
        sendPush: true,
      });

      expect(mockRabbitMQService.publishNotificationRequest).toHaveBeenCalledWith({
        userId: 'user-1',
        type: 'TRANSACTION',
        title: 'Money Debited',
        body: '₹500 at Amazon',
      });
    });

    it('should use default channel as IN_APP', async () => {
      mockPrismaService.notification.create.mockResolvedValue(mockNotification);

      await service.create('user-1', {
        type: 'TRANSACTION',
        title: 'Test',
        body: 'Test body',
      });

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          channel: 'IN_APP',
          priority: 'NORMAL',
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return all notifications', async () => {
      mockPrismaService.notification.findMany.mockResolvedValue([mockNotification]);

      const result = await service.findAll('user-1');

      expect(result).toHaveLength(1);
      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    it('should filter unread notifications', async () => {
      mockPrismaService.notification.findMany.mockResolvedValue([mockNotification]);

      await service.findAll('user-1', true);

      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', read: false },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });
  });

  describe('findOne', () => {
    it('should return notification by id', async () => {
      mockPrismaService.notification.findFirst.mockResolvedValue(mockNotification);

      const result = await service.findOne('user-1', 'notif-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('notif-1');
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      mockPrismaService.notification.findFirst.mockResolvedValue(mockNotification);
      mockPrismaService.notification.update.mockResolvedValue({ ...mockNotification, read: true });

      const result = await service.markAsRead('user-1', 'notif-1');

      expect(result.read).toBe(true);
      expect(mockPrismaService.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: {
          read: true,
          readAt: expect.any(Date),
        },
      });
    });

    it('should return null when notification not found', async () => {
      mockPrismaService.notification.findFirst.mockResolvedValue(null);

      const result = await service.markAsRead('user-1', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      mockPrismaService.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllAsRead('user-1');

      expect(result.message).toBe('All notifications marked as read');
      expect(mockPrismaService.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', read: false },
        data: {
          read: true,
          readAt: expect.any(Date),
        },
      });
    });
  });

  describe('delete', () => {
    it('should delete notification', async () => {
      mockPrismaService.notification.findFirst.mockResolvedValue(mockNotification);
      mockPrismaService.notification.delete.mockResolvedValue(mockNotification);

      const result = await service.delete('user-1', 'notif-1');

      expect(result.message).toBe('Notification deleted');
    });

    it('should return not found message when notification does not exist', async () => {
      mockPrismaService.notification.findFirst.mockResolvedValue(null);

      const result = await service.delete('user-1', 'nonexistent');

      expect(result.message).toBe('Notification not found');
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      mockPrismaService.notification.count.mockResolvedValue(5);

      const result = await service.getUnreadCount('user-1');

      expect(result.count).toBe(5);
      expect(mockPrismaService.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', read: false },
      });
    });
  });

  describe('getPreferences', () => {
    it('should return default preferences when none set', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ notificationPrefs: null });

      const result = await service.getPreferences('user-1');

      expect(result.pushEnabled).toBe(true);
      expect(result.emailEnabled).toBe(false);
      expect(result.transactionAlerts).toBe(true);
      expect(result.minAmountForAlert).toBe(1000);
    });

    it('should merge stored preferences with defaults', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        notificationPrefs: { pushEnabled: false, minAmountForAlert: 500 },
      });

      const result = await service.getPreferences('user-1');

      expect(result.pushEnabled).toBe(false);
      expect(result.minAmountForAlert).toBe(500);
      expect(result.emailEnabled).toBe(false); // default
      expect(result.transactionAlerts).toBe(true); // default
    });
  });

  describe('updatePreferences', () => {
    it('should update and return merged preferences', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce({ notificationPrefs: {} })
        .mockResolvedValue({ notificationPrefs: { pushEnabled: false } });
      mockPrismaService.user.update.mockResolvedValue({});

      const result = await service.updatePreferences('user-1', { pushEnabled: false });

      expect(result.pushEnabled).toBe(false);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { notificationPrefs: { pushEnabled: false } },
      });
    });

    it('should merge with existing preferences', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce({
          notificationPrefs: { pushEnabled: true, emailEnabled: true },
        })
        .mockResolvedValue({
          notificationPrefs: { pushEnabled: true, emailEnabled: true, minAmountForAlert: 2000 },
        });
      mockPrismaService.user.update.mockResolvedValue({});

      const result = await service.updatePreferences('user-1', { minAmountForAlert: 2000 });

      expect(result.pushEnabled).toBe(true);
      expect(result.emailEnabled).toBe(true);
      expect(result.minAmountForAlert).toBe(2000);
    });
  });

  describe('sendTransactionNotification', () => {
    it('should create transaction notification for debit', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        notificationPrefs: { transactionAlerts: true, minAmountForAlert: 100 },
      });
      mockPrismaService.notification.create.mockResolvedValue(mockNotification);

      await service.sendTransactionNotification('user-1', {
        amount: 500,
        merchant: 'Amazon',
        type: 'DEBIT',
        category: 'SHOPPING',
      });

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'TRANSACTION',
          title: 'Money Debited',
          body: '-₹500 at Amazon',
        }),
      });
    });

    it('should create transaction notification for credit', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        notificationPrefs: { transactionAlerts: true, minAmountForAlert: 100 },
      });
      mockPrismaService.notification.create.mockResolvedValue(mockNotification);

      await service.sendTransactionNotification('user-1', {
        amount: 5000,
        type: 'CREDIT',
      });

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Money Credited',
          body: '₹5000 ',
        }),
      });
    });

    it('should not create notification when alerts are disabled', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        notificationPrefs: { transactionAlerts: false },
      });

      await service.sendTransactionNotification('user-1', {
        amount: 500,
        type: 'DEBIT',
      });

      expect(mockPrismaService.notification.create).not.toHaveBeenCalled();
    });

    it('should not create notification when amount is below threshold', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        notificationPrefs: { transactionAlerts: true, minAmountForAlert: 1000 },
      });

      await service.sendTransactionNotification('user-1', {
        amount: 500,
        type: 'DEBIT',
      });

      expect(mockPrismaService.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('sendSubscriptionNotification', () => {
    it('should create subscription notification', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ notificationPrefs: {} });
      mockPrismaService.notification.create.mockResolvedValue(mockNotification);

      await service.sendSubscriptionNotification('user-1', {
        name: 'Netflix',
        amount: 199,
        nextBillingDate: new Date('2024-02-01'),
      });

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'SUBSCRIPTION',
          title: 'Upcoming Subscription Payment',
          priority: 'HIGH',
        }),
      });
    });

    it('should not create notification when alerts are disabled', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        notificationPrefs: { subscriptionAlerts: false },
      });

      await service.sendSubscriptionNotification('user-1', {
        name: 'Netflix',
        amount: 199,
        nextBillingDate: new Date(),
      });

      expect(mockPrismaService.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('sendBudgetAlert', () => {
    it('should create budget warning notification', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ notificationPrefs: {} });
      mockPrismaService.notification.create.mockResolvedValue(mockNotification);

      await service.sendBudgetAlert('user-1', 'Food', 800, 1000);

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'BUDGET_ALERT',
          title: 'Budget Warning',
          priority: 'HIGH',
        }),
      });
    });

    it('should create urgent notification when budget exceeded', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ notificationPrefs: {} });
      mockPrismaService.notification.create.mockResolvedValue(mockNotification);

      await service.sendBudgetAlert('user-1', 'Shopping', 1200, 1000);

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Budget Exceeded',
          priority: 'URGENT',
        }),
      });
    });

    it('should not create notification when budget alerts are disabled', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        notificationPrefs: { budgetAlerts: false },
      });

      await service.sendBudgetAlert('user-1', 'Food', 800, 1000);

      expect(mockPrismaService.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('sendSecurityAlert', () => {
    it('should always create security alert regardless of preferences', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ notificationPrefs: {} });
      mockPrismaService.notification.create.mockResolvedValue(mockNotification);

      await service.sendSecurityAlert('user-1', 'New Login', 'New device detected');

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'SECURITY',
          title: 'New Login',
          priority: 'URGENT',
          channel: 'PUSH',
        }),
      });
    });
  });
});
