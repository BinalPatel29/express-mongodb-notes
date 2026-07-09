import logger from '../src/utils/logger.js';

const errorHandler = (err, req, res, next) => {
    if (err.name === 'CastError') {
        logger.warn({ path: req.path, method: req.method, error: err.message }, 'Database manipulation payload blocked: Invalid ID structural string layout query payload detected');
        return res.status(400).json({ error: 'Invalid note ID format' });
    }
  
    if (err.name === "TokenExpiredError") {
        logger.warn({ path: req.path, method: req.method }, "User authentication rejected: Session token expired");
        return res.status(401).json({ error: 'Authentication session expired, please log in again' });
    }

    if (err.name === 'JsonWebTokenError') {
        logger.warn({ path: req.path, method: req.method }, 'User authentication rejected: Malformed signature detected');
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    // FIX: Catch operational client errors (like 404 Not Found) and log them cleanly as warnings
    if (statusCode >= 400 && statusCode < 500) {
        logger.warn(
            { path: req.path, method: req.method, statusCode, error: message }, 
            'Client request operational mismatch notice'
        );
    } else {
        // True system crashes (500 errors) will still trigger a high-priority level 50 alert with full stacks
        logger.error(
           { 
            path: req.path,        
            method: req.method, 
            error: message, 
            stack: err.stack       
           }, 
           'Server encountered unhandled downstream exception crash error'
        );
    }

    res.status(statusCode).json({
       success: false,
       message: message,
       stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

export default errorHandler;
