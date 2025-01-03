const express = require('express');
const { handleStripeWebhook } = require('../services/webhookHandler');

function setupWebhookRoutes(app, config) {
  // Use express.raw() for webhook endpoints to preserve the raw body
  const webhookMiddleware = express.raw({
    type: 'application/json',
    verify: (req, res, buf) => {
      req.rawBody = buf; // Store raw buffer
    }
  });

  // Live webhook endpoint
  app.post('/stripe-webhook', webhookMiddleware, async (req, res) => {
    const webhookSecret = config.STRIPE_WEBHOOK_SECRET_LIVE;
    console.log('Using Live webhook endpoint');
    if (!webhookSecret) {
      console.error('Live webhook secret not found in config');
      return res.status(500).send('Webhook secret not configured');
    }
    await handleStripeWebhook(req, res, config, 'live');
  });

  // Test webhook endpoint
  app.post('/stripe-webhook-test', webhookMiddleware, async (req, res) => {
    const webhookSecret = config.STRIPE_WEBHOOK_SECRET_TEST;
    console.log('Using Test webhook endpoint');
    if (!webhookSecret) {
      console.error('Test webhook secret not found in config');
      return res.status(500).send('Webhook secret not configured');
    }
    await handleStripeWebhook(req, res, config, 'test');
  });
}

module.exports = {
  setupWebhookRoutes
};