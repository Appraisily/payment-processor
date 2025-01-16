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
      console.log('Starting recordSubmission with data:', {
        session_id: data.session_id,
        customer_email: data.customer_email,
        customer_name: data.customer_name,
        wordpress_url: data.wordpressEditUrl,
        has_description: !!data.description
      });

      const auth = await this.getAuthClient();
      const sheets = google.sheets({ version: 'v4', auth });

      console.log('Searching for existing session_id in column C:', data.session_id);
      // First, search for existing session_id in column C
      const searchResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: this.config.PENDING_APPRAISALS_SPREADSHEET_ID,
        range: `${this.config.PENDING_APPRAISALS_SHEET_NAME}!C:C`
      });

      const rows = searchResponse.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === data.session_id);

      console.log('Search result:', {
        session_id: data.session_id,
        found: rowIndex !== -1,
        row_index: rowIndex,
        total_rows: rows.length
      });

      if (rowIndex !== -1) {
        // Update existing row
        const rowNumber = rowIndex + 1; // Convert to 1-based index
        
        console.log('Preparing to update existing row:', {
          row_number: rowNumber,
          status: 'SUBMITTED',
          wordpress_url: data.wordpressEditUrl,
          description_length: data.description?.length
        });

        // Update status and WordPress URL
        await sheets.spreadsheets.values.update({
          spreadsheetId: this.config.PENDING_APPRAISALS_SPREADSHEET_ID,
          range: `${this.config.PENDING_APPRAISALS_SHEET_NAME}!F${rowNumber}:G${rowNumber}`,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [['SUBMITTED', data.wordpressEditUrl || '']]
          }
        });

        // Update description if provided
        if (data.description) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: this.config.PENDING_APPRAISALS_SPREADSHEET_ID,
            range: `${this.config.PENDING_APPRAISALS_SHEET_NAME}!I${rowNumber}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
              values: [[data.description]]
            }
          });
        }

        console.log('Successfully updated existing row in sheets:', {
          session_id: data.session_id,
          row: rowNumber,
          status: 'SUBMITTED',
          hasDescription: !!data.description,
          wordpress_url: data.wordpressEditUrl
        });
      } else {
        console.log('Preparing to insert new row:', {
          session_id: data.session_id,
          customer_email: data.customer_email,
          customer_name: data.customer_name,
          status: 'SUBMITTED',
          wordpress_url: data.wordpressEditUrl,
          description_length: data.description?.length
        });

        // Insert new row
        await sheets.spreadsheets.values.append({
          spreadsheetId: this.config.PENDING_APPRAISALS_SPREADSHEET_ID,
          range: `${this.config.PENDING_APPRAISALS_SHEET_NAME}!A:I`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          resource: {
            values: [[
              new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', hour12: false }),
              data.appraisalType || 'Regular',
              data.session_id,
              data.customer_email,
              data.customer_name,
              'Pending',
              data.wordpressEditUrl || '',
              '',  // Column H
              data.description || '' // Column I
            ]]
          }
        });

        console.log('Successfully inserted new row in sheets:', {
          session_id: data.session_id,
          status: 'SUBMITTED',
          customer_email: data.customer_email,
          wordpress_url: data.wordpressEditUrl
        });
      }
    } catch (error) {
      console.error('Error recording submission in sheets:', {
        error_message: error.message,
        error_name: error.name,
        session_id: data.session_id,
        stack: error.stack
      });
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
        range: `${this.config.PENDING_APPRAISALS_SHEET_NAME}!C:C`
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === session_id);

      if (rowIndex === -1) {
        console.warn('Session ID not found in sheets:', session_id);
        return;
      }

      const rowNumber = rowIndex + 1;
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.config.PENDING_APPRAISALS_SPREADSHEET_ID,
        resource: {
          valueInputOption: 'USER_ENTERED',
          data: [
            {
              range: `${this.config.PENDING_APPRAISALS_SHEET_NAME}!F${rowNumber}`,
              values: [['Pending']]
            },
            {
              range: `${this.config.PENDING_APPRAISALS_SHEET_NAME}!G${rowNumber}`,
              values: [[wordpressEditUrl]]
            }
          ]
        }
      });

      console.log('Updated submission status in sheets:', {
        session_id,
        status: 'GCS SAVED',
        wordpressEditUrl,
        row: rowNumber
      });
    } catch (error) {
      console.error('Error updating submission status:', error);
      throw new Error('Failed to update submission status in Google Sheets');
    }
  }

  async updateWordPressMediaUrls(session_id, mediaUrls) {
    try {
      const auth = await this.getAuthClient();
      const sheets = google.sheets({ version: 'v4', auth });

      // Find the row with matching session_id
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.config.PENDING_APPRAISALS_SPREADSHEET_ID,
        range: `${this.config.PENDING_APPRAISALS_SHEET_NAME}!C:C`
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === session_id);

      if (rowIndex === -1) {
        console.warn('Session ID not found in sheets:', session_id);
        return;
      }

      const rowNumber = rowIndex + 1;
      const urlsJson = JSON.stringify({
        main: mediaUrls.main || '',
        age: mediaUrls.age || '',
        signature: mediaUrls.signature || ''
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId: this.config.PENDING_APPRAISALS_SPREADSHEET_ID,
        range: `${this.config.PENDING_APPRAISALS_SHEET_NAME}!O${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[urlsJson]]
        }
      });

      console.log('Updated WordPress media URLs in sheets:', {
        session_id,
        urls: urlsJson,
        row: rowNumber
      });
    } catch (error) {
      console.error('Error updating WordPress media URLs:', error);
      // Don't throw error to avoid interrupting the main flow
      console.log('Continuing despite WordPress media URLs update error');
    }
  }

  async updateGCSUrl(session_id, gcsUrl) {
    try {
      const auth = await this.getAuthClient();
      const sheets = google.sheets({ version: 'v4', auth });

      // Find the row with matching session_id
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.config.PENDING_APPRAISALS_SPREADSHEET_ID,
        range: `${this.config.PENDING_APPRAISALS_SHEET_NAME}!C:C`
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === session_id);

      if (rowIndex === -1) {
        console.warn('Session ID not found in sheets:', session_id);
        return;
      }

      const rowNumber = rowIndex + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId: this.config.PENDING_APPRAISALS_SPREADSHEET_ID,
        range: `${this.config.PENDING_APPRAISALS_SHEET_NAME}!Q${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[gcsUrl]]
        }
      });

      console.log('Updated GCS URL in sheets:', {
        session_id,
        gcsUrl,
        row: rowNumber
      });
    } catch (error) {
      console.error('Error updating GCS URL:', error);
      // Don't throw error to avoid interrupting the main flow
      console.log('Continuing despite GCS URL update error');
    }
  }
}

module.exports = AppraisalSheetsClient;