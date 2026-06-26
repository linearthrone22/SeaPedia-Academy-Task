import { Router } from 'express';
import authRoutes from './auth.routes';
import reviewRoutes from './review.routes';

const router = Router();

// Define API routes here
router.use('/auth', authRoutes);
router.use('/reviews', reviewRoutes);

export default router;
