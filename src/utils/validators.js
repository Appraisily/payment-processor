function validateAppraisalRequest(req) {
  // Check required fields
  if (!req.body.session_id) {
    return 'Missing required field: session_id';
  }
  
  // Validate session_id format (alphanumeric with possible underscores and hyphens)
  if (!/^[a-zA-Z0-9_\-]+$/.test(req.body.session_id)) {
    return 'Invalid session_id format';
  }

  // If no files were uploaded, that's okay
  if (!req.files || Object.keys(req.files).length === 0) {
    return null;
  }

  // Validate file types
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  
  // Check file sizes
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  for (const [key, fileArray] of Object.entries(req.files)) {
    if (!fileArray || !fileArray[0]) continue;
    
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