const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const authMiddleware = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const { subscriptionUpgradeSchema } = require('../validators/schemas');

// Public — no auth needed
router.get('/plans', subscriptionController.getPlans);

// Webhook — called by Lemon Squeezy servers (no user JWT)
router.post('/webhook', subscriptionController.paymentWebhook);

router.use(authMiddleware);

router.get('/', subscriptionController.getUserSubscription);
router.post('/checkout', subscriptionController.createCheckout);
router.post('/upgrade', validateRequest(subscriptionUpgradeSchema), subscriptionController.upgradeSubscription);
router.post('/cancel', subscriptionController.cancelSubscription);

module.exports = router;
