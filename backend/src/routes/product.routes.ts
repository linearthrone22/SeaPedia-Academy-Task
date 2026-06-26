import { Router } from 'express';
import {
  createProduct,
  getMyProducts,
  updateProduct,
  deleteProduct,
  getActiveProducts,
  getActiveProductDetail,
} from '../controllers/product.controller';
import { verifyToken, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// Seller products routes
router.post('/seller/products', verifyToken, requireRole('SELLER'), createProduct);
router.get('/seller/products', verifyToken, requireRole('SELLER'), getMyProducts);
router.put('/seller/products/:id', verifyToken, requireRole('SELLER'), updateProduct);
router.delete('/seller/products/:id', verifyToken, requireRole('SELLER'), deleteProduct);

// Public products routes
router.get('/products', getActiveProducts);
router.get('/products/:id', getActiveProductDetail);

export default router;
