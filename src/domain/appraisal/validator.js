const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function validateImageFile(file) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return `Invalid file type. Allowed types: JPEG, PNG, WebP`;
  }

  if (file.size > MAX_FILE_SIZE) {
    return `File exceeds maximum size of 10MB`;
  }

  return null;
}

function validateAppraisalSubmission(submission) {
  const { session_id, description, images } = submission;

  // Validate session_id
  if (!session_id) {
    return 'Missing required field: session_id';
  }

  if (!/^[\w\-\s]+$/.test(session_id)) {
    return 'Invalid session_id format';
  }

  // Validate description length
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    return `Description exceeds maximum length of ${MAX_DESCRIPTION_LENGTH} characters`;
  }

  // Validate required main image
  if (!images?.main?.[0]) {
    return 'Main artwork image is required';
  }

  // Validate main image
  const mainImageError = validateImageFile(images.main[0]);
  if (mainImageError) {
    return `Main image: ${mainImageError}`;
  }

  // Validate optional images
  for (const key of ['signature', 'age']) {
    if (images[key]?.[0]) {
      const error = validateImageFile(images[key][0]);
      if (error) {
        return `${key} image: ${error}`;
      }
    }
  }

  return null;
}

module.exports = {
  validateAppraisalSubmission
};