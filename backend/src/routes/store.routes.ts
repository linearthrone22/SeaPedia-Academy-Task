import { Router } from 'express';
import { createStore, getMyStore, updateStore, getPublicStore } from '../controllers/store.controller';
import { verifyToken, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// Seller store routes
router.post('/seller/store', verifyToken, requireRole('SELLER'), createStore);
router.get('/seller/store', verifyToken, requireRole('SELLER'), getMyStore);
router.put('/seller/store', verifyToken, requireRole('SELLER'), updateStore);

// Public store route
router.get('/stores/:id', getPublicStore);

export default router;
