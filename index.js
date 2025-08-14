const express = require('express');
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

// Airtable Connection Test
async function testAirtableConnection() {
  try {
    const AIRTABLE_BASE_ID = 'appaOZzwTAultlr23';
    const AIRTABLE_TOKEN = 'patHd0JCviTampMds.ab1b932899944e6b78bc16d584db8cdd1b8386e362518c847808a9e6fbdc48e9';
    
    const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/OTP_Codes?maxRecords=1`, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`
      }
    });
    
    if (response.ok) {
      console.log('✅ Connected to Airtable - Houston 100 OTP Database');
    } else {
      console.warn('⚠️ Airtable connection issue:', response.status);
    }
  } catch (error) {
    console.error('❌ Airtable connection error:', error.message);
  }
}

// Test Airtable connection on startup
testAirtableConnection();

// Routes
app.use('/api/otp', otpLimiter);
app.use('/api/otp', require('./routes/otpRoutes'));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Houston 100 OTP Generator',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    database: 'Airtable',
    airtable: {
      baseId: 'appaOZzwTAultlr23',
      table: 'OTP_Codes'
    }
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
    },
    database: 'Airtable',
    company: 'Houston 100 Investment Group LLC'
  });
});

// Email Configuration Test
app.get('/test-email', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Endpoint not available in production' });
  }
  
  const emailConfig = {
    host: process.env.SMTP_HOST || 'Not configured',
    port: process.env.SMTP_PORT || 'Not configured',
    user: process.env.SMTP_USER || 'Not configured',
    from: process.env.FROM_EMAIL || 'Not configured'
  };
  
  res.json({
    message: 'Email configuration status',
    config: emailConfig,
    note: 'SMTP_PASS is hidden for security'
  });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: 'The requested endpoint does not exist',
    availableEndpoints: [
      'GET /',
      'GET /health',
      'POST /api/otp/generate',
      'POST /api/otp/verify'
    ]
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Houston 100 OTP Generator running on port ${PORT}`);
  console.log(`📧 Email service: ${process.env.SMTP_HOST || 'Not configured'}`);
  console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Database: Airtable (Base: appaOZzwTAultlr23)`);
});

module.exports = app;
