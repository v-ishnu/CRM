import { dbConnect } from '@/lib/db/connect';
import MasterData, { MasterDataType } from '@/models/MasterData';

export interface SeedMasterDataItem {
  type: MasterDataType;
  key: string;
  label: string;
  description?: string;
  parentKey?: string;
  sortOrder: number;
}

export const DEFAULT_MASTER_DATA_ITEMS: SeedMasterDataItem[] = [
  // 1. SERVICE CATEGORIES
  { type: 'SERVICE_CATEGORY', key: 'web_dev', label: 'Web Development', description: 'Websites, web apps, and web platforms', sortOrder: 1 },
  { type: 'SERVICE_CATEGORY', key: 'mobile_dev', label: 'Mobile Development', description: 'iOS, Android, and cross-platform applications', sortOrder: 2 },
  { type: 'SERVICE_CATEGORY', key: 'cloud_infra', label: 'Cloud & Infrastructure', description: 'VPS, cloud hosting, APIs, and DevOps', sortOrder: 3 },
  { type: 'SERVICE_CATEGORY', key: 'seo_marketing', label: 'SEO & Marketing', description: 'Search optimization, audits, and marketing', sortOrder: 4 },
  { type: 'SERVICE_CATEGORY', key: 'maintenance', label: 'Maintenance & Support', description: 'Retainers, updates, bug fixes, and SLAs', sortOrder: 5 },
  { type: 'SERVICE_CATEGORY', key: 'other', label: 'Other Services', description: 'Custom consulting and miscellaneous services', sortOrder: 6 },

  // 2. SERVICES (Child of SERVICE_CATEGORY)
  { type: 'SERVICE', key: 'WEBSITE', label: 'Website Development', parentKey: 'web_dev', sortOrder: 1 },
  { type: 'SERVICE', key: 'WEB_APPLICATION', label: 'Web Application', parentKey: 'web_dev', sortOrder: 2 },
  { type: 'SERVICE', key: 'WORDPRESS', label: 'WordPress Development', parentKey: 'web_dev', sortOrder: 3 },
  { type: 'SERVICE', key: 'ECOMMERCE', label: 'E-Commerce Platform', parentKey: 'web_dev', sortOrder: 4 },
  { type: 'SERVICE', key: 'MOBILE_APPLICATION', label: 'Mobile Application', parentKey: 'mobile_dev', sortOrder: 5 },
  { type: 'SERVICE', key: 'API_DEVELOPMENT', label: 'API Development & Integration', parentKey: 'cloud_infra', sortOrder: 6 },
  { type: 'SERVICE', key: 'MAINTENANCE', label: 'Maintenance Retainer', parentKey: 'maintenance', sortOrder: 7 },
  { type: 'SERVICE', key: 'SEO', label: 'Search Engine Optimization', parentKey: 'seo_marketing', sortOrder: 8 },
  { type: 'SERVICE', key: 'OTHER', label: 'Other Service', parentKey: 'other', sortOrder: 9 },

  // 3. HOSTING PROVIDERS
  { type: 'HOSTING_PROVIDER', key: 'hostinger', label: 'Hostinger', sortOrder: 1 },
  { type: 'HOSTING_PROVIDER', key: 'cloudways', label: 'Cloudways', sortOrder: 2 },
  { type: 'HOSTING_PROVIDER', key: 'digitalocean', label: 'DigitalOcean', sortOrder: 3 },
  { type: 'HOSTING_PROVIDER', key: 'aws', label: 'AWS', sortOrder: 4 },
  { type: 'HOSTING_PROVIDER', key: 'godaddy', label: 'GoDaddy', sortOrder: 5 },
  { type: 'HOSTING_PROVIDER', key: 'siteground', label: 'SiteGround', sortOrder: 6 },
  { type: 'HOSTING_PROVIDER', key: 'namecheap', label: 'Namecheap', sortOrder: 7 },
  { type: 'HOSTING_PROVIDER', key: 'hetzner', label: 'Hetzner', sortOrder: 8 },
  { type: 'HOSTING_PROVIDER', key: 'vps', label: 'VPS / Dedicated', sortOrder: 9 },
  { type: 'HOSTING_PROVIDER', key: 'custom', label: 'Custom Provider', sortOrder: 10 },

  // 4. HOSTING TYPES
  { type: 'HOSTING_TYPE', key: 'shared', label: 'Shared Hosting', sortOrder: 1 },
  { type: 'HOSTING_TYPE', key: 'cloud', label: 'Cloud Hosting', sortOrder: 2 },
  { type: 'HOSTING_TYPE', key: 'vps', label: 'VPS (Virtual Private Server)', sortOrder: 3 },
  { type: 'HOSTING_TYPE', key: 'dedicated', label: 'Dedicated Server', sortOrder: 4 },
  { type: 'HOSTING_TYPE', key: 'cpanel', label: 'cPanel Managed', sortOrder: 5 },
  { type: 'HOSTING_TYPE', key: 'custom', label: 'Custom Environment', sortOrder: 6 },

  // 5. PAYMENT METHODS
  { type: 'PAYMENT_METHOD', key: 'BANK_TRANSFER', label: 'Bank Transfer / IMPS / NEFT', sortOrder: 1 },
  { type: 'PAYMENT_METHOD', key: 'UPI', label: 'UPI (GPay / PhonePe / Paytm)', sortOrder: 2 },
  { type: 'PAYMENT_METHOD', key: 'CASH', label: 'Cash', sortOrder: 3 },
  { type: 'PAYMENT_METHOD', key: 'RAZORPAY', label: 'Razorpay Payment Gateway', sortOrder: 4 },
  { type: 'PAYMENT_METHOD', key: 'STRIPE', label: 'Stripe', sortOrder: 5 },
  { type: 'PAYMENT_METHOD', key: 'CARD', label: 'Credit / Debit Card', sortOrder: 6 },
  { type: 'PAYMENT_METHOD', key: 'PAYPAL', label: 'PayPal', sortOrder: 7 },
  { type: 'PAYMENT_METHOD', key: 'OTHER', label: 'Other Payment Method', sortOrder: 8 },

  // 6. PAYMENT TYPES
  { type: 'PAYMENT_TYPE', key: 'ADVANCE', label: 'Advance Deposit', sortOrder: 1 },
  { type: 'PAYMENT_TYPE', key: 'INSTALLMENT', label: 'Milestone Installment', sortOrder: 2 },
  { type: 'PAYMENT_TYPE', key: 'FINAL_PAYMENT', label: 'Final Settlement', sortOrder: 3 },
  { type: 'PAYMENT_TYPE', key: 'OTHER', label: 'Other', sortOrder: 4 },
  { type: 'PAYMENT_TYPE', key: 'CLIENT_BONUS', label: 'Client Bonus', sortOrder: 5 },

  // 7. CREDENTIAL TYPES
  { type: 'CREDENTIAL_TYPE', key: 'WORDPRESS', label: 'WordPress Admin', sortOrder: 1 },
  { type: 'CREDENTIAL_TYPE', key: 'HOSTING', label: 'Hosting / cPanel', sortOrder: 2 },
  { type: 'CREDENTIAL_TYPE', key: 'SSH', label: 'SSH / VPS Server', sortOrder: 3 },
  { type: 'CREDENTIAL_TYPE', key: 'DATABASE', label: 'Database Access', sortOrder: 4 },
  { type: 'CREDENTIAL_TYPE', key: 'CLOUDFLARE', label: 'Cloudflare DNS', sortOrder: 5 },
  { type: 'CREDENTIAL_TYPE', key: 'GITHUB', label: 'GitHub / Git Repository', sortOrder: 6 },
  { type: 'CREDENTIAL_TYPE', key: 'EMAIL', label: 'Email / SMTP Account', sortOrder: 7 },
  { type: 'CREDENTIAL_TYPE', key: 'API_KEY', label: 'API Key / Secret Token', sortOrder: 8 },
  { type: 'CREDENTIAL_TYPE', key: 'CUSTOM', label: 'Custom Credential', sortOrder: 9 },

  // 8. TEAM DESIGNATIONS
  { type: 'TEAM_DESIGNATION', key: 'full_stack_dev', label: 'Full Stack Developer', sortOrder: 1 },
  { type: 'TEAM_DESIGNATION', key: 'frontend_dev', label: 'Frontend Engineer', sortOrder: 2 },
  { type: 'TEAM_DESIGNATION', key: 'backend_dev', label: 'Backend Engineer', sortOrder: 3 },
  { type: 'TEAM_DESIGNATION', key: 'wordpress_dev', label: 'WordPress Specialist', sortOrder: 4 },
  { type: 'TEAM_DESIGNATION', key: 'ui_ux_designer', label: 'UI/UX Designer', sortOrder: 5 },
  { type: 'TEAM_DESIGNATION', key: 'seo_specialist', label: 'SEO Specialist', sortOrder: 6 },
  { type: 'TEAM_DESIGNATION', key: 'devops_engineer', label: 'DevOps Engineer', sortOrder: 7 },
  { type: 'TEAM_DESIGNATION', key: 'qa_engineer', label: 'QA / Test Engineer', sortOrder: 8 },
  { type: 'TEAM_DESIGNATION', key: 'project_manager', label: 'Project Manager', sortOrder: 9 },
];

/**
 * Idempotently seed default master data.
 * Safe to run against any database without wiping existing data.
 */
export async function seedDefaultMasterData(): Promise<{ created: number; updated: number }> {
  await dbConnect();

  let created = 0;
  let updated = 0;

  // Step 1: Seed categories and flat items first
  const categoryMap = new Map<string, any>();

  for (const item of DEFAULT_MASTER_DATA_ITEMS) {
    if (item.type === 'SERVICE_CATEGORY') {
      const existing = await MasterData.findOne({ type: item.type, key: item.key });
      if (!existing) {
        const doc = await MasterData.create({
          type: item.type,
          key: item.key,
          label: item.label,
          description: item.description,
          sortOrder: item.sortOrder,
          isActive: true,
          isSystemDefault: true,
        });
        categoryMap.set(item.key, doc._id);
        created++;
      } else {
        categoryMap.set(item.key, existing._id);
        updated++;
      }
    }
  }

  // Step 2: Seed services with parent linkage and remaining master data
  for (const item of DEFAULT_MASTER_DATA_ITEMS) {
    if (item.type === 'SERVICE_CATEGORY') continue;

    const parentId = item.parentKey ? categoryMap.get(item.parentKey) : undefined;
    const existing = await MasterData.findOne({ type: item.type, key: item.key });

    if (!existing) {
      await MasterData.create({
        type: item.type,
        key: item.key,
        label: item.label,
        description: item.description,
        parentId,
        sortOrder: item.sortOrder,
        isActive: true,
        isSystemDefault: true,
      });
      created++;
    } else {
      // Preserve existing custom label if edited by admin, but ensure parentId is set if missing
      if (parentId && !existing.parentId) {
        existing.parentId = parentId;
        await existing.save();
      }
      updated++;
    }
  }

  return { created, updated };
}
