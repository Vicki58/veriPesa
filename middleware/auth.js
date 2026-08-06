const jwt = require('jsonwebtoken');
require('dotenv').config();

module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Access denied. Invalid token format.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'veripesa_development_secret_key_12345');
    req.vendor = decoded; // { vendor_id, email, business_name }
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid token.' });
  }
};
