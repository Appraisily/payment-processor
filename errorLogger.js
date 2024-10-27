// errorLogger.js

const { google } = require('googleapis');

/**
 * Log an error to the Google Sheets log.
 *
 * @param {Object} config - The configuration object containing necessary IDs and URLs.
 * @param {Object} errorDetails - Details about the error to log.
 */
async function logError(config, errorDetails) {
  try {
    // Initialize Google Sheets API with authentication
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const authClient = await auth.getClient();
    google.options({ auth: authClient });

    // Initialize Sheets API
    const sheets = google.sheets({ version: 'v4', auth });

    // Prepare the data in the order of your columns
    const values = [[
      errorDetails.timestamp || new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
      errorDetails.severity || 'Critical', // Default severity
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
      errorDetails.assignedTo || config.ASSIGNED_TO, // Use from errorDetails or config.js
      errorDetails.chatGPT || config.CHATGPT_CHAT_URL, // Use from errorDetails or config.js
      errorDetails.resolutionLink || config.RESOLUTION_LINK, // Use from errorDetails or config.js
    ]];

    // Append the data to the log sheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: config.LOG_SPREADSHEET_ID,
      range: 'Sheet1', // Replace with your actual sheet name if different
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: values,
      },
    });

    console.log('Error logged successfully:', response.statusText);
  } catch (loggingError) {
    console.error('Failed to log error:', loggingError);
  }
}

module.exports = {
  logError,
};
