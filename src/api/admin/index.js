import express from 'express';
import companyRoutes from './companies/company.route.js';
import aiUsageRoutes from './ai-usage/aiUsage.route.js';

const router = express.Router();

router.use('/companies', companyRoutes);
router.use('/ai-usage', aiUsageRoutes);

export default router;