const { google } = require('googleapis');

/**
 * @typedef {Object} ErrorDetails
 * @property {string} [timestamp] - Timestamp of the error (defaults to current time in Madrid timezone)
 * @property {('Critical'|'Error'|'Warning'|'Info')} [severity] - Error severity level
 * @property {string} [scriptName] - Name of the script where the error occurred
 * @property {string} [errorCode] - Error code identifier
 * @property {string} [errorMessage] - Detailed error message
 * @property {string} [stackTrace] - Error stack trace
 * @property {string} [userId] - ID of the user affected by the error
 * @property {string} [requestId] - ID of the request that caused the error
 * @property {string} [environment] - Environment where the error occurred
 * @property {string} [endpoint] - API endpoint where the error occurred
 * @property {string} [additionalContext] - Any additional context about the error
 * @property {('Open'|'In Progress'|'Resolved')} [resolutionStatus] - Current status of error resolution
 * @property {string} [assignedTo] - Person assigned to resolve the error
 * @property {string} [chatGPT] - Link to relevant ChatGPT conversation
 * @property {string} [resolutionLink] - Link to resolution documentation
 */

/**
 * @typedef {Object} Config
 * @property {string} LOG_SPREADSHEET_ID - ID of the Google Sheet for error logging
 * @property {string} ASSIGNED_TO - Default person to assign errors to
 * @property {string} CHATGPT_CHAT_URL - Default ChatGPT conversation URL
 * @property {string} RESOLUTION_LINK - Default resolution documentation URL
 */

const DEFAULT_SHEET_NAME = 'ErrorLogs';
const DATE_OPTIONS = { timeZone: 'Europe/Madrid' };

/**
 * Formats the current timestamp in Madrid timezone
 * @returns {string} Formatted timestamp
 */
function getCurrentTimestamp() {
  return new Date().toLocaleString('es-ES', DATE_OPTIONS);
}

/**
 * Initializes Google Sheets API client
 * @returns {Promise<google.sheets_v4.Sheets>} Initialized Google Sheets client
 */
async function initializeSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();
  google.options({ auth: authClient });
  return google.sheets({ version: 'v4', auth });
}

/**
 * Prepares error data for logging
 * @param {Config} config - Configuration object
 * @param {ErrorDetails} errorDetails - Error details to log
 * @returns {Array<Array<string>>} Formatted error data
 */
function prepareErrorData(config, errorDetails) {
  return [[
    errorDetails.timestamp || getCurrentTimestamp(),
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
}

/**
 * Logs an error to Google Sheets
 * @param {Config} config - Configuration object containing necessary IDs and URLs
 * @param {ErrorDetails} errorDetails - Details about the error to log
 * @returns {Promise<void>}
 */
async function logError(config, errorDetails) {
  if (!config?.LOG_SPREADSHEET_ID) {
    console.error('Missing required configuration: LOG_SPREADSHEET_ID');
    return;
  }

  try {
    const sheets = await initializeSheetsClient();
    const values = prepareErrorData(config, errorDetails);

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: config.LOG_SPREADSHEET_ID,
      range: DEFAULT_SHEET_NAME,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });

    if (response.status === 200) {
      console.log('Error logged successfully:', {
        timestamp: values[0][0],
        errorCode: values[0][3],
        severity: values[0][1],
      });
    } else {
      throw new Error(`Failed to log error: ${response.statusText}`);
    }
  } catch (loggingError) {
    console.error('Error logging failed:', {
      error: loggingError.message,
      originalError: errorDetails.errorMessage,
      spreadsheetId: config.LOG_SPREADSHEET_ID,
    });

    // Attempt to log to console if sheets logging fails
    console.error('Original error details:', {
      timestamp: getCurrentTimestamp(),
      ...errorDetails,
    });
  }
}

/**
 * Creates a new error log entry
 * @param {Config} config - Configuration object
 * @param {string} errorMessage - Main error message
 * @param {Partial<ErrorDetails>} additionalDetails - Additional error details
 * @returns {Promise<void>}
 */
async function quickLog(config, errorMessage, additionalDetails = {}) {
  const errorDetails = {
    timestamp: getCurrentTimestamp(),
    errorMessage,
    severity: 'Error',
    ...additionalDetails,
  };

  await logError(config, errorDetails);
}

module.exports = {
  logError,
  quickLog,
};
