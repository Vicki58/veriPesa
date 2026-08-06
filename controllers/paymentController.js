const db = require('../config/db');
const daraja = require('../services/daraja');

const initiateStkPush = async (req, res) => {
  const { sale_id, phone, amount } = req.body;
  const vendorId = req.vendor.vendor_id;

  if (!sale_id || !phone || !amount) {
    return res.status(400).json({ error: 'Please provide sale_id, phone, and amount.' });
  }

  try {
    // 1. Verify sale exists and belongs to vendor
    const sales = await db.query(
      'SELECT * FROM sales WHERE sale_id = ? AND vendor_id = ?',
      [sale_id, vendorId]
    );

    if (sales.length === 0) {
      return res.status(404).json({ error: 'Sale record not found.' });
    }

    const sale = sales[0];

    // 2. Initiate STK Push via Daraja API
    // We pass the sale_id as the Account Reference
    const darajaResponse = await daraja.initiateStkPush(phone, amount, `SaleRef-${sale_id}`);

    if (darajaResponse.ResponseCode === '0') {
      const checkoutId = darajaResponse.CheckoutRequestID;
      
      // Update sale record with checkout ID
      await db.query(
        'UPDATE sales SET checkout_request_id = ? WHERE sale_id = ?',
        [checkoutId, sale_id]
      );

      res.status(200).json({
        message: 'STK Push initiated successfully.',
        checkout_request_id: checkoutId,
        daraja_response: darajaResponse
      });
    } else {
      res.status(500).json({
        error: 'Failed to initiate STK Push.',
        daraja_response: darajaResponse
      });
    }
  } catch (error) {
    console.error('STK Push Error:', error);
    res.status(500).json({ error: error.message || 'Server error while initiating STK Push.' });
  }
};

const pollStatus = async (req, res) => {
  const { checkoutId } = req.params;
  const vendorId = req.vendor.vendor_id;

  try {
    // Join sales with transactions to return the full receipt details when verified
    const results = await db.query(
      `SELECT s.sale_id, s.status, s.expected_amount, 
              t.mpesa_ref, t.received_amount, t.sender_phone, t.sender_name, t.timestamp
       FROM sales s
       LEFT JOIN transactions t ON s.sale_id = t.sale_id
       WHERE s.checkout_request_id = ? AND s.vendor_id = ?`,
      [checkoutId, vendorId]
    );

    if (results.length === 0) {
      return res.status(404).json({ error: 'Checkout session not found.' });
    }

    res.status(200).json(results[0]);
  } catch (error) {
    console.error('Polling Status Error:', error);
    res.status(500).json({ error: 'Server error while checking payment status.' });
  }
};

const simulateC2B = async (req, res) => {
  const { phone, amount, billRef } = req.body;

  if (!phone || !amount || !billRef) {
    return res.status(400).json({ error: 'Please provide phone, amount, and billRef.' });
  }

  try {
    const result = await daraja.simulateC2BPayment(phone, amount, billRef);
    res.status(200).json({
      message: 'C2B payment simulation triggered successfully.',
      result
    });
  } catch (error) {
    console.error('C2B simulation error:', error);
    res.status(500).json({ error: error.message || 'Simulation failed.' });
  }
};

module.exports = {
  initiateStkPush,
  pollStatus,
  simulateC2B
};

