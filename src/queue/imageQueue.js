import { Queue } from 'bullmq';

const redisOptions = process.env.REDIS_URL 
  ? { url: process.env.REDIS_URL, maxRetriesPerRequest: null }
  : { 
      host: process.env.REDIS_HOST || "127.0.0.1", 
      port: parseInt(process.env.REDIS_PORT || "6379", 10), 
      maxRetriesPerRequest: null 
    };

export const imageQueue = new Queue("imageJobQueue", { 
  connection: redisOptions 
});
