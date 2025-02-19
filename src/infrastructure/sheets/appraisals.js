const { google } = require('googleapis');
const { getAuthClient, findRowBySessionId, updateCell } = require('./utils');
const { insertNewSubmission, updateExistingSubmission, updateMediaUrls } = require('./operations');

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
        await updateExistingSubmission(sheets, this.config, data, rowNumber);
      } else {
        console.log('Inserting new row for session:', data.session_id);
        await insertNewSubmission(sheets, this.config, data);
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

      await updateMediaUrls(sheets, this.config, rowNumber, mediaUrls);
      
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