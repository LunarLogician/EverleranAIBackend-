const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const generateToken = require('../utils/generateToken');
const validateRequest = require('../middleware/validateRequest');
const {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resetPasswordSchema,
} = require('../validators/schemas');

// Public routes
router.post('/register', validateRequest(registerSchema), authController.register);
router.post('/verify-email', validateRequest(verifyEmailSchema), authController.verifyEmail);
router.post('/resend-verification-otp', authController.resendVerificationOtp);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', validateRequest(resetPasswordSchema), authController.resetPassword);
router.post('/login', validateRequest(loginSchema), authController.login);

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
  // Generate JWT token after successful Google auth
  const token = generateToken(req.user._id);
  
  // Redirect to frontend with token
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  res.redirect(`${frontendUrl}/auth/callback?token=${token}&userId=${req.user._id}`);
});

// Protected routes
router.get('/me', authMiddleware, authController.getCurrentUser);

module.exports = router;
