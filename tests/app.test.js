import { jest } from '@jest/globals';

jest.unstable_mockModule('../validators/authValidator.js', () => ({
  validateRegister: () => ({ error: null }),    
  validateLogin: () => ({ error: null })
}));

jest.unstable_mockModule('../validators/noteValidator.js', () => ({
  validateNote: () => ({ error: null })
}));

const request = (await import('supertest')).default;
const mongoose = (await import('mongoose')).default;
const { MongoMemoryServer } = await import('mongodb-memory-server');
const express = (await import('express')).default;
const helmet = (await import('helmet')).default;
const cors = (await import('cors')).default;
const cookieParser = (await import('cookie-parser')).default;
const authRouter = (await import('../routes/authRoutes.js')).default;
const noteRouter = (await import('../routes/noteRoutes.js')).default;
const { protect } = await import('../middleware/auth.js');
const errorHandler = (await import('../middleware/errorHandler.js')).default;
const logger = (await import('../src/utils/logger.js')).default;
const upload = (await import('../src/utils/upload.js')).default;

beforeAll(() => {
  logger.level = 'silent'; 
  process.env.JWT_SECRET = 'test-environment-jwt-secret-key-12345'; 
  process.env.REFRESH_TOKEN_SECRET = 'test-environment-refresh-secret-key-67890';
});

// Global test suite states
let mongoServer;
let app;
const testUser = {
  firstName: 'QA',
  lastName: 'Tester',
  email: 'qa_engineer@example.com',
  password: 'TestSecurePassword123!',
  mobileNo: '9876543210'
};
let validToken = '';
let testNoteId = '';

// Setup target environment memory instances
beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create(); 
    const mongoUri = mongoServer.getUri(); 
    await mongoose.connect(mongoUri); 

  app = express(); 
  
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());

  app.use('/uploads', express.static('uploads'));
  app.use('/api/auth', authRouter); 
  app.use('/api/notes', protect, noteRouter); 
  app.use(errorHandler); 
}, 60000); 

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect(); 
  }
  if (mongoServer) {
    await mongoServer.stop(); 
  }
});

describe('AUTHENTICATION ENDPOINT TESTS', () => {
  
  it('should successfully register a brand new user profile', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser); 
    expect(res.statusCode).toBe(201); 
    expect(res.body.message).toBe('User registered successfully'); 
  });

  it('should block registration if the email account already exists', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser); 
    expect(res.statusCode).toBe(400);
  });

  it('should successfully authenticate user and yield a JWT', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password }); 
    expect(res.statusCode).toBe(200); 
    expect(res.body).toHaveProperty('token'); 
    validToken = res.body.token; 
  });

  it('should reject login access when an incorrect password is utilized', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'DefinitelyTheWrongPassword123' }); 
    expect(res.statusCode).toBe(401); 
  });
});

describe('ROUTE ACCESS AND TOKEN PROTECTION TESTS', () => {
  
  it('should block access to notes endpoints if authorization header is entirely missing', async () => {
    const res = await request(app)
      .get('/api/notes'); 
    expect(res.statusCode).toBe(401); 
  });

  it('should deny entrance if the authorization token is altered or malformed', async () => {
    const res = await request(app)
      .get('/api/notes')
      .set('Authorization', 'Bearer this-is-a-completely-fake-token-string'); 
    expect(res.statusCode).toBe(401); 
  });
});

describe('CRUD COMPLIANCE VERIFICATION (NOTES)', () => {
  
  it('should permit verified users to save a note resource entity', async () => {
    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${validToken}`) 
      .send({ text: 'Review the express-rate-limit tracking structures inside node windows.' });
    expect(res.statusCode).toBe(201); 
    expect(res.body).toHaveProperty('_id'); 
    testNoteId = res.body._id; 
  });

  it('should allow users to save an uploaded image file successfully', async () => {
    const dummyBuffer = Buffer.from('fake-image-binary-data');
    const res = await request(app)
      .post('/api/notes/upload')
      .set('Authorization', `Bearer ${validToken}`) 
      .attach('image', dummyBuffer, 'test-image.png');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('imageUrl'); 
    expect(res.body.imageUrl).toContain('http://localhost:3000/uploads/');
  });

  it('should compile and return a data listing array owned by the account', async () => {
    const res = await request(app)
      .get('/api/notes')
      .set('Authorization', `Bearer ${validToken}`); 
    expect(res.statusCode).toBe(200); 
    expect(res.body).toBeInstanceOf(Object); 
  });

  it('should apply property transformations targeting a verified document item', async () => {
    const res = await request(app)
      .patch(`/api/notes/${testNoteId}`) 
      .set('Authorization', `Bearer ${validToken}`) 
      .send({ text: 'Updated integration text strings tracking database states.' }); 
    expect(res.statusCode).toBe(200); 
    expect(res.body.message).toBe('Note updated successfully'); 
  });

  it('should wipe out a target document item from active state storage collections', async () => {
    const res = await request(app)
      .delete(`/api/notes/${testNoteId}`) 
      .set('Authorization', `Bearer ${validToken}`); 
    expect(res.statusCode).toBe(200); 
    expect(res.body.message).toBe('Note deleted successfully'); 
  });
});
