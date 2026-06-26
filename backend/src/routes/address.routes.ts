import { Router } from 'express';
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from '../controllers/address.controller';
import { verifyToken, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.get('/buyer/addresses', verifyToken, requireRole('BUYER'), getAddresses);
router.post('/buyer/addresses', verifyToken, requireRole('BUYER'), createAddress);
router.put('/buyer/addresses/:id', verifyToken, requireRole('BUYER'), updateAddress);
router.delete('/buyer/addresses/:id', verifyToken, requireRole('BUYER'), deleteAddress);
router.patch('/buyer/addresses/:id/default', verifyToken, requireRole('BUYER'), setDefaultAddress);

export default router;
