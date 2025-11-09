import Stripe from 'stripe';
import config from './environment.js';

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2023-10-16',
});

export default stripe;
