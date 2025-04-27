const { google } = require('googleapis');

class SheetsRepository {
  constructor(config) {
    this.config = config;
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
  }

  async recordPendingAppraisal(session, isBulkOrder) {
    const auth = await this.getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Get items count and appraisal type for bulk orders
    const itemCount = session.line_items?.data[0]?.quantity || 0;
    const appraisalType = session.metadata?.appraisal_type || 'Regular';
    
    console.log('Recording pending appraisal with session data:', {
      id: session.id,
      is_bulk_order: isBulkOrder,
      items_count: itemCount,
      appraisal_type: appraisalType,
      line_items: session.line_items?.data.map(item => ({
        quantity: item.quantity,
        amount_total: item.amount_total,
        description: item.description
      })),
      metadata: session.metadata,
      client_reference_id: session.client_reference_id
    });
    
    let productName = isBulkOrder ? 
      `Bulk_${appraisalType}_${itemCount}` : 
      (this.config.PAYMENT_LINKS[session.payment_link]?.productName || 'Regular');

    let bucketPath = '';

    if (isBulkOrder) {
      const bulkSessionId = session.client_reference_id.replace('bulk_', '');
      bucketPath = `${this.config.GCS_BULK_APPRAISAL_BUCKET}/${session.client_reference_id}`;
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: this.config.PENDING_APPRAISALS_SPREADSHEET_ID,
      range: `${this.config.PENDING_APPRAISALS_SHEET_NAME}!A:G`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [[
          new Date(session.created * 1000).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }),
          productName,
          session.id,
          session.customer_details?.email || '',
          session.customer_details?.name || '',
          'Pending',
          bucketPath
        ]],
      },
    });
  }

  async getGoogleAuth() {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return await auth.getClient();
  }
}

module.exports = SheetsRepository;