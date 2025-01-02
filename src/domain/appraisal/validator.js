const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function validateAppraisalSubmission(submission) {
  const { session_id, description, files } = submission;

  // Validate session_id
  if (!session_id) {
    return 'Missing required field: session_id';
  }

  if (!/^[a-zA-Z0-9_\-]+$/.test(session_id)) {
    return 'Invalid session_id format';
  }

  // Validate description length
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    return `Description exceeds maximum length of ${MAX_DESCRIPTION_LENGTH} characters`;
  }

  // Validate files if present
  if (files) {
    for (const [key, fileArray] of Object.entries(files)) {
      if (!fileArray || !fileArray[0]) continue;

      const file = fileArray[0];
      
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return `Invalid file type for ${key}. Allowed types: JPEG, PNG, WebP`;
      }

      if (file.size > MAX_FILE_SIZE) {
        return `File ${key} exceeds maximum size of 10MB`;
      }
    }
  }

  return null;
}

module.exports = {
  validateAppraisalSubmission
};