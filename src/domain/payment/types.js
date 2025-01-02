/**
 * @typedef {Object} PaymentSession
 * @property {string} id - Session ID
 * @property {string} payment_intent - Payment intent ID
 * @property {string} customer - Customer ID
 * @property {number} amount_total - Total amount in cents
 * @property {string} currency - Currency code
 * @property {Object} customer_details - Customer details
 * @property {string} customer_details.email - Customer email
 * @property {string} customer_details.name - Customer name
 * @property {number} created - Creation timestamp
 * @property {string} payment_link - Payment link ID
 */

/**
 * @typedef {Object} PaymentRecord
 * @property {string} session_id - Session ID
 * @property {string} payment_intent_id - Payment intent ID
 * @property {string} customer_id - Customer ID
 * @property {string} customer_name - Customer name
 * @property {string} customer_email - Customer email
 * @property {number} amount - Amount in decimal
 * @property {string} date - Formatted date
 * @property {string} mode - Test or Live
 */

module.exports = {
  // Type definitions are for documentation only
};