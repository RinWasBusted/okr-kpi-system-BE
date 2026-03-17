import express from 'express';
import prisma from './utils/prisma';
import cookieParser from 'cookie-parser';
import apiRouter from './api';
import errorHandler from './middlewares/errorHandler';
import responseHandler from './middlewares/responseHandler';

const createApp = () => {
  const app = express();
  
  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(responseHandler);


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

  prisma.$connect()
    .then(() => {
      console.log('Connected to the database successfully!');
    })
    .catch((error) => {
      console.error('Error connecting to the database:', error);
    });

  return app;
};

export { createApp };
