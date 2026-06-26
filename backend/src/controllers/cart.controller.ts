import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';

const addCartItemSchema = z.object({
  productId: z.string().uuid({ message: 'Invalid product ID' }),
  quantity: z.number().int().positive({ message: 'Quantity must be at least 1' }),
});

const updateCartItemSchema = z.object({
  quantity: z.number().int().positive({ message: 'Quantity must be at least 1' }),
});

// Helper to calculate subtotal and format cart
const getFormattedCart = async (buyerId: string) => {
  let cart = await prisma.cart.findUnique({
    where: { buyerId },
    include: {
      items: {
        include: {
          product: {
            include: {
              store: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { buyerId },
      include: {
        items: {
          include: {
            product: {
              include: {
                store: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  // Calculate subtotal
  let subtotal = 0;
  const items = cart.items.map((item) => {
    const price = item.product.price.toNumber();
    const itemSubtotal = price * item.quantity;
    subtotal += itemSubtotal;

    return {
      id: item.id,
      cartId: item.cartId,
      productId: item.productId,
      quantity: item.quantity,
      createdAt: item.createdAt,
      product: {
        id: item.product.id,
        name: item.product.name,
        price,
        stock: item.product.stock,
        imageUrl: item.product.imageUrl,
        store: item.product.store,
      },
      subtotal: itemSubtotal,
    };
  });

  return {
    id: cart.id,
    buyerId: cart.buyerId,
    storeId: cart.storeId,
    items,
    subtotal,
  };
};

/**
 * @openapi
 * /api/buyer/cart:
 *   get:
 *     summary: Get buyer shopping cart
 *     tags:
 *       - Cart
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Buyer cart details
 *       401:
 *         description: Unauthorized
 */
export const getCart = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const cart = await getFormattedCart(user.id);
    return res.status(200).json(cart);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @openapi
 * /api/buyer/cart/items:
 *   post:
 *     summary: Add product item to cart
 *     tags:
 *       - Cart
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - quantity
 *             properties:
 *               productId:
 *                 type: string
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: Item added/updated successfully
 *       400:
 *         description: Validation failed or stock exceeded
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Single-store rule conflict
 */
export const addCartItem = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const result = addCartItemSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
  }

  const { productId, quantity } = result.data;

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId, isActive: true },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    let cart = await prisma.cart.findUnique({
      where: { buyerId: user.id },
      include: { items: true },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { buyerId: user.id },
        include: { items: true },
      });
    }

    // SINGLE-STORE RULE
    if (cart.storeId && cart.storeId !== product.storeId) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Cart sudah berisi produk dari toko lain. Kosongkan cart terlebih dahulu.',
      });
    }

    // Check existing item in cart
    const existingItem = cart.items.find((item) => item.productId === productId);
    const newQuantity = existingItem ? existingItem.quantity + quantity : quantity;

    // Check stock
    if (product.stock < newQuantity) {
      return res.status(400).json({
        error: 'Stock exceeded',
        message: `Hanya tersedia ${product.stock} barang untuk produk ini.`,
      });
    }

    await prisma.$transaction(async (tx) => {
      // Set storeId if null
      if (!cart.storeId) {
        await tx.cart.update({
          where: { id: cart.id },
          data: { storeId: product.storeId },
        });
      }

      if (existingItem) {
        await tx.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: newQuantity },
        });
      } else {
        await tx.cartItem.create({
          data: {
            cartId: cart.id,
            productId,
            quantity,
          },
        });
      }
    });

    const updatedCart = await getFormattedCart(user.id);
    return res.status(200).json(updatedCart);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @openapi
 * /api/buyer/cart/items/{itemId}:
 *   put:
 *     summary: Update cart item quantity
 *     tags:
 *       - Cart
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quantity
 *             properties:
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: Cart item updated successfully
 *       400:
 *         description: Validation failed or stock exceeded
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Item not found
 */
export const updateCartItem = async (req: Request, res: Response) => {
  const { itemId } = req.params;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const result = updateCartItemSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
  }

  const { quantity } = result.data;

  try {
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: {
        cart: true,
        product: true,
      },
    });

    if (!cartItem || cartItem.cart.buyerId !== user.id) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    if (cartItem.product.stock < quantity) {
      return res.status(400).json({
        error: 'Stock exceeded',
        message: `Hanya tersedia ${cartItem.product.stock} barang untuk produk ini.`,
      });
    }

    await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });

    const updatedCart = await getFormattedCart(user.id);
    return res.status(200).json(updatedCart);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @openapi
 * /api/buyer/cart/items/{itemId}:
 *   delete:
 *     summary: Remove item from cart
 *     tags:
 *       - Cart
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Item removed successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Item not found
 */
export const removeCartItem = async (req: Request, res: Response) => {
  const { itemId } = req.params;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });

    if (!cartItem || cartItem.cart.buyerId !== user.id) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.cartItem.delete({
        where: { id: itemId },
      });

      // Check if cart has other items
      const count = await tx.cartItem.count({
        where: { cartId: cartItem.cartId },
      });

      if (count === 0) {
        await tx.cart.update({
          where: { id: cartItem.cartId },
          data: { storeId: null },
        });
      }
    });

    const updatedCart = await getFormattedCart(user.id);
    return res.status(200).json(updatedCart);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @openapi
 * /api/buyer/cart:
 *   delete:
 *     summary: Clear buyer cart completely
 *     tags:
 *       - Cart
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart cleared successfully
 *       401:
 *         description: Unauthorized
 */
export const clearCart = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const cart = await prisma.cart.findUnique({
      where: { buyerId: user.id },
    });

    if (cart) {
      await prisma.$transaction([
        prisma.cartItem.deleteMany({
          where: { cartId: cart.id },
        }),
        prisma.cart.update({
          where: { id: cart.id },
          data: { storeId: null },
        }),
      ]);
    }

    const updatedCart = await getFormattedCart(user.id);
    return res.status(200).json(updatedCart);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
