const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const auth = require('../middleware/auth');

router.get('/', auth, transactionController.getTransactions);
router.get('/disputes', auth, transactionController.getDisputes);
router.get('/:id', auth, transactionController.getTransactionById);
router.patch('/disputes/:id/resolve', auth, transactionController.resolveDispute);
router.post('/claim', auth, transactionController.claimTransaction);

module.exports = router;
