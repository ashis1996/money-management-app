import request from 'supertest';
import { createTestApp, mockUser } from './test-utils';

describe('SubscriptionController (e2e)', () => {
  let testApp: any;
  let server: any;
  let mockPrisma: any;
  let generateToken: any;

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.server;
    mockPrisma = testApp.mockPrisma;
    generateToken = testApp.generateToken;
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const authHeader = () => ({
    Authorization: `Bearer ${generateToken(mockUser.id, mockUser.email)}`,
  });

  const mockSubscription = {
    id: 'sub-1',
    userId: mockUser.id,
    name: 'Netflix',
    merchant: 'netflix',
    amount: 199,
    frequency: 'MONTHLY',
    status: 'ACTIVE',
    nextBillingDate: new Date('2024-02-01').toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe('POST /api/v1/subscriptions', () => {
    it('should create a subscription', async () => {
      mockPrisma.subscription.create.mockResolvedValue(mockSubscription);

      const res = await request(server)
        .post('/api/v1/subscriptions')
        .set(authHeader())
        .send({
          name: 'Netflix',
          // CreateSubscriptionDto uses `merchantName` (matches the
          // Prisma column). The legacy `merchant` field name is
          // rejected by `forbidNonWhitelisted` on the global
          // ValidationPipe.
          merchantName: 'netflix',
          amount: 199,
          frequency: 'MONTHLY',
          nextBillingDate: '2024-02-01',
        })
        .expect(201);

      expect(res.body.id).toBe(mockSubscription.id);
      expect(res.body.name).toBe('Netflix');
    });
  });

  describe('GET /api/v1/subscriptions', () => {
    it('should return all subscriptions', async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([mockSubscription]);

      const res = await request(server).get('/api/v1/subscriptions').set(authHeader()).expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
    });

    it('should filter by status', async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([mockSubscription]);

      const res = await request(server)
        .get('/api/v1/subscriptions?status=ACTIVE')
        .set(authHeader())
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/v1/subscriptions/:id', () => {
    it('should return subscription by ID', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(mockSubscription);

      const res = await request(server)
        .get(`/api/v1/subscriptions/${mockSubscription.id}`)
        .set(authHeader())
        .expect(200);

      expect(res.body.id).toBe(mockSubscription.id);
    });

    it('should return 404 for unknown subscription', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      const res = await request(server)
        .get('/api/v1/subscriptions/unknown-id')
        .set(authHeader())
        .expect(404);

      expect(res.body.message).toMatch(/not found/i);
    });
  });

  describe('PUT /api/v1/subscriptions/:id', () => {
    it('should update a subscription', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(mockSubscription);
      mockPrisma.subscription.update.mockResolvedValue({ ...mockSubscription, amount: 249 });

      const res = await request(server)
        .put(`/api/v1/subscriptions/${mockSubscription.id}`)
        .set(authHeader())
        .send({ amount: 249 })
        .expect(200);

      expect(res.body.amount).toBe(249);
    });
  });

  describe('DELETE /api/v1/subscriptions/:id', () => {
    it('should delete a subscription', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(mockSubscription);
      mockPrisma.subscription.delete.mockResolvedValue(mockSubscription);

      const res = await request(server)
        .delete(`/api/v1/subscriptions/${mockSubscription.id}`)
        .set(authHeader())
        .expect(200);

      expect(res.body.message).toMatch(/deleted successfully/i);
    });
  });

  describe('GET /api/v1/subscriptions/summary', () => {
    it('should return subscription summary', async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([mockSubscription]);

      const res = await request(server)
        .get('/api/v1/subscriptions/summary')
        .set(authHeader())
        .expect(200);

      expect(res.body.totalSubscriptions).toBeDefined();
      expect(res.body.totalMonthlySpend).toBeDefined();
    });
  });

  describe('GET /api/v1/subscriptions/upcoming', () => {
    it('should return upcoming payments', async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([mockSubscription]);

      const res = await request(server)
        .get('/api/v1/subscriptions/upcoming?days=7')
        .set(authHeader())
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/v1/subscriptions/detect', () => {
    it('should detect subscriptions from transactions', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          merchant: 'Netflix',
          amount: 199,
          date: new Date('2024-01-01'),
          type: 'DEBIT',
        },
        {
          id: 'tx-2',
          merchant: 'Netflix',
          amount: 199,
          date: new Date('2024-02-01'),
          type: 'DEBIT',
        },
        {
          id: 'tx-3',
          merchant: 'Netflix',
          amount: 199,
          date: new Date('2024-03-01'),
          type: 'DEBIT',
        },
      ]);
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      mockPrisma.subscription.create.mockResolvedValue(mockSubscription);

      const res = await request(server)
        .post('/api/v1/subscriptions/detect')
        .set(authHeader())
        .expect(201);

      expect(res.body.detected).toBeGreaterThanOrEqual(0);
      expect(res.body.saved).toBeDefined();
    });
  });

  describe('POST /api/v1/subscriptions/:id/cancel', () => {
    it('should cancel subscription', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(mockSubscription);
      mockPrisma.subscription.update.mockResolvedValue({
        ...mockSubscription,
        status: 'CANCELLED',
      });

      const res = await request(server)
        .post(`/api/v1/subscriptions/${mockSubscription.id}/cancel`)
        .set(authHeader())
        .expect(201);

      expect(res.body.status).toBe('CANCELLED');
    });
  });

  describe('POST /api/v1/subscriptions/:id/pause', () => {
    it('should pause subscription', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(mockSubscription);
      mockPrisma.subscription.update.mockResolvedValue({ ...mockSubscription, status: 'PAUSED' });

      const res = await request(server)
        .post(`/api/v1/subscriptions/${mockSubscription.id}/pause`)
        .set(authHeader())
        .expect(201);

      expect(res.body.status).toBe('PAUSED');
    });
  });

  describe('POST /api/v1/subscriptions/:id/resume', () => {
    it('should resume subscription', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(mockSubscription);
      mockPrisma.subscription.update.mockResolvedValue({ ...mockSubscription, status: 'ACTIVE' });

      const res = await request(server)
        .post(`/api/v1/subscriptions/${mockSubscription.id}/resume`)
        .set(authHeader())
        .expect(201);

      expect(res.body.status).toBe('ACTIVE');
    });
  });
});
