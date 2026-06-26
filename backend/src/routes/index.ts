import { Router } from 'express';
import authRoutes from './auth.routes';

const router = Router();

// Define API routes here
router.use('/auth', authRoutes);

export default router;
