import { Request, Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { TokenPayload } from '../middlewares/auth.middleware';

// Zod validation schema
const createReviewSchema = z.object({
  reviewerName: z.string().min(1, { message: 'Reviewer name is required' }),
  rating: z.number().int().min(1).max(5, { message: 'Rating must be an integer between 1 and 5' }),
  comment: z.string().max(500, { message: 'Comment must be maximum 500 characters long' }),
});

/**
 * @openapi
 * /api/reviews:
 *   post:
 *     summary: Submit a new review
 *     tags:
 *       - Reviews
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reviewerName
 *               - rating
 *               - comment
 *             properties:
 *               reviewerName:
 *                 type: string
 *                 example: Jane Doe
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *               comment:
 *                 type: string
 *                 example: Great platform! Extremely useful.
 *     responses:
 *       201:
 *         description: Review submitted successfully
 *       400:
 *         description: Validation failed
 */
export const createReview = async (req: Request, res: Response) => {
  const result = createReviewSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
  }

  const { reviewerName, rating, comment } = result.data;

  // Sanitize comment: strip HTML tags using a simple regex
  const sanitizedComment = comment.replace(/<\/?[^>]+(>|$)/g, '');

  // Optional: attach userId if token provided
  let userId: string | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here') as TokenPayload;
      if (decoded && decoded.userId) {
        userId = decoded.userId;
      }
    } catch (err) {
      // Ignore token verification errors since auth is optional
    }
  }

  try {
    const newReview = await prisma.applicationReview.create({
      data: {
        reviewerName,
        rating,
        comment: sanitizedComment,
        userId,
      },
    });

    return res.status(201).json(newReview);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @openapi
 * /api/reviews:
 *   get:
 *     summary: Get all reviews
 *     tags:
 *       - Reviews
 *     responses:
 *       200:
 *         description: List of reviews ordered by creation date descending
 */
export const getReviews = async (req: Request, res: Response) => {
  try {
    const reviews = await prisma.applicationReview.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.status(200).json(reviews);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
