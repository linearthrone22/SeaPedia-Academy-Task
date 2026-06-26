import { Router } from 'express';
import { getWallet, topupWallet } from '../controllers/wallet.controller';
import { verifyToken, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.get('/buyer/wallet', verifyToken, requireRole('BUYER'), getWallet);
router.post('/buyer/wallet/topup', verifyToken, requireRole('BUYER'), topupWallet);

export default router;
