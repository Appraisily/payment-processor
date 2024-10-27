const express = require('express');
const { google } = require('googleapis');
const stripeModule = require('stripe');
const sendGridMail = require('@sendgrid/mail');
const { logError, quickLog } = require('./errorLogger');
const loadConfig = require('./config');

const app = express();

// Function to initialize the app with loaded config
async function initializeApp() {
  try {
    // Validate required environment variables
    if (!process.env.GOOGLE_CLOUD_PROJECT_ID) {
      throw new Error('GOOGLE_CLOUD_PROJECT_ID environment variable is not set');
    }

    const config = await loadConfig();
    
    // Initialize SendGrid
    sendGridMail.setApiKey(config.SENDGRID_API_KEY);

    // Initialize Google Sheets API
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Middleware setup
    app.use((req, res, next) => {
      if (req.originalUrl === '/stripe-webhook') {
        next();
      } else {
        express.json()(req, res, next);
      }
    });

    // Health check endpoint - must be first to ensure quick startup probe response
    app.get('/', (req, res) => {
      res.status(200).send('OK');
    });

    // Stripe Webhook Handler
    app.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
      const sig = req.headers['stripe-signature'];
      let event;
      let mode = 'Unknown';

      try {
        if (!req.body || !sig) {
          throw new Error('Missing request body or signature');
        }

        // Initialize Stripe with Test Secret Key
        const stripeTest = stripeModule(config.STRIPE_SECRET_KEY_TEST);

        try {
          event = stripeTest.webhooks.constructEvent(req.body, sig, config.STRIPE_WEBHOOK_SECRET_TEST);
          mode = 'Test';
        } catch (testErr) {
          const stripeLive = stripeModule(config.STRIPE_SECRET_KEY_LIVE);
          event = stripeLive.webhooks.constructEvent(req.body, sig, config.STRIPE_WEBHOOK_SECRET_LIVE);
          mode = 'Live';
        }

        if (event.type === 'checkout.session.completed') {
          await handleCheckoutSession(event.data.object, mode, auth, sheets, config);
        }
        
        res.status(200).send('OK');
      } catch (err) {
        await quickLog(config, err.message, {
          severity: 'Error',
          scriptName: 'stripeWebhookHandler',
          errorCode: 'WebhookProcessingError',
          environment: mode,
          endpoint: '/stripe-webhook',
          additionalContext: JSON.stringify({ 
            eventType: event?.type,
            mode 
          })
        });
        res.status(400).send('Webhook Error');
      }
    });

    // Start the server
    const PORT = process.env.PORT || 8080;
    const server = app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

  } catch (err) {
    console.error('Failed to initialize application:', err);
    process.exit(1);
  }
}

async function handleCheckoutSession(session, mode, auth, sheets, config) {
  const {
    id: session_id,
    payment_intent: paymentIntentId,
    customer,
    amount_total: amountTotal,
    currency,
    customer_details: { email: customerEmail = '', name: customerName = '' },
    created,
    payment_link,
  } = session;

  const sessionDate = new Date(created * 1000).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

  try {
    const authClient = await auth.getClient();
    google.options({ auth: authClient });

    // Check for duplicates
    const salesGetResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: config.SALES_SPREADSHEET_ID,
      range: `${config.SALES_SHEET_NAME}!A:A`,
    });

    const existingSalesSessionIds = salesGetResponse.data.values?.flat() || [];

    if (existingSalesSessionIds.includes(session_id)) {
      await quickLog(config, `Duplicate session ID: ${session_id}`, {
        severity: 'Warning',
        errorCode: 'DuplicateSession',
        environment: mode
      });
      return;
    }

    const productDetails = config.PAYMENT_LINKS[payment_link] || { productName: 'Unknown Product' };
    
    // Record sale
    await sheets.spreadsheets.values.append({
      spreadsheetId: config.SALES_SPREADSHEET_ID,
      range: `${config.SALES_SHEET_NAME}!A:H`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [[
          session_id,
          paymentIntentId,
          customer,
          customerName,
          customerEmail,
          parseFloat((amountTotal / 100).toFixed(2)),
          sessionDate,
          mode,
        ]],
      },
    });

    // Record pending appraisal
    await sheets.spreadsheets.values.append({
      spreadsheetId: config.PENDING_APPRAISALS_SPREADSHEET_ID,
      range: `${config.PENDING_APPRAISALS_SHEET_NAME}!A:F`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [[
          new Date(created * 1000).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }),
          productDetails.productName,
          session_id,
          customerEmail,
          customerName,
          'PENDING INFO',
        ]],
      },
    });

    // Send confirmation email
    await sendGridMail.send({
      to: customerEmail,
      from: config.EMAIL_SENDER,
      templateId: config.SENDGRID_TEMPLATE_ID,
      dynamic_template_data: {
        customer_name: customerName,
        total_paid: (amountTotal / 100).toFixed(2),
        currency: currency.toUpperCase(),
        customer_email: customerEmail,
        session_id: session_id,
        current_year: new Date().getFullYear(),
      },
    });

  } catch (err) {
    await logError(config, {
      timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
      severity: 'Error',
      scriptName: 'handleCheckoutSession',
      errorCode: err.code || 'ProcessingError',
      errorMessage: err.message,
      stackTrace: err.stack,
      environment: mode,
      additionalContext: JSON.stringify({ 
        session_id, 
        paymentIntentId,
        error: err.response?.body || err.message 
      }),
    });
    throw err;
  }
}

// Initialize the app
initializeApp();
