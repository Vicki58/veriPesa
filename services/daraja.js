const axios = require('axios');
require('dotenv').config();

let cachedToken = null;
let tokenExpiry = 0;

// Determine if we are running in Mock Mode
const isMockMode = !process.env.CONSUMER_KEY || 
                     process.env.CONSUMER_KEY === '' || 
                     process.env.CONSUMER_KEY.startsWith('placeholder');

if (isMockMode) {
  console.log('⚠️  VeriPesa is running in MOCK MODE for Daraja API calls. Real payments will be simulated locally.');
}

const getToken = async () => {
  if (isMockMode) {
    return 'mock_access_token';
  }

  const now = Date.now();
  if (cachedToken && tokenExpiry > now + 60000) {
    return cachedToken;
  }

  const consumerKey = process.env.CONSUMER_KEY;
  const consumerSecret = process.env.CONSUMER_SECRET;
  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  try {
    const response = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: {
        Authorization: `Basic ${credentials}`
      }
    });

    cachedToken = response.data.access_token;
    const expiresInMs = parseInt(response.data.expires_in) * 1000;
    tokenExpiry = Date.now() + expiresInMs;
    return cachedToken;
  } catch (error) {
    console.error('Error fetching Daraja access token:', error.response?.data || error.message);
    throw new Error('Failed to retrieve Daraja access token. Ensure credentials are correct.');
  }
};

const initiateStkPush = async (phone, amount, accountRef) => {
  // Format phone to 254...
  let formattedPhone = phone.trim();
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '254' + formattedPhone.slice(1);
  } else if (formattedPhone.startsWith('+')) {
    formattedPhone = formattedPhone.slice(1);
  }
  if (!formattedPhone.startsWith('254')) {
    formattedPhone = '254' + formattedPhone;
  }

  if (isMockMode) {
    const mockCheckoutId = `ws_CO_mock_${Math.random().toString(36).substring(2, 10)}`;
    const mockMerchantId = `mock_mid_${Math.random().toString(36).substring(2, 10)}`;
    
    // Simulate Daraja response
    const mockResponse = {
      MerchantRequestID: mockMerchantId,
      CheckoutRequestID: mockCheckoutId,
      ResponseCode: '0',
      ResponseDescription: 'Success. Request accepted for processing (Mock Mode).',
      CustomerMessage: 'Success. Request accepted for processing.'
    };

    // Auto-trigger callback simulation in background after 4 seconds
    setTimeout(async () => {
      try {
        const port = process.env.PORT || 3000;
        const mockCallbackPayload = {
          Body: {
            stkCallback: {
              MerchantRequestID: mockMerchantId,
              CheckoutRequestID: mockCheckoutId,
              ResultCode: 0,
              ResultDesc: 'The service request is processed successfully.',
              CallbackMetadata: {
                Item: [
                  { Name: 'Amount', Value: parseFloat(amount) },
                  { Name: 'MpesaReceiptNumber', Value: 'MP' + Math.random().toString(36).substring(2, 10).toUpperCase() },
                  { Name: 'Balance', Value: 0 },
                  { Name: 'TransactionDate', Value: parseInt(new Date().toISOString().replace(/[-T:.Z]/g,'').slice(0,14)) },
                  { Name: 'PhoneNumber', Value: parseInt(formattedPhone) }
                ]
              }
            }
          }
        };

        await axios.post(`http://localhost:${port}/api/callback/stk`, mockCallbackPayload);
        console.log(`[Mock Callback] Successfully simulated payment callback for CheckoutRequestID: ${mockCheckoutId}`);
      } catch (err) {
        console.error('[Mock Callback Error] Could not deliver mock callback:', err.message);
      }
    }, 4000);

    return mockResponse;
  }

  const token = await getToken();
  const shortcode = process.env.SHORTCODE || '174379';
  const passkey = process.env.PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
  const ngrokUrl = process.env.NGROK_URL || 'http://localhost:3000';
  const callbackUrl = `${ngrokUrl}/api/callback/stk`;

  try {
    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: parseFloat(amount),
        PartyA: formattedPhone,
        PartyB: shortcode,
        PhoneNumber: formattedPhone,
        CallBackURL: callbackUrl,
        AccountReference: accountRef,
        TransactionDesc: 'VeriPesa Payment'
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error initiating STK Push:', error.response?.data || error.message);
    throw new Error(error.response?.data?.errorMessage || 'Failed to initiate STK Push via Daraja API.');
  }
};

const registerC2BUrls = async () => {
  if (isMockMode) {
    console.log('[Mock Mode] Skipping C2B URL registration.');
    return { ResponseDescription: 'C2B URL registration skipped in Mock Mode.' };
  }

  try {
    const token = await getToken();
    const shortcode = process.env.SHORTCODE || '174379';
    const ngrokUrl = process.env.NGROK_URL || 'http://localhost:3000';

    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl',
      {
        ShortCode: shortcode,
        ResponseType: 'Completed',
        ConfirmationURL: `${ngrokUrl}/api/callback/c2b/confirm`,
        ValidationURL: `${ngrokUrl}/api/callback/c2b/validate`
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    console.log('C2B URLs registered successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error registering C2B URLs:', error.response?.data || error.message);
  }
};

const simulateC2BPayment = async (phone, amount, billRef) => {
  // Format phone to 254...
  let formattedPhone = phone.trim();
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '254' + formattedPhone.slice(1);
  } else if (formattedPhone.startsWith('+')) {
    formattedPhone = formattedPhone.slice(1);
  }
  if (!formattedPhone.startsWith('254')) {
    formattedPhone = '254' + formattedPhone;
  }

  if (isMockMode) {
    const mpesaRef = 'MP' + Math.random().toString(36).substring(2, 10).toUpperCase();
    
    // Auto-trigger C2B confirmation callback locally
    setTimeout(async () => {
      try {
        const port = process.env.PORT || 3000;
        const mockC2BPayload = {
          TransactionType: 'Pay Bill',
          TransID: mpesaRef,
          TransTime: new Date().toISOString().replace(/[-T:.Z]/g,'').slice(0,14),
          TransAmount: parseFloat(amount).toFixed(2),
          BusinessShortCode: '174379',
          BillRefNumber: billRef,
          InvoiceNumber: '',
          OrgAccountBalance: '5000.00',
          ThirdPartyTransID: '',
          MSISDN: formattedPhone,
          FirstName: 'TEST',
          LastName: 'CUSTOMER'
        };

        await axios.post(`http://localhost:${port}/api/callback/c2b/confirm`, mockC2BPayload);
        console.log(`[Mock C2B Callback] Successfully simulated C2B Confirmation for ref: ${billRef}`);
      } catch (err) {
        console.error('[Mock C2B Callback Error] Could not deliver mock callback:', err.message);
      }
    }, 2000);

    return {
      OriginatorCoversationID: `mock_c2b_cov_${Date.now()}`,
      ResponseCode: '0',
      ResponseDescription: 'Accept the service request successfully (Mock Mode).'
    };
  }

  const token = await getToken();
  const shortcode = process.env.SHORTCODE || '174379';

  try {
    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/c2b/v1/simulate',
      {
        ShortCode: shortcode,
        CommandID: 'CustomerPayBillOnline',
        Amount: amount,
        Msisdn: formattedPhone,
        BillRefNumber: billRef
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error simulating C2B payment:', error.response?.data || error.message);
    throw new Error(error.response?.data?.errorMessage || 'Failed to simulate C2B payment.');
  }
};

module.exports = {
  isMockMode,
  getToken,
  initiateStkPush,
  registerC2BUrls,
  simulateC2BPayment
};
