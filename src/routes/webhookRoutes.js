const express = require('express');
const PaymentService = require('../domain/payment/service');
const StripeClient = require('../infrastructure/stripe/client');
const { logError } = require('../utils/error/logger');

function setupWebhookRoutes(app, config) {
  const stripeClient = new StripeClient(config);
  const paymentService = new PaymentService(config);

  const webhookMiddleware = express.raw({
    type: 'application/json',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  });

  async function handleWebhook(req, res, mode) {
    const sig = req.headers['stripe-signature'];
    if (!sig) {
      return res.status(400).send('No signature header');
    }

    try {
      const event = await stripeClient.verifyWebhookSignature(
        req.rawBody,
        sig,
        mode
      );

      if (event.type === 'checkout.session.completed') {
        await paymentService.processCheckoutSession(event.data.object, mode);
        res.status(200).send('Webhook processed successfully');
      } else {
        console.log(`Ignoring event type ${event.type}`);
        res.status(200).send('Ignored event type');
      }
    } catch (error) {
      console.error('Error processing webhook:', error);
      await logError(config, {
        severity: 'Error',
        scriptName: 'webhookRoutes',
        errorCode: error.code || 'UnknownError',
        errorMessage: error.message,
        stackTrace: error.stack,
        environment: mode,
        endpoint: req.originalUrl,
        additionalContext: JSON.stringify({ 
          signature: sig,
          mode
        })
      });
      res.status(400).send(`Webhook Error: ${error.message}`);
    }
  }

  app.post('/stripe-webhook', webhookMiddleware, (req, res) => {
    handleWebhook(req, res, 'live');
  });

  app.post('/stripe-webhook-test', webhookMiddleware, (req, res) => {
    handleWebhook(req, res, 'test');
  });
}

module.exports = {
  setupWebhookRoutes
};