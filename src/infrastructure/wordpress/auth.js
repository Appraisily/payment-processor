const axios = require('axios');

async function getOutboundIP() {
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    return response.data.ip;
  } catch (error) {
    console.error('Error getting outbound IP:', error);
    return 'Unknown';
  }
}

function getAuthHeader(config) {
  const credentials = Buffer.from(`${config.WORDPRESS_USERNAME}:${config.WORDPRESS_APP_PASSWORD}`).toString('base64');
  return `Basic ${credentials}`;
}

function getCommonHeaders(config) {
  return {
    Authorization: getAuthHeader(config),
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
}

module.exports = {
  getOutboundIP,
  getAuthHeader,
  getCommonHeaders
};