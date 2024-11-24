const express = require('express');
const { handleStripeWebhook } = require('../services/webhookHandler');

function setupWebhookRoutes(app, config) {
  // Middleware to capture raw body for Stripe webhook verification
  const rawBodyMiddleware = express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString('utf8');
    }
  });

  // Live webhook endpoint
  app.post('/stripe-webhook', rawBodyMiddleware, async (req, res) => {
    await handleStripeWebhook(req, res, config, 'live');
  });

  // Test webhook endpoint
  app.post('/stripe-webhook-test', rawBodyMiddleware, async (req, res) => {
    await handleStripeWebhook(req, res, config, 'test');
  });
}

module.exports = {
  setupWebhookRoutes
};