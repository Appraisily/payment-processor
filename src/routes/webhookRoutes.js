const express = require('express');
const { handleStripeWebhook } = require('../services/webhookHandler');

function setupWebhookRoutes(app, config) {
  // Middleware específico para webhooks que preserva el raw body
  const webhookMiddleware = express.raw({
    type: 'application/json',
    verify: (req, res, buf) => {
      req.rawBody = buf; // Guardar el raw body para la verificación de firma
    }
  });

  // Live webhook endpoint
  app.post('/stripe-webhook', webhookMiddleware, async (req, res) => {
    await handleStripeWebhook(req, res, config, 'live');
  });

  // Test webhook endpoint
  app.post('/stripe-webhook-test', webhookMiddleware, async (req, res) => {
    await handleStripeWebhook(req, res, config, 'test');
  });
}

module.exports = {
  setupWebhookRoutes
};