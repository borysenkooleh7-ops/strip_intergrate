import dotenv from 'dotenv';

dotenv.config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/usdt-payment'
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },

  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    password: process.env.ADMIN_PASSWORD || 'admin123'
  },

  email: {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM || 'USDT Payment <noreply@usdtpayment.com>'
  },

  // Binance API for real USDT transfers
  binance: {
    apiKey: process.env.BINANCE_API_KEY,
    apiSecret: process.env.BINANCE_API_SECRET,
    defaultNetwork: process.env.BINANCE_DEFAULT_NETWORK || 'TRC20' // TRC20, ERC20, or BEP20
  },

  // CoinDesk API for real-time USDT price data
  coindesk: {
    apiKey: process.env.COINDESK_API_KEY,
    apiName: process.env.COINDESK_API_NAME || 'exchange_test_usdt'
  },

  // Transak API for on-ramp (direct crypto purchases)
  transak: {
    apiKey: process.env.TRANSAK_API_KEY,
    apiSecret: process.env.TRANSAK_API_SECRET,
    environment: process.env.TRANSAK_ENVIRONMENT || 'STAGING', // STAGING or PRODUCTION
    webhookSecret: process.env.TRANSAK_WEBHOOK_SECRET
  },

  logLevel: process.env.LOG_LEVEL || 'info'
};

// Validate required environment variables
const requiredEnvVars = ['STRIPE_SECRET_KEY', 'JWT_SECRET'];

if (config.env === 'production') {
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}

export default config;
