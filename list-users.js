/**
 * List All Users Script
 * Shows all users in the database
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: { type: String, required: true },
  walletAddress: { type: String },
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

const listUsers = async () => {
  console.log('\n===========================================');
  console.log('📋 LIST ALL USERS');
  console.log('===========================================\n');

  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const users = await User.find({}).select('-password -emailVerificationToken');

    console.log(`Found ${users.length} user(s):\n`);
    console.log('-------------------------------------------');

    if (users.length === 0) {
      console.log('No users found in database.');
      console.log('\nTo create a user:');
      console.log('1. Go to your site and register');
      console.log('2. Or check if you\'re connected to the right database\n');
    } else {
      users.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.fullName}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Verified: ${user.emailVerified ? '✅ Yes' : '❌ No'}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Wallet: ${user.walletAddress || 'Not set'}`);
        console.log(`   Created: ${user.createdAt.toLocaleString()}`);
      });
      console.log('\n-------------------------------------------');

      const unverified = users.filter(u => !u.emailVerified);
      if (unverified.length > 0) {
        console.log('\n⚠️  Unverified users:');
        unverified.forEach(u => {
          console.log(`   - ${u.email}`);
        });
        console.log('\nTo verify: npm run verify-user <email>');
      }
    }

    console.log('\n===========================================\n');

    await mongoose.connection.close();

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
};

listUsers();
