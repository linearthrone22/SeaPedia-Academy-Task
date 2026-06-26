import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { Prisma } from '@prisma/client';

const topupSchema = z.object({
  amount: z
    .number()
    .positive({ message: 'Amount must be positive' })
    .max(10000000, { message: 'Maximum top-up amount is Rp 10.000.000' }),
});

/**
 * @openapi
 * /api/buyer/wallet:
 *   get:
 *     summary: Retrieve buyer wallet details
 *     tags:
 *       - Wallet
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Buyer wallet details including current balance and last 20 transactions
 *       401:
 *         description: Unauthorized
 */
export const getWallet = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    let wallet = await prisma.wallet.findUnique({
      where: { buyerId: user.id },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    // Auto-create wallet if not exists
    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          buyerId: user.id,
          balance: new Prisma.Decimal(0),
        },
        include: {
          transactions: true,
        },
      });
    }

    return res.status(200).json({
      id: wallet.id,
      buyerId: wallet.buyerId,
      balance: wallet.balance.toNumber(),
      transactions: wallet.transactions.map((t) => ({
        ...t,
        amount: t.amount.toNumber(),
      })),
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @openapi
 * /api/buyer/wallet/topup:
 *   post:
 *     summary: Top up buyer wallet
 *     tags:
 *       - Wallet
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 10000000
 *                 example: 50000
 *     responses:
 *       200:
 *         description: Top-up successful, returns updated balance
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 */
export const topupWallet = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const result = topupSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
  }

  const { amount } = result.data;

  try {
    const updatedWallet = await prisma.$transaction(async (tx) => {
      let wallet = await tx.wallet.findUnique({
        where: { buyerId: user.id },
      });

      if (!wallet) {
        wallet = await tx.wallet.create({
          data: {
            buyerId: user.id,
            balance: new Prisma.Decimal(0),
          },
        });
      }

      // Add to balance
      const newBalance = wallet.balance.add(new Prisma.Decimal(amount));

      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      // Create transaction record
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'TOPUP',
          amount: new Prisma.Decimal(amount),
          description: 'Wallet top-up via payment gateway simulator',
        },
      });

      return updated;
    });

    return res.status(200).json({
      balance: updatedWallet.balance.toNumber(),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
