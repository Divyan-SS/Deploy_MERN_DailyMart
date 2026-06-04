// backend/middleware/errorMiddleware.js

// Primary fallback route handler for unmapped endpoints
const notFound = (req, res, next) => {
  const error = new Error(`Resource Node Not Found - [${req.originalUrl}]`);
  res.status(404);
  next(error);
};

// Global error processing node catching both manual throws and environment crashes
const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // Intercept bad Mongoose hex string lookups to prevent server leakage
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Central production database object resource reference path not found';
  }

  res.status(statusCode).json({
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

export { notFound, errorHandler };