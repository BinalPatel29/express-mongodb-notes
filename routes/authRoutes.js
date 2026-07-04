import express from 'express';
import User from '../models/userModel.js';
import jwt from 'jsonwebtoken';
import { validateRegister, validateLogin } from '../validators/authValidator.js';
import logger from '../src/utils/logger.js';

const router = express.Router();

router.post('/register', async (req, res, next) => {
    console.log('route called')
    const logContext = { path: '/register', method: 'POST' };
    try {
        const { error } = validateRegister(req.body);
        if (error) {
            const errorMsg = error.details?.[0]?.message || error.message;
            logger.warn({ ...logContext, validationError: errorMsg }, "Registration validation failed");
            return res.status(400).json({ error: errorMsg });
        }
        
        const { firstName, lastName, email, password, mobileNo } = req.body;

        const existing = await User.findOne({ email });
        if (existing) {
            logger.warn({ ...logContext }, "Registration rejected: Email already registered");
            return res.status(409).json({ error: 'Email already registered' });
        }
        
        const user = new User({ firstName, lastName, email, password, mobileNo });
        await user.save();
        
        logger.info({ ...logContext, userId: user._id }, "User registered successfully");
        res.status(201).json({ message: 'User registered successfully' });
    }
    catch (error) {
        logger.error({ ...logContext, error: error.message, stack: error.stack }, "Internal crash during user registration");
        // next(error);
         res.status(400).json({ message: err.message });
    }
});

router.post('/login', async (req, res, next) => {
    const logContext = { path: '/login', method: 'POST' };
    try {
        const { error } = validateLogin(req.body);
        if (error) {
            const errorMsg = error.details?.[0]?.message || error.message;
            logger.warn({ ...logContext, validationError: errorMsg }, "Login Validation Failed");
            return res.status(400).json({ error: errorMsg });
        }
        
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            logger.warn({ ...logContext }, "Login failed: Invalid credentials");
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            logger.warn({ ...logContext, userId: user._id}, "Login failed: Invalid password credentials entered");
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!process.env.JWT_SECRET) {
            logger.error({ ...logContext }, "Server configuration mistake: JWT_SECRET environment property missing" );
            return res.status(500).json({ error: 'JWT secret configuration missing on server' });
        }
        
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        logger.info({ ...logContext, userId: user._id }, "User successfully authenticated");
        res.json({ token });
    } 
    catch (error) {
        logger.error({ ...logContext, error: error.message, stack: error.stack }, "Internal crash during user login");
        next(error);
    }
});

export default router;
