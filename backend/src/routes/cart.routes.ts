import { Router } from 'express';
import {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  clearCart,
} from '../controllers/cart.controller';
import { verifyToken, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.get('/buyer/cart', verifyToken, requireRole('BUYER'), getCart);
router.delete('/buyer/cart', verifyToken, requireRole('BUYER'), clearCart);
router.post('/buyer/cart/items', verifyToken, requireRole('BUYER'), addCartItem);
router.put('/buyer/cart/items/:itemId', verifyToken, requireRole('BUYER'), updateCartItem);
router.delete('/buyer/cart/items/:itemId', verifyToken, requireRole('BUYER'), removeCartItem);

export default router;
