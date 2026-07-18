import logger from '../src/utils/logger.js'; 
import { Request, Response, NextFunction } from 'express';

interface EnhancedError extends Error {
  statusCode?: number;
  code?: string;
  isJoi?: boolean;
}

interface IErrorResponse {
  success: false;
  message: string;
  code: string;
  stack?: string;
}

const errorHandler = (
  err: EnhancedError, 
  req: Request, 
  res: Response, 
  next: NextFunction
): Response | void => {
  
  if (err.name === 'CastError') { 
    logger.warn({ path: req.path, method: req.method, error: err.message }, 'Database manipulation payload blocked: Invalid ID structural string layout query payload detected'); 
    
    const response: IErrorResponse = { success: false, message: 'Invalid note ID format', code: 'INVALID_ID' };
    return res.status(400).json(response); 
  } 

  if (err.name === "TokenExpiredError") { 
    logger.warn({ path: req.path, method: req.method }, "User authentication rejected: Session token expired"); 
    
    const response: IErrorResponse = { success: false, message: 'Authentication session expired, please log in again', code: 'TOKEN_EXPIRED' };
    return res.status(401).json(response); 
  } 

  if (err.name === 'JsonWebTokenError') { 
    logger.warn({ path: req.path, method: req.method }, 'User authentication rejected: Malformed signature detected'); 
    
    const response: IErrorResponse = { success: false, message: 'Invalid or expired token', code: 'INVALID_TOKEN' };
    return res.status(401).json(response); 
  } 

  if (err.name === 'ValidationError' || err.isJoi) { 
    logger.warn({ path: req.path, method: req.method, error: err.message }, 'User input operational validation mismatch notice'); 
    
    const response: IErrorResponse = { success: false, message: err.message || 'Validation failed for request payload', code: 'VALIDATION_ERROR' };
    return res.status(400).json(response); 
  } 

  const statusCode = err.statusCode || 500; 
  const message = err.message || 'Internal Server Error'; 

  if (statusCode >= 400 && statusCode < 500) { 
    logger.warn({ path: req.path, method: req.method, statusCode, error: message }, 'Client request operational mismatch notice'); 
  } else { 
    logger.error({ path: req.path, method: req.method, error: message, stack: err.stack }, 'Server encountered unhandled downstream exception crash error'); 
  } 

  const finalResponse: IErrorResponse = {
    success: false, 
    message: message, 
    code: err.code || 'INTERNAL_SERVER_ERROR', 
    stack: process.env['NODE_ENV'] === 'development' ? err.stack : undefined 
  };

  return res.status(statusCode).json(finalResponse);
}; 

export default errorHandler;
