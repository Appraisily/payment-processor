# Payment Processor Service

A Node.js service that handles Stripe payments, records transactions, manages art appraisal workflows, and integrates with WordPress for content management. Built following modular design principles and best practices for secure payment processing and data management.

## Features

- **Payment Processing**
  - Stripe webhook handling for both test and live modes
  - Secure payment verification with signature validation
  - Automatic transaction recording in Google Sheets
  - Support for multiple payment link types (Regular, Insurance, IRS, Bulk)
  - Automatic amount conversion from Stripe's cents format
  - Bulk appraisal support with dynamic pricing

- **Data Management**
  - Google Sheets integration for sales and appraisals tracking
  - Comprehensive error logging system
  - Secure secret management via Google Cloud Secret Manager
  - Caching system for configuration
  - Bulk file management in Google Cloud Storage

- **WordPress Integration**
  - Custom post type handling for appraisals
  - Media upload and management
  - ACF (Advanced Custom Fields) integration
  - Secure authentication

- **Image Processing**
  - Automatic image optimization
  - Format conversion to JPEG
  - Size limits and validation
  - EXIF data handling
  - Bulk image processing and storage
  - Signed URL generation for secure access

- **Email Notifications**
  - SendGrid integration
  - Dynamic template support
  - HTML email templates
  - Error notifications

- **Security**
  - Webhook signature verification
  - API authentication
  - Secure secret management
  - Input validation
  - Secure file upload handling
  - Session-based access control

## Project Structure

```
├── src/                        # Source code root
│   ├── domain/                # Domain logic and business rules
│   │   ├── appraisal/        # Appraisal domain
│   │   │   ├── repositories/ # Repository implementations
│   │   │   │   ├── appraisers.repository.js  # Appraisers backend integration
│   │   ├── bulk-appraisal/   # Bulk appraisal domain
│   │   │   ├── service.js    # Bulk appraisal business logic
│   │   │   │   ├── sheets.repository.js      # Google Sheets operations
│   │   │   │   ├── storage.repository.js     # GCS storage operations
│   │   │   │   └── wordpress.repository.js   # WordPress operations
│   │   │   ├── service.js    # Appraisal business logic
│   │   │   ├── types.js      # Type definitions
│   │   │   └── validator.js  # Input validation
│   │   └── payment/          # Payment domain
│   │       ├── repository.js # Payment data operations
│   │       ├── service.js    # Payment business logic
│   │       ├── types.js      # Type definitions
│   │       └── validator.js  # Input validation
│   ├── infrastructure/       # External services integration
│   │   ├── appraisers/      # Appraisers backend integration
│   │   │   └── client.js    # Appraisers API client
│   │   ├── email/           # Email service
│   │   │   └── sendgrid.js  # SendGrid integration
│   │   ├── image/           # Image processing
│   │   │   └── processor.js # Image optimization
│   │   ├── sheets/          # Google Sheets
│   │   │   ├── appraisals.js # Appraisals sheet operations
│   │   │   └── client.js    # Base Sheets client
│   │   ├── storage/         # Cloud storage
│   │   │   └── gcs.js      # Google Cloud Storage
│   │   ├── stripe/          # Payment processing
│   │   │   └── client.js    # Stripe API client
│   │   └── wordpress/       # WordPress integration
│   │       ├── auth.js      # Authentication utilities
│   │       ├── constants.js # API endpoints and constants
│   │       ├── media.js     # Media upload operations
│   │       └── posts.js     # Post operations
│   ├── routes/              # API routes
│   │   ├── appraisalRoutes.js # Appraisal endpoints
│   │   ├── stripeRoutes.js    # Stripe endpoints
│   │   └── webhookRoutes.js   # Webhook handlers
│   ├── services/            # Application services
│   │   ├── appraisalProcessor.js  # Appraisal processing
│   │   ├── backgroundProcessor.js  # Background tasks
│   │   ├── checkoutProcessor.js    # Checkout processing
│   │   └── webhookHandler.js       # Webhook handling
│   ├── utils/               # Shared utilities
│   │   └── error/          # Error handling
│   │       └── logger.js   # Error logging
│   ├── config.js           # Configuration management
│   └── index.js           # Application entry point
└── Dockerfile                # Container configuration
```

## Data Structures

### Google Sheets Structure

#### Sales Sheet
- Session ID
- Payment Intent ID
- Customer ID
- Customer Name
- Customer Email
- Amount Paid
- Session Date
- Mode (Test/Live)

#### Pending Appraisals Sheet
- Date
- Appraisal Type
- Session ID
- Customer Email
- Customer Name
- Status
- WordPress Edit URL

#### Error Log Sheet
- Timestamp
- Severity
- Script Name
- Error Code
- Error Message
- Stack Trace
- User ID
- Request ID
- Environment
- Endpoint
- Additional Context
- Resolution Status
- Assigned To
- ChatGPT Link
- Resolution Link

## API Endpoints

### Bulk Appraisal API

#### 1. Initialize Bulk Session
```
POST /api/bulk-appraisals/init
```

Response:
```json
{
  "success": true,
  "session_id": "string",
  "expires_at": "string" // ISO date
}
```

#### 2. Upload Individual File
```
POST /api/bulk-appraisals/upload/{sessionId}
```

Request:
- Content-Type: multipart/form-data
- Body:
  - file: File (required, max 10MB)
  - description: string (optional)
  - category: string (optional)
  - position: number (required)

Response:
```json
{
  "success": true,
  "file_id": "string",
  "url": "string" // GCS signed URL
}
```

#### 3. Get Session Status
```
GET /api/bulk-appraisals/session/{sessionId}
```

Response:
```json
{
  "success": true,
  "session_id": "string",
  "files": [
    {
      "id": "string",
      "url": "string",
      "description": "string",
      "category": "string",
      "position": number,
      "status": "uploaded" | "processing" | "error",
      "error": "string"
    }
  ],
  "expires_at": "string"
}
```

#### 4. Remove File
```
DELETE /api/bulk-appraisals/upload/{sessionId}/{fileId}
```

Response:
```json
{
  "success": true,
  "error": "string"
}
```

#### 5. Finalize Session
```
POST /api/bulk-appraisals/finalize/{sessionId}
```

Request:
```json
{
  "email": "string",
  "phone": "string",
  "notes": "string"
}
```

Response:
```json
{
  "success": true,
  "redirect_url": "string", // Stripe checkout URL
  "error": "string"
}
```

### Stripe Webhooks
- POST `/stripe-webhook`: Live mode webhook handler
- POST `/stripe-webhook-test`: Test mode webhook handler

### Stripe API
- GET `/stripe/session/:sessionId`: Retrieve session information
  - Requires `x-shared-secret` header for authentication

### Appraisal Submission
- POST `/api/appraisals`: Handle appraisal submissions
  - Multipart form data
  - Supports image uploads:
    - `main`: Required main artwork image
    - `signature`: Optional signature/marks image
    - `age`: Optional age indicators image
  - Maximum file size: 10MB per file
  - Request format:
    ```typescript
    {
      session_id: string;       // Required: Stripe session ID
      description?: string;     // Optional: Text description of artwork
      customer_email?: string;  // Optional: Will be fetched from Stripe if not provided
      customer_name?: string;   // Optional: Will be fetched from Stripe if not provided
      payment_id?: string;      // Optional: Additional payment reference
      files: {
        main: File[];          // Required: Main artwork image
        signature?: File[];    // Optional: Signature/marks image
        age?: File[];         // Optional: Age indicators image
      }
    }
    ```
  
  Processing Steps:
  1. Immediate 200 response sent to client
  2. Background processing begins:
     - Validate submission data and files
     - Start GCS backup of original files (async)
     - Create WordPress post (custom post type: appraisals)
     - Update post with customer metadata
     - Record submission in Google Sheets (Pending Appraisals)
     - Process and optimize images:
       - Convert to JPEG format
       - Optimize quality (85%)
       - Resize if needed (max 2000x2000)
       - Preserve EXIF rotation
     - Upload optimized images to WordPress
     - Update WordPress post with:
       - Media IDs and URLs
       - ACF fields (main, signature, age)
       - Customer information
     - Notify appraisers backend service with:
       - Session details
       - Customer information
       - WordPress post URL
       - Image URLs
     - Update sheets status to "SUBMITTED"

  Each step is logged for monitoring and debugging purposes.
  Error handling:
    - All errors are logged to Google Sheets error log
    - Non-critical errors don't stop the process
    - Each step has independent error handling
    - Immediate client response not affected by background processing

## Configuration

### Required Secrets (Google Cloud Secret Manager)
- `GCS_BULK_APPRAISAL_BUCKET`: Bucket for bulk appraisal files
- `STRIPE_SECRET_KEY_TEST`
- `STRIPE_SECRET_KEY_LIVE`
- `STRIPE_WEBHOOK_SECRET_TEST`
- `STRIPE_WEBHOOK_SECRET_LIVE`
- `STRIPE_SHARED_SECRET`
- `SALES_SPREADSHEET_ID`
- `PENDING_APPRAISALS_SPREADSHEET_ID`
- `LOG_SPREADSHEET_ID`
- `SENDGRID_API_KEY`
- `SENDGRID_EMAIL`
- `SEND_GRID_TEMPLATE_NOTIFY_PAYMENT_RECEIVED`
- `WORDPRESS_API_URL`
- `wp_username`
- `wp_app_password`
- `SHARED_SECRET`
- `ADMIN_EMAIL`

### Environment Variables
- `PORT` (default: 8080)
- `GOOGLE_CLOUD_PROJECT_ID`
- `CHATGPT_CHAT_URL`
- `RESOLUTION_LINK`
- `ASSIGNED_TO`
- `GCS_BUCKET_NAME` (default: 'appraisily-image-backups')

## Payment Links Configuration

Currently supported payment links:
```javascript
{
  'plink_1PzzahAQSJ9n5XyNZTMmYyLJ': { productName: 'Regular' },
  'plink_1OnRh5AQSJ9n5XyNBhDuqbtS': { productName: 'Regular' },
  'plink_1OnRpsAQSJ9n5XyN2BCtWNEs': { productName: 'Insurance' },
  'plink_1OnRzAAQSJ9n5XyNyLmReeCk': { productName: 'IRS' }
}
```

## Error Handling

The service implements comprehensive error handling:
- Input validation
- Webhook signature verification
- API authentication
- File upload validation
- Database operation error handling
- Third-party service integration error handling

## Security Features

1. **Authentication**
   - Stripe webhook signature verification
   - API shared secret authentication
   - WordPress basic authentication

2. **Data Protection**
   - Secure secret management via Google Cloud
   - Input validation and sanitization
   - File type and size validation

3. **Error Handling**
   - Secure error logging
   - No sensitive data in responses
   - Proper HTTP status codes

## Development

### Bulk Appraisal Flow

1. **Session Initialization**
   - Client requests new session
   - Server generates UUID
   - Creates GCS folder structure
   - Returns session details

2. **File Upload**
   - Client uploads files individually
   - Server processes and stores files
   - Generates signed URLs
   - Maintains file order

3. **Session Management**
   - Status tracking
   - File listing
   - Metadata management
   - Expiration handling

4. **Finalization**
   - Customer information collection
   - Stripe checkout session creation
   - Dynamic pricing ($25 per item)
   - Success/cancel URL handling

### API Data Structures

#### Appraisal Submission
The appraisal submission process is handled by the AppraisalUploadForm component which sends data to the `/api/appraisals` endpoint. The service validates:

- File types: JPEG, PNG, WebP
- File sizes: Maximum 10MB per file
- Required fields: session_id, main image
- Description length: Maximum 2000 characters
- Session ID format: Alphanumeric with hyphens/underscores

Customer information is automatically retrieved from Stripe if not provided
in the request.

#### Stripe Session Endpoint
The `/stripe/session/:sessionId` endpoint returns session information with proper amount formatting:

```json
{
  "customer_details": {
    "name": "string",
    "email": "string"
  },
  "amount_total": number, // Converted from Stripe's cents format
  "currency": "string",
  "payment_status": "string"
}
```

### Prerequisites
- Node.js 18+
- Google Cloud project with required APIs enabled
- Stripe account with webhook endpoints configured
- WordPress installation with REST API and ACF
- SendGrid account with verified sender

### Installation
```bash
# Install dependencies
npm install

# Start the service
npm start
```

### Docker Support
```bash
# Build container
docker build -t payment-processor .

# Run container
docker run -p 8080:8080 payment-processor
```

## Testing

The service includes:
- Webhook testing endpoints
- Separate test/live mode handling
- Error logging for debugging
- Comprehensive request validation

## Monitoring

The service provides:
- Health check endpoint
- Error logging to Google Sheets
- Request tracking
- Payment processing status monitoring

## Best Practices

### Bulk Appraisal Implementation

1. **Session Management**
   - Unique session IDs with UUID v4
   - 24-hour expiration
   - Secure file storage in GCS
   - Customer metadata preservation

2. **File Handling**
   - Server-side file ID generation
   - Position-based ordering
   - Automatic JPEG conversion
   - Signed URL generation
   - Maximum file size enforcement

3. **Security**
   - Session-based access control
   - Secure URL generation
   - File type validation
   - Size limit enforcement
   - Metadata validation

4. **Error Handling**
   - Comprehensive error logging
   - Client-friendly error messages
   - Session validation
   - File existence checks
   - Proper HTTP status codes

1. **Code Organization**
   - Modular architecture
   - Clear separation of concerns
   - Utility functions for reusability
   - Consistent error handling

2. **Security**
   - Input validation
   - Authentication
   - Secure configurations
   - Error handling

3. **Performance**
   - Asynchronous operations
   - Configuration caching
   - Optimized database queries
   - Resource management

4. **Maintenance**
   - Clear documentation
   - Consistent coding style
   - Comprehensive error logging
   - Version control