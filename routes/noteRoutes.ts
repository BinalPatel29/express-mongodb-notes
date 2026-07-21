import { Router, Request, Response, NextFunction } from 'express'; 
import Note from '../models/noteModel.js'; 
import { validateNote } from '../validators/noteValidator.js'; 
import logger from '../src/utils/logger.js'; 
import { Types } from 'mongoose'; 
import path from 'path'; 
import { imageQueue } from '../src/queue/imageQueue.js'; 
import { RedisClientType } from 'redis'; 
// Added queueJobsWaiting to metrics imports
import { cacheHitTotal, cacheMissTotal, queueJobsWaiting } from '../metrics.js'; 

declare global { 
  var redisClient: RedisClientType | null | undefined; 
} 

interface CustomRequest extends Request { 
  userId?: string; 
  // Using 'any' bypasses writing complex nested properties for its custom upload shapes 
  files?: any; 
} 

interface EnhancedError extends Error { 
  statusCode?: number; 
} 

const router = Router(); 
const CACHE_TTL_SECONDS = 86400; 

const asyncHandler = (fn: Function) => (req: CustomRequest, res: Response, next: NextFunction) => { 
  Promise.resolve(fn(req, res, next)).catch(next); 
}; 

async function invalidateUserCache(userId: unknown, specificNoteId: string | null = null): Promise<void> { 
  const redis = global.redisClient; 
  if (redis) { 
    try { 
      const cleanUserId = String(userId); 
      const matchPattern = `notes:${userId}:*`; 
      const keysToDelete = await redis.keys(matchPattern); 
      if (keysToDelete.length > 0) { 
        await redis.del(keysToDelete); 
      } 
      if (specificNoteId) { 
        await redis.del(`note:${cleanUserId}:${specificNoteId}`); 
      } 
      logger.info( 
        { userId: cleanUserId, specificNoteId, listingCleared: keysToDelete.length }, 
        "Redis Cache Invalidation Completed Successfully" 
      ); 
    } catch (scanError: unknown) { 
      const errMsg = scanError instanceof Error ? scanError.message : String(scanError); 
      logger.error({ error: errMsg, userId }, "Failed to clear Redis cache keys"); 
    } 
  } 
} 

router.get('/', asyncHandler(async (req: CustomRequest, res: Response): Promise<Response | void> => { 
  let { page, limit, sort, text } = req.query; 
  const parsedPage = Math.max(1, parseInt(page as string, 10) || 1); 
  const parsedLimit = Math.max(1, parseInt(limit as string, 10) || 10); 
  const currentSort = (sort as string) || '-createdAt'; 
  const currentText = (text as string) || ''; 
  const currentUserId = req.userId || ''; 
  const cachekeys = `notes:${currentUserId}:p_${parsedPage}:l_${parsedLimit}:s_${currentSort}:t_${currentText || 'none'}`; 
  const redis = global.redisClient; 
  
  if (redis) { 
    const cachedListing = await redis.get(cachekeys); 
    if (cachedListing) { 
      cacheHitTotal.inc(); 
      logger.info({ userId: currentUserId, cacheKey: cachekeys }, "Redis List Cache HIT..."); 
      return res.json(JSON.parse(cachedListing)); 
    } 
  } 
  
  cacheMissTotal.inc(); 
  
  // Mongoose queries expect custom ObjectId types, which throws errors against pure strings 
  const filter = { 
    userId: currentUserId as any, 
    ...(currentText && { text: { $regex: currentText, $options: 'i' } }) 
  }; 
  const allowedSort = ['createdAt', 'updatedAt', 'text', '-createdAt', '-updatedAt', '-text']; 
  const finalSort = allowedSort.includes(currentSort) ? currentSort : '-createdAt'; 
  logger.info({ filter }); 
  
  const [notes, totalItems] = await Promise.all([ 
    Note.find(filter as any).sort(finalSort).skip((parsedPage - 1) * parsedLimit).limit(parsedLimit).lean(), 
    Note.countDocuments(filter as any) 
  ]); 
  
  const responsePayload = { 
    success: true, 
    data: notes, 
    pagination: { totalItems, totalPages: Math.ceil(totalItems / parsedLimit), currentPage: parsedPage } 
  }; 
  
  if (redis) { 
    await redis.setEx(cachekeys, CACHE_TTL_SECONDS, JSON.stringify(responsePayload)); 
  } 
  res.json(responsePayload); 
})); 

router.get('/:id', asyncHandler(async (req: CustomRequest, res: Response): Promise<Response | void> => { 
  const noteId = req.params['id']; 
  const currentUserId = req.userId || ''; 
  const cacheKey = `note:${currentUserId}:${noteId}`; 
  const redis = global.redisClient; 
  
  if (redis) { 
    const cachedNote = await redis.get(cacheKey); 
    if (cachedNote) { 
      cacheHitTotal.inc(); 
      logger.info({ userId: currentUserId, noteId }, "Redis Single Cache HIT: Instantly returning single note record"); 
      return res.json(JSON.parse(cachedNote)); 
    } 
  } 
  
  cacheMissTotal.inc(); 
  
  // Overcomes strict typing conflicts between string fields and schema object structures. 
  const note = await Note.findOne({ _id: noteId, userId: currentUserId } as any).lean(); 
  if (!note) { 
    const notFoundError: EnhancedError = new Error('Note not found'); 
    notFoundError.statusCode = 404; 
    throw notFoundError; 
  } 
  
  if (redis) { 
    await redis.setEx(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(note)); 
  } 
  logger.info({ userId: currentUserId, noteId }, "Redis Single Cache MISS: Record successfully fetched from MongoDB"); 
  return res.json(note); 
})); 

router.get('/stats/activity', asyncHandler(async (req: CustomRequest, res: Response): Promise<void> => { 
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); 
  const currentUserId = req.userId || ''; 
  const stats = await Note.aggregate([ 
    { $match: { userId: new Types.ObjectId(currentUserId), createdAt: { $gte: thirtyDaysAgo } } }, 
    { $group: { _id: "$userId", totalNotes: { $sum: 1 } } }, 
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "userProfile" } }, 
    { $unwind: { path: "$userProfile", preserveNullAndEmptyArrays: true } }, 
    { $project: { _id: 0, userId: "$_id", totalNotes: 1, userEmail: "$userProfile.email", userName: { $concat: ["$userProfile.firstName", " ", "$userProfile.lastName"] } } } 
  ]); 
  res.json({ success: true, data: stats[0] || { userId: currentUserId, totalNotes: 0, userName: "", userEmail: "" } }); 
})); 

router.post('/upload', asyncHandler(async (req: CustomRequest, res: Response): Promise<Response | void> => { 
  const logContext = { path: '/upload', method: 'POST' }; 
  if (!req.files || !req.files.image) { 
    logger.warn({ ...logContext }, "Image upload rejected: Missing file target"); 
    return res.status(400).json({ success: false, message: "No image file uploaded.", code: 'VALIDATION_ERROR' }); 
  } 
  const bodyData = req.body || {}; 
  const noteText = typeof bodyData.text === 'string' ? bodyData.text.trim() : ""; 
  const currentUserId = req.userId || ''; 
  const payload = { text: noteText, userId: currentUserId }; 
  const result = validateNote(payload); 
  if (!result.success) { 
    logger.warn({ ...logContext, validationError: result.error }, "Image upload rejected: Joi validator rules check failed"); 
    return res.status(400).json({ success: false, message: "Validation failed", errors: result.error, code: 'VALIDATION_ERROR' }); 
  } 
  const file = req.files.image; 
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); 
  const filename = uniqueSuffix + path.extname(file.name || 'upload.png'); 
  const bufferData = file.data.toString('base64'); 
  
  const job = await imageQueue.add('optimizeImage', { 
    originalname: file.name, 
    bufferData, 
    filename, 
    isTest: process.env['NODE_ENV'] === 'test', 
    mimetype: file.mimetype, 
    text: payload.text, 
    userId: currentUserId 
  }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }); 
  
  // Track queue backlog addition for Prometheus monitoring
  queueJobsWaiting.inc(); 
  
  logger.info({ ...logContext, jobId: job.id, filename }, 'Image offloaded to background queue process successfully'); 
  return res.status(202).json({ success: true, message: "Image uploaded and queued for background optimization processing.", jobId: job.id }); 
})); 

// parsing objects requires safe type-guarding via 'unknown' 
router.post('/', asyncHandler(async (req: CustomRequest, res: Response): Promise<Response | void> => { 
  const currentUserId = req.userId || ''; 
  const payload = { text: req.body.text, userId: currentUserId, imageUrl: req.body.imageUrl }; 
  const result = validateNote(payload); 
  if (!result.success) { 
    return res.status(400).json({ success: false, message: "Validation failed", errors: result.error, code: 'VALIDATION_ERROR' }); 
  } 
  const note = new Note({ text: req.body.text, userId: currentUserId, imageUrl: req.body.imageUrl || "" }); 
  await note.save(); 
  await invalidateUserCache(currentUserId); 
  res.status(201).json(note); 
})); 

router.patch('/:id', asyncHandler(async (req: CustomRequest, res: Response): Promise<Response | void> => { 
  const currentUserId = req.userId || ''; 
  const payload = { text: req.body.text, userId: currentUserId }; 
  const result = validateNote(payload); 
  if (!result.success) { 
    return res.status(400).json({ success: false, message: "Validation failed", errors: result.error, code: 'VALIDATION_ERROR' }); 
  } 
  // This allows the query options block to take raw configurations smoothly 
  const note = await (Note as any).findOneAndUpdate( 
    { _id: req.params['id'], userId: currentUserId }, 
    { text: req.body.text }, 
    { returnDocument: 'after' } 
  ); 
  if (!note) { 
    const notFoundError: EnhancedError = new Error('Note not found'); 
    notFoundError.statusCode = 404; 
    throw notFoundError; 
  } 
  await invalidateUserCache(currentUserId, req.params['id'] as string); 
  res.json({ message: 'Note updated successfully', note }); 
})); 

router.delete('/:id', asyncHandler(async (req: CustomRequest, res: Response): Promise<Response | void> => { 
  const currentUserId = req.userId || ''; 
  // Safely passes plain text routing params directly into the execution block 
  const note = await (Note as any).findOneAndDelete({ _id: req.params['id'], userId: currentUserId }).exec(); 
  if (!note) { 
    const error: EnhancedError = new Error('Note not found'); 
    error.name = 'OperationalError'; 
    error.statusCode = 404; 
    throw error; 
  } 
  await invalidateUserCache(currentUserId, req.params['id'] as string); 
  res.json({ message: 'Note deleted successfully' }); 
})); 

export default router;
