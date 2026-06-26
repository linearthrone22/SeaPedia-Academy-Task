import { Router } from 'express';
import authRoutes from './auth.routes';
import reviewRoutes from './review.routes';
import storeRoutes from './store.routes';
import productRoutes from './product.routes';

const router = Router();

// Define API routes here
router.use('/auth', authRoutes);
router.use('/reviews', reviewRoutes);
router.use('/', storeRoutes);
router.use('/', productRoutes);

export default router;
