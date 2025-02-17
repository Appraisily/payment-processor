# Payment Processor API Documentation

## Base URL
```
https://payment-processor-856401495068.us-central1.run.app
```

## Authentication
Most endpoints require the `x-shared-secret` header for authentication:
```
x-shared-secret: ${VITE_STRIPE_SHARED_SECRET}
```

## Endpoints

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

## Notes
- All timestamps are in UTC
- File uploads are processed asynchronously
- Customer information is automatically retrieved from Stripe if not provided
- Images are backed up to Google Cloud Storage
- WordPress integration creates posts for each submission
- Comprehensive error logging is implemented