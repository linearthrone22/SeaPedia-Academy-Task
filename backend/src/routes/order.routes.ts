import { Router } from 'express';
import {
  checkout,
  getBuyerOrders,
  getBuyerOrderDetail,
  getSellerOrders,
  getSellerOrderDetail,
} from '../controllers/order.controller';
import { verifyToken, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// Buyer order routes
router.post('/buyer/checkout', verifyToken, requireRole('BUYER'), checkout);
router.get('/buyer/orders', verifyToken, requireRole('BUYER'), getBuyerOrders);
router.get('/buyer/orders/:id', verifyToken, requireRole('BUYER'), getBuyerOrderDetail);

// Seller order routes
router.get('/seller/orders', verifyToken, requireRole('SELLER'), getSellerOrders);
router.get('/seller/orders/:id', verifyToken, requireRole('SELLER'), getSellerOrderDetail);

export default router;
