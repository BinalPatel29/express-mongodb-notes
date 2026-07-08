import express, { Router } from 'express';
import Note from '../models/noteModel.js';
import { validateNote } from '../validators/noteValidator.js';
import logger from '../src/utils/logger.js';
import upload from '../js/utils/upload.js'; 

const router = Router();

const CACHE_TTL_SECONDS = 86400;

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

async function invalidateUserCache(userId) {
    if (global.redisClient) {
        const matchPattern = `notes:${userId}:*`;
        const keysToDelete = [];
        
        for await (const key of global.redisClient.scanIterator({ MATCH: matchPattern, COUNT: 100 })) {
            if (typeof key === 'string') {
                keysToDelete.push(key);
            }
        }

        if (keysToDelete.length > 0) {
            await global.redisClient.del(...keysToDelete);
            logger.info({ userId, keysCount: keysToDelete.length }, "Redis Cache Invalidated: Cleared stale data structures cleanly");
        }
    }
}

router.get('/', asyncHandler(async (req, res, next) => {
    try {
        let { page = 1, limit = 10, sort = '-createdAt', text } = req.query;

        page = Math.max(1, parseInt(page, 10) || 1);
        limit = Math.max(1, parseInt(limit, 10) || 10);
        
        const cachekeys = `notes:${req.userId}:p_${page}:l_${limit}:s_${sort}:t_${text || 'none'}`;

        if (global.redisClient) {
            const cachedData = await global.redisClient.get(cachekeys);
            if (cachedData) {
                const parsedPayload = JSON.parse(cachedData);
                if (parsedPayload?.data?.length > 0) {
                    logger.info({ userId: req.userId, cachekeys }, "Redis Cache HIT: Instantly returning data from system RAM memory");
                    return res.json(parsedPayload);
                }
            }
            logger.info({ userId: req.userId, cachekeys }, "Redis Cache MISS: Fetching live workspace records from MongoDB database");
        }
        
        let user_id = new Types.ObjectId(req.userId);
        const filter = {
            userId: user_id,
            ...(text && { text: { $regex: text, $options: 'i' } })
        };

        const allowedSort = ['createdAt', 'updatedAt', 'text', '-createdAt', '-updatedAt', '-text'];
        const finalSort = allowedSort.includes(sort) ? sort : '-createdAt';

        const [notes, totalItems] = await Promise.all([
            Note.find(filter).sort(finalSort).skip((page - 1) * limit).limit(limit).lean(),
            Note.countDocuments(filter)
        ]);

        const responsePayload = {
            success: true,
            data: notes,
            pagination: {
                totalItems,
                totalPages: Math.ceil(totalItems / limit),
                currentPage: page
            }
        };

        if (global.redisClient) {
            await global.redisClient.setEx(cachekeys, CACHE_TTL_SECONDS, JSON.stringify(responsePayload));
        }
        res.json(responsePayload);
    } catch(error) {
        next(error);
    }
}));

router.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
       return res.status(400).json({ message : 'No file uploaded' });
    }
    const imageUrl = `http://localhost:3000/uploads/${req.file.filename}`;
    res.status(200).json({
        message: "image uploaded successfully",
        imageUrl: imageUrl
    });
});

router.post('/', asyncHandler(async (req, res, next) => {
    const logContext = { path: '/notes', method: 'POST', userId: req.userId };
    const payload = {
        text: req.body.text,
        userId: req.userId
    };
    const { error } = validateNote(payload);
       
    if (error) {
        const errorMsg = error.details?.[0]?.message || error.message;
        logger.warn({ ...logContext, validationError: errorMsg }, "Note creation validation failed");

        const validationError = new Error(errorMsg);
        validationError.statusCode = 400;
        throw validationError;
    }
    
    const note = new Note({ 
        text: req.body.text, 
        userId: req.userId,
        imageUrl: req.body.imageUrl || "" 
    });
    await note.save();

    await invalidateUserCache(req.userId);

    logger.info({ ...logContext, noteId: note._id }, "Note written to database successfully");
    res.status(201).json(note);
}));

router.patch('/:id', asyncHandler(async (req, res, next) => {
    const logContext = { path: `/notes/${req.params.id}`, method: 'PATCH', userId: req.userId, noteId: req.params.id };
    const payload = {
        text: req.body.text,
        userId: req.userId
    };
    const { error } = validateNote(payload);

    if (error) {
        const errorMsg = error.details?.[0]?.message || error.message;
        logger.warn({ ...logContext, validationError: errorMsg }, "Note modification validation failed");

        const validationError = new Error(errorMsg);
        validationError.statusCode = 400;
        throw validationError;
    }

    const note = await Note.findOneAndUpdate(
        { _id: req.params.id, userId: req.userId }, 
        req.body, 
        { new: true }
    );

    if (!note) {
        logger.warn({ ...logContext }, "Note patch rejected: Target document record not found or unauthorized");
        const notFoundError = new Error('Note not found');
        notFoundError.statusCode = 404;
        throw notFoundError;
    } 

    await invalidateUserCache(req.userId);

    logger.info({ ...logContext }, "Note record updated successfully");
    res.json({ message: 'Note updated successfully', note });
}));

router.delete('/:id', asyncHandler(async (req, res, next) => {
    const logContext = { path: `/notes/${req.params.id}`, method: 'DELETE', userId: req.userId, noteId: req.params.id };
    const note = await Note.findOneAndDelete({ _id: req.params.id, userId: req.userId });

    if (!note) {
        const error = new Error('Note not found');
        error.statusCode = 404;
        throw error;
    }

    await invalidateUserCache(req.userId);

    logger.info({ ...logContext }, "Note record deleted successfully");
    res.json({ message: 'Note deleted successfully' });
}));

export default router;
