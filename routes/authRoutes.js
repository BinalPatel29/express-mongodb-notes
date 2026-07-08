import express from 'express';
import User from '../models/userModel.js';
import jwt from 'jsonwebtoken';
import { validateRegister, validateLogin } from '../validators/authValidator.js';
import logger from '../src/utils/logger.js';

export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

const router = express.Router();
const setRefreshTokenCookies = (res, token) => {
    res.cookie('refresh_token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
};

router.post('/register',asyncHandler( async (req, res, next) => {
    const logContext = { path: '/register', method: 'POST' };
    const { error } = validateRegister(req.body);

    if (error) {
        const errorMsg = error.details?.[0]?.message || error.message;
        logger.warn({ ...logContext, validationError: errorMsg }, "Registration validation failed");

        const appError = new Error(errorMsg);
        appError.statusCode = 400;
        throw appError;
    }
            
    const { firstName, lastName, email, password, mobileNo } = req.body;
    const existing = await User.findOne({ email });
        
    if (existing) {
        logger.warn({ ...logContext }, "Registration rejected: Email already registered");

        const appError = new Error('Email already registered');
        appError.statusCode = 400;
        throw appError;
    }
    const user = new User({ firstName, lastName, email, password, mobileNo });
    await user.save();
            
    logger.info({ ...logContext, userId: user._id }, "User registered successfully");
    res.status(201).json({ message: 'User registered successfully' });
}));

router.post('/login', asyncHandler(async (req, res, next) => {
    const logContext = { path: '/login', method: 'POST', credentials: 'include' };
    const { error } = validateLogin(req.body);
            
    if (error) {
        const errorMsg = error.details?.[0]?.message || error.message;
        logger.warn({ ...logContext, validationError: errorMsg }, "Login Validation Failed");
            
        const appError = new Error(errorMsg);
        appError.statusCode = 400;
        throw appError;
    }
    const { email, password } = req.body;
    const user = await User.findOne({ email });
            
    if (!user) {
        logger.warn({ ...logContext }, "Login failed: Invalid credentials");
            
        const appError = new Error('Invalid credentials');
        appError.statusCode = 401;
        throw appError;
    }
            
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        logger.warn({ ...logContext, userId: user._id}, "Login failed: Invalid password credentials entered");
            
        const appError = new Error('Invalid credentials');
        appError.statusCode = 401;
        throw appError;
    }

    if (!process.env.JWT_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
        logger.error({ ...logContext }, "Server configuration mistake: JWT_SECRET environment property missing" );
        const appError = new Error('Server environment configuration missing');
        appError.statusCode = 500;
        throw appError;
    }
            
    const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
        { userId: user._id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: '7d'}
    );

    user.refreshTokens.push(refreshToken);
    await user.save();

    setRefreshTokenCookies(res, refreshToken);
            
    logger.info({ ...logContext, userId: user._id }, "User successfully authenticated");
    res.json({ token });
}));

router.post('/refresh',asyncHandler( async (req, res, next) => {
    const logContext = { path: '/refresh', method: 'POST' };
    const cookies = req.cookies;
    if (!cookies?.refresh_token) return res.status(401).json({ message: 'unauthorized' });

    const oldRefreshToken = cookies.refresh_token;
    const user = await User.findOne({ refreshTokens: oldRefreshToken });

    if (!user) {
        jwt.verify(oldRefreshToken, process.env.REFRESH_TOKEN_SECRET, async (err, decoded) => {
            if (!err && decoded) {
                await User.updateOne({ _id: decoded.userId }, { $set: { refreshTokens: [] } });
                logger.error({ ...logContext, userId: decoded.userId }, "Breach threat detected: All active tokens purged.");
            }
        });
        res.clearCookie('refresh_token', { httpOnly: true, secure: true, sameSite: 'strict', path: '/' });
        return res.status(403).json({ message: 'compromised session: please, re-authentication' });
    }

    jwt.verify(oldRefreshToken, process.env.REFRESH_TOKEN_SECRET, async (err, decoded) => {
        if (err) {
            user.refreshTokens = user.refreshTokens.filter(rt => rt !== oldRefreshToken);
            await user.save();
            res.clearCookie('refresh_token', { httpOnly: true, secure: true, sameSite: 'strict', path: '/' });
            return res.status(403).json({ message: 'Session expired' });
        }

        user.refreshTokens = user.refreshTokens.filter(rt => rt !== oldRefreshToken);

        const newAccessToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
        const newRefreshToken = jwt.sign({ userId: user._id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
            
        user.refreshTokens.push(newRefreshToken);
        await user.save();

        setRefreshTokenCookies(res, newRefreshToken);
        res.json({ token: newAccessToken });
    });
}));

router.post('/logout-all', asyncHandler(async (req, res, next) => {
    const cookies = req.cookies;
    if (!cookies?.refresh_token) return res.sendStatus(204);

    const currentRefreshToken = cookies.refresh_token;
    const user = await User.findOne({ refreshTokens: currentRefreshToken });

    if (user) {
        user.refreshTokens = [];
        await user.save();
    }
    res.clearCookie('refresh_token', { httpOnly: true, secure: true, sameSite: 'strict', path: '/' });
    res.json({ message: 'successfully logout from everywhere' });
}));

export default router;
