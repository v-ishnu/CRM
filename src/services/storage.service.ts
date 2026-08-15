import 'server-only';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = process.env.SUPABASE_INVOICE_BUCKET || 'invoices';


// Initialize Supabase Client if configured
const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
    })
  : null;

// Declare global variable type for TypeScript compliance when testing
declare global {
  var mockStorage: Record<string, Buffer> | undefined;
}

export class StorageService {
  /**
   * Helper to verify configuration state
   */
  static isConfigured(): boolean {
    return !!supabase && !!bucketName;
  }

  /**
   * Upload an invoice PDF buffer to Supabase Storage
   */
  static async uploadInvoicePDF(buffer: Buffer, storagePath: string): Promise<string> {
    if (!this.isConfigured()) {
      if (process.env.NODE_ENV === 'test') {
        globalThis.mockStorage = globalThis.mockStorage || {};
        globalThis.mockStorage[storagePath] = buffer;
        return storagePath;
      }
      throw new Error('Supabase invoice storage is not configured. Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    }

    const { data, error } = await supabase!.storage
      .from(bucketName)
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error(`Failed to upload invoice to storage: ${error.message}`);
    }

    return data.path;
  }

  /**
   * Retrieve an invoice PDF buffer from Supabase Storage
   */
  static async getInvoicePDF(storagePath: string): Promise<Buffer> {
    if (!this.isConfigured()) {
      if (process.env.NODE_ENV === 'test') {
        globalThis.mockStorage = globalThis.mockStorage || {};
        const mockFile = globalThis.mockStorage[storagePath];
        if (mockFile) return mockFile;
      }
      throw new Error('Supabase invoice storage is not configured. Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    }

    const { data, error } = await supabase!.storage
      .from(bucketName)
      .download(storagePath);

    if (error) {
      console.error('Supabase download error:', error);
      throw new Error(`Failed to download invoice from storage: ${error.message}`);
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Generate a signed URL for an invoice PDF download
   */
  static async getSignedUrl(storagePath: string, expiresIn = 900): Promise<string> {
    if (!this.isConfigured()) {
      if (process.env.NODE_ENV === 'test') {
        return `https://mock-supabase.co/storage/v1/object/sign/${bucketName}/${storagePath}?token=mock`;
      }
      throw new Error('Supabase invoice storage is not configured. Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    }

    const { data, error } = await supabase!.storage
      .from(bucketName)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      console.error('Supabase signed URL error:', error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Delete an invoice PDF from Supabase Storage
   */
  static async deleteInvoicePDF(storagePath: string): Promise<boolean> {
    if (!this.isConfigured()) {
      if (process.env.NODE_ENV === 'test') {
        globalThis.mockStorage = globalThis.mockStorage || {};
        delete globalThis.mockStorage[storagePath];
        return true;
      }
      return false;
    }

    const { error } = await supabase!.storage
      .from(bucketName)
      .remove([storagePath]);

    if (error) {
      console.error('Supabase delete error:', error);
      return false;
    }

    return true;
  }
}
