const express = require('express');
const multer = require('multer');
const { generateAssignment, rewriteAssignment } = require('../controllers/assignmentController');
const auth = require('../middleware/auth');
const requirePlan = require('../middleware/requirePlan');
const validateRequest = require('../middleware/validateRequest');
const {
  assignmentGenerateSchema,
  assignmentRewriteSchema,
} = require('../validators/schemas');

const router = express.Router();

// Simpler multer configuration that accepts all file types
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(auth);

// POST /api/assignments/generate - requires basic plan
router.post('/generate', requirePlan('basic'), upload.single('file'), validateRequest(assignmentGenerateSchema), generateAssignment);

// POST /api/assignments/rewrite - requires basic plan
router.post('/rewrite', requirePlan('basic'), upload.single('file'), validateRequest(assignmentRewriteSchema), rewriteAssignment);

module.exports = router;