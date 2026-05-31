import request from 'supertest';
import { createTestApp, mockUser } from './test-utils';

describe('SmsController (e2e)', () => {
  let testApp: any;
  let server: any;
  let mockPrisma: any;
  let mockRabbitMQ: any;
  let generateToken: any;

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.server;
    mockPrisma = testApp.mockPrisma;
    mockRabbitMQ = testApp.mockRabbitMQ;
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

  describe('POST /api/v1/sms/ingest', () => {
    it('should ingest SMS and create transaction', async () => {
      mockPrisma.smsLog.create.mockResolvedValue({
        id: 'sms-1',
        userId: mockUser.id,
        body: 'Debited INR 500 at Amazon',
        sender: 'HD-BANK',
        phoneNumber: '+1234567890',
        receivedAt: new Date(),
        isProcessed: false,
      });
      mockPrisma.smsLog.update.mockResolvedValue({ id: 'sms-1', isProcessed: true });
      // ingestSms now upserts on (userId, externalReferenceId) instead of
      // creating directly. Returning a row whose createdAt === updatedAt
      // signals a fresh insert (not a no-op against an existing row), so
      // the service publishes transaction.created and reports
      // transactionCreated: true to the caller.
      const txTimestamp = new Date('2026-05-01T00:00:00Z');
      mockPrisma.transaction.findUnique.mockResolvedValue(null); // no dedup hit
      mockPrisma.transaction.upsert.mockResolvedValue({
        id: 'tx-1',
        userId: mockUser.id,
        amount: 500,
        type: 'DEBIT',
        category: 'SHOPPING',
        merchant: 'Amazon',
        createdAt: txTimestamp,
        updatedAt: txTimestamp,
      });

      const res = await request(server)
        .post('/api/v1/sms/ingest')
        .set(authHeader())
        .send({
          body: 'Debited INR 500 at Amazon',
          sender: 'HD-BANK',
          phoneNumber: '+1234567890',
          timestamp: new Date().toISOString(),
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.transactionCreated).toBe(true);
    });

    it('should ingest SMS without transaction for non-transactional message', async () => {
      mockPrisma.smsLog.create.mockResolvedValue({
        id: 'sms-2',
        userId: mockUser.id,
        body: 'Your OTP is 123456',
        sender: 'HD-BANK',
        phoneNumber: '+1234567890',
        receivedAt: new Date(),
        isProcessed: false,
      });
      mockPrisma.smsLog.update.mockResolvedValue({ id: 'sms-2', isProcessed: true });

      const res = await request(server)
        .post('/api/v1/sms/ingest')
        .set(authHeader())
        .send({
          body: 'Your OTP is 123456',
          sender: 'HD-BANK',
          phoneNumber: '+1234567890',
          timestamp: new Date().toISOString(),
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.transactionCreated).toBe(false);
    });
  });

  describe('POST /api/v1/sms/ingest/batch', () => {
    it('should ingest multiple SMS messages', async () => {
      mockPrisma.smsLog.create.mockResolvedValue({
        id: 'sms-3',
        userId: mockUser.id,
        body: 'Debited INR 100 at Zomato',
        sender: 'HDFCBK',
        phoneNumber: '+1234567890',
        receivedAt: new Date(),
        isProcessed: false,
      });
      mockPrisma.smsLog.update.mockResolvedValue({ id: 'sms-3', isProcessed: true });
      mockPrisma.transaction.create.mockResolvedValue({
        id: 'tx-2',
        userId: mockUser.id,
        amount: 100,
        type: 'DEBIT',
        category: 'FOOD_DINING',
        merchant: 'Zomato',
      });

      const res = await request(server)
        .post('/api/v1/sms/ingest/batch')
        .set(authHeader())
        .send({
          messages: [
            { body: 'Debited INR 100 at Zomato', sender: 'HDFCBK', phoneNumber: '+1234567890', timestamp: new Date().toISOString() },
            { body: 'Debited INR 200 at Starbucks', sender: 'SBIBNK', phoneNumber: '+1234567890', timestamp: new Date().toISOString() },
          ],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.total).toBe(2);
    });
  });

  describe('GET /api/v1/sms/unprocessed', () => {
    it('should return unprocessed SMS', async () => {
      mockPrisma.smsLog.findMany.mockResolvedValue([
        { id: 'sms-4', userId: mockUser.id, isProcessed: false, body: 'Test' },
      ]);

      const res = await request(server)
        .get('/api/v1/sms/unprocessed')
        .set(authHeader())
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/v1/sms/history', () => {
    it('should return paginated SMS history', async () => {
      mockPrisma.smsLog.count.mockResolvedValue(25);
      mockPrisma.smsLog.findMany.mockResolvedValue([
        { id: 'sms-5', userId: mockUser.id, body: 'Test', transaction: null },
      ]);

      const res = await request(server)
        .get('/api/v1/sms/history?page=1&limit=10')
        .set(authHeader())
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.total).toBe(25);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(10);
    });
  });

  describe('POST /api/v1/sms/reprocess/:id', () => {
    it('should reprocess an SMS', async () => {
      const smsLog = {
        id: 'sms-6',
        userId: mockUser.id,
        body: 'Debited INR 500 at Amazon',
        sender: 'HD-BANK',
        receivedAt: new Date(),
      };
      mockPrisma.smsLog.findMany.mockResolvedValue([smsLog]);

      const res = await request(server)
        .post('/api/v1/sms/reprocess/sms-6')
        .set(authHeader())
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.parsed).toBeDefined();
    });

    it('should return not found for missing SMS', async () => {
      mockPrisma.smsLog.findMany.mockResolvedValue([]);

      const res = await request(server)
        .post('/api/v1/sms/reprocess/missing-id')
        .set(authHeader())
        .expect(201);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });
  });
});
