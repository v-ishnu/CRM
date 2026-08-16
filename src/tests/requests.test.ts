import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';

// Models
import Client from '@/models/Client';
import Project from '@/models/Project';
import DataRequest from '@/models/DataRequest';
import Credential from '@/models/Credential';
import RequestResponse from '@/models/RequestResponse';
import AuditLog from '@/models/AuditLog';
import User from '@/models/User';

// Route Handlers
import { POST as createRequestRoute } from '@/app/api/requests/route';
import { GET as getRequestDetail, DELETE as deleteRequestRoute } from '@/app/api/requests/[id]/route';
import { POST as decryptCredentialRoute } from '@/app/api/requests/[id]/decrypt/route';
import { POST as logAuditRoute } from '@/app/api/requests/[id]/audit/route';
import { POST as telegramWebhook } from '@/app/api/telegram/webhook/route';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/developer-crm-test';

describe('Data Request & Secure Credential Collection Tests', () => {
  let testClient: any;
  let testProject: any;
  let adminUser: any;
  let credentialRequestId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }

    // Set test encryption key
    process.env.CREDENTIAL_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'test_webhook_secret';
    process.env.TELEGRAM_BOT_TOKEN = 'mock_bot_token';

    // Cleanup existing test documents
    await Client.deleteMany({ clientCode: /^REQ-CL-/ });
    await Project.deleteMany({ projectCode: /^REQ-PR-/ });
    await DataRequest.deleteMany({});
    await Credential.deleteMany({});
    await RequestResponse.deleteMany({});
    await User.deleteMany({ email: 'requests_admin@example.com' });
    await AuditLog.deleteMany({ actor: 'requests_admin@example.com' });

    // Seed test data
    testClient = await Client.create({
      clientCode: 'REQ-CL-001',
      name: 'Rahul Requests Test',
      email: 'rahul_req@example.com',
      telegramConnected: true,
      telegramChatId: '987654321',
      telegramUserId: '987654321',
    });

    testProject = await Project.create({
      projectCode: 'REQ-PR-001',
      clientId: testClient._id,
      name: 'Rahul Website Migration',
      serviceType: 'OTHER',
      totalAmount: 15000,
      currency: 'INR',
      status: 'PLANNED',
    });

    const hashedPassword = await bcrypt.hash('SecretAdminPassword123', 10);
    adminUser = await User.create({
      email: 'requests_admin@example.com',
      password: hashedPassword,
      role: 'ADMIN',
      name: 'Request Admin User',
    });
  });

  afterAll(async () => {
    await Client.deleteMany({ clientCode: /^REQ-CL-/ });
    await Project.deleteMany({ projectCode: /^REQ-PR-/ });
    await DataRequest.deleteMany({});
    await Credential.deleteMany({});
    await RequestResponse.deleteMany({});
    await User.deleteMany({ email: 'requests_admin@example.com' });
    await AuditLog.deleteMany({ actor: 'requests_admin@example.com' });
    await mongoose.connection.close();
  });

  const getAdminHeaders = () => ({
    'x-user-role': 'ADMIN',
    'x-user-email': 'requests_admin@example.com',
    'x-user-id': adminUser._id.toString(),
  });

  describe('1. Admin Request Creation & Telegram Dispatches', () => {
    it('should allow admin to create a general data request', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return {
          ok: true,
          json: async () => ({ ok: true, result: { message_id: 111 } }),
        } as Response;
      });

      const req = new NextRequest('http://localhost/api/requests', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          clientId: testClient._id.toString(),
          projectId: testProject._id.toString(),
          type: 'GENERAL',
          title: 'Brand Assets & Logo',
          message: 'Please provide high-resolution SVG and PNG logos for the project.',
        }),
      });

      const res = await createRequestRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.requestId).toMatch(/^REQ-\d{4}-\d{4}$/);
      expect(json.data.type).toBe('GENERAL');
      expect(json.data.status).toBe('SENT');

      fetchSpy.mockRestore();
    });

    it('should allow admin to create a credential request with custom fields', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return {
          ok: true,
          json: async () => ({ ok: true, result: { message_id: 222 } }),
        } as Response;
      });

      const req = new NextRequest('http://localhost/api/requests', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          clientId: testClient._id.toString(),
          projectId: testProject._id.toString(),
          type: 'CREDENTIAL',
          credentialType: 'DATABASE',
          title: 'Database Access Info',
          message: 'Provide primary database connection credentials.',
          requiredFields: ['Service', 'Username', 'Password', 'Login URL'],
        }),
      });

      const res = await createRequestRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.type).toBe('CREDENTIAL');
      credentialRequestId = json.data._id;

      fetchSpy.mockRestore();
    });

    it('should prevent non-admins from creating requests', async () => {
      const req = new NextRequest('http://localhost/api/requests', {
        method: 'POST',
        headers: { 'x-user-role': 'CLIENT' },
        body: JSON.stringify({
          clientId: testClient._id.toString(),
          title: 'Unauthorized Request',
        }),
      });

      const res = await createRequestRoute(req);
      expect(res.status).toBe(403);
    });
  });

  describe('2. Required 13 Test Cases: Webhook Routing, Credential Parsing & Idempotency', () => {
    // TEST 1: No active request + /status -> status handler
    it('TEST 1: No active request + /status -> routes to status handler', async () => {
      // Temporarily ensure no active requests for this client
      await DataRequest.updateMany({ clientId: testClient._id }, { status: 'COMPLETED' });

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      });

      const req = new NextRequest('http://localhost/api/telegram/webhook', {
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'test_webhook_secret' },
        body: JSON.stringify({
          update_id: 20001,
          message: {
            message_id: 6001,
            from: { id: 987654321, username: 'rahul_test' },
            chat: { id: 987654321 },
            text: '/status',
          },
        }),
      });

      const res = await telegramWebhook(req);
      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalled();
      const calls = fetchSpy.mock.calls.map(c => typeof c[0] === 'string' ? c[0] : (c[0] as any).toString());
      expect(calls.some(url => url.includes('sendMessage'))).toBe(true);

      fetchSpy.mockRestore();
    });

    // TEST 2: No active request + "hello" -> normal fallback
    it('TEST 2: No active request + "hello" -> normal fallback message', async () => {
      await DataRequest.updateMany({ clientId: testClient._id }, { status: 'COMPLETED' });

      let sentText = '';
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        if (init?.body) {
          const body = JSON.parse(init.body as string);
          sentText = body.text || '';
        }
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      });

      const req = new NextRequest('http://localhost/api/telegram/webhook', {
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'test_webhook_secret' },
        body: JSON.stringify({
          update_id: 20002,
          message: {
            message_id: 6002,
            from: { id: 987654321, username: 'rahul_test' },
            chat: { id: 987654321 },
            text: 'hello',
          },
        }),
      });

      const res = await telegramWebhook(req);
      expect(res.status).toBe(200);
      expect(sentText).toContain('You do not have any pending requests to respond to');
      expect(sentText).not.toContain('Unknown command');

      fetchSpy.mockRestore();
    });

    // TEST 3: Credential request active + valid credential text -> credential handler
    it('TEST 3: Credential request active + valid credential text -> processed and encrypted', async () => {
      const dbReq = await DataRequest.create({
        requestId: 'REQ-2026-T003',
        clientId: testClient._id,
        projectId: testProject._id,
        type: 'CREDENTIAL',
        title: 'Database Access Credentials',
        message: 'Send MongoDB credentials.',
        requiredFields: ['Service', 'Username', 'Password', 'Login URL'],
        status: 'SENT',
      });

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      });

      const req = new NextRequest('http://localhost/api/telegram/webhook', {
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'test_webhook_secret' },
        body: JSON.stringify({
          update_id: 20003,
          message: {
            message_id: 6003,
            from: { id: 987654321, username: 'rahul_test' },
            chat: { id: 987654321 },
            text: `Service: MongoDB Atlas\nUsername: admin_rahul\nPassword: SecureDatabasePassword999\nLogin URL: mongodb.com`,
          },
        }),
      });

      const res = await telegramWebhook(req);
      expect(res.status).toBe(200);

      // Verify deleteMessage API was triggered on Telegram
      const calls = fetchSpy.mock.calls.map(c => typeof c[0] === 'string' ? c[0] : (c[0] as any).toString());
      expect(calls.some(url => url.includes('deleteMessage'))).toBe(true);

      // Verify credential encrypted correctly in Database
      const cred = await Credential.findOne({ requestId: dbReq._id });
      expect(cred).toBeDefined();
      expect(cred?.service.ciphertext).not.toBe('MongoDB Atlas');
      expect(cred?.password.ciphertext).not.toBe('SecureDatabasePassword999');

      // Verify status updated to RECEIVED
      const updatedReq = await DataRequest.findById(dbReq._id);
      expect(updatedReq?.status).toBe('RECEIVED');

      fetchSpy.mockRestore();
    });

    // TEST 4: Credential request active + missing password -> validation error
    it('TEST 4: Credential request active + missing password -> validation error returned', async () => {
      const dbReq = await DataRequest.create({
        requestId: 'REQ-2026-T004',
        clientId: testClient._id,
        projectId: testProject._id,
        type: 'CREDENTIAL',
        title: 'FTP Access Request',
        message: 'Send FTP credentials.',
        requiredFields: ['Service', 'Username', 'Password'],
        status: 'SENT',
      });

      let sentMsg = '';
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        if (init?.body) {
          const body = JSON.parse(init.body as string);
          sentMsg = body.text || '';
        }
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      });

      const req = new NextRequest('http://localhost/api/telegram/webhook', {
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'test_webhook_secret' },
        body: JSON.stringify({
          update_id: 20004,
          message: {
            message_id: 6004,
            from: { id: 987654321, username: 'rahul_test' },
            chat: { id: 987654321 },
            text: `Service: SFTP Server\nUsername: sftp_user\nRequest ID: ${dbReq.requestId}`,
          },
        }),
      });

      const res = await telegramWebhook(req);
      expect(res.status).toBe(200);

      // Verify validation warning
      expect(sentMsg).toContain('Credential submission incomplete');
      expect(sentMsg).toContain('Password');

      // Verify database has no credentials created
      const cred = await Credential.findOne({ requestId: dbReq._id });
      expect(cred).toBeNull();

      fetchSpy.mockRestore();
    });

    // TEST 5: Credential request active + different capitalization -> parser accepts it
    it('TEST 5: Credential request active + different capitalization -> parser accepts it', async () => {
      const dbReq = await DataRequest.create({
        requestId: 'REQ-2026-T005',
        clientId: testClient._id,
        projectId: testProject._id,
        type: 'CREDENTIAL',
        title: 'cPanel Access',
        message: 'Send cPanel info.',
        requiredFields: ['service', 'username', 'password', 'loginUrl'],
        status: 'SENT',
      });

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      });

      // Different capitalizations: SERVICE, USERNAME, password, Login URL
      const req = new NextRequest('http://localhost/api/telegram/webhook', {
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'test_webhook_secret' },
        body: JSON.stringify({
          update_id: 20005,
          message: {
            message_id: 6005,
            from: { id: 987654321, username: 'rahul_test' },
            chat: { id: 987654321 },
            text: `SERVICE: Hostinger cPanel\nUSERNAME: rahul_cpanel\npassword: StrongPassword123!\nLogin URL: cpanel.hostinger.com\nRequest ID: ${dbReq.requestId}`,
          },
        }),
      });

      const res = await telegramWebhook(req);
      expect(res.status).toBe(200);

      const cred = await Credential.findOne({ requestId: dbReq._id });
      expect(cred).toBeDefined();

      fetchSpy.mockRestore();
    });

    // TEST 6: Credential request active + /status -> command handler
    it('TEST 6: Credential request active + /status -> command handler takes precedence', async () => {
      await DataRequest.create({
        requestId: 'REQ-2026-T006',
        clientId: testClient._id,
        projectId: testProject._id,
        type: 'CREDENTIAL',
        title: 'Hosting Credentials',
        message: 'Send hosting info.',
        status: 'SENT',
      });

      let sentMsg = '';
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        if (init?.body) {
          const body = JSON.parse(init.body as string);
          sentMsg = body.text || '';
        }
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      });

      const req = new NextRequest('http://localhost/api/telegram/webhook', {
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'test_webhook_secret' },
        body: JSON.stringify({
          update_id: 20006,
          message: {
            message_id: 6006,
            from: { id: 987654321, username: 'rahul_test' },
            chat: { id: 987654321 },
            text: '/status',
          },
        }),
      });

      const res = await telegramWebhook(req);
      expect(res.status).toBe(200);
      expect(sentMsg).toContain('Status');

      fetchSpy.mockRestore();
    });

    // TEST 7: Credential request active + photo -> image handler
    it('TEST 7: Image request active + photo -> downloaded and uploaded to storage', async () => {
      const dbReq = await DataRequest.create({
        requestId: 'REQ-2026-T007',
        clientId: testClient._id,
        type: 'IMAGE',
        title: 'Project Logo',
        message: 'Send vector/raster logo.',
        status: 'SENT',
      });

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('getFile')) {
          return {
            ok: true,
            json: async () => ({ ok: true, result: { file_path: 'photos/logo.png' } }),
          } as Response;
        }
        if (urlStr.includes('photos/logo.png')) {
          const buffer = Buffer.from('mock_png_image_binary_data');
          return {
            ok: true,
            arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
          } as Response;
        }
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      });

      const req = new NextRequest('http://localhost/api/telegram/webhook', {
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'test_webhook_secret' },
        body: JSON.stringify({
          update_id: 20007,
          message: {
            message_id: 6007,
            from: { id: 987654321 },
            chat: { id: 987654321 },
            photo: [
              { file_id: 'photo_small', file_size: 100 },
              { file_id: 'photo_large', file_size: 5000 },
            ],
            reply_to_message: { message_id: 99999 },
          },
        }),
      });

      // Point session to this request
      global.activeClientRequests = global.activeClientRequests || {};
      global.activeClientRequests['987654321'] = dbReq.requestId;

      const res = await telegramWebhook(req);
      expect(res.status).toBe(200);

      const resp = await RequestResponse.findOne({ requestId: dbReq._id });
      expect(resp).toBeDefined();
      expect(resp?.files.length).toBe(1);

      fetchSpy.mockRestore();
    });

    // TEST 8: Document request active + document -> document handler
    it('TEST 8: Document request active + document -> uploaded to storage', async () => {
      const dbReq = await DataRequest.create({
        requestId: 'REQ-2026-T008',
        clientId: testClient._id,
        type: 'DOCUMENT',
        title: 'Wireframes PDF',
        message: 'Provide wireframes PDF.',
        status: 'SENT',
      });

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('getFile')) {
          return {
            ok: true,
            json: async () => ({ ok: true, result: { file_path: 'documents/wireframes.pdf' } }),
          } as Response;
        }
        if (urlStr.includes('documents/wireframes.pdf')) {
          const buffer = Buffer.from('%PDF-1.4 mock wireframes binary');
          return {
            ok: true,
            arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
          } as Response;
        }
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      });

      global.activeClientRequests = global.activeClientRequests || {};
      global.activeClientRequests['987654321'] = dbReq.requestId;

      const req = new NextRequest('http://localhost/api/telegram/webhook', {
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'test_webhook_secret' },
        body: JSON.stringify({
          update_id: 20008,
          message: {
            message_id: 6008,
            from: { id: 987654321 },
            chat: { id: 987654321 },
            document: {
              file_id: 'doc_99',
              file_name: 'wireframes.pdf',
              mime_type: 'application/pdf',
            },
          },
        }),
      });

      const res = await telegramWebhook(req);
      expect(res.status).toBe(200);

      const resp = await RequestResponse.findOne({ requestId: dbReq._id });
      expect(resp).toBeDefined();
      expect(resp?.files[0].fileName).toBe('wireframes.pdf');

      fetchSpy.mockRestore();
    });

    // TEST 9: Telegram user attempts another client's request -> reject
    it('TEST 9: Telegram user attempts another client\'s request -> rejected', async () => {
      const otherClient = await Client.create({
        clientCode: 'REQ-CL-999',
        name: 'Other Client Z',
        email: 'other_z@example.com',
        telegramConnected: true,
        telegramChatId: '55667788',
      });

      const dbReq = await DataRequest.create({
        requestId: 'REQ-2026-T009',
        clientId: otherClient._id,
        type: 'TEXT',
        title: 'Other client private info',
        message: 'Feedback.',
        status: 'SENT',
      });

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      });

      // User 987654321 tries to answer REQ-2026-T009 belonging to otherClient
      const req = new NextRequest('http://localhost/api/telegram/webhook', {
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'test_webhook_secret' },
        body: JSON.stringify({
          update_id: 20009,
          message: {
            message_id: 6009,
            from: { id: 987654321 },
            chat: { id: 987654321 },
            text: `Answer for ${dbReq.requestId}`,
          },
        }),
      });

      const res = await telegramWebhook(req);
      expect(res.status).toBe(200);

      // Verify other client's request was not answered
      const resp = await RequestResponse.findOne({ requestId: dbReq._id });
      expect(resp).toBeNull();

      fetchSpy.mockRestore();
    });

    // TEST 10: Same Telegram update processed twice -> only one credential record (Idempotency)
    it('TEST 10: Same Telegram update processed twice -> only one credential record created', async () => {
      // Clean up prior pending requests so they don't interfere
      await DataRequest.updateMany({ clientId: testClient._id, status: { $in: ['PENDING', 'SENT', 'OPENED'] } }, { status: 'COMPLETED' });

      const dbReq = await DataRequest.create({
        requestId: 'REQ-2026-0010',
        clientId: testClient._id,
        projectId: testProject._id,
        type: 'CREDENTIAL',
        title: 'AWS Credentials',
        message: 'Provide AWS IAM keys.',
        requiredFields: ['Service', 'Username', 'Password'],
        status: 'SENT',
      });

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      });

      // Clear deduplication set so the first call is processed
      global.processedTelegramUpdates = new Set<number>();

      const payload = {
        update_id: 30010,
        message: {
          message_id: 7010,
          from: { id: 987654321, username: 'rahul_test' },
          chat: { id: 987654321 },
          text: `Service: AWS\nUsername: aws_admin\nPassword: SecretKey999`,
        },
      };

      // First webhook POST
      const req1 = new NextRequest('http://localhost/api/telegram/webhook', {
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'test_webhook_secret' },
        body: JSON.stringify(payload),
      });
      await telegramWebhook(req1);

      // Duplicate webhook POST with same update_id
      const req2 = new NextRequest('http://localhost/api/telegram/webhook', {
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'test_webhook_secret' },
        body: JSON.stringify(payload),
      });
      await telegramWebhook(req2);

      // Verify only ONE Credential document was created
      const creds = await Credential.find({ requestId: dbReq._id });
      expect(creds.length).toBe(1);

      fetchSpy.mockRestore();
    });

    // TEST 11: Successful credential submission -> audit log created
    it('TEST 11: Successful credential submission -> audit log created', async () => {
      const audit = await AuditLog.findOne({
        action: 'CREDENTIAL_RECEIVED',
        entityType: 'Credential',
      });
      expect(audit).toBeDefined();
      expect(audit?.actor).toBe(testClient.email);
    });

    // TEST 12: Successful credential submission -> plaintext password does NOT exist in database
    it('TEST 12: Plaintext password does NOT exist anywhere in database', async () => {
      const allCreds = await Credential.find({ clientId: testClient._id }).lean();
      expect(allCreds.length).toBeGreaterThan(0);

      const jsonDump = JSON.stringify(allCreds);
      expect(jsonDump).not.toContain('SecureDatabasePassword999');
      expect(jsonDump).not.toContain('StrongPassword123!');
      expect(jsonDump).not.toContain('SecretKey999');
    });

    // TEST 13: Successful credential submission -> plaintext password does NOT appear in application logs
    it('TEST 13: Plaintext password does NOT appear in application logs', async () => {
      const logSpy = vi.spyOn(console, 'log');
      const errSpy = vi.spyOn(console, 'error');

      const dbReq = await DataRequest.create({
        requestId: 'REQ-2026-T013',
        clientId: testClient._id,
        type: 'CREDENTIAL',
        title: 'Secret Vault',
        message: 'Send vault key.',
        requiredFields: ['Service', 'Username', 'Password'],
        status: 'SENT',
      });

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      });

      const req = new NextRequest('http://localhost/api/telegram/webhook', {
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'test_webhook_secret' },
        body: JSON.stringify({
          update_id: 20013,
          message: {
            message_id: 6013,
            from: { id: 987654321, username: 'rahul_test' },
            chat: { id: 987654321 },
            text: `Service: Vault\nUsername: vault_user\nPassword: SuperSecretNeverLogInPlaintext888\nRequest ID: ${dbReq.requestId}`,
          },
        }),
      });

      await telegramWebhook(req);

      const loggedMessages = [
        ...logSpy.mock.calls.map(c => c.join(' ')),
        ...errSpy.mock.calls.map(c => c.join(' ')),
      ].join('\n');

      expect(loggedMessages).not.toContain('SuperSecretNeverLogInPlaintext888');

      logSpy.mockRestore();
      errSpy.mockRestore();
      fetchSpy.mockRestore();
    });
  });

  describe('3. Admin Decryption Challenges, View Audits & Deletions', () => {
    it('should decrypt credential values with correct admin password and log view audit', async () => {
      const cred = await Credential.findOne({ clientId: testClient._id });
      expect(cred).toBeDefined();

      const req = new NextRequest(`http://localhost/api/requests/${cred!.requestId}/decrypt`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ password: 'SecretAdminPassword123' }),
      });

      const res = await decryptCredentialRoute(req, { params: Promise.resolve({ id: cred!.requestId.toString() }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.password).toBeDefined();

      // Verify audit log
      const audit = await AuditLog.findOne({ action: 'CREDENTIAL_VIEWED' });
      expect(audit).toBeDefined();
    });

    it('should refuse decryption if incorrect admin password is sent', async () => {
      const cred = await Credential.findOne({ clientId: testClient._id });
      const req = new NextRequest(`http://localhost/api/requests/${cred!.requestId}/decrypt`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ password: 'WrongPassword' }),
      });

      const res = await decryptCredentialRoute(req, { params: Promise.resolve({ id: cred!.requestId.toString() }) });
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
    });

    it('should allow logging reveal and copy audits', async () => {
      const cred = await Credential.findOne({ clientId: testClient._id });
      const req = new NextRequest(`http://localhost/api/requests/${cred!.requestId}/audit`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ action: 'CREDENTIAL_COPIED', field: 'password' }),
      });

      const res = await logAuditRoute(req, { params: Promise.resolve({ id: cred!.requestId.toString() }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);

      const audit = await AuditLog.findOne({ action: 'CREDENTIAL_COPIED' });
      expect(audit).toBeDefined();
    });

    it('should delete requests, credentials, responses, and log audit log', async () => {
      const cred = await Credential.findOne({ clientId: testClient._id });
      const req = new NextRequest(`http://localhost/api/requests/${cred!.requestId}`, {
        method: 'DELETE',
        headers: getAdminHeaders(),
      });

      const res = await deleteRequestRoute(req, { params: Promise.resolve({ id: cred!.requestId.toString() }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);

      const deletedCred = await Credential.findById(cred!._id);
      expect(deletedCred).toBeNull();
    });
  });
});
