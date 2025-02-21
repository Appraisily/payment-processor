const { google } = require('googleapis');

// Utility functions
async function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return await auth.getClient();
}

async function findRowBySessionId(sheets, config, session_id) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.PENDING_APPRAISALS_SPREADSHEET_ID,
    range: `${config.PENDING_APPRAISALS_SHEET_NAME}!C:C`
  });

  const rows = response.data.values || [];
  const rowIndex = rows.findIndex(row => row[0] === session_id);
  
  return rowIndex === -1 ? null : rowIndex + 1; // Convert to 1-based index if found
}

async function updateCell(sheets, config, rowNumber, column, value) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.PENDING_APPRAISALS_SPREADSHEET_ID,
    range: `${config.PENDING_APPRAISALS_SHEET_NAME}!${column}${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [[value]]
    }
  });
}

class AppraisalSheetsClient {
  constructor(config) {
    this.config = config;
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

      const auth = await getAuthClient();
      const sheets = google.sheets({ version: 'v4', auth });

      const rowNumber = await findRowBySessionId(sheets, this.config, data.session_id);

      if (rowNumber) {
        console.log('Updating existing row:', { row_number: rowNumber });
        await this.updateExistingSubmission(sheets, data, rowNumber);
      } else {
        console.log('Inserting new row for session:', data.session_id);
        await this.insertNewSubmission(sheets, data);
      }

      console.log('Submission recorded successfully:', {
        session_id: data.session_id,
        row: rowNumber || 'new'
      });
    } catch (error) {
      console.error('Error recording submission:', error);
      throw new Error('Failed to record submission in Google Sheets');
    }
  }

  async insertNewSubmission(sheets, data) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: this.config.PENDING_APPRAISALS_SPREADSHEET_ID,
      range: `${this.config.PENDING_APPRAISALS_SHEET_NAME}!A:I`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [[
          new Date().toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }),
          data.appraisalType || 'Regular',
          data.session_id,
          data.customer_email,
          data.customer_name,
          'SUBMITTED',
          data.wordpressEditUrl || '',
          '',  // Column H (reserved)
          data.description || ''  // Column I (description)
        ]]
      }
    });
  }

  async updateExistingSubmission(sheets, data, rowNumber) {
    // Update status and WordPress URL
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: this.config.PENDING_APPRAISALS_SPREADSHEET_ID,
      resource: {
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: `${this.config.PENDING_APPRAISALS_SHEET_NAME}!F${rowNumber}:G${rowNumber}`,
            values: [['SUBMITTED', data.wordpressEditUrl || '']]
          }
        ]
      }
    });

    // Update description if provided
    if (data.description) {
      await updateCell(sheets, this.config, rowNumber, 'I', data.description);
    }
  }

  async updateSubmissionStatus(session_id, wordpressEditUrl) {
    try {
      const auth = await getAuthClient();
      const sheets = google.sheets({ version: 'v4', auth });
      
      const rowNumber = await findRowBySessionId(sheets, this.config, session_id);
      if (!rowNumber) {
        console.warn('Session ID not found in sheets:', session_id);
        return;
      }

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.config.PENDING_APPRAISALS_SPREADSHEET_ID,
        resource: {
          valueInputOption: 'USER_ENTERED',
          data: [
            {
              range: `${this.config.PENDING_APPRAISALS_SHEET_NAME}!F${rowNumber}`,
              values: [['GCS SAVED']]
            },
            {
              range: `${this.config.PENDING_APPRAISALS_SHEET_NAME}!G${rowNumber}`,
              values: [[wordpressEditUrl]]
            }
          ]
        }
      });

      console.log('Updated submission status:', {
        session_id,
        status: 'GCS SAVED',
        row: rowNumber
      });
    } catch (error) {
      console.error('Error updating submission status:', error);
      throw new Error('Failed to update submission status');
    }
  }

  async updateWordPressMediaUrls(session_id, mediaUrls) {
    try {
      const auth = await getAuthClient();
      const sheets = google.sheets({ version: 'v4', auth });
      
      const rowNumber = await findRowBySessionId(sheets, this.config, session_id);
      if (!rowNumber) {
        console.warn('Session ID not found in sheets:', session_id);
        return;
      }

      const urlsJson = JSON.stringify({
        main: mediaUrls.main || '',
        age: mediaUrls.age || '',
        signature: mediaUrls.signature || ''
      });

      await updateCell(sheets, this.config, rowNumber, 'O', urlsJson);
      
      console.log('Updated WordPress media URLs:', {
        session_id,
        row: rowNumber
      });
    } catch (error) {
      console.error('Error updating media URLs:', error);
      console.log('Continuing despite media URLs update error');
    }
  }

  async updateGCSUrl(session_id, gcsUrl) {
    try {
      const auth = await getAuthClient();
      const sheets = google.sheets({ version: 'v4', auth });
      
      const rowNumber = await findRowBySessionId(sheets, this.config, session_id);
      if (!rowNumber) {
        console.warn('Session ID not found in sheets:', session_id);
        return;
      }

      await updateCell(sheets, this.config, rowNumber, 'Q', gcsUrl);
      
      console.log('Updated GCS URL:', {
        session_id,
        row: rowNumber
      });
    } catch (error) {
      console.error('Error updating GCS URL:', error);
      console.log('Continuing despite GCS URL update error');
    }
  }
}

module.exports = AppraisalSheetsClient;