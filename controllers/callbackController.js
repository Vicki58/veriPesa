const db = require('../config/db');
const matching = require('../services/matching');

// Helper to extract values from CallBackMetadata array
const getMetadataValue = (items, name) => {
  const item = items.find(i => i.Name === name);
  return item ? item.Value : null;
};

const handleStkCallback = async (req, res) => {
  console.log('Received STK Push Callback:', JSON.stringify(req.body, null, 2));

  try {
    const callbackData = req.body?.Body?.stkCallback;
    if (!callbackData) {
      return res.status(400).json({ error: 'Invalid callback payload' });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc } = callbackData;

    // 1. Find the corresponding sale record
    const sales = await db.query(
      'SELECT * FROM sales WHERE checkout_request_id = ?',
      [CheckoutRequestID]
    );

    if (sales.length === 0) {
      console.warn(`[STK Callback] No sale record found for CheckoutRequestID: ${CheckoutRequestID}`);
      // Send success response to Safaricom to avoid infinite retries
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const sale = sales[0];
    const saleId = sale.sale_id;

    // 2. Handle failure codes (ResultCode != 0)
    if (ResultCode !== 0) {
      console.log(`[STK Callback] Payment failed/cancelled for Sale ID ${saleId}. Code: ${ResultCode}, Desc: ${ResultDesc}`);
      await db.query(
        "UPDATE sales SET status = 'failed' WHERE sale_id = ?",
        [saleId]
      );
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    // 3. Process success details from CallbackMetadata
    const metadataItems = callbackData.CallbackMetadata?.Item || [];
    const amount = getMetadataValue(metadataItems, 'Amount');
    const mpesaRef = getMetadataValue(metadataItems, 'MpesaReceiptNumber');
    const phone = getMetadataValue(metadataItems, 'PhoneNumber');

    // 4. Insert transaction record
    const result = await db.query(
      `INSERT INTO transactions (sale_id, mpesa_ref, received_amount, sender_phone, sender_name, transaction_type, matched)
       VALUES (?, ?, ?, ?, ?, 'stk_push', false)`,
      [saleId, mpesaRef, amount, phone ? String(phone) : null, sale.customer_name || null]
    );

    const transactionId = result.insertId;

    // 5. Invoke matching engine
    const matchStatus = await matching.matchTransaction(saleId, transactionId, amount, mpesaRef);
    console.log(`[STK Callback] Transaction matched. Status: ${matchStatus}`);

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('Error handling STK Callback:', error);
    // Return 200 to Safaricom so they stop retrying, but log it internally
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
};

const handleC2BValidate = async (req, res) => {
  console.log('Received C2B Validation Callback:', req.body);
  // Accept all validation checks for the sandbox till code
  res.status(200).json({
    ResultCode: 0,
    ResultDesc: 'Accepted'
  });
};

const handleC2BConfirm = async (req, res) => {
  console.log('Received C2B Confirmation Callback:', req.body);

  const {
    TransID,
    TransTime,
    TransAmount,
    BillRefNumber,
    MSISDN,
    FirstName,
    LastName
  } = req.body;

  try {
    const senderName = `${FirstName || ''} ${LastName || ''}`.trim() || null;
    const phone = MSISDN ? String(MSISDN) : null;
    const amount = parseFloat(TransAmount);
    
    // Clean and attempt to find a matching pending sale using BillRefNumber
    // Vendors might tell customers to enter the "Sale ID" as the account number
    let matchedSaleId = null;
    const cleanRef = BillRefNumber ? BillRefNumber.trim() : '';
    
    // Parse numeric characters from reference to see if it represents a valid sale ID
    const possibleSaleId = parseInt(cleanRef.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(possibleSaleId)) {
      const sales = await db.query(
        "SELECT * FROM sales WHERE sale_id = ? AND status = 'pending'",
        [possibleSaleId]
      );
      if (sales.length > 0) {
        matchedSaleId = sales[0].sale_id;
        console.log(`[C2B Callback] Auto-matched BillRefNumber "${cleanRef}" to Sale ID ${matchedSaleId}`);
      }
    }

    // If still not matched, let's try matching on phone number & amount for pending sales created recently
    if (!matchedSaleId && phone) {
      const formattedPhone = phone.endsWith(phone.slice(-9)) ? phone.slice(-9) : phone;
      const salesByPhone = await db.query(
        `SELECT * FROM sales 
         WHERE (customer_phone LIKE ? OR customer_phone LIKE ?)
           AND expected_amount = ? 
           AND status = 'pending' 
         ORDER BY created_at DESC LIMIT 1`,
        [`%${formattedPhone}`, `%${formattedPhone}`, amount]
      );
      if (salesByPhone.length > 0) {
        matchedSaleId = salesByPhone[0].sale_id;
        console.log(`[C2B Callback] Auto-matched MSISDN ${phone} & amount ${amount} to Sale ID ${matchedSaleId}`);
      }
    }

    // Insert transaction
    const result = await db.query(
      `INSERT INTO transactions (sale_id, mpesa_ref, received_amount, sender_phone, sender_name, transaction_type, matched)
       VALUES (?, ?, ?, ?, ?, 'c2b', false)`,
      [matchedSaleId, TransID, amount, phone, senderName]
    );

    const transactionId = result.insertId;

    // Run matching rules if sale_id was linked
    if (matchedSaleId) {
      const matchStatus = await matching.matchTransaction(matchedSaleId, transactionId, amount, TransID);
      console.log(`[C2B Callback] Auto-matching completed: ${matchStatus}`);
    } else {
      console.log(`[C2B Callback] Transaction saved as UNMATCHED. Reference: ${TransID}`);
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('Error handling C2B Confirmation Callback:', error);
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
};

module.exports = {
  handleStkCallback,
  handleC2BValidate,
  handleC2BConfirm
};
