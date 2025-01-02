const { google } = require('googleapis');

class AppraisalSheetsClient {
  constructor(config) {
    this.config = config;
  }

  async getAuthClient() {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    return await auth.getClient();
  }

  async recordSubmission(data) {
    try {
      const auth = await this.getAuthClient();
      const sheets = google.sheets({ version: 'v4', auth });

      const values = [[
        new Date().toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }),
        data.appraisalType || 'Regular',
        data.session_id,
        data.customer_email,
        data.customer_name,
        'SUBMITTED',
        data.wordpressEditUrl || ''
      ]];

      await sheets.spreadsheets.values.append({
        spreadsheetId: this.config.PENDING_APPRAISALS_SPREADSHEET_ID,
        range: `${this.config.PENDING_APPRAISALS_SHEET_NAME}!A:G`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: { values }
      });

      console.log('Recorded appraisal submission in sheets:', {
        session_id: data.session_id,
        status: 'SUBMITTED'
      });
    } catch (error) {
      console.error('Error recording submission in sheets:', error);
      throw new Error('Failed to record submission in Google Sheets');
    }
  }

  async updateSubmissionStatus(session_id, wordpressEditUrl) {
    try {
      const auth = await this.getAuthClient();
      const sheets = google.sheets({ version: 'v4', auth });

      // Find the row with matching session_id
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.config.PENDING_APPRAISALS_SPREADSHEET_ID,
        range: `${this.config.PENDING_APPRAISALS_SHEET_NAME}!A:G`
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[2] === session_id);

      if (rowIndex === -1) {
        console.warn('Session ID not found in sheets:', session_id);
        return;
      }

      // Update the status and WordPress URL
      const range = `${this.config.PENDING_APPRAISALS_SHEET_NAME}!F${rowIndex + 1}:G${rowIndex + 1}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId: this.config.PENDING_APPRAISALS_SPREADSHEET_ID,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [['PROCESSING', wordpressEditUrl]]
        }
      });

      console.log('Updated submission status in sheets:', {
        session_id,
        status: 'PROCESSING',
        wordpressEditUrl
      });
    } catch (error) {
      console.error('Error updating submission status:', error);
      throw new Error('Failed to update submission status in Google Sheets');
    }
  }
}

module.exports = AppraisalSheetsClient;