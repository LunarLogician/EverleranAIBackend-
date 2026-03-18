const express = require('express');
const multer = require('multer');
const router = express.Router();
const quizController = require('../controllers/quizController');
const authMiddleware = require('../middleware/auth');
const requirePlan = require('../middleware/requirePlan');
const validateRequest = require('../middleware/validateRequest');
const {
  quizGenerateSchema,
  quizFromTextSchema,
  quizSubmitSchema,
} = require('../validators/schemas');

// File upload configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(authMiddleware);

// All quiz generation requires pro plan
router.post('/generate', requirePlan('pro'), validateRequest(quizGenerateSchema), quizController.generateQuiz);
router.post('/generate-from-text', requirePlan('pro'), validateRequest(quizFromTextSchema), quizController.generateQuizFromText);
router.post('/generate-from-file', requirePlan('pro'), upload.single('file'), quizController.generateQuizFromFile);

// Read-only quiz routes — available to all authenticated users
router.get('/', quizController.getUserQuizzes);
router.get('/:quizId', quizController.getQuizDetails);
router.post('/:quizId/submit', validateRequest(quizSubmitSchema), quizController.submitQuizAttempt);
router.delete('/:quizId', quizController.deleteQuiz);

module.exports = router;
