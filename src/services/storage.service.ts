import 'server-only';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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
   * Ensure local invoice storage directory exists
   */
  private static getLocalInvoiceDir(): string {
    const dir = path.join(process.cwd(), 'public', 'invoices');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Ensure local general uploads storage directory exists
   */
  private static getLocalUploadDir(): string {
    const dir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Upload an invoice PDF buffer to Supabase Storage with local filesystem backup
   */
  static async uploadInvoicePDF(buffer: Buffer, storagePath: string): Promise<string> {
    // 1. Always save a local copy in public/invoices for offline access & fallback
    try {
      const localDir = this.getLocalInvoiceDir();
      const fileName = path.basename(storagePath);
      const localPath = path.join(localDir, fileName);
      fs.writeFileSync(localPath, buffer);
    } catch (fsErr) {
      console.warn('Local invoice file backup warning:', fsErr);
    }

    // 2. Track in test mock storage if in test mode
    if (process.env.NODE_ENV === 'test') {
      globalThis.mockStorage = globalThis.mockStorage || {};
      globalThis.mockStorage[storagePath] = buffer;
    }

    // 3. Upload to Supabase Storage if configured
    if (this.isConfigured()) {
      try {
        const { data, error } = await supabase!.storage
          .from(bucketName)
          .upload(storagePath, buffer, {
            contentType: 'application/pdf',
            upsert: true,
          });

        if (!error && data) {
          return data.path;
        }
        console.warn('Supabase invoice upload failed, using local storage path:', error?.message);
      } catch (cloudErr: any) {
        console.warn('Supabase invoice upload error, using local storage path:', cloudErr.message);
      }
    }

    return storagePath;
  }

  /**
   * Upload any file/document buffer to Supabase Storage with local backup
   */
  static async uploadFile(buffer: Buffer, storagePath: string, contentType: string): Promise<string> {
    try {
      const localDir = this.getLocalUploadDir();
      const fileName = path.basename(storagePath);
      fs.writeFileSync(path.join(localDir, fileName), buffer);
    } catch (fsErr) {
      console.warn('Local file backup warning:', fsErr);
    }

    if (process.env.NODE_ENV === 'test') {
      globalThis.mockStorage = globalThis.mockStorage || {};
      globalThis.mockStorage[storagePath] = buffer;
    }

    if (this.isConfigured()) {
      try {
        const { data, error } = await supabase!.storage
          .from(bucketName)
          .upload(storagePath, buffer, {
            contentType,
            upsert: true,
          });

        if (!error && data) {
          return data.path;
        }
        console.warn('Supabase generic upload failed, using local storage path:', error?.message);
      } catch (cloudErr: any) {
        console.warn('Supabase generic upload error, using local storage path:', cloudErr.message);
      }
    }

    return storagePath;
  }

  /**
   * Retrieve an invoice PDF buffer from local storage, Supabase, or mock
   */
  static async getInvoicePDF(storagePath: string): Promise<Buffer> {
    // 1. Check in-memory mock if in test environment
    if (process.env.NODE_ENV === 'test' && globalThis.mockStorage && globalThis.mockStorage[storagePath]) {
      return globalThis.mockStorage[storagePath];
    }

    // 2. Check local filesystem in public/invoices/
    const fileName = path.basename(storagePath);
    const localPath = path.join(process.cwd(), 'public', 'invoices', fileName);
    if (fs.existsSync(localPath)) {
      try {
        return fs.readFileSync(localPath);
      } catch (readErr) {
        console.warn('Local invoice read warning:', readErr);
      }
    }

    const directPublicPath = path.join(process.cwd(), 'public', storagePath);
    if (fs.existsSync(directPublicPath)) {
      try {
        return fs.readFileSync(directPublicPath);
      } catch (readErr) {
        console.warn('Direct public path read warning:', readErr);
      }
    }

    // 3. Check Supabase Storage if configured
    if (this.isConfigured()) {
      try {
        const { data, error } = await supabase!.storage
          .from(bucketName)
          .download(storagePath);

        if (!error && data) {
          const arrayBuffer = await data.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          // Cache locally
          try {
            const dir = this.getLocalInvoiceDir();
            fs.writeFileSync(path.join(dir, fileName), buffer);
          } catch {}
          return buffer;
        }
        console.warn('Supabase download warning:', error?.message);
      } catch (cloudErr: any) {
        console.warn('Supabase download error:', cloudErr.message);
      }
    }

    // 4. Test mock storage fallback
    if (globalThis.mockStorage && globalThis.mockStorage[storagePath]) {
      return globalThis.mockStorage[storagePath];
    }

    throw new Error(`Invoice PDF file could not be found locally or in storage: ${storagePath}`);
  }

  /**
   * Generate a signed URL for an invoice PDF download
   */
  static async getSignedUrl(storagePath: string, expiresIn = 900): Promise<string> {
    if (this.isConfigured()) {
      try {
        const { data, error } = await supabase!.storage
          .from(bucketName)
          .createSignedUrl(storagePath, expiresIn);

        if (!error && data?.signedUrl) {
          return data.signedUrl;
        }
      } catch (err: any) {
        console.warn('Supabase signed URL warning:', err.message);
      }
    }

    // Local static URL fallback
    const fileName = path.basename(storagePath);
    return `/invoices/${fileName}`;
  }

  /**
   * Delete an invoice PDF from local storage and Supabase Storage
   */
  static async deleteInvoicePDF(storagePath: string): Promise<boolean> {
    // 1. Delete from local filesystem
    try {
      const fileName = path.basename(storagePath);
      const localPath = path.join(process.cwd(), 'public', 'invoices', fileName);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
    } catch (fsErr) {
      console.warn('Local invoice delete warning:', fsErr);
    }

    // 2. Delete from test mock storage
    if (globalThis.mockStorage && globalThis.mockStorage[storagePath]) {
      delete globalThis.mockStorage[storagePath];
    }

    // 3. Delete from Supabase Storage if configured
    if (this.isConfigured()) {
      try {
        await supabase!.storage
          .from(bucketName)
          .remove([storagePath]);
      } catch (cloudErr: any) {
        console.warn('Supabase delete warning:', cloudErr.message);
      }
    }

    return true;
  }
}
