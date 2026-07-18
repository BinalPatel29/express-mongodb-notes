import { Worker, Job } from 'bullmq';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger.js';
import Note from '../../models/noteModel.js';

export interface IImageJobPayload {
  originalname: string;
  bufferData: string;
  filename: string;
  isTest: boolean;
  mimetype: string;
  text: string;
  userId: string;
}

const redisOptions = process.env['REDIS_URL']
  ? { url: process.env['REDIS_URL'], maxRetriesPerRequest: null }
  : {
      host: process.env['REDIS_HOST'] || "127.0.0.1",
      port: parseInt(process.env['REDIS_PORT'] || "6379", 10),
      maxRetriesPerRequest: null
    };

const uploadDir = path.resolve('./uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

let workerInstance: Worker | null = null;

export function startImageWorker(): Worker {
  if (workerInstance) return workerInstance;

  workerInstance = new Worker<IImageJobPayload>("imageJobQueue", async (job: Job<IImageJobPayload>) => {
    const { originalname, bufferData, filename, isTest, mimetype, text, userId } = job.data;
    const outputPath = path.join(uploadDir, filename);
    
    const base64String = typeof bufferData === 'string' ? bufferData : ((bufferData as any)?.data || "");
    const fileBuffer = Buffer.from(base64String, 'base64');
    
    logger.info({ jobId: job.id, filename }, "Background processing for image job started");

    if (isTest || !mimetype?.startsWith('image/')) {
      fs.writeFileSync(outputPath, fileBuffer);
    } else {
      await sharp(fileBuffer).rotate().toFile(outputPath);
    }

    const imageUrl = `http://localhost:3000/uploads/${filename}`;
    const note = new Note({ text, userId, imageUrl });
    await note.save();

    const redis = (global as any).redisClient;
    if (redis) {
      try {
        const staleCachePattern = `notes:${userId}:*`;
        const matchingKeys = await redis.keys(staleCachePattern);
        if (matchingKeys.length > 0) {
          await redis.del(matchingKeys);
          logger.info({ userId }, "Stale pagination cache buffers cleared for live data sync");
        }
      } catch (cacheError: any) {
        logger.error({ error: cacheError.message, userId }, "Failed to clear background cache keys");
      }
    }

    const io = (global as any).io;
    if (io) {
      io.emit('liveNotification', { text: `image resizing successfully: ${originalname}`, filename: filename });
    }

    logger.info({ jobId: job.id, filename }, "Background image optimization completed successfully");
    return { imageUrl, noteId: note._id };
  }, { 
    connection: redisOptions, 
    concurrency: 3 
  });

  workerInstance.on('failed', (job: Job<IImageJobPayload> | undefined, err: Error) => {
    logger.error({ jobId: job?.id, error: err.message }, "Background image optimization job failed");
  });

  return workerInstance;
}

if (process.env['NODE_ENV'] !== 'test') {
  startImageWorker();
}
