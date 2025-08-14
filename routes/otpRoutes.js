const express = require('express');
const router = express.Router();
const otpController = require('../controllers/otpController');

// Middleware for request validation
const validateGenerateOTP = (req, res, next) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email is required'
    });
  }
  
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address'
    });
  }
  
  // Normalize email
  req.body.email = email.toLowerCase().trim();
  next();
};

const validateVerifyOTP = (req, res, next) => {
  const { email, otp } = req.body;
  
  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: 'Email and OTP are required'
    });
  }
  
  // Validate OTP format (6 digits)
  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({
      success: false,
      message: 'OTP must be exactly 6 digits'
    });
  }
  
  // Normalize email
  req.body.email = email.toLowerCase().trim();
  next();
};

// Request logging middleware
const logRequest = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${ip}`);
  next();
};

// Routes

/**
 * @route   POST /api/otp/generate
 * @desc    Generate and send OTP via email
 * @access  Public (but rate limited)
 * @body    { email: string }
 */
router.post('/generate', logRequest, validateGenerateOTP, otpController.generateOTP);

/**
 * @route   POST /api/otp/verify
 * @desc    Verify OTP code
 * @access  Public
 * @body    { email: string, otp: string }
 */
router.post('/verify', logRequest, validateVerifyOTP, otpController.verifyOTP);

/**
 * @route   GET /api/otp/status/:email
 * @desc    Get OTP status for debugging (dev only)
 * @access  Public
 * @params  email: string
 */
router.get('/status/:email', logRequest, (req, res, next) => {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({
      success: false,
      message: 'Endpoint not available in production'
    });
  }
  next();
}, otpController.getOTPStatus);

/**
 * @route   GET /api/otp/health
 * @desc    Health check for OTP service
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Houston 100 OTP Service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    endpoints: {
      generate: 'POST /api/otp/generate',
      verify: 'POST /api/otp/verify',
      status: 'GET /api/otp/status/:email (dev only)'
    },
    airtable: {
      connected: true,
      baseId: 'appaOZzwTAultlr23',
      table: 'OTP_Codes'
    }
  });
});

/**
 * @route   POST /api/otp/test
 * @desc    Test endpoint for development
 * @access  Public (dev only)
 */
router.post('/test', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({
      success: false,
      message: 'Test endpoint not available in production'
    });
  }
  
  res.json({
    success: true,
    message: 'Houston 100 OTP API is working!',
    timestamp: new Date().toISOString(),
    requestBody: req.body,
    headers: {
      userAgent: req.headers['user-agent'],
      origin: req.headers.origin
    }
  });
});

// Error handling middleware for this router
router.use((error, req, res, next) => {
  console.error('OTP Route Error:', error);
  
  // Handle specific error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      details: error.message
    });
  }
  
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
      retryAfter: error.retryAfter
    });
  }
  
  // Generic error response
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler for unknown OTP routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'OTP endpoint not found',
    availableEndpoints: [
      'POST /api/otp/generate',
      'POST /api/otp/verify',
      'GET /api/otp/health'
    ]
  });
});

module.exports = router;
