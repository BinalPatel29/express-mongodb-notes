import { Worker } from 'bullmq';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger.js';
import Note from '../../models/noteModel.js';

const redisOptions = { 
    host: process.env.REDIS_HOST || "127.0.0.1", 
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    maxRetriesPerRequest: null 
};

const uploadDir = path.resolve('./uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

let workerInstance = null;

export function startImageWorker() {
    if (workerInstance) return workerInstance;

    workerInstance = new Worker("imageJobQueue", async (job) => {
        const { originalname, bufferData, filename, isTest, mimetype, text, userId } = job.data;
        const outputPath = path.join(uploadDir, filename);
    
        const base64String = typeof bufferData === 'string' ? bufferData : (bufferData?.data || "");
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

        if (global.io) {
            global.io.emit('liveNotification', { 
                text: `image resizing successfully: ${originalname}`, 
                filename: filename 
            });
        }

        logger.info({ jobId: job.id, filename }, "Background image optimization completed successfully");
        return { imageUrl, noteId: note._id };
    }, { connection: redisOptions, concurrency: 3 });

    workerInstance.on('failed', (job, err) => {
        logger.error({ jobId: job?.id, error: err.message }, "Background image optimization job failed");
    });

    return workerInstance;
}

if (process.env.NODE_ENV !== 'test') {
    startImageWorker();
}
