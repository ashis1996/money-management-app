import request from 'supertest';
import { createTestApp, mockUser } from './test-utils';

describe('TransactionController (e2e)', () => {
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

  const mockTransaction = {
    id: 'tx-1',
    userId: mockUser.id,
    amount: 500,
    type: 'DEBIT',
    category: 'SHOPPING',
    merchant: 'Amazon',
    description: 'Purchase at Amazon',
    date: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe('POST /api/v1/transactions', () => {
    it('should create a transaction', async () => {
      mockPrisma.transaction.create.mockResolvedValue(mockTransaction);

      const res = await request(server)
        .post('/api/v1/transactions')
        .set(authHeader())
        .send({
          amount: 500,
          type: 'DEBIT',
          category: 'SHOPPING',
          merchant: 'Amazon',
          description: 'Purchase at Amazon',
          date: new Date().toISOString(),
        })
        .expect(201);

      expect(res.body.id).toBe(mockTransaction.id);
      expect(res.body.amount).toBe(500);
    });

    it('should reject invalid transaction type', async () => {
      const res = await request(server)
        .post('/api/v1/transactions')
        .set(authHeader())
        .send({
          amount: 500,
          type: 'INVALID_TYPE',
          category: 'SHOPPING',
        })
        .expect(400);

      expect(res.body.message || res.body.error).toBeDefined();
    });
  });

  describe('GET /api/v1/transactions', () => {
    it('should return paginated transactions', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([mockTransaction]);
      mockPrisma.transaction.count.mockResolvedValue(1);

      const res = await request(server)
        .get('/api/v1/transactions')
        .set(authHeader())
        .expect(200);

      // The response is now a paginated envelope rather than a bare array.
      // Without this, a heavy user could OOM the API with a single GET.
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toMatchObject({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
      // findMany must be called with skip/take so the DB doesn't return
      // the full table.
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('should clamp limit to 100 even when caller asks for more', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.transaction.count.mockResolvedValue(0);

      const res = await request(server)
        .get('/api/v1/transactions?limit=500')
        .set(authHeader());

      // Make validation failures self-debugging.
      if (res.status !== 200) {
        // eslint-disable-next-line no-console
        console.error('clamp test got', res.status, res.body);
      }
      expect(res.status).toBe(200);

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('should filter by category', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([mockTransaction]);
      mockPrisma.transaction.count.mockResolvedValue(1);

      const res = await request(server)
        .get('/api/v1/transactions?category=SHOPPING')
        .set(authHeader())
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/transactions/:id', () => {
    it('should return transaction by ID', async () => {
      mockPrisma.transaction.findFirst.mockResolvedValue(mockTransaction);

      const res = await request(server)
        .get(`/api/v1/transactions/${mockTransaction.id}`)
        .set(authHeader())
        .expect(200);

      expect(res.body.id).toBe(mockTransaction.id);
    });

    it('should return 404 for unknown transaction', async () => {
      mockPrisma.transaction.findFirst.mockResolvedValue(null);

      const res = await request(server)
        .get('/api/v1/transactions/unknown-id')
        .set(authHeader())
        .expect(404);

      expect(res.body.message).toMatch(/not found/i);
    });
  });

  describe('PUT /api/v1/transactions/:id', () => {
    it('should update a transaction', async () => {
      mockPrisma.transaction.findFirst.mockResolvedValue(mockTransaction);
      mockPrisma.transaction.update.mockResolvedValue({ ...mockTransaction, amount: 600 });

      const res = await request(server)
        .put(`/api/v1/transactions/${mockTransaction.id}`)
        .set(authHeader())
        .send({ amount: 600 })
        .expect(200);

      expect(res.body.amount).toBe(600);
    });
  });

  describe('DELETE /api/v1/transactions/:id', () => {
    it('should delete a transaction', async () => {
      mockPrisma.transaction.findFirst.mockResolvedValue(mockTransaction);
      mockPrisma.transaction.delete.mockResolvedValue(mockTransaction);

      const res = await request(server)
        .delete(`/api/v1/transactions/${mockTransaction.id}`)
        .set(authHeader())
        .expect(200);

      expect(res.body.message).toMatch(/deleted/i);
    });
  });

  describe('GET /api/v1/transactions/analytics/categories', () => {
    it('should return spending by category', async () => {
      mockPrisma.transaction.groupBy.mockResolvedValue([
        { category: 'SHOPPING', _sum: { amount: 1500 }, _count: { id: 5 } },
        { category: 'FOOD_DINING', _sum: { amount: 800 }, _count: { id: 3 } },
      ]);

      const res = await request(server)
        .get('/api/v1/transactions/analytics/categories')
        .set(authHeader())
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/v1/transactions/analytics/monthly', () => {
    it('should return monthly statistics', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([mockTransaction]);

      const res = await request(server)
        .get('/api/v1/transactions/analytics/monthly?year=2024&month=1')
        .set(authHeader())
        .expect(200);

      expect(res.body).toBeDefined();
    });
  });

  describe('GET /api/v1/transactions/search', () => {
    it('should search transactions', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([mockTransaction]);

      const res = await request(server)
        .get('/api/v1/transactions/search?q=Amazon')
        .set(authHeader())
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
