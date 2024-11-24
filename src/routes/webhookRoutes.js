const express = require('express');
const { handleStripeWebhook } = require('../services/webhookHandler');

function setupWebhookRoutes(app, config) {
  // Middleware específico para webhooks que preserva el raw body
  const webhookMiddleware = express.raw({
    type: 'application/json'
  });

  // Live webhook endpoint
  app.post('/stripe-webhook', webhookMiddleware, async (req, res) => {
    console.log('Live webhook secret:', config.STRIPE_WEBHOOK_SECRET_LIVE); // Temporary debug
    await handleStripeWebhook(req, res, config, 'live');
  });

  // Test webhook endpoint
  app.post('/stripe-webhook-test', webhookMiddleware, async (req, res) => {
    console.log('Test webhook secret:', config.STRIPE_WEBHOOK_SECRET_TEST); // Temporary debug
    await handleStripeWebhook(req, res, config, 'test');
  });
}

module.exports = {
  setupWebhookRoutes
};