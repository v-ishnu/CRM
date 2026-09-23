import mongoose from 'mongoose';

// Connect helper


/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
interface MongooseGlobal {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCached: MongooseGlobal;
}

let cached = global.mongooseCached;

if (!cached) {
  cached = global.mongooseCached = { conn: null, promise: null };
}

export async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  const prodUri = process.env.MONGODB_URI;
  const testUri = process.env.MONGODB_TEST_URI || process.env.TEST_MONGODB_URI;

  let uri: string;

  if (isTestEnv) {
    if (!testUri) {
      throw new Error(
        'REFUSING TO RUN TESTS AGAINST PRODUCTION DATABASE. MONGODB_TEST_URI or TEST_MONGODB_URI is required when NODE_ENV=test.'
      );
    }

    // Safety guard: Ensure test URI does not point to production database
    if (
      (prodUri && testUri === prodUri) ||
      testUri.includes('clienttelegrammanagemnt.m3gs6bt.mongodb.net/crm')
    ) {
      throw new Error(
        'REFUSING TO RUN TESTS AGAINST PRODUCTION DATABASE. Safety violation detected: test suite cannot execute against production MongoDB.'
      );
    }

    uri = testUri;
  } else {
    if (!prodUri) {
      throw new Error('Please define the MONGODB_URI environment variable inside .env');
    }
    uri = prodUri;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(uri, opts).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
