const { google } = require('googleapis');

async function logError(config, errorDetails) {
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const authClient = await auth.getClient();
    google.options({ auth: authClient });

    const sheets = google.sheets({ version: 'v4', auth });

    const values = [[
      errorDetails.timestamp || new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
      errorDetails.severity || 'Critical',
      errorDetails.scriptName || 'Unknown Script',
      errorDetails.errorCode || 'N/A',
      errorDetails.errorMessage || 'No error message provided',
      errorDetails.stackTrace || 'No stack trace available',
      errorDetails.userId || 'N/A',
      errorDetails.requestId || 'N/A',
      errorDetails.environment || 'Production',
      errorDetails.endpoint || 'N/A',
      errorDetails.additionalContext || 'N/A',
      errorDetails.resolutionStatus || 'Open',
      errorDetails.assignedTo || config.ASSIGNED_TO,
      errorDetails.chatGPT || config.CHATGPT_CHAT_URL,
      errorDetails.resolutionLink || config.RESOLUTION_LINK,
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: config.LOG_SPREADSHEET_ID,
      range: 'Sheet1',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: values,
      },
    });

    console.log('Error logged successfully');
  } catch (loggingError) {
    console.error('Failed to log error:', loggingError);
  }
}

module.exports = {
  logError,
};