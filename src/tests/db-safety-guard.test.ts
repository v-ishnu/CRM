import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dbConnect } from '@/lib/db/connect';

describe('Production Database Safety Guard', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset cached connection
    if (global.mongooseCached) {
      global.mongooseCached.conn = null;
      global.mongooseCached.promise = null;
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    if (global.mongooseCached) {
      global.mongooseCached.conn = null;
      global.mongooseCached.promise = null;
    }
  });

  it('should throw an error when running tests without MONGODB_TEST_URI defined', async () => {
    (process.env as any).NODE_ENV = 'test';
    delete process.env.MONGODB_TEST_URI;
    delete process.env.TEST_MONGODB_URI;

    await expect(dbConnect()).rejects.toThrow(
      /REFUSING TO RUN TESTS AGAINST PRODUCTION DATABASE/
    );
  });

  it('should throw an error when test URI matches production URI', async () => {
    (process.env as any).NODE_ENV = 'test';
    const prodUri = 'mongodb+srv://admin:pass@cluster.mongodb.net/crm_production?retryWrites=true&w=majority';
    process.env.MONGODB_URI = prodUri;
    process.env.MONGODB_TEST_URI = prodUri;

    await expect(dbConnect()).rejects.toThrow(
      /REFUSING TO RUN TESTS AGAINST PRODUCTION DATABASE.*Safety violation detected/
    );
  });

  it('should throw an error when test URI points to known production cluster string', async () => {
    (process.env as any).NODE_ENV = 'test';
    process.env.MONGODB_TEST_URI = 'mongodb+srv://user:pass@clienttelegrammanagemnt.m3gs6bt.mongodb.net/crm';

    await expect(dbConnect()).rejects.toThrow(
      /REFUSING TO RUN TESTS AGAINST PRODUCTION DATABASE.*Safety violation detected/
    );
  });
});
