import { Router } from 'express';
import authRoutes from './auth.routes';
import reviewRoutes from './review.routes';
import storeRoutes from './store.routes';
import productRoutes from './product.routes';
import walletRoutes from './wallet.routes';
import addressRoutes from './address.routes';
import cartRoutes from './cart.routes';
import orderRoutes from './order.routes';

const router = Router();

// Define API routes here
router.use('/auth', authRoutes);
router.use('/reviews', reviewRoutes);
router.use('/', storeRoutes);
router.use('/', productRoutes);
router.use('/', walletRoutes);
router.use('/', addressRoutes);
router.use('/', cartRoutes);
router.use('/', orderRoutes);

export default router;
