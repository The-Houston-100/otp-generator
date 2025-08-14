const nodemailer = require('nodemailer');
const randomstring = require('randomstring');

// Airtable Configuration for Houston 100
const AIRTABLE_BASE_ID = 'appaOZzwTAultlr23';
const AIRTABLE_TOKEN = 'patHd0JCviTampMds.ab1b932899944e6b78bc16d584db8cdd1b8386e362518c847808a9e6fbdc48e9';
const OTP_TABLE_NAME = 'OTP_Codes';
const AIRTABLE_OTP_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${OTP_TABLE_NAME}`;

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

// Airtable Helper Functions
async function createOTPRecord(email, otpCode, expiresAt) {
  const response = await fetch(AIRTABLE_OTP_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fields: {
        Email: email,
        OTP: otpCode,
        ExpiresAt: expiresAt.toISOString(),
        Attempts: 0,
        CreatedAt: new Date().toISOString(),
        Status: 'Active'
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Airtable error: ${response.status}`);
  }

  return await response.json();
}

async function findOTPRecord(email) {
  const filterFormula = `{Email} = '${email}'`;
  const response = await fetch(`${AIRTABLE_OTP_URL}?filterByFormula=${encodeURIComponent(filterFormula)}`, {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`
    }
  });

  if (!response.ok) {
    throw new Error(`Airtable error: ${response.status}`);
  }

  const data = await response.json();
  return data.records.length > 0 ? data.records[0] : null;
}

async function updateOTPRecord(recordId, fields) {
  const response = await fetch(`${AIRTABLE_OTP_URL}/${recordId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields })
  });

  if (!response.ok) {
    throw new Error(`Airtable error: ${response.status}`);
  }

  return await response.json();
}

async function deleteOTPRecord(recordId) {
  const response = await fetch(`${AIRTABLE_OTP_URL}/${recordId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`
    }
  });

  if (!response.ok) {
    throw new Error(`Airtable error: ${response.status}`);
  }

  return await response.json();
}

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
    const authorizedEmails = [
      'effram@houston100.org',
      'quintin@houston100.org',
      'william@houston100.org',
      'demo@houston100.org',
      'test@houston100.org'
    ];

    if (!authorizedEmails.includes(email.toLowerCase())) {
      console.warn(`⚠️ Unauthorized email attempted: ${email}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Please contact Houston 100 administration.'
      });
    }

    // Generate 6-digit OTP
    const otpCode = randomstring.generate({
      length: 6,
      charset: 'numeric'
    });

    // Set expiry time (5 minutes)
    const expiryTime = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRY) || 300000));

    // Delete any existing OTP for this email
    const existingRecord = await findOTPRecord(email);
    if (existingRecord) {
      await deleteOTPRecord(existingRecord.id);
    }

    // Save new OTP to Airtable
    await createOTPRecord(email, otpCode, expiryTime);

    // Houston 100 Email Template
    const emailTemplate = {
      from: process.env.FROM_EMAIL || 'Houston 100 Security <noreply@houston100.org>',
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
              <a href="mailto:support@houston100.org">support@houston100.org</a></p>
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
support@houston100.org
      `
    };

    // Send email
    await transporter.sendMail(emailTemplate);

    console.log(`✅ OTP sent to ${email}: ${otpCode} (stored in Airtable)`);

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

    // Find OTP record in Airtable
    const otpRecord = await findOTPRecord(email);

    if (!otpRecord) {
      return res.status(404).json({
        success: false,
        message: 'No verification code found. Please request a new code.'
      });
    }

    const fields = otpRecord.fields;

    // Check if OTP has expired
    if (new Date() > new Date(fields.ExpiresAt)) {
      await deleteOTPRecord(otpRecord.id);
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new code.'
      });
    }

    // Check attempts (prevent brute force)
    if (fields.Attempts >= 3) {
      await deleteOTPRecord(otpRecord.id);
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Please request a new code.'
      });
    }

    // Verify OTP
    if (fields.OTP !== otp) {
      // Increment attempts
      await updateOTPRecord(otpRecord.id, {
        Attempts: fields.Attempts + 1
      });

      return res.status(400).json({
        success: false,
        message: `Invalid verification code. ${3 - (fields.Attempts + 1)} attempts remaining.`
      });
    }

    // OTP is valid - delete it and grant access
    await deleteOTPRecord(otpRecord.id);

    console.log(`✅ OTP verified successfully for ${email} (Airtable)`);

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
    
    const otpRecord = await findOTPRecord(email);
    
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
      expiresAt: otpRecord.fields.ExpiresAt,
      attempts: otpRecord.fields.Attempts
    });
    
  } catch (error) {
    console.error('❌ Get OTP status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get OTP status'
    });
  }
};
