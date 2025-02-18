# Payment Processor API Documentation

## Base URL
```
```
https://payment-processor-856401495068.us-central1.run.app
```
```

## Authentication
Most endpoints require the `x-shared-secret` header for authentication:
```
```
x-shared-secret: ${VITE_STRIPE_SHARED_SECRET}
```
```

## Endpoints

### 1. Bulk Appraisal Endpoints

#### Session Restore
```
GET /api/bulk-appraisals/session/:sessionId
```

Response:
```json
{
  "success": boolean,
  "session": {
    "id": string,
    "customer_email": string | null,
    "appraisal_type": "regular" | "insurance" | "tax" | null,
    "created_at": string,
    "expires_at": string,
    "items": Array<{
      "id": string,
      "file_url": string,
      "description"?: string,
      "category"?: string,
      "status": "pending" | "processed"
    }>
  },
  "error"?: string
}
```

#### Update Session Email
```
PUT /api/bulk-appraisals/session/:sessionId/email
```

Request Body:
```json
{
  "email": string
}
```

Response:
```json
{
  "success": true,
  "message": "Email updated successfully"
}
```

Error Responses:
```json
{
  "success": false,
  "error": "Invalid email address" | "Session not found" | "Failed to update email"
}
```

#### Session Finalization
```
POST /api/bulk-appraisals/finalize
```

Request Body:
```json
{
  "session_id": string,
  "appraisal_type": "regular" | "insurance" | "tax"
}
```

Response:
```json
{
  "success": boolean,
  "items": Array<{
    "item_id": string,
    "file_url": string,
    "description"?: string,
    "category"?: string,
    "appraisal_type": string,
    "price": number,
    "status": "pending" | "processed"
  }>,
  "total_price": number,
  "discount"?: {
    "type": "bulk" | "early",
    "percentage": number,
    "amount": number
  },
  "final_price": number,
  "error"?: string
}
```

Notes:
- Pricing varies by appraisal type:
  - Regular: $25 per item
  - Insurance: $50 per item
  - Tax: $75 per item
- Sessions expire after 24 hours
- Files are stored securely in Google Cloud Storage
- Signed URLs are generated for secure file access

### 1. Session Information
Retrieve detailed information about a Stripe checkout session.

```
GET /stripe/session/:sessionId
```

#### Headers
- `x-shared-secret`: Required for authentication
- `Content-Type`: application/json

#### Response
```json
{
  "customer_details": {
    "name": "string",
    "email": "string"
  },
  "amount_total": number,
  "currency": "string",
  "payment_status": "string"
}
```

### 2. Appraisal Submission
Submit artwork images and details for appraisal.

```
POST /api/appraisals
```

#### Headers
- `Content-Type`: multipart/form-data

#### Body Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| session_id | string | Yes | Stripe checkout session ID |
| description | string | No | Description of the artwork |
| customer_email | string | No | Customer email (will be fetched from Stripe if not provided) |
| customer_name | string | No | Customer name (will be fetched from Stripe if not provided) |
| main | file | Yes | Main artwork image (JPEG, PNG, or WebP, max 10MB) |
| signature | file | No | Signature/marks image (JPEG, PNG, or WebP, max 10MB) |
| age | file | No | Age indicators image (JPEG, PNG, or WebP, max 10MB) |

#### Response
```json
{
  "success": true,
  "message": "Submission received and processing started",
  "session_id": "string"
}
```

## File Requirements

### Image Upload Specifications
- **Supported formats**: JPEG, PNG, WebP
- **Maximum file size**: 10MB per file
- **Required images**: Main artwork image
- **Optional images**: Signature/marks, Age indicators
- **Image optimization**: Files are automatically processed
  - Converted to JPEG
  - Quality optimized to 85%
  - Resized if larger than 2000x2000
  - EXIF rotation preserved

## Error Handling

### Common Error Responses
```json
{
  "success": false,
  "message": "Error description"
}
```

### HTTP Status Codes
- `200`: Success
- `400`: Bad Request (invalid input)
- `401`: Unauthorized (invalid or missing shared secret)
- `404`: Not Found
- `413`: Payload Too Large (file size exceeds limit)
- `500`: Internal Server Error

## Bulk Appraisal Flow

1. Session Creation
   - Server generates unique session ID
   - Creates secure storage folder
   - Returns session details and expiration

2. File Management
   - Files uploaded individually
   - Automatic image optimization
   - Secure URL generation
   - Position-based ordering

3. Session Updates
   - Email updates
   - Appraisal type selection
   - Customer information management

4. Finalization
   - Dynamic pricing based on type
   - Stripe checkout integration
   - Success/failure handling

## Usage Example

### Submitting an Appraisal
```javascript
const formData = new FormData();
formData.append('session_id', stripeSessionId);
formData.append('description', 'Artwork description');
formData.append('main', mainImageFile);
formData.append('signature', signatureImageFile);

const response = await fetch('https://payment-processor-856401495068.us-central1.run.app/api/appraisals', {
  method: 'POST',
  body: formData
});

const result = await response.json();
```

### Fetching Session Details
```javascript
const response = await fetch(
  `https://payment-processor-856401495068.us-central1.run.app/stripe/session/${sessionId}`,
  {
    headers: {
      'x-shared-secret': process.env.VITE_STRIPE_SHARED_SECRET,
      'Content-Type': 'application/json'
    }
  }
);

const sessionData = await response.json();
```

### Bulk Appraisal Example
```javascript
// Initialize session
const sessionResponse = await fetch('/api/bulk-appraisals/init', {
  method: 'POST'
});
const { session_id } = await sessionResponse.json();

// Upload file
const formData = new FormData();
formData.append('file', file);
formData.append('position', '1');
formData.append('description', 'Artwork description');

const uploadResponse = await fetch(`/api/bulk-appraisals/upload/${session_id}`, {
  method: 'POST',
  body: formData
});

// Update email
await fetch(`/api/bulk-appraisals/session/${session_id}/email`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'customer@example.com' })
});

// Finalize session
const finalizeResponse = await fetch('/api/bulk-appraisals/finalize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id,
    appraisal_type: 'regular'
  })
});
```

## Notes
- All timestamps are in UTC
- File uploads are processed asynchronously
- Customer information is automatically retrieved from Stripe if not provided
- Images are backed up to Google Cloud Storage
- WordPress integration creates posts for each submission