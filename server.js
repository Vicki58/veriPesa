const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const daraja = require('./services/daraja');

const authRoutes = require('./routes/auth');
const salesRoutes = require('./routes/sales');
const paymentRoutes = require('./routes/payments');
const callbackRoutes = require('./routes/callbacks');
const transactionRoutes = require('./routes/transactions');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

// Standard middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/callback', callbackRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/reports', reportRoutes);

// Fallback to index.html for unknown routes to support client routing if needed
app.get('/*splat', (req, res, next) => {
  // If request is for an API, don't serve index.html, let it 404 or pass
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 VeriPesa Server is running on port ${PORT}`);
  console.log(`🔗 Local testing URL: http://localhost:${PORT}`);
  
  // Register C2B URLs on server start (useful for C2B confirm/validate setup)
  try {
    await daraja.registerC2BUrls();
  } catch (error) {
    console.error('Failed to auto-register C2B URLs on startup:', error.message);
  }
});
