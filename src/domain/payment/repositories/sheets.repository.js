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

    let productName = this.config.PAYMENT_LINKS[session.payment_link]?.productName || 'Unknown Product';
    let itemCount = 1;
    let bucketPath = '';

    if (isBulkOrder) {
      const bulkSessionId = session.client_reference_id.replace('bulk_', '');
      bucketPath = `${this.config.GCS_BULK_APPRAISAL_BUCKET}/${session.client_reference_id}`;
      const StorageRepository = require('../../bulk-appraisal/repositories/storage.repository');
      const storageRepo = new StorageRepository(this.config);
      const files = await storageRepo.getSessionFiles(bulkSessionId);
      itemCount = files.length;
      productName = `Bulk Appraisal (${itemCount} items) - ${session.metadata?.appraisal_type || 'Regular'}`;
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
          itemCount > 1 ? `BULK ORDER (${itemCount} items)` : 'PENDING INFO',
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