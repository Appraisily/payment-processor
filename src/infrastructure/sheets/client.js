const { google } = require('googleapis');

class GoogleSheetsClient {
  constructor(config) {
    this.config = config;
  }

  async getAuthClient() {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    return await auth.getClient();
  }

  async getClient() {
    const authClient = await this.getAuthClient();
    return google.sheets({ version: 'v4', auth: authClient });
  }

  async appendRow(spreadsheetId, range, values) {
    const sheets = await this.getClient();
    return await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [values] }
    });
  }

  async findRow(spreadsheetId, range, searchValue) {
    const sheets = await this.getClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    });

    const values = response.data.values || [];
    return values.findIndex(row => row[0] === searchValue);
  }

  async updateRow(spreadsheetId, range, values) {
    const sheets = await this.getClient();
    return await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [values] }
    });
  }
}

module.exports = GoogleSheetsClient;