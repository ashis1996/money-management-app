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
      // LogoutDto.refreshToken is @IsJWT()-validated, so we hand it the
      // same well-formed JWT we'd use elsewhere. The handler still parses
      // and revokes it; the JWT signature isn't verified for logout.
      const refreshToken = generateToken(mockUser.id, mockUser.email);

      const res = await request(server)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${generateToken(mockUser.id, mockUser.email)}`)
        .send({ refreshToken })
        .expect(201);

      expect(res.body.message).toMatch(/logged out/i);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh tokens', async () => {
      const refreshToken = generateToken(mockUser.id, mockUser.email);
      // The service stores SHA-256 hashes, not the raw token. The mock just
      // needs to return a row whose `tokenHash` field is set so the lookup
      // succeeds — the hash value itself is opaque to the service code path
      // we're testing here.
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        tokenHash: 'sha256-of-the-token',
        expiresAt: new Date(Date.now() + 86400000),
        // tokenVersion is consumed by issueSessionForUserId and embedded
        // in the new access token's `tv` claim.
        user: { ...mockUser, passwordHash: 'hash', tokenVersion: 0 },
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
