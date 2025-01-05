const express = require('express');
const { google } = require('googleapis');
const sendGridMail = require('@sendgrid/mail');
const axios = require('axios');
const pkg = require('../../package.json');

async function checkGoogleSheets(config) {
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    await auth.getClient();
    return true;
  } catch (error) {
    console.error('Sheets health check failed:', error);
    return false;
  }
}

async function checkWordPress(config) {
  try {
    await axios.get(config.WORDPRESS_API_URL, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.WORDPRESS_USERNAME}:${config.WORDPRESS_APP_PASSWORD}`).toString('base64')}`
      }
    });
    return true;
  } catch (error) {
    console.error('WordPress health check failed:', error);
    return false;
  }
}

async function checkEmail(config) {
  try {
    sendGridMail.setApiKey(config.SENDGRID_API_KEY);
    return true;
  } catch (error) {
    console.error('Email health check failed:', error);
    return false;
  }
}

function setupHealthRoutes(app, config) {
  const router = express.Router();
  const startTime = Date.now();

  // List all endpoints
  router.get('/endpoints', (req, res) => {
    res.json({
      service: pkg.name,
      version: pkg.version,
      endpoints: [
        {
          path: '/stripe/session/:sessionId',
          method: 'GET',
          description: 'Retrieve basic Stripe session information',
          requiredParams: ['sessionId'],
          requiredHeaders: ['x-shared-secret'],
          response: {
            customer_details: {
              name: 'string',
              email: 'string'
            },
            amount_total: 'number',
            currency: 'string',
            payment_status: 'string'
          }
        },
        {
          path: '/stripe/expandedsession/:sessionId',
          method: 'GET',
          description: 'Retrieve detailed session information for data layer',
          requiredParams: ['sessionId'],
          requiredHeaders: ['x-shared-secret'],
          response: {
            event: 'conversion',
            transactionTotal: 'number',
            transactionId: 'string',
            transactionCurrency: 'string',
            userEmail: 'string',
            userPhone: 'string',
            userFirstName: 'string',
            userLastName: 'string'
          }
        },
        {
          path: '/api/appraisals',
          method: 'POST',
          description: 'Submit artwork appraisal request',
          requiredParams: ['session_id', 'main (file)'],
          optionalParams: ['signature (file)', 'age (file)', 'description'],
          response: {
            success: 'boolean',
            message: 'string',
            session_id: 'string'
          }
        },
        {
          path: '/stripe-webhook',
          method: 'POST',
          description: 'Handle live mode Stripe webhook events',
          requiredHeaders: ['stripe-signature'],
          response: {
            message: 'string'
          }
        },
        {
          path: '/stripe-webhook-test',
          method: 'POST',
          description: 'Handle test mode Stripe webhook events',
          requiredHeaders: ['stripe-signature'],
          response: {
            message: 'string'
          }
        }
      ]
    });
  });

  // Service health status
  router.get('/status', async (req, res) => {
    const [sheetsStatus, wordpressStatus, emailStatus] = await Promise.all([
      checkGoogleSheets(config),
      checkWordPress(config),
      checkEmail(config)
    ]);

    const services = {
      sheets: sheetsStatus,
      wordpress: wordpressStatus,
      email: emailStatus
    };

    const status = Object.values(services).every(s => s) ? 'healthy' : 
                  Object.values(services).some(s => s) ? 'degraded' : 
                  'unhealthy';

    res.json({
      status,
      uptime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      services
    });
  });

  app.use('/api/health', router);
}

module.exports = setupHealthRoutes;