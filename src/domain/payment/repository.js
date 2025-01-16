const { google } = require('googleapis');
const sendGridMail = require('@sendgrid/mail');

class PaymentRepository {
  constructor(config) {
    this.config = config;
    sendGridMail.setApiKey(config.SENDGRID_API_KEY);
  }

  async isDuplicateSession(sessionId) {
    const auth = await this.getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.config.SALES_SPREADSHEET_ID,
      range: `${this.config.SALES_SHEET_NAME}!A:A`,
    });

    const existingIds = response.data.values ? response.data.values.flat() : [];
    return existingIds.includes(sessionId);
  }

  async recordPayment(session, mode) {
    const auth = await this.getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const {
      id: session_id,
      payment_intent: paymentIntentId,
      customer,
      customer_details: { email: customerEmail = '', name: customerName = '' },
      amount_total: amountTotal,
      created
    } = session;

    const sessionDate = new Date(created * 1000).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

    await sheets.spreadsheets.values.append({
      spreadsheetId: this.config.SALES_SPREADSHEET_ID,
      range: `${this.config.SALES_SHEET_NAME}!A:H`,
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
  }

  async recordPendingAppraisal(session) {
    const auth = await this.getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const productDetails = this.config.PAYMENT_LINKS[session.payment_link] || { productName: 'Regular' };

    await sheets.spreadsheets.values.append({
      spreadsheetId: this.config.PENDING_APPRAISALS_SPREADSHEET_ID,
      range: `${this.config.PENDING_APPRAISALS_SHEET_NAME}!A:F`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [[
          new Date(session.created * 1000).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
          productDetails.productName,
          session.id,
          session.customer_details?.email || '',
          session.customer_details?.name || '',
          'Pending',
        ]],
      },
    });
  }

  async sendConfirmationEmail(session) {
    const emailContent = {
      to: session.customer_details?.email,
      from: this.config.EMAIL_SENDER,
      templateId: this.config.SENDGRID_TEMPLATE_ID,
      dynamic_template_data: {
        customer_name: session.customer_details?.name,
        session_id: session.id,
        current_year: new Date().getFullYear(),
      },
    };

    await sendGridMail.send(emailContent);
  }

  async getGoogleAuth() {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return await auth.getClient();
  }
}

module.exports = PaymentRepository;