/**
 * Email Configuration Test Script
 *
 * This script tests your email configuration to make sure emails can be sent.
 *
 * Usage:
 *   node test-email.js your-email@example.com
 *
 * Example:
 *   node test-email.js borysenkooleh7@gmail.com
 */

import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const testEmail = async (recipientEmail) => {
  console.log('\n===========================================');
  console.log('📧 TESTING EMAIL CONFIGURATION');
  console.log('===========================================\n');

  // Check if email is configured
  const emailConfig = {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM || 'USDT Payment <noreply@usdtpayment.com>'
  };

  console.log('Current Configuration:');
  console.log('  HOST:', emailConfig.host || '❌ NOT SET');
  console.log('  PORT:', emailConfig.port);
  console.log('  SECURE:', emailConfig.secure);
  console.log('  USER:', emailConfig.user || '❌ NOT SET');
  console.log('  PASSWORD:', emailConfig.password ? '✅ SET (hidden)' : '❌ NOT SET');
  console.log('  FROM:', emailConfig.from);
  console.log('\n-------------------------------------------\n');

  if (!emailConfig.host || !emailConfig.user || !emailConfig.password) {
    console.error('❌ EMAIL NOT CONFIGURED!');
    console.error('\nMissing required environment variables in .env file:');
    if (!emailConfig.host) console.error('  - EMAIL_HOST');
    if (!emailConfig.user) console.error('  - EMAIL_USER');
    if (!emailConfig.password) console.error('  - EMAIL_PASSWORD');
    console.error('\nPlease check EMAIL_SETUP_GUIDE.md for setup instructions.\n');
    process.exit(1);
  }

  // Create transporter
  console.log('Creating email transporter...');
  const transporter = nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    auth: {
      user: emailConfig.user,
      pass: emailConfig.password,
    },
  });

  // Verify connection
  console.log('Verifying SMTP connection...');
  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!\n');
  } catch (error) {
    console.error('❌ SMTP connection failed!');
    console.error('Error:', error.message);
    console.error('\nCommon issues:');
    console.error('  - Wrong EMAIL_USER or EMAIL_PASSWORD');
    console.error('  - Gmail: Need to use App Password (not regular password)');
    console.error('  - Network/Firewall blocking SMTP');
    console.error('  - Wrong EMAIL_HOST or EMAIL_PORT\n');
    process.exit(1);
  }

  // Send test email
  const testCode = Math.floor(100000 + Math.random() * 900000).toString();

  console.log('Sending test verification email...');
  console.log('To:', recipientEmail);
  console.log('Test Code:', testCode);
  console.log('\n-------------------------------------------\n');

  const mailOptions = {
    from: emailConfig.from,
    to: recipientEmail,
    subject: 'Test Email - USDT Payment Email Verification',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px;
            border-radius: 10px;
            color: white;
          }
          .content {
            background: white;
            color: #333;
            padding: 30px;
            border-radius: 8px;
            margin-top: 20px;
          }
          .code-box {
            background: #f7fafc;
            border: 2px solid #667eea;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 30px 0;
          }
          .code {
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
            letter-spacing: 5px;
            font-family: monospace;
          }
          .success {
            background: #48bb78;
            color: white;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 style="margin: 0; font-size: 28px;">✅ Email Test Successful!</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Your USDT Payment email configuration is working</p>
        </div>

        <div class="content">
          <div class="success">
            <h2 style="margin: 0;">🎉 Congratulations!</h2>
            <p style="margin: 10px 0 0 0;">Your email service is configured correctly and sending emails.</p>
          </div>

          <h2>Test Verification Code</h2>
          <p>This is a test email to verify your email configuration is working properly.</p>

          <div class="code-box">
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #718096;">Test verification code:</p>
            <div class="code">${testCode}</div>
          </div>

          <h3>Next Steps:</h3>
          <ul>
            <li>✅ Email service is configured correctly</li>
            <li>✅ Emails are being sent successfully</li>
            <li>✅ Ready for production use!</li>
          </ul>

          <p><strong>For Production Deployment:</strong></p>
          <ol>
            <li>Add the same EMAIL_* environment variables to Render.com</li>
            <li>Deploy your backend</li>
            <li>Test registration on your live site</li>
          </ol>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #718096; text-align: center;">
            <p>This is an automated test email from USDT Payment</p>
            <p>&copy; ${new Date().getFullYear()} USDT Payment. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      ✅ EMAIL TEST SUCCESSFUL!

      Your USDT Payment email configuration is working correctly.

      Test Verification Code: ${testCode}

      Next Steps:
      ✅ Email service is configured correctly
      ✅ Emails are being sent successfully
      ✅ Ready for production use!

      For Production Deployment:
      1. Add the same EMAIL_* environment variables to Render.com
      2. Deploy your backend
      3. Test registration on your live site

      This is an automated test email from USDT Payment
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ TEST EMAIL SENT SUCCESSFULLY!\n');
    console.log('Email Details:');
    console.log('  Message ID:', info.messageId);
    console.log('  Response:', info.response);
    console.log('\n-------------------------------------------\n');
    console.log('✅ EMAIL CONFIGURATION IS WORKING!');
    console.log('\nPlease check your inbox:', recipientEmail);
    console.log('(Check spam folder if you don\'t see it)\n');
    console.log('Next step: Add these same environment variables to Render.com\n');
    console.log('===========================================\n');
  } catch (error) {
    console.error('❌ FAILED TO SEND TEST EMAIL!');
    console.error('\nError:', error.message);
    if (error.code) {
      console.error('Error Code:', error.code);
    }
    console.error('\nCommon issues:');
    console.error('  - Gmail: Check App Password is correct');
    console.error('  - SendGrid: Verify sender identity');
    console.error('  - Mailgun: Check domain verification');
    console.error('  - All: Check EMAIL_USER and EMAIL_PASSWORD\n');
    process.exit(1);
  }
};

// Get recipient email from command line argument
const recipientEmail = process.argv[2];

if (!recipientEmail) {
  console.error('\n❌ ERROR: No recipient email provided!\n');
  console.error('Usage: node test-email.js your-email@example.com');
  console.error('Example: node test-email.js borysenkooleh7@gmail.com\n');
  process.exit(1);
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(recipientEmail)) {
  console.error('\n❌ ERROR: Invalid email format!\n');
  console.error('Please provide a valid email address.\n');
  process.exit(1);
}

// Run test
testEmail(recipientEmail).catch(error => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
