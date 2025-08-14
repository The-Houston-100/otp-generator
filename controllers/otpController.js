const nodemailer = require('nodemailer');
const randomstring = require('randomstring');
const OTP = require('../models/OTP');

// Configure Nodemailer for Houston 100
const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Verify email configuration on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email configuration error:', error);
  } else {
    console.log('✅ Email server ready for Houston 100 OTP delivery');
  }
});

// Generate and send OTP
exports.generateOTP = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Check if user is authorized for Houston 100
    const authorizedDomains = ['houston100.org', 'gmail.com']; // Add your domains
    const emailDomain = email.split('@')[1];
    
    // For demo, allow common domains, but log for review
    if (!authorizedDomains.includes(emailDomain)) {
      console.warn(`⚠️ Non-Houston100 domain attempted: ${email}`);
    }

    // Generate 6-digit OTP
    const otpCode = randomstring.generate({
      length: 6,
      charset: 'numeric'
    });

    // Set expiry time (5 minutes)
    const expiryTime = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRY) || 300000));

    // Delete any existing OTP for this email
    await OTP.deleteMany({ email });

    // Save new OTP to database
    const otp = new OTP({
      email,
      otp: otpCode,
      expiresAt: expiryTime,
      attempts: 0
    });

    await otp.save();

    // Houston 100 Email Template
    const emailTemplate = {
      from: process.env.FROM_EMAIL,
      to: email,
      subject: '🔐 Houston 100 - Your Verification Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ffffff 0%, #747474 50%, #4a90e2 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e1e8ed; }
            .otp-box { background: #f8f9fa; border: 2px solid #4a90e2; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
            .otp-code { font-size: 2rem; font-weight: bold; color: #4a90e2; letter-spacing: 8px; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; font-size: 0.9rem; color: #666; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; color: #2c3e50;">🏢 Houston 100</h1>
              <p style="margin: 10px 0 0 0; color: #4a5568;">Investment Group LLC</p>
            </div>
            
            <div class="content">
              <h2>Verification Code for Expense Tracker</h2>
              <p>Hello,</p>
              <p>You requested access to the Houston 100 Expense Tracker. Please use the verification code below to complete your login:</p>
              
              <div class="otp-box">
                <div class="otp-code">${otpCode}</div>
                <p style="margin: 10px 0 0 0; font-size: 0.9rem; color: #666;">This code expires in 5 minutes</p>
              </div>
              
              <p><strong>Important:</strong> This code is for Houston 100 members only. If you didn't request this code, please ignore this email.</p>
              
              <div class="warning">
                <strong>🔒 Security Notice:</strong> Never share this code with anyone. Houston 100 staff will never ask for your verification code.
              </div>
              
              <p>If you have any issues, please contact our support team.</p>
              
              <p>Best regards,<br>
              <strong>Houston 100 Technology Team</strong></p>
            </div>
            
            <div class="footer">
              <p>Houston 100 Investment Group LLC<br>
              Kingdom-focused Financial Stewardship<br>
              <a href="mailto:${process.env.SUPPORT_EMAIL}">${process.env.SUPPORT_EMAIL}</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Houston 100 - Verification Code

Your verification code: ${otpCode}

This code expires in 5 minutes.

If you didn't request this code, please ignore this email.

Houston 100 Investment Group LLC
${process.env.SUPPORT_EMAIL}
      `
    };

    // Send email
    await transporter.sendMail(emailTemplate);

    console.log(`✅ OTP sent to ${email}: ${otpCode}`);

    res.status(200).json({
      success: true,
      message: 'Verification code sent successfully',
      email: email,
      expiresIn: '5 minutes'
    });

  } catch (error) {
    console.error('❌ Generate OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send verification code. Please try again.'
    });
  }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validate input
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    // Find OTP record
    const otpRecord = await OTP.findOne({ email });

    if (!otpRecord) {
      return res.status(404).json({
        success: false,
        message: 'No verification code found. Please request a new code.'
      });
    }

    // Check if OTP has expired
    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteOne({ email });
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new code.'
      });
    }

    // Check attempts (prevent brute force)
    if (otpRecord.attempts >= 3) {
      await OTP.deleteOne({ email });
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Please request a new code.'
      });
    }

    // Verify OTP
    if (otpRecord.otp !== otp) {
      // Increment attempts
      otpRecord.attempts += 1;
      await otpRecord.save();

      return res.status(400).json({
        success: false,
        message: `Invalid verification code. ${3 - otpRecord.attempts} attempts remaining.`
      });
    }

    // OTP is valid - delete it and grant access
    await OTP.deleteOne({ email });

    console.log(`✅ OTP verified successfully for ${email}`);

    res.status(200).json({
      success: true,
      message: 'Verification successful',
      email: email,
      authenticated: true
    });

  } catch (error) {
    console.error('❌ Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed. Please try again.'
    });
  }
};

// Helper function to validate email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Get OTP status (for debugging)
exports.getOTPStatus = async (req, res) => {
  try {
    const { email } = req.params;
    
    const otpRecord = await OTP.findOne({ email });
    
    if (!otpRecord) {
      return res.status(404).json({
        success: false,
        message: 'No active verification code found'
      });
    }
    
    res.status(200).json({
      success: true,
      email: email,
      hasActiveOTP: true,
      expiresAt: otpRecord.expiresAt,
      attempts: otpRecord.attempts
    });
    
  } catch (error) {
    console.error('❌ Get OTP status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get OTP status'
    });
  }
};
