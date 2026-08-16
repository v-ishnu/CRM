import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { dbConnect } from '../src/lib/db/connect';
import { ClientService } from '../src/services/client.service';
import Client from '../src/models/Client';

async function runMigration() {
  console.log('--- Starting Client Code Migration ---');
  await dbConnect();

  const allClientsBefore = await Client.find({});
  console.log(`Found ${allClientsBefore.length} clients in database.`);
  for (const c of allClientsBefore) {
    console.log(`- Current: ID=${c._id}, Code=${c.clientCode}, Name=${c.name}, TelegramUserId=${c.telegramUserId || 'N/A'}`);
  }

  const result = await ClientService.migrateLegacyClientCodes();
  console.log(`\nMigration completed: ${result.migratedCount} clients updated.`);
  for (const item of result.updated) {
    console.log(`  * ID: ${item.id} | Old Code: ${item.oldCode} -> New Secure Code: ${item.newCode}`);
  }

  const allClientsAfter = await Client.find({});
  console.log('\n--- Final Clients in DB ---');
  for (const c of allClientsAfter) {
    console.log(`- ID=${c._id}, Code=${c.clientCode}, Name=${c.name}, TelegramUserId=${c.telegramUserId || 'N/A'}`);
  }

  await mongoose.disconnect();
  console.log('--- Done ---');
  process.exit(0);
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
