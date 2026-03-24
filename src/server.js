import express, { request } from 'express';
import prisma from './utils/prisma';
import { connectRedis } from './utils/redis.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { corsOptions } from './utils/cors.js';
import apiRouter from './api';
import errorHandler from './middlewares/errorHandler';
import responseHandler from './middlewares/responseHandler';
import { setupSwagger } from './config/swagger.config.js';

const createApp = async () => {
  const app = express();

  // Middleware
  app.use(cors(corsOptions));
  app.options(/.*/, cors(corsOptions));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(responseHandler);

  setupSwagger(app);

  // Routes
  app.get('/', (req, res) => {
    res.json({ message: 'Welcome to OKR-KPI System API' });
  });
  app.use('/api', apiRouter, errorHandler);


  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  try {
      await prisma.$connect();
      console.log('Connected to the database successfully!');
  } catch (error) {
      console.error('Error connecting to the database:', error);
  }

  try {
      await connectRedis();
      console.log('Connected to Redis');
  } catch (error) {
      console.error('Failed to connect to Redis', error);
  }
  
  return app;
};

export { createApp };
