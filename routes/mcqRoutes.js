const express = require('express');
const multer = require('multer');
const router = express.Router();
const mcqController = require('../controllers/mcqController');
const auth = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const {
  mcqGenerateSchema,
  mcqFromDocumentSchema,
  mcqSubmitSchema,
} = require('../validators/schemas');

// File upload configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// All routes require authentication
router.use(auth);

// Generate MCQs from source text
router.post('/generate', validateRequest(mcqGenerateSchema), mcqController.generateMCQs);

// Generate MCQs from document
router.post('/generate-from-document', validateRequest(mcqFromDocumentSchema), mcqController.generateMCQsFromDocument);

// Generate MCQs from uploaded file
router.post('/generate-from-file', upload.single('file'), mcqController.generateMCQsFromFile);

// Submit answers and get results
router.post('/submit', validateRequest(mcqSubmitSchema), mcqController.submitAnswers);

// Get all MCQs for user
router.get('/list', mcqController.getMCQs);

// Get single MCQ with questions
router.get('/:mcqId', mcqController.getMCQ);

// Get MCQ attempt history
router.get('/:mcqId/history', mcqController.getMCQHistory);

// Delete MCQ
router.delete('/:mcqId', mcqController.deleteMCQ);

module.exports = router;
