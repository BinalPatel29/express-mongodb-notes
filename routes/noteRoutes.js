import { Router } from 'express';
import util from 'util';
import jwt from 'jsonwebtoken';
import Note from '../models/noteModel.js';
import User from '../models/userModel.js';
import { validateNote } from '../validators/noteValidator.js';
import logger from '../src/utils/logger.js';
import { Types } from 'mongoose';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { imageQueue } from '../src/queue/imageQueue.js';

const router = Router();
const CACHE_TTL_SECONDS = 86400;
const verifyJwtAsync = util.promisify(jwt.verify);

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

async function invalidateUserCache(userId, specificNoteId = null) {
    if (global.redisClient) {
        try {
            const cleanUserId = String(userId);
            const matchPattern = `notes:${userId}:*`;
            const keysToDelete = await global.redisClient.keys(matchPattern);

            if (keysToDelete.length > 0) {
                await global.redisClient.del(keysToDelete);
            }

            if (specificNoteId) {
                await global.redisClient.del(`note:${cleanUserId}:${specificNoteId}`);
            }

            logger.info(
            { userId: cleanUserId, specificNoteId, listingCleared: keysToDelete.length },
            "Redis Cache Invalidation Completed Successfully"
        );
        } catch (scanError) {
            logger.error({ error: scanError.message, userId }, "Failed to clear Redis cache keys");
        }
    }
}

router.get('/', asyncHandler(async (req, res, next) => {
    let { page = 1, limit = 10, sort = '-createdAt', text } = req.query;
    page = Math.max(1, parseInt(page, 10) || 1);
    limit = Math.max(1, parseInt(limit, 10) || 10);
    const cachekeys = `notes:${req.userId}:p_${page}:l_${limit}:s_${sort}:t_${text || 'none'}`;

    if (global.redisClient) {
    const cachedListing = await global.redisClient.get(cachekeys);
    
        if (cachedListing) {
            logger.info({ userId: req.userId, cacheKey: cachekeys }, "Redis List Cache HIT: Instantly returning matching pagination state records");
            return res.json(JSON.parse(cachedListing));
        }
    }

    let user_id = new Types.ObjectId(req.userId);
    const filter = { userId: user_id, ...(text && { text: { $regex: text, $options: 'i' } }) };
    const allowedSort = ['createdAt', 'updatedAt', 'text', '-createdAt', '-updatedAt', '-text'];
    const finalSort = allowedSort.includes(sort) ? sort : '-createdAt';
  
    logger.info({ filter });

    const [notes, totalItems] = await Promise.all([
        Note.find(filter).sort(finalSort).skip((page - 1) * limit).limit(limit).lean(),
        Note.countDocuments(filter)
    ]);
    const responsePayload = { success: true, data: notes, pagination: { totalItems, totalPages: Math.ceil(totalItems / limit), currentPage: page } };

    if (global.redisClient) {
        await global.redisClient.setEx(cachekeys, CACHE_TTL_SECONDS, JSON.stringify(responsePayload));
    }

    res.json(responsePayload);
}));

router.get('/:id', asyncHandler(async (req, res, next) => {
    const noteId = req.params.id;
    const cacheKey = `note:${req.userId}:${noteId}`;

    if (global.redisClient) {
        const cachedNote = await global.redisClient.get(cacheKey);
        
        if (cachedNote) {
            logger.info({ userId: req.userId, noteId }, "Redis Single Cache HIT: Instantly returning single note record");
            return res.json(JSON.parse(cachedNote));
        }
    }

    const note = await Note.findOne({ _id: noteId, userId: req.userId }).lean();
  
    if (!note) {
        const notFoundError = new Error('Note not found');
        notFoundError.statusCode = 404;
        throw notFoundError;
    }

    if (global.redisClient) {
        await global.redisClient.setEx(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(note));
    }

    logger.info({ userId: req.userId, noteId }, "Redis Single Cache MISS: Record successfully fetched from MongoDB");
    return res.json(note);
}));

router.get('/stats/activity', asyncHandler(async (req, res, next) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
    const stats = await Note.aggregate([
        {
            $match: {
            userId: new Types.ObjectId(req.userId),
            createdAt: { $gte: thirtyDaysAgo }
            }
        },
        {
            $group: {
            _id: "$userId",
            totalNotes: { $sum: 1 }
            }
        },
        {
            $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "userProfile"
            }
        },
        {
            $unwind: {
            path: "$userProfile",
            preserveNullAndEmptyLines: true
            }
        },
        {
            $project: {
            _id: 0,
            userId: "$_id",
            totalNotes: 1,
            userEmail: "$userProfile.email",
            userName: { $concat: ["$userProfile.firstName", " ", "$userProfile.lastName"] }
            }
        }
    ]);

    res.json({
        success: true,
        data: stats[0] || { userId: req.userId, totalNotes: 0, userName: "", userEmail: "" }
    });
}));

router.post('/upload', asyncHandler(async (req, res, next) => { 
    if (!req.files || !req.files.image) { 
        return res.status(400).json({ success: false, message: 'No file uploaded', code: 'VALIDATION_ERROR' }); 
    } 

    const file = req.files.image; 
    const payload = { text: req.body.text || "Uploaded Image Note", userId: req.userId }; 
    const { error } = validateNote(payload); 
    if (error) { 
        return res.status(400).json({ success: false, message: error, code: 'VALIDATION_ERROR' }); 
    } 

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); 
    const filename = uniqueSuffix + path.extname(file.name || 'test-image.png'); 
    
    const bufferData = file.data.toString('base64'); 

    const job = await imageQueue.add('optimizeImage', { 
        originalname: file.name, 
        bufferData, 
        filename, 
        isTest: process.env.NODE_ENV === 'test', 
        mimetype: file.mimetype, 
        text: payload.text, 
        userId: req.userId 
    }, { 
        attempts: 3, 
        backoff: { type: 'exponential', delay: 2000 } 
    }); 

    logger.info({ jobId: job.id, filename }, 'Image offloaded to background queue process successfully'); 
    return res.status(202).json({ success: true, message: "Image uploaded and queued", jobId: job.id }); 
}));

router.post('/', asyncHandler(async (req, res, next) => {
    const payload = { text: req.body.text, userId: req.userId, imageUrl: req.body.imageUrl };
    const { error } = validateNote(payload);

    if (error) {
        return res.status(400).json({
            success: false,
            message: error,
            code: 'VALIDATION_ERROR'
        });
    }

    const note = new Note({ text: req.body.text, userId: req.userId, imageUrl: req.body.imageUrl || "" });
    await note.save();
    await invalidateUserCache(req.userId);
    res.status(201).json(note);
}));

router.patch('/:id', asyncHandler(async (req, res, next) => {
    const payload = { text: req.body.text, userId: req.userId };
    const { error } = validateNote(payload);
    
    if (error) {
        return res.status(400).json({
            success: false,
            message: error,
            code: 'VALIDATION_ERROR'
        });
    }
  
    const note = await Note.findOneAndUpdate(
        { _id: req.params.id, userId: req.userId },
        { text: req.body.text },
        { returnDocument: 'after' }
    );
  
    if (!note) {
        const notFoundError = new Error('Note not found');
        notFoundError.statusCode = 404;
        throw notFoundError;
    }
  
    await invalidateUserCache(req.userId, req.params.id);
    res.json({ message: 'Note updated successfully', note });
}));

router.delete('/:id', asyncHandler(async (req, res, next) => {
    const note = await Note.findOneAndDelete({ _id: req.params.id, userId: req.userId }).exec();
  
    if (!note) {
        const error = new Error('Note not found');
        error.name = 'OperationalError';
        error.statusCode = 404;
        throw error;
    }
  
    await invalidateUserCache(req.userId, req.params.id);
    res.json({ message: 'Note deleted successfully' });
}));

router.post('/refresh', asyncHandler(async (req, res, next) => {
    const logContext = { path: '/refresh', method: 'POST' };
    const cookies = req.cookies;

    if (!cookies?.refresh_token) {
        return res.status(401).json({
            success: false,
            message: 'unauthorized',
            code: 'UNAUTHORIZED'
        });
    }

    const oldRefreshToken = cookies.refresh_token;
    const user = await User.findOne({ refreshTokens: oldRefreshToken });

    if (!user) {
        try {
            const decoded = await verifyJwtAsync(oldRefreshToken, process.env.REFRESH_TOKEN_SECRET);
      
            if (decoded && decoded.userId) {
                await User.updateOne({ _id: decoded.userId }, { $set: { refreshTokens: [] } });
                logger.error({ ...logContext, userId: decoded.userId }, "Breach threat detected: All active tokens purged.");
            }
        } catch (err) {
            logger.warn({ ...logContext }, "Failed to decode untrusted reuse token verification request");
        }

        res.clearCookie('refresh_token', cookieClearOptions);
        return res.status(403).json({
            success: false,
            message: 'compromised session: please, re-authentication',
            code: 'TOKEN_COMPROMISED'
        });
    }

    try {
        const decoded = await verifyJwtAsync(oldRefreshToken, process.env.REFRESH_TOKEN_SECRET);

        user.refreshTokens = user.refreshTokens.filter(rt => rt !== oldRefreshToken);

        const newAccessToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
        const newRefreshToken = jwt.sign({ userId: user._id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

        user.refreshTokens.push(newRefreshToken);
        await user.save();

        setRefreshTokenCookies(res, newRefreshToken);
        res.json({ token: newAccessToken });

    } catch (err) {
        user.refreshTokens = user.refreshTokens.filter(rt => rt !== oldRefreshToken);
        await user.save();
    
        res.clearCookie('refresh_token', cookieClearOptions);
        return res.status(403).json({
            success: false,
            message: 'Session expired',
            code: 'TOKEN_EXPIRED'
        });
    }
}));

export default router;
