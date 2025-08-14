const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Security Middleware
app.use(helmet());

// CORS Configuration for Houston 100
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Rate Limiting for OTP requests
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.MAX_OTP_REQUESTS) || 5,
  message: {
    error: 'Too many OTP requests. Please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ Connected to MongoDB - Houston 100 OTP Database');
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Routes
app.use('/api/otp', otpLimiter);
app.use('/api/otp', require('./routes/otpRoutes'));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Houston 100 OTP Generator',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Root Route
app.get('/', (req, res) => {
  res.json({
    message: 'Houston 100 OTP Generator API',
    version: '1.0.0',
    endpoints: {
      generateOTP: 'POST /api/otp/generate',
      verifyOTP: 'POST /api/otp/verify',
      health: 'GET /health'
    }
  });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: 'The requested endpoint does not exist'
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Houston 100 OTP Generator running on port ${PORT}`);
  console.log(`📧 Email service: ${process.env.SMTP_HOST}`);
  console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
