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

      const res = await request(server).get('/api/v1/users/me').set(authHeader()).expect(200);

      expect(res.body.email).toBe(mockUser.email);
    });

    it('should return 404 for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(server).get('/api/v1/users/me').set(authHeader()).expect(404);

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
    it("should return the caller's own record when id matches", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const res = await request(server)
        .get(`/api/v1/users/${mockUser.id}`)
        .set(authHeader())
        .expect(200);

      expect(res.body.id).toBe(mockUser.id);
    });

    it('should return 403 when requesting another user by ID', async () => {
      // Both IDs are valid UUID v4 (the controller's ParseUUIDPipe rejects
      // anything else with 400 first); the route only ever 403s on
      // legitimate cross-user requests.
      const someoneElse = '22222222-2222-4222-8222-222222222222';
      const res = await request(server)
        .get(`/api/v1/users/${someoneElse}`)
        .set(authHeader())
        .expect(403);

      expect(res.body.message).toMatch(/own user record/i);
      // We must NOT have hit the database for the other user.
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should return 400 when the id is not a UUID', async () => {
      // Bonus: ParseUUIDPipe stops the request before the controller, so
      // a stray static path like `/users/preferences` cannot accidentally
      // be swallowed by `:id`.
      await request(server).get('/api/v1/users/not-a-uuid').set(authHeader()).expect(400);
    });
  });

  describe('GET /api/v1/users/me/export', () => {
    it("returns the caller's data bundle and writes a USER_DATA_EXPORT audit row", async () => {
      // The export pulls from many tables in parallel; mock each table
      // to return a single sentinel row so we can verify the bundle's
      // shape without caring about the contents.
      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        phone: mockUser.phone,
        avatarUrl: null,
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        emailVerified: false,
        phoneVerified: false,
        archetype: 'BALANCED',
        notificationPrefs: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      });
      mockPrisma.account.findMany.mockResolvedValue([{ id: 'acc-1' }]);
      mockPrisma.transaction.findMany.mockResolvedValue([{ id: 'tx-1' }]);
      mockPrisma.subscription.findMany.mockResolvedValue([{ id: 'sub-1' }]);
      mockPrisma.budget.findMany.mockResolvedValue([{ id: 'b-1' }]);
      mockPrisma.goal.findMany.mockResolvedValue([{ id: 'g-1' }]);
      mockPrisma.notification.findMany.mockResolvedValue([{ id: 'n-1' }]);
      mockPrisma.smsLog.findMany.mockResolvedValue([{ id: 's-1' }]);

      const res = await request(server)
        .get('/api/v1/users/me/export')
        .set(authHeader())
        .expect(200);

      expect(res.body.user).toMatchObject({ id: mockUser.id, email: mockUser.email });
      expect(res.body.accounts).toHaveLength(1);
      expect(res.body.transactions).toHaveLength(1);
      expect(res.body.smsLogs).toHaveLength(1);
      // The export bundle includes all 7 collection fields the regulator
      // would expect — keeping this assertion shape-aware so a future
      // refactor can't silently drop a category.
      for (const key of [
        'user',
        'accounts',
        'transactions',
        'subscriptions',
        'budgets',
        'goals',
        'notifications',
        'smsLogs',
      ]) {
        expect(res.body[key]).toBeDefined();
      }

      // Audit row must be written — without this, "right to access"
      // requests have no compliance trail.
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUser.id,
            action: 'USER_DATA_EXPORT',
            entityType: 'User',
          }),
        }),
      );
    });
  });

  describe('DELETE /api/v1/users/me', () => {
    it('hard-deletes the caller and writes a USER_DELETE_SELF audit row before the delete', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.delete.mockResolvedValue(mockUser);

      await request(server).delete('/api/v1/users/me').set(authHeader()).expect(204);

      // Audit must run BEFORE delete so the row survives even if the
      // FK cascade is interrupted (e.g. a constraint violation
      // somewhere downstream).
      const auditCall = mockPrisma.auditLog.create.mock.invocationCallOrder[0];
      const deleteCall = mockPrisma.user.delete.mock.invocationCallOrder[0];
      expect(auditCall).toBeLessThan(deleteCall);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUser.id,
            action: 'USER_DELETE_SELF',
            entityType: 'User',
          }),
        }),
      );
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: mockUser.id } });
    });

    it('returns 404 when the user is already gone', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await request(server).delete('/api/v1/users/me').set(authHeader()).expect(404);

      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });
  });
});
