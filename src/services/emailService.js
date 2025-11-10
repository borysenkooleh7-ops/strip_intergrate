import nodemailer from 'nodemailer';
import config from '../config/environment.js';
import logger from '../utils/logger.js';

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      // Create transporter based on environment
      if (config.email && config.email.host && config.email.user && config.email.password) {
        logger.info('Initializing email transporter with config:', {
          host: config.email.host,
          port: config.email.port,
          secure: config.email.secure,
          user: config.email.user,
          from: config.email.from
        });

        this.transporter = nodemailer.createTransport({
          host: config.email.host,
          port: config.email.port,
          secure: config.email.secure, // true for 465, false for other ports
          auth: {
            user: config.email.user,
            pass: config.email.password,
          },
        });

        // Verify connection
        this.transporter.verify((error, success) => {
          if (error) {
            logger.error('❌ Email transporter verification failed:', {
              error: error.message,
              stack: error.stack
            });
          } else {
            logger.info('✅ Email service is ready to send emails');
          }
        });
      } else {
        // For development: use console logging
        logger.warn('⚠️ EMAIL SERVICE NOT CONFIGURED - Emails will only be logged to console');
        logger.warn('Missing email configuration:', {
          hasHost: !!config.email?.host,
          hasUser: !!config.email?.user,
          hasPassword: !!config.email?.password
        });
        logger.warn('To enable email sending:');
        logger.warn('1. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD in your .env file');
        logger.warn('2. For Gmail: Generate App Password at https://myaccount.google.com/apppasswords');
        logger.warn('3. Restart the server after adding credentials');
        this.transporter = null;
      }
    } catch (error) {
      logger.error('Failed to initialize email transporter:', error);
      this.transporter = null;
    }
  }

  async sendVerificationEmail(email, fullName, verificationCode) {
    const verificationLink = `${config.clientUrl}/verify-email?code=${verificationCode}&email=${encodeURIComponent(email)}`;

    const mailOptions = {
      from: config.email?.from || 'USDT Payment <noreply@usdtpayment.com>',
      to: email,
      subject: 'Verify Your Email - USDT Payment',
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
            .button {
              display: inline-block;
              background: #667eea;
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
              font-weight: bold;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e2e8f0;
              font-size: 12px;
              color: #718096;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 style="margin: 0; font-size: 28px;">Welcome to USDT Payment!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">We're excited to have you on board</p>
          </div>

          <div class="content">
            <h2>Hi ${fullName},</h2>
            <p>Thank you for registering! To complete your registration, please verify your email address.</p>

            <div class="code-box">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #718096;">Your verification code:</p>
              <div class="code">${verificationCode}</div>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #718096;">This code will expire in 15 minutes</p>
            </div>

            <p>Alternatively, you can click the button below to verify your email:</p>

            <div style="text-align: center;">
              <a href="${verificationLink}" class="button">Verify Email Address</a>
            </div>

            <p style="margin-top: 30px; font-size: 14px; color: #718096;">
              If you didn't create an account with us, you can safely ignore this email.
            </p>

            <div class="footer">
              <p>This is an automated email. Please do not reply to this message.</p>
              <p>&copy; ${new Date().getFullYear()} USDT Payment. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Hi ${fullName},

        Thank you for registering with USDT Payment!

        To complete your registration, please verify your email address using the code below:

        Verification Code: ${verificationCode}

        This code will expire in 15 minutes.

        Alternatively, you can verify your email by visiting this link:
        ${verificationLink}

        If you didn't create an account with us, you can safely ignore this email.

        Best regards,
        USDT Payment Team
      `,
    };

    try {
      if (this.transporter) {
        logger.info('📧 Sending verification email...', { to: email });
        const info = await this.transporter.sendMail(mailOptions);
        logger.info('✅ Verification email sent successfully!', {
          email,
          messageId: info.messageId,
          response: info.response
        });
        return { success: true, messageId: info.messageId };
      } else {
        // Development/No Config mode: log to console
        logger.warn('⚠️ EMAIL NOT SENT - Email service not configured');
        logger.info('VERIFICATION EMAIL (Console Only - NOT SENT)', {
          to: email,
          code: verificationCode,
          link: verificationLink
        });
        console.log('\n========================================');
        console.log('📧 VERIFICATION EMAIL (NOT ACTUALLY SENT)');
        console.log('========================================');
        console.log('To:', email);
        console.log('Verification Code:', verificationCode);
        console.log('Verification Link:', verificationLink);
        console.log('========================================');
        console.log('⚠️  EMAIL SERVICE NOT CONFIGURED!');
        console.log('Configure EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD');
        console.log('in your .env file to send real emails.');
        console.log('========================================\n');
        return { success: true, messageId: 'dev-mode-console-only' };
      }
    } catch (error) {
      logger.error('❌ Failed to send verification email', {
        email,
        error: error.message,
        stack: error.stack,
        code: error.code
      });

      // Log specific SMTP errors
      if (error.code === 'EAUTH') {
        logger.error('Authentication failed - Check EMAIL_USER and EMAIL_PASSWORD');
      } else if (error.code === 'ECONNECTION') {
        logger.error('Connection failed - Check EMAIL_HOST and EMAIL_PORT');
      } else if (error.code === 'ETIMEDOUT') {
        logger.error('Connection timeout - Check your network and email server');
      }

      throw new Error('Failed to send verification email: ' + error.message);
    }
  }

  async sendPasswordResetEmail(email, fullName, resetToken) {
    const resetLink = `${config.clientUrl}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: config.email?.from || 'USDT Payment <noreply@usdtpayment.com>',
      to: email,
      subject: 'Password Reset Request - USDT Payment',
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
            .button {
              display: inline-block;
              background: #667eea;
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <h2>Password Reset Request</h2>
          <p>Hi ${fullName},</p>
          <p>You requested to reset your password. Click the button below to reset it:</p>
          <a href="${resetLink}" class="button">Reset Password</a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </body>
        </html>
      `,
    };

    try {
      if (this.transporter) {
        const info = await this.transporter.sendMail(mailOptions);
        logger.info('Password reset email sent', { email, messageId: info.messageId });
        return { success: true };
      } else {
        logger.info('PASSWORD RESET EMAIL (Development Mode)', {
          to: email,
          link: resetLink
        });
        console.log('\n========== PASSWORD RESET EMAIL ==========');
        console.log('To:', email);
        console.log('Reset Link:', resetLink);
        console.log('==========================================\n');
        return { success: true };
      }
    } catch (error) {
      logger.error('Failed to send password reset email', { email, error: error.message });
      throw new Error('Failed to send password reset email');
    }
  }
}

// Export singleton instance
export default new EmailService();
