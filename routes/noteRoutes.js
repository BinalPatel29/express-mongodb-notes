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
    const logContext = { path: '/upload', method: 'POST' };

    if (!req.files || !req.files.image) {
        logger.warn({ ...logContext }, "Image upload rejected: Missing file target");
        return res.status(400).json({
            success: false,
            message: "No image file uploaded.",
            code: 'VALIDATION_ERROR'
        });
    }

    const bodyData = req.body || {};
    const noteText = typeof bodyData.text === 'string' ? bodyData.text.trim() : "";

    const payload = { 
        text: noteText, 
        userId: req.userId 
    };

    const { error } = validateNote(payload);
    if (error) {
        logger.warn({ ...logContext, validationError: error }, "Image upload rejected: Joi validator rules check failed");
        return res.status(400).json({
            success: false,
            message: error,
            code: 'VALIDATION_ERROR'
        });
    }

    const file = req.files.image;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = uniqueSuffix + path.extname(file.name || 'upload.png');
    
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

    logger.info({ ...logContext, jobId: job.id, filename }, 'Image offloaded to background queue process successfully');

    return res.status(202).json({
        success: true,
        message: "Image uploaded and queued for background optimization processing.",
        jobId: job.id
    });
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

export default router;
