const express = require('express');
const router = express.Router();
const callbackController = require('../controllers/callbackController');

router.post('/stk', callbackController.handleStkCallback);
router.post('/c2b/validate', callbackController.handleC2BValidate);
router.post('/c2b/confirm', callbackController.handleC2BConfirm);

module.exports = router;
