import request from 'supertest';
import { createTestApp, mockUser } from './test-utils';

describe('UserController (e2e)', () => {
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

  describe('GET /api/v1/users/me', () => {
    it('should return current user profile', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const res = await request(server)
        .get('/api/v1/users/me')
        .set(authHeader())
        .expect(200);

      expect(res.body.email).toBe(mockUser.email);
    });

    it('should return 404 for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(server)
        .get('/api/v1/users/me')
        .set(authHeader())
        .expect(404);

      expect(res.body.message).toMatch(/not found/i);
    });
  });

  describe('PUT /api/v1/users/me', () => {
    it('should update user profile', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, name: 'Updated Name' });

      const res = await request(server)
        .put('/api/v1/users/me')
        .set(authHeader())
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.name).toBe('Updated Name');
    });

    it('should reject duplicate email on update', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(mockUser) // first call for finding current user
        .mockResolvedValueOnce({ id: 'other-user', email: 'other@example.com' }); // duplicate check

      const res = await request(server)
        .put('/api/v1/users/me')
        .set(authHeader())
        .send({ email: 'other@example.com' })
        .expect(409);

      expect(res.body.message).toMatch(/already registered/i);
    });
  });

  describe('GET /api/v1/users/dashboard', () => {
    it('should return dashboard statistics', async () => {
      mockPrisma.account.findMany.mockResolvedValue([
        { balance: 5000, type: 'BANK' },
        { balance: 2000, type: 'WALLET' },
      ]);
      mockPrisma.transaction.groupBy.mockResolvedValue([
        { type: 'CREDIT', _sum: { amount: 10000 } },
        { type: 'DEBIT', _sum: { amount: 6000 } },
      ]);
      mockPrisma.subscription.count.mockResolvedValue(3);
      mockPrisma.notification.count.mockResolvedValue(5);

      const res = await request(server)
        .get('/api/v1/users/dashboard')
        .set(authHeader())
        .expect(200);

      expect(res.body.totalBalance).toBe(7000);
      expect(res.body.monthlyIncome).toBe(10000);
      expect(res.body.monthlyExpense).toBe(6000);
      expect(res.body.netSavings).toBe(4000);
      expect(res.body.activeSubscriptions).toBe(3);
      expect(res.body.unreadNotifications).toBe(5);
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('should return user by ID', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const res = await request(server)
        .get(`/api/v1/users/${mockUser.id}`)
        .set(authHeader())
        .expect(200);

      expect(res.body.id).toBe(mockUser.id);
    });

    it('should return 404 for unknown ID', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(server)
        .get('/api/v1/users/unknown-id')
        .set(authHeader())
        .expect(404);

      expect(res.body.message).toMatch(/not found/i);
    });
  });
});
