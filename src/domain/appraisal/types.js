/**
 * @typedef {Object} AppraisalSubmission
 * @property {string} session_id - Stripe session ID
 * @property {string} description - Optional appraisal description
 * @property {Object} images - Uploaded image files
 * @property {File[]} images.main - Required main artwork image
 * @property {File[]} [images.signature] - Optional signature/marks image
 * @property {File[]} [images.age] - Optional age indicators image
 * @property {string} customer_email - Customer email
 * @property {string} customer_name - Customer name
 * @property {string} payment_id - Optional payment ID
 */

/**
 * @typedef {Object} ProcessedAppraisal
 * @property {number} id - WordPress post ID
 * @property {string} editUrl - WordPress edit URL
 * @property {Object} media - Uploaded media IDs and URLs
 * @property {Object} backupUrls - GCS backup URLs
 */

module.exports = {
  // Type definitions are for documentation only
};