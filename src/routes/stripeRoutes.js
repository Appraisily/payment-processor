const express = require('express');
const stripeModule = require('stripe');
const { logError } = require('../utils/errorLogger');

function setupStripeRoutes(app, config) {
  const router = express.Router();

  // Middleware to verify shared secret
  const verifySharedSecret = async (req, res, next) => {
    const sharedSecret = req.headers['x-shared-secret'];
    
    try {
      const expectedSecret = config.STRIPE_SHARED_SECRET;
      if (!sharedSecret || sharedSecret !== expectedSecret) {
        throw new Error('Invalid or missing shared secret');
      }
      next();
    } catch (error) {
      await logError(config, {
        timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
        severity: 'Warning',
        scriptName: 'stripeRoutes',
        errorCode: 'AuthenticationError',
        errorMessage: 'Invalid or missing shared secret',
        endpoint: req.originalUrl,
        environment: 'Production',
        additionalContext: JSON.stringify({ 
          hasSharedSecret: !!sharedSecret,
          ip: req.ip 
        })
      });
      res.status(401).json({ error: 'Unauthorized' });
    }
  };

  // GET /stripe/session/:sessionId
  router.get('/session/:sessionId', verifySharedSecret, async (req, res) => {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    try {
      // Verify we have the required configuration
      if (!config.STRIPE_SECRET_KEY_LIVE) {
        throw new Error('Stripe configuration is not properly loaded');
      }

      // Initialize Stripe with the live key
      const stripe = stripeModule(config.STRIPE_SECRET_KEY_LIVE);
      
      // Retrieve the session
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['customer_details']
      });

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      // Return only necessary data
      res.json({
        customer_details: {
          name: session.customer_details?.name,
          email: session.customer_details?.email
        },
        amount_total: session.amount_total,
        currency: session.currency,
        payment_status: session.payment_status
      });

    } catch (error) {
      await logError(config, {
        timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
        severity: 'Error',
        scriptName: 'stripeRoutes',
        errorCode: error.code || 'UnknownError',
        errorMessage: `Failed to retrieve session: ${error.message}`,
        errorMessage: error.message,
        stackTrace: error.stack,
        endpoint: req.originalUrl,
        environment: 'Production',
        additionalContext: JSON.stringify({ 
          sessionId,
          stripeError: error.raw 
        })
      });

      // Handle specific Stripe errors
      if (error.type === 'StripeInvalidRequestError') {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Handle other errors
      res.status(500).json({ 
        error: 'Internal server error while retrieving session'
      });
    }
  });

  // Mount the router
  app.use('/stripe', router);
}

module.exports = {
  setupStripeRoutes
};