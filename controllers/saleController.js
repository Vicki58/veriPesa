const db = require('../config/db');

const createSale = async (req, res) => {
  const { customer_phone, customer_name, expected_amount } = req.body;
  const vendorId = req.vendor.vendor_id;

  if (!customer_phone || !expected_amount) {
    return res.status(400).json({ error: 'Please provide customer phone number and expected amount.' });
  }

  try {
    const result = await db.query(
      'INSERT INTO sales (vendor_id, customer_phone, customer_name, expected_amount, status) VALUES (?, ?, ?, ?, ?)',
      [vendorId, customer_phone, customer_name || '', expected_amount, 'pending']
    );

    res.status(201).json({
      message: 'Sale record created successfully.',
      sale: {
        sale_id: result.insertId,
        vendor_id: vendorId,
        customer_phone,
        customer_name: customer_name || '',
        expected_amount,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Error creating sale:', error);
    res.status(500).json({ error: 'Server error while creating sale.' });
  }
};

const getSales = async (req, res) => {
  const vendorId = req.vendor.vendor_id;

  try {
    const sales = await db.query(
      'SELECT * FROM sales WHERE vendor_id = ? ORDER BY created_at DESC',
      [vendorId]
    );
    res.status(200).json(sales);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Server error while fetching sales.' });
  }
};

const getSaleById = async (req, res) => {
  const { id } = req.params;
  const vendorId = req.vendor.vendor_id;

  try {
    const sales = await db.query(
      'SELECT * FROM sales WHERE sale_id = ? AND vendor_id = ?',
      [id, vendorId]
    );

    if (sales.length === 0) {
      return res.status(404).json({ error: 'Sale record not found.' });
    }

    res.status(200).json(sales[0]);
  } catch (error) {
    console.error('Error fetching sale:', error);
    res.status(500).json({ error: 'Server error while fetching sale.' });
  }
};

module.exports = {
  createSale,
  getSales,
  getSaleById
};
