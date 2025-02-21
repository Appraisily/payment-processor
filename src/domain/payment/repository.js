const { google } = require('googleapis');
const sendGridMail = require('@sendgrid/mail');
const { PubSub } = require('@google-cloud/pubsub');

class PaymentRepository {
  constructor(config) {
    this.config = config;
    sendGridMail.setApiKey(config.SENDGRID_API_KEY);
    this.pubsub = new PubSub();
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

    const sessionDate = new Date(created * 1000).toLocaleDateString('es-ES', { 
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

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

    // Publish to CRM PubSub
    await this.publishToCRM({
      crmProcess: "stripePayment",
      customer: {
        email: customerEmail,
        name: customerName,
        stripeCustomerId: customer
      },
      payment: {
        checkoutSessionId: session_id,
        paymentIntentId: paymentIntentId,
        amount: amountTotal / 100,
        currency: session.currency,
        status: session.payment_status,
        metadata: {
          serviceType: this.config.PAYMENT_LINKS[session.payment_link]?.productName || 'Unknown',
          sessionId: session_id
        }
      },
      metadata: {
        origin: "payment-processor",
        environment: mode,
        timestamp: Math.floor(Date.now() / 1000)
      }
    });
  }

  async publishToCRM(message) {
    try {
      const topicName = process.env.PUBSUB_CRM_NAME;
      if (!topicName) {
        console.error('PUBSUB_CRM_NAME environment variable not set');
        return;
      }

      const topic = this.pubsub.topic(topicName);
      const messageBuffer = Buffer.from(JSON.stringify(message));
      
      const messageId = await topic.publish(messageBuffer);
      console.log(`Message ${messageId} published to CRM topic`);
    } catch (error) {
      console.error('Error publishing to CRM PubSub:', error);
      // Don't throw error to avoid interrupting the main flow
    }
  }

  async recordPendingAppraisal(session) {
    const auth = await this.getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: config.PENDING_APPRAISALS_SPREADSHEET_ID,
      range: `${this.config.PENDING_APPRAISALS_SHEET_NAME}!A:F`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [[
          new Date().toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }),
          'Bulk',
          session.id,
          session.customer_details?.email || '',
          session.customer_details?.name || '',
          'PAID'
        ]],
      },
    });
  }

  async sendConfirmationEmail(session) {
    // Determine if this is a bulk order
    const isBulkOrder = session.client_reference_id?.startsWith('bulk_');
    
    if (isBulkOrder) {
      // Get bulk session details
      const bulkSessionId = session.client_reference_id.replace('bulk_', '');
      const bulkAppraisalService = new (require('../bulk-appraisal/service'))(this.config);
      const sessionStatus = await bulkAppraisalService.getSessionStatus(bulkSessionId);
      
      const emailContent = {
        to: session.customer_details?.email,
        from: this.config.EMAIL_SENDER,
        templateId: this.config.SENDGRID_TEMPLATE_BULK_ID,
        dynamic_template_data: {
          customer_name: session.customer_details?.name,
          session_id: session.id,
          current_year: new Date().getFullYear(),
          items_count: sessionStatus.session.items.length,
          appraisal_type: session.metadata?.appraisal_type || 'Regular'
        },
      };
      
      await sendGridMail.send(emailContent);
      return;
    }

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