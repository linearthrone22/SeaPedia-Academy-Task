import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';

const createStoreSchema = z.object({
  name: z.string().min(3, { message: 'Store name must be at least 3 characters long' }),
  description: z.string().optional(),
});

const updateStoreSchema = z.object({
  name: z.string().min(3, { message: 'Store name must be at least 3 characters long' }),
  description: z.string().optional(),
});

/**
 * @openapi
 * /api/seller/store:
 *   post:
 *     summary: Create a new store for the seller
 *     tags:
 *       - Seller Store
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Toko Nelayan Sejahtera
 *               description:
 *                 type: string
 *                 example: Supplier ikan segar tangkapan laut dalam.
 *     responses:
 *       201:
 *         description: Store created successfully
 *       400:
 *         description: Seller already has a store or validation failed
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Store name already exists
 */
export const createStore = async (req: Request, res: Response) => {
  const result = createStoreSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
  }

  const { name, description } = result.data;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Check if seller already has a store
    const existingSellerStore = await prisma.store.findUnique({
      where: { sellerId: user.id },
    });

    if (existingSellerStore) {
      return res.status(400).json({
        error: 'Create store failed',
        message: 'Seller can only have ONE store',
      });
    }

    // Check if store name is unique
    const duplicateStoreName = await prisma.store.findUnique({
      where: { name },
    });

    if (duplicateStoreName) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Store name is already taken',
      });
    }

    const newStore = await prisma.store.create({
      data: {
        name,
        description,
        sellerId: user.id,
      },
    });

    return res.status(201).json(newStore);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @openapi
 * /api/seller/store:
 *   get:
 *     summary: Retrieve own store information
 *     tags:
 *       - Seller Store
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Seller store info with product count
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Store not found
 */
export const getMyStore = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const store = await prisma.store.findUnique({
      where: { sellerId: user.id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!store) {
      return res.status(404).json({ error: 'Store not found', message: 'You have not created a store yet' });
    }

    return res.status(200).json({
      id: store.id,
      name: store.name,
      description: store.description,
      sellerId: store.sellerId,
      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
      productCount: store._count.products,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @openapi
 * /api/seller/store:
 *   put:
 *     summary: Update own store details
 *     tags:
 *       - Seller Store
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Toko Nelayan Baru
 *               description:
 *                 type: string
 *                 example: Deskripsi toko yang diperbarui.
 *     responses:
 *       200:
 *         description: Store details updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Store not found
 *       409:
 *         description: Store name already exists
 */
export const updateStore = async (req: Request, res: Response) => {
  const result = updateStoreSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
  }

  const { name, description } = result.data;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const store = await prisma.store.findUnique({
      where: { sellerId: user.id },
    });

    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    // Check uniqueness if changing the name
    if (name !== store.name) {
      const duplicateStoreName = await prisma.store.findUnique({
        where: { name },
      });

      if (duplicateStoreName) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'Store name is already taken by another store',
        });
      }
    }

    const updatedStore = await prisma.store.update({
      where: { sellerId: user.id },
      data: {
        name,
        description,
      },
    });

    return res.status(200).json(updatedStore);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @openapi
 * /api/stores/{id}:
 *   get:
 *     summary: Get public store information and paginated products
 *     tags:
 *       - Public Stores
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Store UUID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 12
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Public store details and product grid
 *       404:
 *         description: Store not found
 */
export const getPublicStore = async (req: Request, res: Response) => {
  const { id } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 12;
  const skip = (page - 1) * limit;

  try {
    const store = await prisma.store.findUnique({
      where: { id },
    });

    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    // Fetch active products with pagination
    const [products, totalProducts] = await prisma.$transaction([
      prisma.product.findMany({
        where: {
          storeId: id,
          isActive: true,
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.product.count({
        where: {
          storeId: id,
          isActive: true,
        },
      }),
    ]);

    // Map decimal prices to standard float/string for easy serialization
    const serializedProducts = products.map((product) => ({
      ...product,
      price: product.price.toNumber(),
    }));

    return res.status(200).json({
      store,
      products: serializedProducts,
      pagination: {
        total: totalProducts,
        page,
        limit,
        totalPages: Math.ceil(totalProducts / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
