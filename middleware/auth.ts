import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

interface CustomRequest extends Request {
  userId?: string;
}

interface EnhanceError extends Error {
  statusCode? : number;
}

export function protect(req: CustomRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const error: EnhanceError = new Error("No token provided");
    error.statusCode = 401;
    return next(error);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env['WT_SECRET'] || '') as jwt.JwtPayload;
    req.userId = decoded.userId;
    next();
  } catch (error) {
    next(error);
  }
}
