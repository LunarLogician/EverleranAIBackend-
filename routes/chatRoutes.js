const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const { chatSchema } = require('../validators/schemas');

router.use(authMiddleware);

// Direct chat endpoint (simplified ChatGPT-like interface)
router.post('/', validateRequest(chatSchema), chatController.directChat);

// Chat history endpoints (original flow)
// NOTE: Place specific routes BEFORE dynamic routes to prevent /:chatId from catching /history
router.get('/count', chatController.getChatCount);
router.post('/create', chatController.createChat);
router.get('/history', chatController.getHistory);
router.get('/:chatId', chatController.getChatHistory);
router.post('/:chatId/message', chatController.sendMessage);
router.get('/:documentId/summary', chatController.generateSummary);

module.exports = router;
