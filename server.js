import express from 'express';
import mongoose from 'mongoose';
import 'dotenv/config';
import authRouter from './routes/authRoutes.js';
import noteRouter from './routes/noteRoutes.js';
import { protect } from './middleware/auth.js';
import cors from 'cors';
import logger from './src/utils/logger.js'; 
import User from './models/userModel.js'; 
import errorHandler from './middleware/errorHandler.js';
import helmet from 'helmet';         // Secures server against hackers
import { rateLimit } from 'express-rate-limit';        // Overloading server with request
import { createClient } from 'redis';

const app = express();
const PORT = process.env.PORT || 3000;

// HELMET HEADERS 
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS CONFIGURATION 
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://127.0.0.1:5501']; 
  
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn({ origin }, "CORS blocked unauthorized origin request");
      callback(null, false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'],
  credentials: true,
  optionsSuccessStatus: 204       // success status-code
};
app.use(cors(corsOptions));

// GLOBAL RATE LIMITER 
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { status: 429, error: "Too many requests, please try again later." },
  standardHeaders: false,        // sends-modern, http-headers
  legacyHeaders: false,          // sends-older, rate-limit-headers
  handler: (req, res, next, options) => {
    logger.warn({ ip: req.ip, path: req.path }, "Global rate limit exceeded by client ip");
    res.status(options.statusCode).json(options.message);
  }
});
app.use(globalLimiter);

// AUTH RATE LIMITER
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 20, 
  message: { status: 429, error: "Too many authentication attempts. Please try again after 15 minutes." },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn({ ip: req.ip, path: req.path }, 'Auth rate limit exceeded! Potential brute force attempt.');
    res.status(options.statusCode).json(options.message);
  }
});

app.use(express.json());

// Malformed JSON Middleware
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    logger.warn({ path: req.path, method: req.method }, 'Incoming request failed: Malformed JSON payload received');
    return res.status(400).json({ status: 400, message: 'Malformed JSON payload' });
  }
  next(err);
});

// Database Connection
if (!process.env.MONGO_URI) {
  logger.fatal('Application crash initialization error: Missing MONGO_URI string inside environment configuration settings');
  process.exit(1);
}

// Redis connection client
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});
redisClient.on('error' , (err) =>  {logger.error({ error: err.message}, 'Redis engine connection error')});

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    logger.info('Database connection verified: MongoDB connected successfully');
    
    try {
      await redisClient.connect();
      logger.info('Cache connection verified: Redis engine connected successfully');
      global.redisClient = redisClient;
    } catch (redisError) {
      logger.error({ error: redisError.message }, 'Critical initialization error: Redis setup failed');
    }

    try {
      await User.syncIndexes();
      logger.info('Database collection indexes synchronized successfully');
    } catch (indexError) {
      logger.warn({ error: indexError.message }, 'Non-fatal database index synchronization warning');
    }
  })
  .catch((err) => {
    logger.error({ error: err.message, stack: err.stack }, 'Database operational system connection failed');
  });

// Static Assets
app.use('/frontend', express.static('frontend'));
app.use('/js', express.static('js'));
app.use('/css', express.static('css'));

// Routes
app.get('/api/new', (req, res) => {
  logger.info({ path: '/api/new', method: 'GET' }, 'Healthcheck baseline verification requested');
  res.status(200).json({ message: 'ok' });
});

// ROUTING WITH ROUTE-SPECIFIC MIDDLEWARE 
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/notes', protect, noteRouter);

app.get('/', (req, res) => {
  res.redirect('/frontend/register.html');
});

// Fallback 404
app.use((req, res) => {
  logger.warn({ path: req.path, method: req.method }, 'Client attempted to hit non-existent endpoint pipeline');
  res.status(404).json({ error: 'Route not found' });
});

// Global Error Interceptor
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server initialized interface: Process actively listening on web communications interface port bindings: ${PORT}`);
});
