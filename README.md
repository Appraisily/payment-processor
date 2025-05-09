# Payment Processor Service

A Node.js service that handles Stripe payments, records transactions, manages art appraisal workflows, and integrates with WordPress for content management. Built following modular design principles and best practices for secure payment processing and data management.

## Features

### Payment Processing
- Stripe webhook handling for both test and live modes
- Secure payment verification with signature validation
- Automatic transaction recording in Google Sheets
- Support for multiple payment link types (Regular, Insurance, IRS, Bulk)
- Bulk appraisal support with dynamic pricing
- Session-based appraisal management
- Flexible pricing based on appraisal type

### Data Management
- Google Sheets integration for sales and appraisals tracking
- Comprehensive error logging system
- Secure secret management via Google Cloud Secret Manager
- Bulk file management in Google Cloud Storage
- Session metadata persistence
- Customer information tracking

### WordPress Integration
- Custom post type handling for appraisals
- Media upload and management
- ACF (Advanced Custom Fields) integration
- Secure authentication

### Image Processing
- Automatic image optimization
- Format conversion to JPEG
- Size limits and validation
- EXIF data handling
- Bulk image processing and storage
- Signed URL generation for secure access
- Position-based file ordering

### Email Notifications
- SendGrid integration
- Dynamic template support
- HTML email templates
- Error notifications

### Security
- Webhook signature verification
- API authentication
- Secure secret management
- Input validation
- Secure file upload handling
- Session-based access control
- Signed URL expiration

## Architecture

### Domain Layer
- **Appraisal Domain**: Handles individual appraisal processing
- **Bulk Appraisal Domain**: Manages bulk appraisal sessions
- **Payment Domain**: Processes Stripe payments and webhooks

### Infrastructure Layer
- **Storage**: Google Cloud Storage integration
- **Email**: SendGrid email service
- **Database**: Google Sheets integration
- **CMS**: WordPress API integration
- **Payment**: Stripe API integration

### Application Layer
- **Routes**: API endpoint handlers
- **Services**: Business logic coordination
- **Repositories**: Data access abstraction

## API Endpoints

### 1. Stripe Webhooks
- `POST /stripe-webhook` - Live mode webhook handler
- `POST /stripe-webhook-test` - Test mode webhook handler

### 2. Stripe API
- `GET /stripe/session/:sessionId` - Retrieve session information
  - Requires `x-shared-secret` header
  - Returns customer details, amount, currency, and payment status

### 3. Bulk Appraisals
- `POST /api/bulk-appraisals/init` - Initialize bulk session
- `POST /api/bulk-appraisals/upload/:sessionId` - Upload file to session
- `DELETE /api/bulk-appraisals/upload/:sessionId/:fileId` - Delete file from session
- `GET /api/bulk-appraisals/session/:sessionId` - Get session status
- `PUT /api/bulk-appraisals/session/:sessionId/email` - Update session email
- `PUT /api/bulk-appraisals/description` - Update item description
- `POST /api/bulk-appraisals/finalize/:sessionId` - Finalize session

### 4. Individual Appraisals
- `POST /api/appraisals` - Submit individual appraisal
  - Supports multipart form data
  - Handles multiple image uploads (main, signature, age)
  - Maximum file size: 10MB per file

### 5. Test Endpoints
- `GET /api/appraisals/test-wp/:postId` - Test WordPress post structure
  - Development/debugging endpoint
  - Returns WordPress post data structure

### 6. Health Check
- `GET /` - Service health check endpoint
  - Returns "Service is healthy" when operational

## Configuration

### Required Secrets
- `STRIPE_SECRET_KEY_TEST`
- `STRIPE_SECRET_KEY_LIVE`
- `STRIPE_WEBHOOK_SECRET_TEST`
- `STRIPE_WEBHOOK_SECRET_LIVE`
- `STRIPE_SHARED_SECRET`
- `SALES_SPREADSHEET_ID`
- `PENDING_APPRAISALS_SPREADSHEET_ID`
- `LOG_SPREADSHEET_ID`
- `SENDGRID_API_KEY`
- `WORDPRESS_API_URL`
- `WORDPRESS_USERNAME`
- `WORDPRESS_APP_PASSWORD`
- `SHARED_SECRET`

### Environment Variables
- `PORT` (default: 8080)
- `GOOGLE_CLOUD_PROJECT_ID`
- `GCS_BUCKET_NAME`
- `PUBSUB_CRM_NAME`

## Development

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

For more details about the webhook flow and processing, see [webhook-flow.md](webhook-flow.md).