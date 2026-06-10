// backend/controllers/authController.js
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { transporter, getSenderEmail } from '../config/mail.js';
import crypto from 'crypto';

// Helper to sign JWT credentials 
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};



// @desc    Register a new user profile
// @route   POST /api/users
// @access  Public
const registerUser = async (req, res, next) => {
  const { name, email, password } = req.body;

  try {
    const sanitizedEmail = email ? email.trim().toLowerCase() : '';

    const userExists = await User.findOne({ email: sanitizedEmail });

    if (userExists) {
      res.status(400);
      throw new Error('Target email node identity already registered');
    }

    const user = await User.create({
      name,
      email,
      password,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        token: generateToken(user._id),
      });
    } else {
      res.status(400);
      throw new Error('Invalid structural user data schema payload');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Auth user & acquire token identity
// @route   POST /api/users/login
// @access  Public
const authUser = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const sanitizedEmail = email ? email.trim().toLowerCase() : '';
    console.log(`[Auth Login Attempt] Email: "${email}" -> Sanitized: "${sanitizedEmail}", Password provided: ${password ? 'Yes' : 'No'}`);

    const user = await User.findOne({ email: sanitizedEmail });
    if (user) {
      const isMatch = await user.matchPassword(password);
      console.log(`[Auth Login Attempt] User found. Password match: ${isMatch}`);
    } else {
      console.log(`[Auth Login Attempt] User NOT found in database.`);
    }

    if (user && password && (await user.matchPassword(password))) {
      if (user.email === 'dailymartadmin@gmail.com' && !user.isAdmin) {
        user.isAdmin = true;
        await user.save();
      }
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        token: generateToken(user._id),
      });
    } else {
      res.status(401);
      throw new Error('Invalid identification token or security key signature');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get profile details for current logged-in user
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
      });
    } else {
      res.status(404);
      throw new Error('User entity signature not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Update profile metrics 
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      if (req.body.password) {
        user.password = req.body.password;
      }

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        isAdmin: updatedUser.isAdmin,
        token: generateToken(updatedUser._id),
      });
    } else {
      res.status(404);
      throw new Error('User identity reference not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Auth user via Google OAuth Access Token
// @route   POST /api/users/google-login
// @access  Public
const googleLogin = async (req, res, next) => {
  const { token } = req.body;

  try {
    if (!token) {
      res.status(400);
      throw new Error('Google access token is missing');
    }

    const googleResponse = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`);
    
    if (!googleResponse.ok) {
      res.status(401);
      throw new Error('Failed to verify Google access token');
    }

    const { email, name } = await googleResponse.json();

    if (!email) {
      res.status(400);
      throw new Error('Email not provided by Google account');
    }

    let user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      user = await User.create({
        name,
        email,
        password: crypto.randomBytes(32).toString('hex'),
      });
    } else if (user.email === 'dailymartadmin@gmail.com' && !user.isAdmin) {
      user.isAdmin = true;
      await user.save();
    }

    if (user) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        token: generateToken(user._id),
      });
    } else {
      res.status(400);
      throw new Error('Invalid user details created from Google authentication');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Request password reset code
// @route   POST /api/users/forgot-password
// @access  Public
const forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  try {
    if (!email) {
      res.status(400);
      throw new Error('Email address is required');
    }

    const sanitizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: sanitizedEmail });

    if (!user) {
      res.status(404);
      throw new Error('User not found with this email');
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetPasswordToken = resetCode;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    const emailUser = getSenderEmail();

    const mailOptions = {
      from: `"DailyMart Security" <${emailUser}>`,
      to: user.email,
      subject: 'DailyMart - Password Reset Code',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #10b981; text-transform: uppercase;">Password Reset Request</h2>
          <p>You requested to reset your password. Use the verification code below to set a new password. This code will expire in 10 minutes:</p>
          <div style="font-size: 24px; font-weight: bold; background: #f3f4f6; padding: 12px 20px; display: inline-block; border-radius: 8px; letter-spacing: 2px; color: #111827; margin: 15px 0;">
            ${resetCode}
          </div>
          <p>If you did not request this, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px border #e5e7eb; margin: 20px 0;" />
          <p style="font-size: 11px; color: #6b7280;">This is an automated security transmission. Do not reply directly to this mail.</p>
        </div>
      `,
    };

    if (emailUser === 'your_gmail@gmail.com' || !process.env.SMTP_EMAIL) {
      console.log(`\n🔑 [DailyMart Security Alert]: Verification code for ${user.email} is: ${resetCode}\n`);
    }

    try {
      console.log(`[Email Audit] Starting password reset code email dispatch to: ${user.email}`);
      console.log(`[Email Audit] Google REST API Parameters: client_id=${process.env.GOOGLE_CLIENT_ID ? 'configured' : 'missing'}, client_secret=${process.env.GOOGLE_CLIENT_SECRET ? 'configured' : 'missing'}, refresh_token=${process.env.GOOGLE_REFRESH_TOKEN ? 'configured' : 'missing'}`);
      await transporter.sendMail(mailOptions);
      console.log(`[Email Audit] Password reset code email sent successfully to: ${user.email}`);
      res.json({ message: 'Verification code successfully sent to your email inbox' });
    } catch (mailError) {
      console.error('[Email Audit] Password reset code email failed to send:', mailError);
      res.json({ 
        message: 'Verification code generated (fallback mock print).',
        code: resetCode
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password using verification code
// @route   POST /api/users/reset-password
// @access  Public
const resetPassword = async (req, res, next) => {
  const { email, token, password } = req.body;

  try {
    if (!email || !token || !password) {
      res.status(400);
      throw new Error('Email, verification code, and new password are required');
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      res.status(400);
      throw new Error('Invalid verification code or code has expired');
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({ message: 'Password successfully updated. You can now log in.' });
  } catch (error) {
    next(error);
  }
};

export { registerUser, authUser, googleLogin, forgotPassword, resetPassword, getUserProfile, updateUserProfile };