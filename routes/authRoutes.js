import express from 'express';
import User from '../models/userModel.js';
import jwt from 'jsonwebtoken';
import { validateRegister, validateLogin } from '../validators/authValidator.js';
import logger from '../src/utils/logger.js';

const router = express.Router();

router.post('/register', async (req, res, next) => {
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
});

router.post('/login', async (req, res, next) => {
    const logContext = { path: '/login', method: 'POST' };
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

    if (!process.env.JWT_SECRET) {
        logger.error({ ...logContext }, "Server configuration mistake: JWT_SECRET environment property missing" );
        
        const appError = new Error('Server environment configuration missing');
        appError.statusCode = 500;
        throw appError;
    }
        
    const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );
        
    logger.info({ ...logContext, userId: user._id }, "User successfully authenticated");
    res.json({ token });
});

export default router;