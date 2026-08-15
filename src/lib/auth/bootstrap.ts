import bcrypt from 'bcryptjs';
import User from '@/models/User';
import { dbConnect } from '@/lib/db/connect';

export async function bootstrapAdmin() {
  await dbConnect();
  
  const count = await User.countDocuments();
  if (count > 0) {
    return; // Already bootstrapped
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn('ADMIN_EMAIL and ADMIN_PASSWORD env vars are not set. Cannot bootstrap initial admin.');
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  
  const admin = new User({
    email,
    password: hashedPassword,
    role: 'ADMIN',
    name: 'Administrator',
  });

  await admin.save();
  console.log(`Successfully bootstrapped initial admin user with email: ${email}`);
}
