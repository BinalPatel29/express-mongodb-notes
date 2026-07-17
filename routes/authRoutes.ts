import express, { Request, Response, NextFunction } from 'express';
import User from '../models/userModel.js'; 
import jwt from 'jsonwebtoken'; 
import { validateRegister, validateLogin } from '../validators/authValidator.js'; 
import logger from '../src/utils/logger.js'; 
import 'cookie-parser';

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => { 
    Promise.resolve(fn(req, res, next)).catch(next); 
}; 

const router = express.Router(); 

const setRefreshTokenCookies = (res: any, token: string): void => { 
    (res as any).cookie('refresh_token', token, { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production', 
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', 
        path: '/', 
        maxAge: 7 * 24 * 60 * 60 * 1000 
    } as any); 
}; 

const cookieClearOptions: any = { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production', 
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', 
    path: '/' 
}; 

router.post('/register', asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => { 
    const logContext = { path: '/register', method: 'POST' }; 
    const result = validateRegister(req.body); 

    if (!result.success) { 
        logger.warn({ ...logContext, validationErrors: result.error }, "Registration validation failed"); 
        
        return res.status(400).json({
            success: false,
            message: "Validation failed: Please inspect your request fields.",
            errors: result.error, 
            code: 'VALIDATION_ERROR'
        });
    } 

    const { firstName, lastName, email, password, mobileNo } = result.value; 
    const existing = await User.findOne({ email }); 
    if (existing) { 
        logger.warn({ ...logContext }, "Registration rejected: Email already registered"); 
        return res.status(400).json({
            success: false,
            message: "Email already registered",
            code: 'EMAIL_ALREADY_EXISTS'
        });
    } 

    const user = new User({ firstName, lastName, email, password, mobileNo }); 
    await user.save(); 
    
    logger.info({ ...logContext, userId: user._id }, "User registered successfully"); 
    return res.status(201).json({ success: true, message: 'User registered successfully' }); 
})); 

router.post('/login', asyncHandler(async (req: Request, res: Response, next: NextFunction) => { 
    const logContext = { path: '/login', method: 'POST', credentials: 'include' }; 
    const result = validateLogin(req.body); 

    if (!result.success) { 
        logger.warn({ ...logContext, validationErrors: result.error }, "Login Validation Failed"); 
        
        return res.status(400).json({
            success: false,
            message: "Validation failed: Missing or invalid credentials.",
            errors: result.error,
            code: 'VALIDATION_ERROR'
        });
    } 

    const { email, password } = result.value; 
    const user = await User.findOne({ email }); 
    if (!user) { 
        logger.warn({ ...logContext }, "Login failed: Invalid credentials"); 
        return res.status(401).json({
            success: false,
            message: "Invalid credentials",
            code: 'INVALID_CREDENTIALS'
        });
    } 

    const isMatch = await user.comparePassword(password); 
    if (!isMatch) { 
        logger.warn({ ...logContext, userId: user._id }, "Login failed: Invalid password credentials entered"); 
        return res.status(401).json({
            success: false,
            message: "Invalid credentials",
            code: 'INVALID_CREDENTIALS'
        });
    } 

    if (!process.env.JWT_SECRET || !process.env.REFRESH_TOKEN_SECRET) { 
        logger.error({ ...logContext }, "Server configuration mistake: JWT_SECRET environment property missing"); 
        return res.status(500).json({
            success: false,
            message: "Server environment configuration missing",
            code: 'INTERNAL_SERVER_ERROR'
        });
    } 

    const token = jwt.sign( 
        { userId: user._id }, 
        process.env.JWT_SECRET!, 
        { expiresIn: '15m' } 
    ); 
    const refreshToken = jwt.sign( 
        { userId: user._id }, 
        process.env.REFRESH_TOKEN_SECRET!, 
        { expiresIn: '7d' } 
    ); 

    user.refreshTokens.push(refreshToken); 
    await user.save(); 
    setRefreshTokenCookies(res, refreshToken); 
    
    logger.info({ ...logContext, userId: user._id }, "User successfully authenticated"); 
    return res.json({ success: true, token }); 
})); 

router.post('/refresh', asyncHandler(async (req: Request, res: Response, next: NextFunction) => { 
    const logContext = { path: '/refresh', method: 'POST' }; 
    const cookies = req.cookies; 
    if (!cookies?.refresh_token) { 
        return res.status(401).json({ success: false, message: 'unauthorized', code: 'UNAUTHORIZED' }); 
    } 
    const oldRefreshToken = cookies.refresh_token; 
    const user = await User.findOne({ refreshTokens: oldRefreshToken }); 
    if (!user) { 
        try { 
            const decoded = jwt.verify(oldRefreshToken, process.env['REFRESH_TOKEN_SECRET'] || '') as jwt.JwtPayload; 
            if (decoded && decoded.userId) { 
                await User.updateOne({ _id: decoded.userId }, { $set: { refreshTokens: [] } }); 
                logger.error({ ...logContext, userId: decoded.userId }, "Breach threat detected: All active tokens purged."); 
            } 
        } catch (err) { 
            logger.warn({ ...logContext }, "Failed to decode untrusted reuse token verification request"); 
        } 
        res.clearCookie('refresh_token', cookieClearOptions); 
        return res.status(403).json({ success: false, message: 'compromised session: please, re-authentication', code: 'TOKEN_COMPROMISED' }); 
    } 
    try { 
        const decoded = jwt.verify(oldRefreshToken, process.env['REFRESH_TOKEN_SECRET'] || ''); 
        user.refreshTokens = user.refreshTokens.filter(rt => rt !== oldRefreshToken); 
        const newAccessToken = jwt.sign({ userId: user._id }, process.env['JWT_SECRET'] || '', { expiresIn: '15m' }); 
        const newRefreshToken = jwt.sign({ userId: user._id }, process.env['REFRESH_TOKEN_SECRET'] || '', { expiresIn: '7d' }); 
        user.refreshTokens.push(newRefreshToken); 
        await user.save(); 
        setRefreshTokenCookies(res, newRefreshToken); 
        res.json({ token: newAccessToken }); 
    } catch (err) { 
        user.refreshTokens = user.refreshTokens.filter(rt => rt !== oldRefreshToken); 
        await user.save(); 
        res.clearCookie('refresh_token', cookieClearOptions); 
        return res.status(403).json({ success: false, message: 'Session expired', code: 'TOKEN_EXPIRED' }); 
    } 
})); 

router.post('/logout-all', asyncHandler(async (req: Request, res: Response, next: NextFunction) => { 
    const cookies = req.cookies; 
    if (!cookies?.refresh_token) return res.sendStatus(204); 
    const currentRefreshToken = cookies.refresh_token; 
    const user = await User.findOne({ refreshTokens: currentRefreshToken }); 
    if (user) { 
        user.refreshTokens = []; 
        await user.save(); 
    } 
    res.clearCookie('refresh_token', cookieClearOptions); 
    return res.json({ success: true, message: 'successfully logout from everywhere' }); 
})); 

export default router;
