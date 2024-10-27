const express = require('express');
const { google } = require('googleapis');
const stripeModule = require('stripe');
const sendGridMail = require('@sendgrid/mail');
const { logError } = require('./errorLogger');
const loadConfig = require('./config');

const app = express();

// Function to initialize the app with loaded config
async function initializeApp() {
  const config = await loadConfig();

  // Initialize SendGrid
  sendGridMail.setApiKey(config.SENDGRID_API_KEY);

  // Initialize Google Sheets API
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // Middleware to parse JSON bodies for non-webhook routes (if any)
  app.use(express.json());

  // Stripe requires the raw body to verify webhook signatures
  app.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    console.log('Function execution started');

    const sig = req.headers['stripe-signature'];
    let event;
    let mode = 'Unknown';

    try {
      // Ensure rawBody is available
      const rawBody = req.body;
      if (!rawBody) {
        throw new Error('Raw body is not available.');
      }

      // Initialize Stripe with Test Secret Key
      const stripeTest = stripeModule(config.STRIPE_SECRET_KEY_TEST);

      try {
        // Attempt to construct the event using Test Webhook Secret
        event = stripeTest.webhooks.constructEvent(rawBody, sig, config.STRIPE_WEBHOOK_SECRET_TEST);
        mode = 'Test';
        console.log('Webhook signature verified with Test secret');
      } catch (testErr) {
        console.warn('Failed to verify with Test secret:', testErr.message);
        // Initialize Stripe with Live Secret Key
        const stripeLive = stripeModule(config.STRIPE_SECRET_KEY_LIVE);
        // Attempt to construct the event using Live Webhook Secret
        event = stripeLive.webhooks.constructEvent(rawBody, sig, config.STRIPE_WEBHOOK_SECRET_LIVE);
        mode = 'Live';
        console.log('Webhook signature verified with Live secret');
      }
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      await logError(config, {
        timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
        severity: 'Error',
        scriptName: 'stripeWebhookHandler',
        errorCode: 'SignatureVerificationFailed',
        errorMessage: err.message,
        stackTrace: err.stack || '',
        userId: '',
        requestId: req.headers['x-request-id'] || '',
        environment: 'Production',
        endpoint: req.originalUrl || '',
        additionalContext: JSON.stringify({ payload: req.body }),
        resolutionStatus: 'Open',
        assignedTo: config.ASSIGNED_TO,
        chatGPT: config.CHATGPT_CHAT_URL,
        resolutionLink: config.RESOLUTION_LINK,
      });
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      const {
        id: session_id,
        payment_intent: paymentIntentId,
        customer,
        amount_total: amountTotal,
        currency,
        customer_details: { email: customerEmail = '', name: customerName = '' },
        created,
        payment_link,
        metadata,
      } = session;

      const sessionDate = new Date(created * 1000).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

      try {
        // Authenticate with Google Sheets
        const authClient = await auth.getClient();
        google.options({ auth: authClient });

        // Check for duplicates in Sales sheet
        const salesGetResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: config.SALES_SPREADSHEET_ID,
          range: `${config.SALES_SHEET_NAME}!A:A`,
        });

        const existingSalesSessionIds = salesGetResponse.data.values ? salesGetResponse.data.values.flat() : [];

        if (existingSalesSessionIds.includes(session_id)) {
          console.log(`Duplicate session ID detected in Sales sheet: ${session_id}`);
          await logError(config, {
            timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
            severity: 'Warning',
            scriptName: 'stripeWebhookHandler',
            errorCode: 'DuplicateSession',
            errorMessage: `Duplicate session ID detected in Sales sheet: ${session_id}`,
            stackTrace: '',
            userId: '',
            requestId: req.headers['x-request-id'] || '',
            environment: mode,
            endpoint: req.originalUrl || '',
            additionalContext: JSON.stringify({ session_id, paymentIntentId }),
            resolutionStatus: 'Open',
            assignedTo: config.ASSIGNED_TO,
            chatGPT: config.CHATGPT_CHAT_URL,
            resolutionLink: config.RESOLUTION_LINK,
          });
          return res.status(200).send('OK');
        }

        // Determine the product purchased based on the payment_link
        let productDetails = config.PAYMENT_LINKS[payment_link || ''];

        if (!productDetails) {
          console.warn(`No product mapping found for payment_link: ${payment_link}`);
          await logError(config, {
            timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
            severity: 'Warning',
            scriptName: 'stripeWebhookHandler',
            errorCode: 'UnmappedPaymentLink',
            errorMessage: `No product mapping found for payment_link: ${payment_link}`,
            stackTrace: '',
            userId: '',
            requestId: req.headers['x-request-id'] || '',
            environment: mode,
            endpoint: req.originalUrl || '',
            additionalContext: JSON.stringify({ payment_link }),
            resolutionStatus: 'Open',
            assignedTo: config.ASSIGNED_TO,
            chatGPT: config.CHATGPT_CHAT_URL,
            resolutionLink: config.RESOLUTION_LINK,
          });
          productDetails = { productName: 'Unknown Product' };
        }

        const productName = productDetails.productName;

        // Append to Sales sheet
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

        console.log('New session appended to Sales sheet');

        // Append to Pending Appraisals sheet
        await sheets.spreadsheets.values.append({
          spreadsheetId: config.PENDING_APPRAISALS_SPREADSHEET_ID,
          range: `${config.PENDING_APPRAISALS_SHEET_NAME}!A:F`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          resource: {
            values: [[
              new Date(created * 1000).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }),
              productName,
              session_id,
              customerEmail,
              customerName,
              'PENDING INFO',
            ]],
          },
        });

        console.log('New session appended to Pending Appraisals sheet');

        // Send Email to Customer Using SendGrid Dynamic Template
        const currentYear = new Date().getFullYear();

        console.log(`Appending Amount Paid: ${parseFloat((amountTotal / 100).toFixed(2))} (Type: ${typeof parseFloat((amountTotal / 100).toFixed(2))})`);

        const emailContent = {
          to: customerEmail,
          from: config.EMAIL_SENDER,
          templateId: config.SENDGRID_TEMPLATE_ID,
          dynamic_template_data: {
            customer_name: customerName,
            total_paid: (amountTotal / 100).toFixed(2),
            currency: currency.toUpperCase(),
            customer_email: customerEmail,
            session_id: session_id,
            current_year: currentYear,
          },
        };

        await sendGridMail.send(emailContent);
        console.log(`Confirmation email sent to ${customerEmail}`);

        res.status(200).send('OK');
      } catch (err) {
        console.error('Error processing webhook:', err);
        await logError(config, {
          timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
          severity: 'Error',
          scriptName: 'stripeWebhookHandler',
          errorCode: err.code || 'UnknownError',
          errorMessage: err.message,
          stackTrace: err.stack || '',
          userId: '',
          requestId: req.headers['x-request-id'] || '',
          environment: mode,
          endpoint: req.originalUrl || '',
          additionalContext: JSON.stringify({ 
            session_id, 
            paymentIntentId, 
            sendGridError: err.response ? err.response.body : err.message 
          }),
          resolutionStatus: 'Open',
          assignedTo: config.ASSIGNED_TO,
          chatGPT: config.CHATGPT_CHAT_URL,
          resolutionLink: config.RESOLUTION_LINK,
        });
        res.status(500).send('Internal Server Error');
      }
    } else {
      // Handle other event types if needed
      res.status(200).send('OK');
    }
  });

  // Optional: Health check endpoint
  app.get('/', (req, res) => {
    res.send('Cloud Run service is up and running.');
  });

  // Start the server
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

// Initialize the app and handle any startup errors
initializeApp().catch(error => {
  console.error('Failed to initialize application:', error);
  process.exit(1);
});
