const express = require('express');
const StripeClient = require('../infrastructure/stripe/client');
const { logError } = require('../utils/error/logger');

function setupStripeRoutes(app, config) {
  const router = express.Router();
  const stripeClient = new StripeClient(config);

  const verifySharedSecret = async (req, res, next) => {
    const sharedSecret = req.headers['x-shared-secret'];
    
    if (!sharedSecret || sharedSecret !== config.STRIPE_SHARED_SECRET) {
      await logError(config, {
        severity: 'Warning',
        scriptName: 'stripeRoutes',
        errorCode: 'AuthenticationError',
        errorMessage: 'Invalid or missing shared secret',
        endpoint: req.originalUrl,
        additionalContext: JSON.stringify({ 
          hasSharedSecret: !!sharedSecret,
          ip: req.ip 
        })
      });
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };

  router.get('/session/:sessionId', verifySharedSecret, async (req, res) => {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    try {
      const session = await stripeClient.retrieveSession(sessionId, 'live');
      
      console.log('Retrieved Stripe session:', {
        id: session.id,
        email: session.customer_details?.email,
        status: session.payment_status
      });
      
      res.json({
        customer_details: {
          name: session.customer_details?.name,
          email: session.customer_details?.email
        },
        amount_total: session.amount_total / 100,
        currency: session.currency,
        payment_status: session.payment_status
      });
    } catch (error) {
      await logError(config, {
        timestamp: new Date().toISOString(),
        severity: 'Error',
        scriptName: 'stripeRoutes',
        errorCode: error.code || 'UnknownError',
        errorMessage: error.message,
        stackTrace: error.stack,
        endpoint: req.originalUrl,
        additionalContext: JSON.stringify({ 
          sessionId,
          headers: req.headers,
          stripeError: error.raw 
        })
      });

      if (error.type === 'StripeInvalidRequestError') {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.use('/stripe', router);
}

module.exports = setupStripeRoutes;