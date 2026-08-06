const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const register = async (req, res) => {
  const { business_name, email, phone, till_number, password } = req.body;

  if (!business_name || !email || !phone || !password) {
    return res.status(400).json({ error: 'Please provide business name, email, phone, and password.' });
  }

  try {
    const existing = await db.query('SELECT * FROM vendors WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email is already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await db.query(
      'INSERT INTO vendors (business_name, email, phone, till_number, password_hash) VALUES (?, ?, ?, ?, ?)',
      [business_name, email, phone, till_number || '', passwordHash]
    );

    // insertId is supported by mysql2 insert results
    const vendorId = result.insertId;

    const token = jwt.sign(
      { vendor_id: vendorId, email, business_name },
      process.env.JWT_SECRET || 'veripesa_development_secret_key_12345',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Vendor registered successfully.',
      token,
      vendor: { vendor_id: vendorId, business_name, email, phone, till_number }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration.' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide email and password.' });
  }

  try {
    const vendors = await db.query('SELECT * FROM vendors WHERE email = ? OR phone = ?', [email, email]);
    if (vendors.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    const vendor = vendors[0];
    const isMatch = await bcrypt.compare(password, vendor.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { vendor_id: vendor.vendor_id, email: vendor.email, business_name: vendor.business_name },
      process.env.JWT_SECRET || 'veripesa_development_secret_key_12345',
      { expiresIn: '24h' }
    );

    res.status(200).json({
      message: 'Login successful.',
      token,
      vendor: {
        vendor_id: vendor.vendor_id,
        business_name: vendor.business_name,
        email: vendor.email,
        phone: vendor.phone,
        till_number: vendor.till_number
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login.' });
  }
};

module.exports = {
  register,
  login
};
