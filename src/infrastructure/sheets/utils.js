const { google } = require('googleapis');

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

module.exports = {
  getAuthClient,
  findRowBySessionId,
  updateCell
};