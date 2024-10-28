// index.js

const express = require('express');
const { google } = require('googleapis');
const stripeModule = require('stripe');
const sendGridMail = require('@sendgrid/mail');
const { logError } = require('./errorLogger');
const loadConfig = require('./config'); // Import the updated config.js

async function initializeApp() {
  const app = express();

  try {
    // Load configuration
    const config = await loadConfig();

    // Configure SendGrid once
    sendGridMail.setApiKey(config.SENDGRID_API_KEY);

    // Middleware to capture raw body for Stripe webhook verification
    app.use('/stripe-webhook', express.json({
      verify: (req, res, buf) => {
        req.rawBody = buf.toString('utf8'); // Store raw body
      }
    }));

    // Stripe webhook route
    app.post('/stripe-webhook', async (req, res) => {
      console.log('Webhook received at /stripe-webhook');
      console.log(`Headers: ${JSON.stringify(req.headers)}`);
      console.log(`Body Type: ${typeof req.body}`); // Should show 'object'
      console.log(`Body Content: ${req.rawBody}`); // Show raw body

      const sig = req.headers['stripe-signature'];
      let event;

      try {
        // Initialize Stripe with both Test and Live keys
        const stripeTest = stripeModule(config.STRIPE_SECRET_KEY_TEST);
        const stripeLive = stripeModule(config.STRIPE_SECRET_KEY_LIVE);

        // Attempt to construct event using Test webhook secret
        try {
          event = stripeTest.webhooks.constructEvent(req.rawBody, sig, config.STRIPE_WEBHOOK_SECRET_TEST);
          // Determine mode based on event
          const mode = event.livemode ? 'Live' : 'Test';
          event.mode = mode;
          console.log(`Event verified in ${mode} mode`);
        } catch (testErr) {
          console.warn('Failed to verify with Test secret, attempting Live secret:', testErr.message);
          // If Test verification fails, attempt Live verification
          event = stripeLive.webhooks.constructEvent(req.rawBody, sig, config.STRIPE_WEBHOOK_SECRET_LIVE);
          const mode = event.livemode ? 'Live' : 'Test';
          event.mode = mode;
          console.log(`Event verified in ${mode} mode`);
        }
      } catch (err) {
        console.error('Failed to verify webhook signature:', err.message);
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
          additionalContext: JSON.stringify({ payload: req.rawBody }),
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
          payment_link, // Extract payment_link from session
          metadata, // If metadata is used
        } = session;

        const sessionDate = new Date(created * 1000).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

        let mode; // Declare `mode` in the upper scope

        try {
          // Determine mode based on event
          mode = event.mode; // 'Test' or 'Live'
          console.log(`Processing event in ${mode} mode`);

          // Authenticate with Google Sheets
          const auth = new google.auth.GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
          });
          const authClient = await auth.getClient();
          google.options({ auth: authClient });

          const sheets = google.sheets({ version: 'v4', auth });

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

          // Determine the appraisal type based on payment_link
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
            // Proceed with a default product name
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
                session_id,                                     // Column A: Session ID
                paymentIntentId,                               // Column B: Payment Intent ID
                customer,                                      // Column C: Customer ID
                customerName,                                  // Column D: Customer Name
                customerEmail,                                 // Column E: Customer Email
                parseFloat((amountTotal / 100).toFixed(2)),    // Column F: Amount Paid
                sessionDate,                                   // Column G: Session Date
                mode,                                          // Column H: Mode (Test or Live)
              ]],
            },
          });

          console.log('New session added to Sales sheet');

          // Append to Pending Appraisals sheet
          await sheets.spreadsheets.values.append({
            spreadsheetId: config.PENDING_APPRAISALS_SPREADSHEET_ID,
            range: `${config.PENDING_APPRAISALS_SHEET_NAME}!A:F`, // Columns A to F
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
              values: [[
                new Date(created * 1000).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }), // Column A: Date
                productName,      // Column B: Appraisal Type
                session_id,       // Column C: Session ID
                customerEmail,    // Column D: Customer Email
                customerName,     // Column E: Customer Name
                'PENDING INFO',    // Column F: Status
              ]],
            },
          });

          console.log('New session added to Pending Appraisals sheet');

          // **Send Confirmation Email to Customer Using SendGrid Dynamic Template **
          const currentYear = new Date().getFullYear();

          console.log(`Amount Paid: ${parseFloat((amountTotal / 100).toFixed(2))} (Type: ${typeof parseFloat((amountTotal / 100).toFixed(2))})`);

          const emailContent = {
            to: customerEmail,
            from: config.EMAIL_SENDER, // Verified email
            templateId: config.SENDGRID_TEMPLATE_ID, // Unique Template ID
            dynamic_template_data: {
              customer_name: customerName,
              session_id: session_id,
              current_year: currentYear, // Dynamic variable
            },
          };

          await sendGridMail.send(emailContent);
          console.log(`Confirmation email sent to ${customerEmail}`);

          res.status(200).send('OK');
        } catch (err) {
          console.error('Error processing webhook:', err);
          // Log detailed SendGrid error
          await logError(config, {
            timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
            severity: 'Error',
            scriptName: 'stripeWebhookHandler',
            errorCode: err.code || 'UnknownError',
            errorMessage: err.message,
            stackTrace: err.stack || '',
            userId: '',
            requestId: req.headers['x-request-id'] || '',
            environment: mode || 'Unknown', // Use `mode` if defined
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
        // Handle other event types if necessary
        res.status(200).send('OK');
      }
    }); // End of app.post('/stripe-webhook')

    // Global middleware to parse JSON bodies for routes other than webhooks
    app.use(express.json());

    // Optional: Health Check Endpoint
    app.get('/', (req, res) => {
      res.send('Cloud Run service is active and running.');
    });

    // Start the server
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize the application:', error);
    process.exit(1);
  }
}

// Start initialization
initializeApp();
