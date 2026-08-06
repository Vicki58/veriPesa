const db = require('../config/db');
const matching = require('../services/matching');

const getTransactions = async (req, res) => {
  const vendorId = req.vendor.vendor_id;

  try {
    // Matched transactions belonging to the vendor
    const matched = await db.query(
      `SELECT t.*, s.customer_name, s.customer_phone, s.expected_amount 
       FROM transactions t 
       JOIN sales s ON t.sale_id = s.sale_id 
       WHERE s.vendor_id = ? 
       ORDER BY t.timestamp DESC`,
      [vendorId]
    );

    // Unmatched C2B transactions (available to claim)
    const unmatched = await db.query(
      `SELECT t.*, NULL as customer_name, NULL as customer_phone, NULL as expected_amount 
       FROM transactions t 
       WHERE t.sale_id IS NULL 
       ORDER BY t.timestamp DESC LIMIT 50`
    );

    res.status(200).json({ matched, unmatched });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Server error while fetching transactions.' });
  }
};

const getTransactionById = async (req, res) => {
  const { id } = req.params;
  const vendorId = req.vendor.vendor_id;

  try {
    const txs = await db.query(
      `SELECT t.*, s.customer_name, s.customer_phone, s.expected_amount, s.vendor_id 
       FROM transactions t 
       LEFT JOIN sales s ON t.sale_id = s.sale_id 
       WHERE t.transaction_id = ?`,
      [id]
    );

    if (txs.length === 0) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    const tx = txs[0];

    // Authorize: If transaction is matched to a sale, ensure it belongs to the vendor
    if (tx.sale_id && tx.vendor_id !== vendorId) {
      return res.status(403).json({ error: 'Unauthorized access to this transaction.' });
    }

    // Get fraud flags and audit log details
    const flags = await db.query(
      'SELECT * FROM fraud_flags WHERE transaction_id = ? ORDER BY created_at DESC',
      [id]
    );

    res.status(200).json({ transaction: tx, flags });
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    res.status(500).json({ error: 'Server error while fetching transaction details.' });
  }
};

const getDisputes = async (req, res) => {
  const vendorId = req.vendor.vendor_id;

  try {
    const disputes = await db.query(
      `SELECT t.transaction_id, t.mpesa_ref, t.received_amount, t.sender_phone, t.sender_name, t.transaction_type, t.timestamp,
              f.flag_id, f.flag_reason, f.risk_level, f.resolved, f.created_at as flag_created_at,
              s.sale_id, s.customer_name, s.expected_amount 
       FROM fraud_flags f
       JOIN transactions t ON f.transaction_id = t.transaction_id
       JOIN sales s ON t.sale_id = s.sale_id
       WHERE s.vendor_id = ? AND f.resolved = false
       ORDER BY f.created_at DESC`,
      [vendorId]
    );

    res.status(200).json(disputes);
  } catch (error) {
    console.error('Error fetching disputes:', error);
    res.status(500).json({ error: 'Server error while fetching disputes.' });
  }
};

const resolveDispute = async (req, res) => {
  const { id } = req.params; // flag_id
  const { resolution_note, action } = req.body; // action: 'approve' (force verify) or 'reject' (mark failed)
  const vendorId = req.vendor.vendor_id;
  const email = req.vendor.email;

  if (!action || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Please provide a valid action: approve or reject.' });
  }

  try {
    // Check if the flag belongs to a transaction on the vendor's sales
    const flags = await db.query(
      `SELECT f.*, t.sale_id, t.transaction_id, s.vendor_id 
       FROM fraud_flags f
       JOIN transactions t ON f.transaction_id = t.transaction_id
       JOIN sales s ON t.sale_id = s.sale_id
       WHERE f.flag_id = ? AND s.vendor_id = ?`,
      [id, vendorId]
    );

    if (flags.length === 0) {
      return res.status(404).json({ error: 'Dispute flag not found or unauthorized.' });
    }

    const flag = flags[0];

    // 1. Mark flag resolved
    await db.query(
      `UPDATE fraud_flags 
       SET resolved = true, resolved_by = ?, resolution_note = ? 
       WHERE flag_id = ?`,
      [email, resolution_note || `Resolved by vendor (Action: ${action})`, id]
    );

    // 2. Perform the vendor's manual action
    if (action === 'approve') {
      await db.query("UPDATE sales SET status='verified' WHERE sale_id=?", [flag.sale_id]);
      await db.query("UPDATE transactions SET matched=true WHERE transaction_id=?", [flag.transaction_id]);
    } else {
      await db.query("UPDATE sales SET status='failed' WHERE sale_id=?", [flag.sale_id]);
      await db.query("UPDATE transactions SET matched=false WHERE transaction_id=?", [flag.transaction_id]);
    }

    res.status(200).json({ message: 'Dispute resolved successfully.' });
  } catch (error) {
    console.error('Error resolving dispute:', error);
    res.status(500).json({ error: 'Server error while resolving dispute.' });
  }
};

const claimTransaction = async (req, res) => {
  const { sale_id, transaction_id } = req.body;
  const vendorId = req.vendor.vendor_id;

  if (!sale_id || !transaction_id) {
    return res.status(400).json({ error: 'Please provide sale_id and transaction_id.' });
  }

  try {
    // 1. Verify sale belongs to vendor and is pending
    const sales = await db.query(
      "SELECT * FROM sales WHERE sale_id = ? AND vendor_id = ? AND status = 'pending'",
      [sale_id, vendorId]
    );

    if (sales.length === 0) {
      return res.status(404).json({ error: 'Pending sale not found or unauthorized.' });
    }

    // 2. Verify transaction is unclaimed (unmatched and sale_id IS NULL)
    const txs = await db.query(
      'SELECT * FROM transactions WHERE transaction_id = ? AND sale_id IS NULL',
      [transaction_id]
    );

    if (txs.length === 0) {
      return res.status(404).json({ error: 'Unclaimed transaction not found.' });
    }

    const tx = txs[0];

    // 3. Link transaction to sale
    await db.query(
      'UPDATE transactions SET sale_id = ? WHERE transaction_id = ?',
      [sale_id, transaction_id]
    );

    // 4. Run matching logic
    const matchStatus = await matching.matchTransaction(sale_id, transaction_id, tx.received_amount, tx.mpesa_ref);

    res.status(200).json({
      message: 'Transaction linked successfully.',
      match_status: matchStatus
    });
  } catch (error) {
    console.error('Error claiming transaction:', error);
    res.status(500).json({ error: 'Server error while linking transaction.' });
  }
};

module.exports = {
  getTransactions,
  getTransactionById,
  getDisputes,
  resolveDispute,
  claimTransaction
};
