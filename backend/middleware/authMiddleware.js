// backend/middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Verifies Bearer tokens and attaches the authenticated user profile to the request
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Pull user metadata while safely avoiding password hash leakage
      req.user = await User.findById(decoded.id).select('-password');
      
      next();
      return; // Safe exit point prevents dual-next processing errors
    } catch (error) {
      res.status(401);
      const err = new Error('Not authorized, security token signature verification failed');
      next(err);
      return;
    }
  }

  if (!token) {
    res.status(401);
    const err = new Error('Not authorized, no network bearer token provided');
    next(err);
  }
};

// Restricts routes to administrators only
const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(403);
    const err = new Error('Access denied: Clear administrative clearance vector role required');
    next(err);
  }
};

export { protect, admin };