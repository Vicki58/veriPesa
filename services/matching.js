const db = require('../config/db');

const createFraudFlag = async (transactionId, reason, riskLevel) => {
  await db.query(
    'INSERT INTO fraud_flags (transaction_id, flag_reason, risk_level) VALUES (?, ?, ?)',
    [transactionId, reason, riskLevel]
  );
};

const matchTransaction = async (saleId, transactionId, receivedAmount, mpesaRef) => {
  const sales = await db.query('SELECT * FROM sales WHERE sale_id = ?', [saleId]);
  if (sales.length === 0) {
    return 'failed';
  }
  const sale = sales[0];

  // Check duplicate (any other transaction with this receipt number)
  const duplicates = await db.query(
    'SELECT * FROM transactions WHERE mpesa_ref = ? AND transaction_id != ?',
    [mpesaRef, transactionId]
  );
  
  if (duplicates.length > 0) {
    await createFraudFlag(transactionId, 'Duplicate transaction ID', 'high');
    await db.query("UPDATE sales SET status='flagged' WHERE sale_id=?", [saleId]);
    return 'flagged';
  }

  // Check amount match
  const expected = parseFloat(sale.expected_amount);
  const received = parseFloat(receivedAmount);
  if (received !== expected) {
    const risk = getRiskScore(expected, received, false);
    await createFraudFlag(transactionId, `Amount mismatch: expected ${expected}, received ${received}`, risk);
    await db.query("UPDATE sales SET status='flagged' WHERE sale_id=?", [saleId]);
    return 'flagged';
  }

  // All good
  await db.query("UPDATE sales SET status='verified' WHERE sale_id=?", [saleId]);
  await db.query("UPDATE transactions SET matched=true WHERE transaction_id=?", [transactionId]);
  return 'verified';
};

const getRiskScore = (expectedAmount, receivedAmount, isDuplicate) => {
  if (isDuplicate) return 'high';
  const diff = Math.abs(expectedAmount - receivedAmount) / expectedAmount;
  if (diff > 0.5) return 'high';
  if (diff > 0.1) return 'medium';
  return 'low';
};

module.exports = {
  matchTransaction,
  getRiskScore,
  createFraudFlag
};
