import { Router } from 'express';
import { createReview, getReviews } from '../controllers/review.controller';

const router = Router();

router.post('/', createReview);
router.get('/', getReviews);

export default router;
