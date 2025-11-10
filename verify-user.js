/**
 * Manual User Verification Script
 *
 * This script manually verifies a user's email in the database.
 * Useful for testing or for users who registered before email service was configured.
 *
 * Usage:
 *   node verify-user.js user-email@example.com
 *
 * Example:
 *   node verify-user.js borysenkooleh7@gmail.com
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// User Schema (simplified version)
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

const verifyUser = async (email) => {
  console.log('\n===========================================');
  console.log('👤 MANUAL USER VERIFICATION');
  console.log('===========================================\n');

  if (!email) {
    console.error('❌ ERROR: No email provided!\n');
    console.error('Usage: node verify-user.js user-email@example.com\n');
    process.exit(1);
  }

  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find user
    console.log('🔍 Looking for user:', email);
    const user = await User.findOne({ email });

    if (!user) {
      console.error('❌ User not found with email:', email);
      console.error('\nPlease check:');
      console.error('  - Email is spelled correctly');
      console.error('  - User has registered in the database');
      console.error('\n');
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log('✅ User found!\n');
    console.log('User Details:');
    console.log('  Name:', user.fullName);
    console.log('  Email:', user.email);
    console.log('  Email Verified:', user.emailVerified ? '✅ Yes' : '❌ No');
    console.log('  Wallet:', user.walletAddress || 'Not set');
    console.log('  Role:', user.role);
    console.log('  Created:', user.createdAt.toLocaleString());
    console.log('\n-------------------------------------------\n');

    if (user.emailVerified) {
      console.log('ℹ️  Email is already verified!');
      console.log('   User can login normally.\n');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Verify the user
    console.log('🔧 Verifying user email...');

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;

    await user.save();

    console.log('✅ EMAIL VERIFIED SUCCESSFULLY!\n');
    console.log('===========================================');
    console.log('User', email, 'can now login!');
    console.log('===========================================\n');

    await mongoose.connection.close();
    console.log('✅ Database connection closed\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nStack trace:', error.stack);

    if (error.code === 'ENOTFOUND') {
      console.error('\n⚠️  Cannot connect to MongoDB');
      console.error('   Check MONGODB_URI in .env file');
    }

    process.exit(1);
  }
};

// Get email from command line argument
const userEmail = process.argv[2];

// Run verification
verifyUser(userEmail);
