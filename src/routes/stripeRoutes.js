const express = require('express');
const stripeModule = require('stripe');
const { logError } = require('../utils/errorLogger');

function setupStripeRoutes(app, config) {
  const router = express.Router();

  // Middleware to verify shared secret
  const verifySharedSecret = async (req, res, next) => {
    const sharedSecret = req.headers['x-shared-secret'];
    
    try {
      const expectedSecret = await config.STRIPE_SHARED_SECRET;
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

    try {
      // Initialize Stripe with the live key
      const stripe = stripeModule(config.STRIPE_SECRET_KEY_LIVE);
      
      // Retrieve the session
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
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
        errorMessage: error.message,
        stackTrace: error.stack,
        endpoint: req.originalUrl,
        environment: 'Production',
        additionalContext: JSON.stringify({ 
          sessionId,
          stripeError: error.raw 
        })
      });

      res.status(error.statusCode || 500).json({ 
        error: error.message 
      });
    }
  });

  // Mount the router
  app.use('/stripe', router);
}

module.exports = {
  setupStripeRoutes
};