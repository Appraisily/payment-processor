const { google } = require('googleapis');

async function updateAppraisalStatus(sessionId, wordpressUrl, config) {
  try {
    // Initialize Google Sheets API
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // First, find the row with the matching session ID
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.PENDING_APPRAISALS_SPREADSHEET_ID,
      range: `${config.PENDING_APPRAISALS_SHEET_NAME}!C:C`
    });

    const values = response.data.values || [];
    const rowIndex = values.findIndex(row => row[0] === sessionId);

    if (rowIndex === -1) {
      throw new Error(`Session ID ${sessionId} not found in spreadsheet`);
    }

    // Update both status and WordPress URL
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.PENDING_APPRAISALS_SPREADSHEET_ID,
      range: `${config.PENDING_APPRAISALS_SHEET_NAME}!F${rowIndex + 1}:I${rowIndex + 1}`,
      valueInputOption: 'RAW',
      resource: {
        values: [['INFORMATION RECEIVED', wordpressUrl, description || '']]
      }
    });

    console.log(`Updated status, WordPress URL and description for session ${sessionId}`);
  } catch (error) {
    console.error('Error updating appraisal status in spreadsheet:', error);
    throw error;
  }
}

module.exports = {
  updateAppraisalStatus
};