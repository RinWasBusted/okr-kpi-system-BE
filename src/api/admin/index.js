import express from 'express';
import companyRoutes from './company/company.route.js';

const router = express.Router();

router.use('/companies', companyRoutes);

export default router;