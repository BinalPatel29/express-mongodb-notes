import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv'; // Corrected import syntax for dotenv
import authRouter from './routes/authRoutes.js';
import noteRouter from './routes/noteRoutes.js';
import { protect } from './middleware/auth.js';
import cors from 'cors';
import logger from './src/utils/logger.js';
import User from './models/userModel.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    logger.warn({ path: req.path, method: req.method }, 'Incoming request failed: Malformed JSON payload received');
    return res.status(400).json({ status: 400, message: 'Malformed JSON payload' });
  }
  next(err);
});

if (!process.env.MONGO_URI) {
  logger.fatal('Application crash initialization error: Missing MONGO_URI string inside environment configuration settings');
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    logger.info('Database connection verified: MongoDB connected successfully');
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

app.get('/api/new', (req, res) => {
  logger.info({ path: '/api/new', method: 'GET' }, 'Healthcheck baseline verification requested');
  res.status(200).json({ message: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/notes', protect, noteRouter);

app.use('/frontend', express.static('frontend'));
app.use('/js', express.static('js'));
app.use('/css', express.static('css'));

app.get('/', (req, res) => {
  res.redirect('/frontend/index.html');
});

app.use((req, res) => {
  logger.warn({ path: req.path, method: req.method }, 'Client attempted to hit non-existent endpoint pipeline');
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  if (err.name === 'CastError') {
    logger.warn({ path: req.path, method: req.method, error: err.message }, 'Database manipulation payload blocked: Invalid ID structural string layout query payload detected');
    return res.status(400).json({ error: 'Invalid note ID format' });
  }
  next(err);
});

app.use((err, req, res, next) => {
  logger.error(
    { path: req.path, method: req.method, error: err.message, stack: err.stack },
    'Server encountered unhandled downstream exception crash error'
  );
  res.status(500).json({ message: 'Internal Server Error' });
});

app.listen(PORT, () => {
  logger.info(`Server initialized interface: Process actively listening on web communications interface port bindings: ${PORT}`);
});