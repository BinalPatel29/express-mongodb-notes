import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import 'dotenv/config';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import fileUpload from 'express-fileupload';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createClient, RedisClientType } from 'redis';
import { rateLimit, Options } from 'express-rate-limit';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import authRouter from './routes/authRoutes.js';
import noteRouter from './routes/noteRoutes.js';
import { protect } from './middleware/auth.js';
import logger from './src/utils/logger.js';
import User from './models/userModel.js';
import errorHandler from './middleware/errorHandler.js';
import { imageQueue } from './src/queue/imageQueue.js';
import { setupWorker } from "@socket.io/sticky";
import { createAdapter } from "@socket.io/redis-adapter";
import cluster from 'cluster';

declare global {
  var io: Server | undefined;
  var redisClient: RedisClientType | null | undefined;
}

if (!process.env.REDIS_HOST && process.env.DOCKER_ENV !== 'true') {
  process.env.REDIS_HOST = '127.0.0.1';
}

const PORT = process.env.PORT || 3000;

await import('./src/worker/imageWorker.js');

const app = express();

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(imageQueue)],
  serverAdapter: serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());
logger.info(`[Worker ${process.pid}] Queue management UI dashboard mounted successfully.`);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://127.0.0.1:5501'],
    credentials: true,
    methods: ['GET', 'POST']
  }
});

global.io = io;

app.use(express.json());
app.use(cookieParser());
app.use(fileUpload());
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://127.0.0.1:5501'];
const corsOptions: cors.CorsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn({ origin }, "CORS blocked unauthorized origin request");
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'],
  credentials: true,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

app.use('/frontend', express.static('frontend'));
app.use('/js', express.static('js'));
app.use('/css', express.static('css'));
app.use('/uploads', express.static('uploads'));
app.use(express.static('public'));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: "Too many requests, please try again later.", code: "TOO_MANY_REQUESTS" },
  standardHeaders: false,
  legacyHeaders: false,
  handler: (req: Request, res: Response, next: NextFunction, options: Options) => {
    logger.warn({ ip: req.ip, path: req.path }, "Global rate limit exceeded by client ip");
    res.status(options.statusCode).json(options.message);
  }
});
app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many authentication attempts. Please try again after 15 minutes.", code: "TOO_MANY_REQUESTS" },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req: Request, res: Response, next: NextFunction, options: Options) => {
    logger.warn({ ip: req.ip, path: req.path }, 'Auth rate limit exceeded! Potential brute force attempt.');
    res.status(options.statusCode).json(options.message);
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: "Too many login attempts. Please try again after 15 minutes.", code: "TOO_MANY_REQUESTS" },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req: Request, res: Response, next: NextFunction, options: Options) => {
    logger.warn({ ip: req.ip, path: req.path }, 'Login rate limit exceeded! Bruteforce attack vector blocked.');
    res.status(options.statusCode).json(options.message);
  }
});

// parsing objects requires safe type-guarding via 'unknown'
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  // Added safety verification before looking up properties inside 'unknown' type
  if (err && typeof err === 'object' && 'status' in err && err.status === 400 && 'body' in err) {
    logger.warn({ path: req.path, method: req.method }, 'Incoming request failed: Malformed JSON payload received');
    return res.status(400).json({ status: 400, message: 'Malformed JSON payload' });
  }
  next();
});

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redisClient: RedisClientType = createClient({ url: redisUrl }); 
const pubClient: RedisClientType = createClient({ url: redisUrl });       
const subClient = pubClient.duplicate();                                  

redisClient.on('error', (err: Error) => {
  logger.error({ error: err.message }, 'Redis engine connection error');
  global.redisClient = null;
});

const mongooseOptions = {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
};

async function startDatabases(): Promise<void> {
  const targetMongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/note_db";
  try {
    logger.info(`[Worker ${process.pid}] Attempting database connection handshake to: ${targetMongoUri}`);
    await mongoose.connect(targetMongoUri, mongooseOptions);
    logger.info(`[Worker ${process.pid}] Database connection verified: MongoDB connected successfully`);

    try {
      await Promise.all([
        redisClient.connect(),
        pubClient.connect(),
        subClient.connect()
      ]);
      
      logger.info(`[Worker ${process.pid}] Cache connection verified: Redis engine connected successfully`);
      global.redisClient = redisClient;

      io.adapter(createAdapter(pubClient, subClient)); 
      //'unknown' depending on tsconfig. Checking instance structures keeps logs type-safe
    } catch (redisError: unknown) {
      const errMsg = redisError instanceof Error ? redisError.message : String(redisError);
      logger.error({ error: errMsg }, 'Critical initialization error: Redis setup failed');
      global.redisClient = null;
    }

    try {
      await mongoose.connection.db?.collection('users').createIndex({ email: 1 }, { unique: true });
      logger.info(`[Worker ${process.pid}] Database collection indexes synchronized successfully`);
    } catch (indexError: unknown) {
      const errMsg = indexError instanceof Error ? indexError.message : String(indexError);
      logger.warn({ error: errMsg }, 'Non-fatal database index synchronization warning');
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error({ error: errMsg}, 'Database connection failed. MongoDB container might still be starting up.');
    logger.info('Re-queueing operational connection establishment routing handshake in 5 seconds...');
    setTimeout(startDatabases, 5000);
  }
}

startDatabases();

io.on('connection', (socket: Socket) => {
  logger.info({ socketId: socket.id, workerPid: process.pid }, 'Real-time WebSocket client gateway connected successfully');
  
  socket.on('newActivityNotice', (data: { message: string }) => {
    socket.broadcast.emit('liveNotification', { text: data.message });
  });

  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Real-time WebSocket client gateway disconnected');
  });
});

if (cluster.isWorker && typeof process.send === 'function') {
    setupWorker(io);
} else {
    logger.info(`[Worker ${process.pid}] Skipping sticky socket worker setup: Process is not a cluster fork.`);
}

app.get('/health', async (req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy';
  const redisStatus = (redisClient && redisClient.isOpen) ? 'healthy' : 'unhealthy';
  const isHealthy = mongoStatus === 'healthy' && redisStatus === 'healthy';
  
  logger.info({ path: '/health', method: 'GET', status: isHealthy ? 'UP' : 'DOWN', mongo: mongoStatus, redis: redisStatus }, 'Infrastructure healthcheck verification pinged');
  return res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'UP' : 'DOWN',
    timestamp: new Date().toISOString(),
    workerPid: process.pid,
    services: { database: mongoStatus, cache: redisStatus }
  });
});

app.get('/favicon.ico', (req: Request, res: Response) => res.status(204).end());

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/notes', protect, noteRouter);

app.get('/', (req: Request, res: Response) => {
  res.redirect('/frontend/register.html');
});

app.use((req: Request, res: Response) => {
  logger.warn({ path: req.path, method: req.method }, 'Client attempted to hit non-existent endpoint pipeline');
  res.status(404).json({ error: 'Route not found' });
});

app.use(errorHandler);
let workerServer: any = null;
if (cluster.isPrimary) {
  httpServer.listen(PORT, () => {
    logger.info(`Server infrastructure online: Standalone Process ${process.pid} listening on port ${PORT}`);
  });
} else {
  logger.info(`Server infrastructure active: Worker Node ${process.pid} processing proxy network handshakes internally.`);
}

async function handleShutdown(signal: string): Promise<void> {
  logger.info({ signal, pid: process.pid }, "Received shutdown signal. Commencing clean disconnection procedures...");
  try {
    //'any' FOR DYNAMIC IMPORT: Required because dynamic paths cannot be statically analyzed at compile time
    const workerModule: any= await import('./src/worker/imageWorker.js');
    const imageWorker = workerModule.default || workerModule.imageWorker || workerModule;
    
    if (imageWorker && typeof imageWorker.close === 'function') {
      await imageWorker.close();
      logger.info('BullMQ Background Worker instances stopped cleanly.');
    }
    
    await mongoose.connection.close();
    logger.info('MongoDB driver connection terminated.');
    
    if (redisClient.isOpen) await redisClient.quit();
    if (pubClient.isOpen) await pubClient.quit();
    if (subClient.isOpen) await subClient.quit();
    logger.info('Caching and Pub/Sub Layer Redis connections terminated.');

    if (cluster.isPrimary && workerServer) {
      workerServer.close(() => {
        logger.info('HTTP server instance offline. Exiting process safely.');
        process.exit(0);
      });
    } else {
      logger.info('Worker process resources dropped. Terminating instance sequence.');
      process.exit(0);
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error({ error: errMsg }, 'Error occurred during lifecycle graceful shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));