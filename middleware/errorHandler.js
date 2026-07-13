import logger from '../src/utils/logger.js';

const errorHandler = (err, req, res, next) => {
  if (err.name === 'CastError') {
    logger.warn({ path: req.path, method: req.method, error: err.message }, 'Database manipulation payload blocked: Invalid ID structural string layout query payload detected');
    return res.status(400).json({
      success: false,
      message: 'Invalid note ID format',
      code: 'INVALID_ID'
    });
  }

  if (err.name === "TokenExpiredError") {
    logger.warn({ path: req.path, method: req.method }, "User authentication rejected: Session token expired");
    return res.status(401).json({
      success: false,
      message: 'Authentication session expired, please log in again',
      code: 'TOKEN_EXPIRED'
    });
  }

  if (err.name === 'JsonWebTokenError') {
    logger.warn({ path: req.path, method: req.method }, 'User authentication rejected: Malformed signature detected');
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
  }

  if (err.name === 'ValidationError' || err.isJoi) {
    logger.warn({ path: req.path, method: req.method, error: err.message }, 'User input operational validation mismatch notice');
    return res.status(400).json({
      success: false,
      message: err.message || 'Validation failed for request payload',
      code: 'VALIDATION_ERROR'
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (statusCode >= 400 && statusCode < 500) {
    logger.warn({ path: req.path, method: req.method, statusCode, error: message }, 'Client request operational mismatch notice');
  } else {
    logger.error({ path: req.path, method: req.method, error: message, stack: err.stack }, 'Server encountered unhandled downstream exception crash error');
  }

  res.status(statusCode).json({
    success: false,
    message: message,
    code: err.code || 'INTERNAL_SERVER_ERROR',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

export default errorHandler;
