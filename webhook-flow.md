# Stripe Webhook Flow

```mermaid
sequenceDiagram
    participant Stripe
    participant Webhook as Webhook Handler
    participant Payment as Payment Service
    participant Storage as GCS Storage
    participant Sheets as Google Sheets
    participant Email as SendGrid
    participant CRM as PubSub/CRM

    Stripe->>Webhook: POST /stripe-webhook
    Note over Webhook: Verify signature
    
    alt Invalid Signature
        Webhook-->>Stripe: 400 Bad Request
    else Valid Signature
        alt Not checkout.session.completed
            Webhook-->>Stripe: 200 Ignored Event
        else checkout.session.completed
            Webhook->>Payment: Process Session

            alt Regular Appraisal
                par Process Regular Appraisal
                    Payment->>Sheets: Record in Sales Sheet
                    Note over Sheets: Session ID<br/>Payment Intent<br/>Customer Details<br/>Amount
                    Payment->>Sheets: Record in Pending Appraisals
                    Note over Sheets: Date<br/>Product Type<br/>Status: PENDING INFO
                    Payment->>Email: Send Regular Template
                    Note over Email: Use SendGrid Template<br/>Customer Details<br/>Session ID
                    Payment->>CRM: Publish Payment Event
                    Note over CRM: Payment Details<br/>Customer Info<br/>Metadata
                end
            else Bulk Appraisal (client_reference_id starts with 'bulk_')
                Payment->>Storage: Get Bulk Session Files
                Storage-->>Payment: Files Count & Details
                
                par Process Bulk Appraisal
                    Payment->>Sheets: Record in Sales Sheet
                    Note over Sheets: Session ID<br/>Payment Intent<br/>Amount
                    Payment->>Sheets: Record in Pending Appraisals
                    Note over Sheets: Date<br/>Bulk Order Details<br/>Items Count<br/>Status: BULK ORDER
                    Payment->>Email: Send Bulk Template
                    Note over Email: Use Bulk Template<br/>Items Count<br/>Appraisal Type
                    Payment->>CRM: Publish Bulk Event
                    Note over CRM: Session Details<br/>Items Count<br/>Appraisal Type
                end
            end

            Webhook-->>Stripe: 200 Success
        end
    end
```

## Flow Description

1. **Webhook Reception**
   - Stripe sends webhook event to `/stripe-webhook`
   - Signature is verified using webhook secret

2. **Event Processing**
   - Only processes `checkout.session.completed` events
   - Other events are acknowledged but ignored

3. **Session Type Detection**
   - Checks `client_reference_id` for "bulk_" prefix
   - Routes to appropriate processing flow

4. **Regular Appraisal Processing**
   - Records transaction in Sales spreadsheet
   - Creates pending appraisal entry
   - Sends regular confirmation email template
   - Notifies CRM system via PubSub

5. **Bulk Appraisal Processing**
   - Retrieves bulk session details from GCS
   - Records sale with bulk information
   - Creates pending appraisal with item count
   - Sends bulk confirmation email template
   - Publishes bulk event to CRM

6. **Data Storage**
   - Sales recorded in dedicated spreadsheet
   - Pending appraisals include order type and item count
   - Bulk sessions maintain file metadata in GCS
   - Customer information preserved

7. **Error Handling**
   - Invalid signatures return 400
   - Processing errors are logged
   - Stripe receives appropriate status codes