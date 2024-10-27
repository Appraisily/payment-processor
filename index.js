// index.js

const express = require('express');
const { google } = require('googleapis');
const stripeModule = require('stripe');
const sendGridMail = require('@sendgrid/mail');
const { logError } = require('./errorLogger');
const loadConfig = require('./config'); // Importa el config.js actualizado

const app = express();

// Función para inicializar la aplicación con la configuración cargada
async function initializeApp() {
  const config = await loadConfig();

  // Middleware para parsear cuerpos JSON para rutas que no sean webhooks
  app.use(express.json());

  // Stripe requiere el cuerpo raw para verificar firmas de webhooks
  app.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    console.log('Inicio de la ejecución de la función');

    const sig = req.headers['stripe-signature'];
    let event;

    try {
      // Recupera el secreto de webhook basado en el modo (Test o Live)
      // Primero, intenta verificar con el secreto de prueba
      const stripeTest = stripeModule(config.STRIPE_SECRET_KEY_TEST);
      try {
        event = stripeTest.webhooks.constructEvent(req.body, sig, config.STRIPE_WEBHOOK_SECRET_TEST);
        console.log('Evento verificado en modo Test');
      } catch (testErr) {
        console.warn('Fallo al verificar con el secreto de prueba, intentando modo Live:', testErr.message);
        // Si falla, intenta verificar con el secreto en vivo
        const stripeLive = stripeModule(config.STRIPE_SECRET_KEY_LIVE);
        event = stripeLive.webhooks.constructEvent(req.body, sig, config.STRIPE_WEBHOOK_SECRET_LIVE);
        console.log('Evento verificado en modo Live');
      }
    } catch (err) {
      console.error('Fallo en la verificación de la firma del webhook:', err.message);
      await logError(config, {
        timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
        severity: 'Error',
        scriptName: 'stripeWebhookHandler',
        errorCode: 'SignatureVerificationFailed',
        errorMessage: err.message,
        stackTrace: err.stack || '',
        userId: '',
        requestId: req.headers['x-request-id'] || '',
        environment: 'Production',
        endpoint: req.originalUrl || '',
        additionalContext: JSON.stringify({ payload: req.body }),
        resolutionStatus: 'Open',
        assignedTo: config.ASSIGNED_TO,
        chatGPT: config.CHATGPT_CHAT_URL,
        resolutionLink: config.RESOLUTION_LINK,
      });
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Maneja el evento
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      const {
        id: session_id,
        payment_intent: paymentIntentId,
        customer,
        amount_total: amountTotal,
        currency,
        customer_details: { email: customerEmail = '', name: customerName = '' },
        created,
        payment_link, // Extrae el payment_link de la sesión
        metadata, // Si se usa metadata
      } = session;

      const sessionDate = new Date(created * 1000).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

      try {
        // Determina el modo basado en el evento
        const mode = event.livemode ? 'Live' : 'Test';
        console.log(`Procesando evento en modo: ${mode}`);

        // Configura SendGrid con la API Key correspondiente
        if (mode === 'Test') {
          sendGridMail.setApiKey(config.SENDGRID_API_KEY_TEST);
        } else {
          sendGridMail.setApiKey(config.SENDGRID_API_KEY_LIVE);
        }

        // Determina el Template ID de SendGrid
        const sendGridTemplateId = mode === 'Test' ? config.SENDGRID_TEMPLATE_ID_TEST : config.SENDGRID_TEMPLATE_ID_LIVE;

        // Autentica con Google Sheets
        const auth = new google.auth.GoogleAuth({
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const authClient = await auth.getClient();
        google.options({ auth: authClient });

        const sheets = google.sheets({ version: 'v4', auth });

        // Verifica duplicados en la hoja de Ventas
        const salesGetResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: config.SALES_SPREADSHEET_ID,
          range: `${config.SALES_SHEET_NAME}!A:A`,
        });

        const existingSalesSessionIds = salesGetResponse.data.values ? salesGetResponse.data.values.flat() : [];

        if (existingSalesSessionIds.includes(session_id)) {
          console.log(`ID de sesión duplicada detectada en la hoja de Ventas: ${session_id}`);
          await logError(config, {
            timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
            severity: 'Warning',
            scriptName: 'stripeWebhookHandler',
            errorCode: 'DuplicateSession',
            errorMessage: `ID de sesión duplicada detectada en la hoja de Ventas: ${session_id}`,
            stackTrace: '',
            userId: '',
            requestId: req.headers['x-request-id'] || '',
            environment: mode,
            endpoint: req.originalUrl || '',
            additionalContext: JSON.stringify({ session_id, paymentIntentId }),
            resolutionStatus: 'Open',
            assignedTo: config.ASSIGNED_TO,
            chatGPT: config.CHATGPT_CHAT_URL,
            resolutionLink: config.RESOLUTION_LINK,
          });
          return res.status(200).send('OK');
        }

        // Determina el producto comprado basado en el payment_link
        let productDetails = config.PAYMENT_LINKS[payment_link || ''];

        if (!productDetails) {
          console.warn(`No se encontró mapeo de producto para payment_link: ${payment_link}`);
          await logError(config, {
            timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
            severity: 'Warning',
            scriptName: 'stripeWebhookHandler',
            errorCode: 'UnmappedPaymentLink',
            errorMessage: `No se encontró mapeo de producto para payment_link: ${payment_link}`,
            stackTrace: '',
            userId: '',
            requestId: req.headers['x-request-id'] || '',
            environment: mode,
            endpoint: req.originalUrl || '',
            additionalContext: JSON.stringify({ payment_link }),
            resolutionStatus: 'Open',
            assignedTo: config.ASSIGNED_TO,
            chatGPT: config.CHATGPT_CHAT_URL,
            resolutionLink: config.RESOLUTION_LINK,
          });
          // Procede con un nombre de producto por defecto
          productDetails = { productName: 'Unknown Product' };
        }

        const productName = productDetails.productName;

        // Añade a la hoja de Ventas
        await sheets.spreadsheets.values.append({
          spreadsheetId: config.SALES_SPREADSHEET_ID,
          range: `${config.SALES_SHEET_NAME}!A:H`, // Columnas A a H
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          resource: {
            values: [[
              session_id,                         // Columna A: Session ID
              paymentIntentId,                    // Columna B: Payment Intent ID
              customer,                           // Columna C: Customer ID
              customerName,                       // Columna D: Customer Name
              customerEmail,                      // Columna E: Customer Email
              parseFloat((amountTotal / 100).toFixed(2)),  // Columna F: Amount Paid
              sessionDate,                        // Columna G: Session Date
              mode,                               // Columna H: Mode (Test or Live)
            ]],
          },
        });

        console.log('Nueva sesión añadida a la hoja de Ventas');

        // Añade a la hoja de Pending Appraisals
        await sheets.spreadsheets.values.append({
          spreadsheetId: config.PENDING_APPRAISALS_SPREADSHEET_ID,
          range: `${config.PENDING_APPRAISALS_SHEET_NAME}!A:F`, // Columnas A a F
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          resource: {
            values: [[
              new Date(created * 1000).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }), // Columna A: Date
              productName, // Columna B: Product Purchased
              session_id,   // Columna C: Session ID
              customerEmail, // Columna D: Customer Email
              customerName,  // Columna E: Customer Name
              'PENDING INFO', // Columna F: Status
            ]],
          },
        });

        console.log('Nueva sesión añadida a la hoja de Pending Appraisals');

        // **Enviar Email al Cliente Usando el Template Dinámico de SendGrid**
        const currentYear = new Date().getFullYear();

        console.log(`Monto Pagado: ${parseFloat((amountTotal / 100).toFixed(2))} (Tipo: ${typeof parseFloat((amountTotal / 100).toFixed(2))})`);

        const emailContent = {
          to: customerEmail,
          from: config.EMAIL_SENDER, // Email verificado
          templateId: sendGridTemplateId, // Template ID basado en el modo
          dynamic_template_data: {
            customer_name: customerName,
            session_id: session_id,
            current_year: currentYear, // Variable dinámica
          },
        };

        await sendGridMail.send(emailContent);
        console.log(`Email de confirmación enviado a ${customerEmail}`);

        res.status(200).send('OK');
      } catch (err) {
        console.error('Error procesando el webhook:', err);
        // Log detailed SendGrid error
        await logError(config, {
          timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
          severity: 'Error',
          scriptName: 'stripeWebhookHandler',
          errorCode: err.code || 'UnknownError',
          errorMessage: err.message,
          stackTrace: err.stack || '',
          userId: '',
          requestId: req.headers['x-request-id'] || '',
          environment: mode, // Indica Test o Live
          endpoint: req.originalUrl || '',
          additionalContext: JSON.stringify({ 
            session_id, 
            paymentIntentId, 
            sendGridError: err.response ? err.response.body : err.message 
          }),
          resolutionStatus: 'Open',
          assignedTo: config.ASSIGNED_TO,
          chatGPT: config.CHATGPT_CHAT_URL,
          resolutionLink: config.RESOLUTION_LINK,
        });
        res.status(500).send('Internal Server Error');
      }
    });

    // Opcional: Endpoint de Health Check
    app.get('/', (req, res) => {
      res.send('El servicio de Cloud Run está activo y funcionando.');
    });

    // Inicia el servidor
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
      console.log(`Servidor escuchando en el puerto ${PORT}`);
    });
  }

  // Inicializa la aplicación y maneja errores de inicio
  try {
    await initializeApp();
  } catch (error) {
    console.error('Fallo al inicializar la aplicación:', error);
    process.exit(1);
  }
}

// Inicia la inicialización
initializeApp();
