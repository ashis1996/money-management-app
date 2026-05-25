import request from 'supertest';
import { createTestApp, mockUser } from './test-utils';

describe('NotificationController (e2e)', () => {
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

  const mockNotification = {
    id: 'notif-1',
    userId: mockUser.id,
    type: 'TRANSACTION',
    title: 'Money Debited',
    body: '₹500 at Amazon',
    channel: 'IN_APP',
    priority: 'NORMAL',
    read: false,
    sent: false,
    createdAt: new Date().toISOString(),
  };

  describe('GET /api/v1/notifications', () => {
    it('should return all notifications', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([mockNotification]);

      const res = await request(server)
        .get('/api/v1/notifications')
        .set(authHeader())
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
    });

    it('should filter unread notifications', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([mockNotification]);

      const res = await request(server)
        .get('/api/v1/notifications?unread=true')
        .set(authHeader())
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/v1/notifications/unread/count', () => {
    it('should return unread count', async () => {
      mockPrisma.notification.count.mockResolvedValue(5);

      const res = await request(server)
        .get('/api/v1/notifications/unread/count')
        .set(authHeader())
        .expect(200);

      expect(res.body.count).toBe(5);
    });
  });

  describe('GET /api/v1/notifications/:id', () => {
    it('should return notification by ID', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(mockNotification);

      const res = await request(server)
        .get(`/api/v1/notifications/${mockNotification.id}`)
        .set(authHeader())
        .expect(200);

      expect(res.body.id).toBe(mockNotification.id);
    });
  });

  describe('PUT /api/v1/notifications/:id/read', () => {
    it('should mark notification as read', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(mockNotification);
      mockPrisma.notification.update.mockResolvedValue({ ...mockNotification, read: true });

      const res = await request(server)
        .put(`/api/v1/notifications/${mockNotification.id}/read`)
        .set(authHeader())
        .expect(200);

      expect(res.body.read).toBe(true);
    });

    it('should return null for non-existent notification', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(null);

      const res = await request(server)
        .put('/api/v1/notifications/unknown-id/read')
        .set(authHeader())
        .expect(200);

      // Express serializes null as {} in JSON responses
      expect(res.body).toEqual({});
    });
  });

  describe('POST /api/v1/notifications/read-all', () => {
    it('should mark all notifications as read', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const res = await request(server)
        .post('/api/v1/notifications/read-all')
        .set(authHeader())
        .expect(201);

      expect(res.body.message).toMatch(/marked as read/i);
    });
  });

  describe('DELETE /api/v1/notifications/:id', () => {
    it('should delete notification', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(mockNotification);
      mockPrisma.notification.delete.mockResolvedValue(mockNotification);

      const res = await request(server)
        .delete(`/api/v1/notifications/${mockNotification.id}`)
        .set(authHeader())
        .expect(200);

      expect(res.body.message).toMatch(/deleted/i);
    });

    it('should return not found for missing notification', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(null);

      const res = await request(server)
        .delete('/api/v1/notifications/unknown-id')
        .set(authHeader())
        .expect(200);

      expect(res.body.message).toMatch(/not found/i);
    });
  });

  describe('GET /api/v1/notifications/preferences', () => {
    it('should return default preferences when none set', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ notificationPrefs: null });

      const res = await request(server)
        .get('/api/v1/notifications/preferences')
        .set(authHeader())
        .expect(200);

      expect(res.body.pushEnabled).toBe(true);
      expect(res.body.emailEnabled).toBe(false);
      expect(res.body.transactionAlerts).toBe(true);
    });
  });

  describe('PUT /api/v1/notifications/preferences', () => {
    it('should update notification preferences', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ notificationPrefs: {} })
        .mockResolvedValue({ notificationPrefs: { pushEnabled: false } });
      mockPrisma.user.update.mockResolvedValue({});

      const res = await request(server)
        .put('/api/v1/notifications/preferences')
        .set(authHeader())
        .send({ pushEnabled: false })
        .expect(200);

      expect(res.body.pushEnabled).toBe(false);
    });
  });

  describe('POST /api/v1/notifications', () => {
    it('should create a notification', async () => {
      mockPrisma.notification.create.mockResolvedValue(mockNotification);

      const res = await request(server)
        .post('/api/v1/notifications')
        .set(authHeader())
        .send({
          type: 'TRANSACTION',
          title: 'Test Notification',
          body: 'Test body',
          priority: 'NORMAL',
        })
        .expect(201);

      expect(res.body.id).toBe(mockNotification.id);
      expect(res.body.title).toBe(mockNotification.title);
    });
  });
});
