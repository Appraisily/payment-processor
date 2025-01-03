const GoogleSheetsClient = require('./client');

class ErrorLogger {
  constructor(config) {
    this.config = config;
    this.sheetsClient = new GoogleSheetsClient(config);
  }

  async logError(errorDetails) {
    try {
      const values = [
        new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
        errorDetails.severity || 'Critical',
        errorDetails.scriptName || 'Unknown',
        errorDetails.errorCode || 'N/A',
        errorDetails.errorMessage || 'No message',
        errorDetails.stackTrace || 'No stack trace',
        errorDetails.userId || 'N/A',
        errorDetails.requestId || 'N/A',
        errorDetails.environment || 'Production',
        errorDetails.endpoint || 'N/A',
        errorDetails.additionalContext || 'N/A',
        'Open',
        this.config.ASSIGNED_TO,
        this.config.CHATGPT_CHAT_URL,
        this.config.RESOLUTION_LINK
      ];

      await this.sheetsClient.appendRow(
        this.config.LOG_SPREADSHEET_ID,
        'Sheet1',
        values
      );

      console.log('Error logged successfully');
    } catch (loggingError) {
      console.error('Failed to log error:', loggingError);
    }
  }
}

module.exports = ErrorLogger;