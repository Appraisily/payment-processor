const { google } = require('googleapis');
const sendGridMail = require('@sendgrid/mail');
const { logError } = require('../utils/errorLogger');

async function processCheckoutSession(session, config, mode) {
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
    // Configure SendGrid
    sendGridMail.setApiKey(config.SENDGRID_API_KEY);

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
      console.log(`Duplicate session ID detected: ${session_id}`);
      return;
    }

    // Determine the appraisal type
    let productDetails = config.PAYMENT_LINKS[payment_link || ''];
    if (!productDetails) {
      console.warn(`No product mapping found for payment_link: ${payment_link}`);
      productDetails = { productName: 'Unknown Product' };
    }

    // Record the sale
    await recordSale(sheets, config, {
      session_id,
      paymentIntentId,
      customer,
      customerName,
      customerEmail,
      amountTotal,
      sessionDate,
      mode
    });

    // Record pending appraisal
    await recordPendingAppraisal(sheets, config, {
      created,
      productName: productDetails.productName,
      session_id,
      customerEmail,
      customerName
    });

    // Send confirmation email
    await sendConfirmationEmail(config, {
      customerEmail,
      customerName,
      session_id
    });

  } catch (err) {
    throw new Error(`Failed to process checkout session: ${err.message}`);
  }
}

async function recordSale(sheets, config, saleData) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: config.SALES_SPREADSHEET_ID,
    range: `${config.SALES_SHEET_NAME}!A:H`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    resource: {
      values: [[
        saleData.session_id,
        saleData.paymentIntentId,
        saleData.customer,
        saleData.customerName,
        saleData.customerEmail,
        parseFloat((saleData.amountTotal / 100).toFixed(2)),
        saleData.sessionDate,
        saleData.mode,
      ]],
    },
  });
}

async function recordPendingAppraisal(sheets, config, appraisalData) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: config.PENDING_APPRAISALS_SPREADSHEET_ID,
    range: `${config.PENDING_APPRAISALS_SHEET_NAME}!A:F`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    resource: {
      values: [[
        new Date(appraisalData.created * 1000).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }),
        appraisalData.productName,
        appraisalData.session_id,
        appraisalData.customerEmail,
        appraisalData.customerName,
        'PENDING INFO',
      ]],
    },
  });
}

async function sendConfirmationEmail(config, emailData) {
  const currentYear = new Date().getFullYear();
  
  const emailContent = {
    to: emailData.customerEmail,
    from: config.EMAIL_SENDER,
    templateId: config.SENDGRID_TEMPLATE_ID,
    dynamic_template_data: {
      customer_name: emailData.customerName,
      session_id: emailData.session_id,
      current_year: currentYear,
    },
  };

  await sendGridMail.send(emailContent);
}

module.exports = {
  processCheckoutSession
};