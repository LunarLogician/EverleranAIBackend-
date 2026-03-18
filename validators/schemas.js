/**
 * Joi Validation Schemas
 * All request body validations for routes
 */

const Joi = require('joi');

// ─── Authentication Schemas ───────────────────────────────────────
exports.registerSchema = Joi.object({
  name: Joi.string().required().trim().min(2).max(100),
  email: Joi.string().required().email().lowercase(),
  password: Joi.string().required().min(6).max(100),
});

exports.loginSchema = Joi.object({
  email: Joi.string().required().email().lowercase(),
  password: Joi.string().required(),
});

exports.verifyEmailSchema = Joi.object({
  email: Joi.string().required().email().lowercase(),
  otp: Joi.string().required().length(6),
});

exports.resetPasswordSchema = Joi.object({
  email: Joi.string().required().email().lowercase(),
  otp: Joi.string().required().length(6),
  newPassword: Joi.string().required().min(6).max(100),
});

// ─── Chat Schemas ───────────────────────────────────────
exports.chatSchema = Joi.object({
  documentId: Joi.string().optional().regex(/^[0-9a-f]{24}$/i), // MongoDB ObjectId
  message: Joi.string().optional().max(5000),
  image: Joi.string().optional().max(5000000), // Base64 data URL
}).or('message', 'image');

// ─── MCQ Schemas ───────────────────────────────────────
exports.mcqGenerateSchema = Joi.object({
  sourceText: Joi.string().required().max(50000),
  title: Joi.string().optional().max(200),
  numQuestions: Joi.number().integer().min(1).max(50).default(5),
});

exports.mcqFromDocumentSchema = Joi.object({
  documentId: Joi.string().required().regex(/^[0-9a-f]{24}$/i),
  numQuestions: Joi.number().integer().min(1).max(50).default(5),
});

exports.mcqSubmitSchema = Joi.object({
  mcqId: Joi.string().required().regex(/^[0-9a-f]{24}$/i),
  answers: Joi.array()
    .items(
      Joi.object({
        questionIndex: Joi.number().integer().min(0).required(),
        selectedAnswer: Joi.string().required(),
      })
    )
    .required(),
});

// ─── Flashcard Schemas ───────────────────────────────────────
exports.flashcardGenerateSchema = Joi.object({
  topic: Joi.string().required().max(200),
  numCards: Joi.number().integer().min(1).max(100).default(10),
});

exports.flashcardFromTextSchema = Joi.object({
  text: Joi.string().required().max(50000),
  numCards: Joi.number().integer().min(1).max(100).default(10),
});

exports.flashcardProgressSchema = Joi.object({
  cardIndex: Joi.number().integer().min(0).required(),
  difficulty: Joi.string().valid('easy', 'medium', 'hard').required(),
});

// ─── Quiz Schemas ───────────────────────────────────────
exports.quizGenerateSchema = Joi.object({
  topic: Joi.string().required().max(200),
  numQuestions: Joi.number().integer().min(1).max(50).default(5),
});

exports.quizFromTextSchema = Joi.object({
  text: Joi.string().required().max(50000),
  numQuestions: Joi.number().integer().min(1).max(50).default(5),
});

exports.quizSubmitSchema = Joi.object({
  quizId: Joi.string().required().regex(/^[0-9a-f]{24}$/i),
  answers: Joi.array()
    .items(
      Joi.object({
        questionIndex: Joi.number().integer().min(0).required(),
        selectedAnswer: Joi.string().required(),
      })
    )
    .required(),
});

// ─── Assignment Schemas ───────────────────────────────────────
exports.assignmentGenerateSchema = Joi.object({
  message: Joi.string().required().max(10000),
});

exports.assignmentRewriteSchema = Joi.object({
  studentName: Joi.string().required().max(100),
  enrollmentId: Joi.string().required().max(50),
  assignment: Joi.string().required().max(10000),
});

// ─── Document Schemas ───────────────────────────────────────
exports.documentUploadSchema = Joi.object({
  title: Joi.string().optional().max(200),
  description: Joi.string().optional().max(1000),
});

exports.documentDeleteSchema = Joi.object({
  documentId: Joi.string().required().regex(/^[0-9a-f]{24}$/i),
});

// ─── Subscription Schemas ───────────────────────────────────────
exports.subscriptionUpgradeSchema = Joi.object({
  plan: Joi.string().required().valid('free', 'basic', 'pro'),
});
