import request from 'supertest';
import { createTestApp, mockUser } from './test-utils';

describe('AuthController (e2e)', () => {
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

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user and return tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.account.create.mockResolvedValue({ id: 'acc-1', userId: mockUser.id });

      const res = await request(server)
        .post('/api/v1/auth/register')
        .send({ email: mockUser.email, password: 'password123', name: mockUser.name, phone: mockUser.phone })
        .expect(201);

      expect(res.body.user).toBeDefined();
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.email).toBe(mockUser.email);
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(mockPrisma.account.create).toHaveBeenCalled();
    });

    it('should reject duplicate email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const res = await request(server)
        .post('/api/v1/auth/register')
        .send({ email: mockUser.email, password: 'password123' })
        .expect(400);

      expect(res.body.message).toMatch(/already registered/i);
    });

    it('should reject invalid email format', async () => {
      const res = await request(server)
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: 'password123' })
        .expect(400);

      expect(res.body.message || res.body.error).toBeDefined();
    });

    it('should reject short password', async () => {
      // class-validator MinLength should reject if DTO has it
      const res = await request(server)
        .post('/api/v1/auth/register')
        .send({ email: 'test2@example.com', password: '123' })
        .expect(400);

      expect(res.body.message || res.body.error).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should return tokens for validated user', async () => {
      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({ email: mockUser.email, password: 'password123' })
        .expect(200);

      expect(res.body.user).toBeDefined();
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(typeof res.body.accessToken).toBe('string');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      const res = await request(server)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${generateToken(mockUser.id, mockUser.email)}`)
        .send({ refreshToken: 'some-token' })
        .expect(201);

      expect(res.body.message).toMatch(/logged out/i);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh tokens', async () => {
      const refreshToken = generateToken(mockUser.id, mockUser.email);
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        token: refreshToken,
        expiresAt: new Date(Date.now() + 86400000),
        user: { ...mockUser, passwordHash: 'hash' },
      });
      mockPrisma.refreshToken.delete.mockResolvedValue({});
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const res = await request(server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });
  });
});
