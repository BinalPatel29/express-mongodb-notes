// Import the unstable_mockModule method from Jest globals to mock ES modules before importing them
import { jest } from '@jest/globals';

// Unstable mock for authValidator.js so we don't hit real database validations during auth tests
jest.unstable_mockModule('../validators/authValidator.js', () => ({
  validateRegister: () => ({ error: null }),
  validateLogin: () => ({ error: null })
}));

// Unstable mock for noteValidator.js so we don't hit real database validations during note tests
jest.unstable_mockModule('../validators/noteValidator.js', () => ({
  validateNote: () => ({ error: null })
}));

// Import Supertest to make HTTP requests against the Express app
const request = (await import('supertest')).default;

// Import Mongoose to connect to and manage the in-memory MongoDB instance
const mongoose = (await import('mongoose')).default;

// Import MongoMemoryServer to spin up an in-memory database for testing
const { MongoMemoryServer } = await import('mongodb-memory-server');

// Import Express to initialize the mock server application
const express = (await import('express')).default;

// Import Helmet for security headers
const helmet = (await import('helmet')).default;

// Import CORS to handle Cross-Origin Resource Sharing
const cors = (await import('cors')).default;

// Import authentication routes
const authRouter = (await import('../routes/authRoutes.js')).default;

// Import note routes
const noteRouter = (await import('../routes/noteRoutes.js')).default;

// Import the protect middleware to secure routes and verify JWT tokens
const { protect } = await import('../middleware/auth.js');

// Import the error handler middleware to catch application errors
const errorHandler = (await import('../middleware/errorHandler.js')).default;

// Import the logger utility
const logger = (await import('../src/utils/logger.js')).default;

// Runs once before all tests in this file
beforeAll(() => {
  logger.level = 'silent'; // Mute the logger output to keep test logs clean
  process.env.JWT_SECRET = 'test-environment-jwt-secret-key-12345'; // Set a JWT secret for testing
});

// Global variables to hold the mock server, database connection, user tokens, and note IDs
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

// Setup the in-memory database and express application before any tests run
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create(); // Spin up in-memory MongoDB
  const mongoUri = mongoServer.getUri(); // Get the connection string for the in-memory DB
  await mongoose.connect(mongoUri); // Connect Mongoose to the in-memory DB

  app = express(); // Initialize the Express application
  
  // Apply middleware for security and standard application behavior
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors());
  app.use(express.json());

  // Mount routes and middlewares
  app.use('/api/auth', authRouter); // Auth routes are public
  app.use('/api/notes', protect, noteRouter); // Note routes are protected by the protect middleware
  app.use(errorHandler); // Catch-all error handler middleware
}, 60000); // Allow up to 60 seconds for this setup to complete (e.g., downloading/starting MongoDB binary)

// Teardown step to disconnect mongoose and stop the in-memory server after all tests finish
afterAll(async () => {
  await mongoose.disconnect(); // Disconnect from the database
  if (mongoServer) {
    await mongoServer.stop(); // Stop the MongoMemoryServer instance
  }
});

// Group of tests checking authentication endpoints (/api/auth)
describe('AUTHENTICATION ENDPOINT TESTS', () => {
  
  // Verify successful user registration
  it('should successfully register a brand new user profile', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser); // Send test user data to the register endpoint
    expect(res.statusCode).toBe(201); // Expect a 201 Created status
    expect(res.body.message).toBe('User registered successfully'); // Verify response message
  });

  // Verify that registering with an already existing email returns an error
  it('should block registration if the email account already exists', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser); // Send duplicate user data
    expect(res.statusCode).toBe(400); // Expect a 400 Bad Request status
  });

  // Verify that correct login credentials generate and return a JSON Web Token (JWT)
  it('should successfully authenticate user and yield a JWT', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password }); // Send correct credentials
    expect(res.statusCode).toBe(200); // Expect a 200 OK status
    expect(res.body).toHaveProperty('token'); // Verify the token is present in the response
    validToken = res.body.token; // Save the token globally for subsequent protected requests
  });

  // Verify that an incorrect password returns an unauthorized error
  it('should reject login access when an incorrect password is utilized', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'DefinitelyTheWrongPassword123' }); // Send incorrect password
    expect(res.statusCode).toBe(401); // Expect a 401 Unauthorized status
  });
});

// Group of tests checking route protection and authorization middleware
describe('ROUTE ACCESS AND TOKEN PROTECTION TESTS', () => {
  
  // Verify that accessing a protected route without an Authorization header is blocked
  it('should block access to notes endpoints if authorization header is entirely missing', async () => {
    const res = await request(app)
      .get('/api/notes'); // Try accessing without any token
    expect(res.statusCode).toBe(401); // Expect a 401 Unauthorized status
  });

  // Verify that accessing a protected route with an invalid or malformed token is blocked
  it('should deny entrance if the authorization token is altered or malformed', async () => {
    const res = await request(app)
      .get('/api/notes')
      .set('Authorization', 'Bearer this-is-a-completely-fake-token-string'); // Send fake token
    expect(res.statusCode).toBe(401); // Expect a 401 Unauthorized status
  });
});

// Group of tests testing CRUD operations on notes (/api/notes)
describe('CRUD COMPLIANCE VERIFICATION (NOTES)', () => {
  
  // Verify that an authenticated user can create a new note
  it('should permit verified users to save a note resource entity', async () => {
    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${validToken}`) // Pass the saved valid JWT
      .send({ text: 'Review the express-rate-limit tracking structures inside node windows.' }); // Note payload
    expect(res.statusCode).toBe(201); // Expect a 201 Created status
    expect(res.body).toHaveProperty('_id'); // Verify the returned note has an ID
    testNoteId = res.body._id; // Save the note ID globally for subsequent edit/delete tests
  });

  // Verify that an authenticated user can fetch their created notes
  it('should compile and return a data listing array owned by the account', async () => {
    const res = await request(app)
      .get('/api/notes')
      .set('Authorization', `Bearer ${validToken}`); // Pass the saved valid JWT
    expect(res.statusCode).toBe(200); // Expect a 200 OK status
    expect(Array.isArray(res.body)).toBe(true); // Verify that the response is a list/array of items
  });

  // Verify that an authenticated user can update one of their notes
  it('should apply property transformations targeting a verified document item', async () => {
    const res = await request(app)
      .patch(`/api/notes/${testNoteId}`) // Hit the specific note's update endpoint
      .set('Authorization', `Bearer ${validToken}`) // Pass the saved valid JWT
      .send({ text: 'Updated integration text strings tracking database states.' }); // Updated text payload
    expect(res.statusCode).toBe(200); // Expect a 200 OK status
    expect(res.body.message).toBe('Note updated successfully'); // Verify the response message
  });

  // Verify that an authenticated user can delete one of their notes
  it('should wipe out a target document item from active state storage collections', async () => {
    const res = await request(app)
      .delete(`/api/notes/${testNoteId}`) // Hit the specific note's delete endpoint
      .set('Authorization', `Bearer ${validToken}`); // Pass the saved valid JWT
    expect(res.statusCode).toBe(200); // Expect a 200 OK status
    expect(res.body.message).toBe('Note deleted successfully'); // Verify the response message
  });
});
