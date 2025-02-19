const { getAuthClient, findRowBySessionId, updateCell } = require('./utils');

async function insertNewSubmission(sheets, config, data) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: config.PENDING_APPRAISALS_SPREADSHEET_ID,
    range: `${config.PENDING_APPRAISALS_SHEET_NAME}!A:I`,
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

async function updateExistingSubmission(sheets, config, data, rowNumber) {
  // Update status and WordPress URL
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: config.PENDING_APPRAISALS_SPREADSHEET_ID,
    resource: {
      valueInputOption: 'USER_ENTERED',
      data: [
        {
          range: `${config.PENDING_APPRAISALS_SHEET_NAME}!F${rowNumber}:G${rowNumber}`,
          values: [['SUBMITTED', data.wordpressEditUrl || '']]
        }
      ]
    }
  });

  // Update description if provided
  if (data.description) {
    await updateCell(sheets, config, rowNumber, 'I', data.description);
  }
}

async function updateMediaUrls(sheets, config, rowNumber, mediaUrls) {
  const urlsJson = JSON.stringify({
    main: mediaUrls.main || '',
    age: mediaUrls.age || '',
    signature: mediaUrls.signature || ''
  });

  await updateCell(sheets, config, rowNumber, 'O', urlsJson);
}

module.exports = {
  insertNewSubmission,
  updateExistingSubmission,
  updateMediaUrls
};