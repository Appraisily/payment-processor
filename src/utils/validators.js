function validateAppraisalRequest(req) {
  // Check required fields
  if (!req.body.session_id) {
    return 'Missing required field: session_id';
  }
  
  // Validate session_id format (alphanumeric with possible underscores and hyphens)
  if (!/^[a-zA-Z0-9_-]+$/.test(req.body.session_id)) {
    return 'Invalid session_id format';
  }

  if (!req.body.customer_email) {
    return 'Missing required field: customer_email';
  }

  // Validate email format
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(req.body.customer_email)) {
    return 'Invalid email format';
  }

  // Check for required main image
  if (!req.files?.main || !req.files.main[0]) {
    return 'Missing required file: main image';
  }

  // Validate file types
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  
  // Check file sizes
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  for (const [key, fileArray] of Object.entries(req.files)) {
    const file = fileArray[0];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return `Invalid file type for ${key}. Allowed types: JPEG, PNG, WebP`;
    }
    
    if (file.size > maxSize) {
      return `File ${key} exceeds maximum size of 10MB`;
    }
  }

  // Validate optional description length if provided
  if (req.body.description && req.body.description.length > 2000) {
    return 'Description exceeds maximum length of 2000 characters';
  }

  return null; // No validation errors
}

module.exports = {
  validateAppraisalRequest
};