import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { Prisma } from '@prisma/client';

const createProductSchema = z.object({
  name: z.string().min(1, { message: 'Product name is required' }),
  description: z.string().min(1, { message: 'Product description is required' }),
  price: z.number().positive({ message: 'Price must be greater than 0' }),
  stock: z.number().int().nonnegative({ message: 'Stock must be at least 0' }),
  imageUrl: z.string().url().optional().or(z.literal('')),
});

const updateProductSchema = z.object({
  name: z.string().min(1, { message: 'Product name is required' }),
  description: z.string().min(1, { message: 'Product description is required' }),
  price: z.number().positive({ message: 'Price must be greater than 0' }),
  stock: z.number().int().nonnegative({ message: 'Stock must be at least 0' }),
  imageUrl: z.string().url().optional().or(z.literal('')),
});

/**
 * @openapi
 * /api/seller/products:
 *   post:
 *     summary: Add a new product to the seller's store
 *     tags:
 *       - Seller Products
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
 *               - description
 *               - price
 *               - stock
 *             properties:
 *               name:
 *                 type: string
 *                 example: Kepiting Bakau Super
 *               description:
 *                 type: string
 *                 example: Kepiting bakau segar tangkapan liar, ukuran 500g+.
 *               price:
 *                 type: number
 *                 example: 25.50
 *               stock:
 *                 type: integer
 *                 example: 10
 *               imageUrl:
 *                 type: string
 *                 example: https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=500
 *     responses:
 *       201:
 *         description: Product added successfully
 *       400:
 *         description: Validation failed or Seller has no store yet
 *       401:
 *         description: Unauthorized
 */
export const createProduct = async (req: Request, res: Response) => {
  const result = createProductSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
  }

  const { name, description, price, stock, imageUrl } = result.data;
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
        error: 'Create product failed',
        message: 'You must create a store before adding products',
      });
    }

    const newProduct = await prisma.product.create({
      data: {
        name,
        description,
        price: new Prisma.Decimal(price),
        stock,
        imageUrl: imageUrl || null,
        storeId: store.id,
      },
    });

    return res.status(201).json({
      ...newProduct,
      price: newProduct.price.toNumber(),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @openapi
 * /api/seller/products:
 *   get:
 *     summary: Retrieve all products in seller's store
 *     tags:
 *       - Seller Products
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of own products
 *       400:
 *         description: Store not created yet
 *       401:
 *         description: Unauthorized
 */
export const getMyProducts = async (req: Request, res: Response) => {
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
        error: 'Fetch products failed',
        message: 'Create a store first before accessing products',
      });
    }

    const products = await prisma.product.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: 'desc' },
    });

    const serializedProducts = products.map((p) => ({
      ...p,
      price: p.price.toNumber(),
    }));

    return res.status(200).json(serializedProducts);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @openapi
 * /api/seller/products/{id}:
 *   put:
 *     summary: Update product details
 *     tags:
 *       - Seller Products
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *               - price
 *               - stock
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               stock:
 *                 type: integer
 *               imageUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Not product owner)
 *       404:
 *         description: Product not found
 */
export const updateProduct = async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = updateProductSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
  }

  const { name, description, price, stock, imageUrl } = result.data;
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

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Verify ownership
    if (product.storeId !== store.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are not authorized to update this product',
      });
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        name,
        description,
        price: new Prisma.Decimal(price),
        stock,
        imageUrl: imageUrl || null,
      },
    });

    return res.status(200).json({
      ...updatedProduct,
      price: updatedProduct.price.toNumber(),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @openapi
 * /api/seller/products/{id}:
 *   delete:
 *     summary: Delete a product (Soft Delete)
 *     tags:
 *       - Seller Products
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product UUID
 *     responses:
 *       200:
 *         description: Product soft-deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Not product owner)
 *       404:
 *         description: Product not found
 */
export const deleteProduct = async (req: Request, res: Response) => {
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

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Verify ownership
    if (product.storeId !== store.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are not authorized to delete this product',
      });
    }

    // Soft delete product by setting isActive = false
    const deletedProduct = await prisma.product.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    return res.status(200).json({
      message: 'Product soft-deleted successfully',
      id: deletedProduct.id,
      isActive: deletedProduct.isActive,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @openapi
 * /api/products:
 *   get:
 *     summary: Retrieve all active products
 *     tags:
 *       - Public Products
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search query by product name
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
 *         description: List of active products with store info and pagination details
 */
export const getActiveProducts = async (req: Request, res: Response) => {
  const search = req.query.search as string;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 12;
  const skip = (page - 1) * limit;

  // Build filter query
  const whereClause: Prisma.ProductWhereInput = {
    isActive: true,
  };

  if (search) {
    whereClause.name = {
      contains: search,
      mode: 'insensitive',
    };
  }

  try {
    const [products, totalProducts] = await prisma.$transaction([
      prisma.product.findMany({
        where: whereClause,
        include: {
          store: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({
        where: whereClause,
      }),
    ]);

    const serializedProducts = products.map((p) => ({
      ...p,
      price: p.price.toNumber(),
    }));

    return res.status(200).json({
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

/**
 * @openapi
 * /api/products/{id}:
 *   get:
 *     summary: Retrieve detailed product info
 *     tags:
 *       - Public Products
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product UUID
 *     responses:
 *       200:
 *         description: Product details with store info
 *       404:
 *         description: Product not found
 */
export const getActiveProductDetail = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const product = await prisma.product.findFirst({
      where: {
        id,
        isActive: true,
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.status(200).json({
      ...product,
      price: product.price.toNumber(),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
