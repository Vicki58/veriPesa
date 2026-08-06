const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');

router.post('/stk-push', auth, paymentController.initiateStkPush);
router.get('/status/:checkoutId', auth, paymentController.pollStatus);
router.post('/simulate-c2b', auth, paymentController.simulateC2B);

module.exports = router;

