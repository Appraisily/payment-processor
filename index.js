// index.js

const express = require('express');
const { google } = require('googleapis');
const stripeModule = require('stripe');
const sendGridMail = require('@sendgrid/mail');
const { logError } = require('./errorLogger');
const config = require('./config'); // Import configuration from config.js

const app = express();

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
    await logError({
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
      payment_link, // Extract the payment_link from the session
      metadata, // If any metadata is used
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
        await logError({
          timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
          severity: 'Warning',
          scriptName: 'stripeWebhookHandler',
          errorCode: 'DuplicateSession',
          errorMessage: `Duplicate session ID detected in Sales sheet: ${session_id}`,
          stackTrace: '',
          userId: '',
          requestId: req.headers['x-request-id'] || '',
          environment: mode, // Indicates Test or Live
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
      let productDetails = config.PAYMENT_LINKS[payment_link || '']; // Ensure payment_link exists

      if (!productDetails) {
        console.warn(`No product mapping found for payment_link: ${payment_link}`);
        await logError({
          timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
          severity: 'Warning',
          scriptName: 'stripeWebhookHandler',
          errorCode: 'UnmappedPaymentLink',
          errorMessage: `No product mapping found for payment_link: ${payment_link}`,
          stackTrace: '',
          userId: '',
          requestId: req.headers['x-request-id'] || '',
          environment: mode, // Indicates Test or Live
          endpoint: req.originalUrl || '',
          additionalContext: JSON.stringify({ payment_link }),
          resolutionStatus: 'Open',
          assignedTo: config.ASSIGNED_TO,
          chatGPT: config.CHATGPT_CHAT_URL,
          resolutionLink: config.RESOLUTION_LINK,
        });
        // Optionally, you can decide whether to continue processing or abort
        // For this example, we'll proceed with a default product name
        productDetails = { productName: 'Unknown Product' };
      }

      const productName = productDetails.productName;

      // Append to Sales sheet
      await sheets.spreadsheets.values.append({
        spreadsheetId: config.SALES_SPREADSHEET_ID,
        range: `${config.SALES_SHEET_NAME}!A:H`, // Columns A to H
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [[
            session_id,                         // Column A: Session ID
            paymentIntentId,                    // Column B: Payment Intent ID
            customer,                           // Column C: Customer ID
            customerName,                       // Column D: Customer Name
            customerEmail,                      // Column E: Customer Email
            parseFloat((amountTotal / 100).toFixed(2)),  // Column F: Amount Paid
            sessionDate,                        // Column G: Session Date
            mode,                               // Column H: Mode (Test or Live)
          ]],
        },
      });

      console.log('New session appended to Sales sheet');

      // Append to Pending Appraisals sheet
      await sheets.spreadsheets.values.append({
        spreadsheetId: config.PENDING_APPRAISALS_SPREADSHEET_ID,
        range: `${config.PENDING_APPRAISALS_SHEET_NAME}!A:F`, // Columns A to F
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [[
            new Date(created * 1000).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }), // Column A: Date
            productName, // Column B: Product Purchased
            session_id,   // Column C: Session ID
            customerEmail, // Column D: Customer Email
            customerName,  // Column E: Customer Name
            'PENDING INFO', // Column F: Status
          ]],
        },
      });

      console.log('New session appended to Pending Appraisals sheet');

// **Enviar Email al Cliente Usando el Template Dinámico de SendGrid**
const currentYear = new Date().getFullYear();

console.log(`Monto Pagado: ${parseFloat((amountTotal / 100).toFixed(2))} (Tipo: ${typeof parseFloat((amountTotal / 100).toFixed(2))})`);

const emailContent = {
  to: customerEmail,
  from: config.EMAIL_SENDER, // Email verificado en SendGrid
  templateId: config.SENDGRID_TEMPLATE_ID, // d-e1efdd3a8eb84500ba389c81f0b08d56 (actualizado)
  dynamic_template_data: {
    customer_name: customerName,
    session_id: session_id,
    current_year: currentYear, // Variable dinámica
  },
};

await sendGridMail.send(emailContent);
console.log(`Email de confirmación enviado a ${customerEmail}`);

res.status(200).send('OK');
    } catch (err) {
      console.error('Error processing webhook:', err);
      // Log detailed SendGrid error
      await logError({
        timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
        severity: 'Error',
        scriptName: 'stripeWebhookHandler',
        errorCode: err.code || 'UnknownError',
        errorMessage: err.message,
        stackTrace: err.stack || '',
        userId: '',
        requestId: req.headers['x-request-id'] || '',
        environment: mode, // Indicates Test or Live
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
    console.log(`Unhandled event type: ${event.type}`);
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
