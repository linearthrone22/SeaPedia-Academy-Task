import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { executeCheckout } from '../services/checkout.service';

const checkoutBodySchema = z.object({
  deliveryAddressId: z.string().uuid({ message: 'Invalid delivery address ID' }),
  deliveryMethod: z.enum(['INSTANT', 'NEXT_DAY', 'REGULAR'], {
    errorMap: () => ({ message: 'Delivery method must be INSTANT, NEXT_DAY, or REGULAR' }),
  }),
});

// Helper to serialize order decimals
const serializeOrder = (order: any) => {
  return {
    ...order,
    subtotal: order.subtotal.toNumber(),
    discountAmount: order.discountAmount.toNumber(),
    deliveryFee: order.deliveryFee.toNumber(),
    taxAmount: order.taxAmount.toNumber(),
    totalAmount: order.totalAmount.toNumber(),
    items: order.items?.map((item: any) => ({
      ...item,
      price: item.price.toNumber(),
    })) || [],
  };
};

/**
 * @openapi
 * /api/buyer/checkout:
 *   post:
 *     summary: Checkout items in buyer cart
 *     tags:
 *       - Orders
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deliveryAddressId
 *               - deliveryMethod
 *             properties:
 *               deliveryAddressId:
 *                 type: string
 *               deliveryMethod:
 *                 type: string
 *                 enum: [INSTANT, NEXT_DAY, REGULAR]
 *     responses:
 *       201:
 *         description: Order created successfully
 *       400:
 *         description: Insufficient funds or stock, or validation failed
 *       401:
 *         description: Unauthorized
 */
export const checkout = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const result = checkoutBodySchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
  }

  const { deliveryAddressId, deliveryMethod } = result.data;

  try {
    const order = await executeCheckout({
      buyerId: user.id,
      deliveryAddressId,
      deliveryMethod,
    });

    return res.status(201).json(serializeOrder(order));
  } catch (error: any) {
    return res.status(400).json({
      error: 'Checkout failed',
      message: error.message || 'An error occurred during checkout',
    });
  }
};

/**
 * @openapi
 * /api/buyer/orders:
 *   get:
 *     summary: Retrieve list of buyer orders
 *     tags:
 *       - Orders
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of buyer orders
 *       401:
 *         description: Unauthorized
 */
export const getBuyerOrders = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const orders = await prisma.order.findMany({
      where: { buyerId: user.id },
      include: {
        store: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const serialized = orders.map((order) => serializeOrder(order));
    return res.status(200).json(serialized);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @openapi
 * /api/buyer/orders/{id}:
 *   get:
 *     summary: Retrieve details of a specific buyer order
 *     tags:
 *       - Orders
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detailed order info
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order not found
 */
export const getBuyerOrderDetail = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
        deliveryAddress: true,
        store: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!order || order.buyerId !== user.id) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.status(200).json(serializeOrder(order));
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @openapi
 * /api/seller/orders:
 *   get:
 *     summary: Retrieve list of seller incoming orders
 *     tags:
 *       - Seller Orders
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of seller incoming orders
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Store not created yet
 */
export const getSellerOrders = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const store = await prisma.store.findUnique({
      where: { sellerId: user.id },
    });

    if (!store) {
      return res.status(400).json({
        error: 'Seller store not found',
        message: 'You must open a store to see incoming orders',
      });
    }

    const orders = await prisma.order.findMany({
      where: { storeId: store.id },
      include: {
        buyer: {
          select: {
            username: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const serialized = orders.map((order) => serializeOrder(order));
    return res.status(200).json(serialized);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @openapi
 * /api/seller/orders/{id}:
 *   get:
 *     summary: Retrieve detailed info of specific seller incoming order
 *     tags:
 *       - Seller Orders
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detailed order info
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Not store owner)
 *       404:
 *         description: Order not found
 */
export const getSellerOrderDetail = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const store = await prisma.store.findUnique({
      where: { sellerId: user.id },
    });

    if (!store) {
      return res.status(403).json({ error: 'Forbidden', message: 'Seller does not have a store' });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
        deliveryAddress: true,
        buyer: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.storeId !== store.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'This order does not belong to your store' });
    }

    return res.status(200).json(serializeOrder(order));
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
