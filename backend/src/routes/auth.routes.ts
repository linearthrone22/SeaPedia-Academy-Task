import { Router } from 'express';
import { register, login, selectRole, logout, me } from '../controllers/auth.controller';
import { verifyToken } from '../middlewares/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/select-role', verifyToken, selectRole);
router.post('/logout', logout);
router.get('/me', verifyToken, me);

export default router;
