import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';

const createAddressSchema = z.object({
  label: z.string().min(1, { message: 'Label is required (e.g. Rumah, Kantor)' }),
  recipientName: z.string().min(1, { message: 'Recipient name is required' }),
  phone: z.string().min(1, { message: 'Phone number is required' }),
  addressLine: z.string().min(1, { message: 'Address is required' }),
  city: z.string().min(1, { message: 'City is required' }),
  province: z.string().min(1, { message: 'Province is required' }),
  postalCode: z.string().min(1, { message: 'Postal code is required' }),
  isDefault: z.boolean().default(false),
});

const updateAddressSchema = z.object({
  label: z.string().min(1, { message: 'Label is required' }),
  recipientName: z.string().min(1, { message: 'Recipient name is required' }),
  phone: z.string().min(1, { message: 'Phone number is required' }),
  addressLine: z.string().min(1, { message: 'Address is required' }),
  city: z.string().min(1, { message: 'City is required' }),
  province: z.string().min(1, { message: 'Province is required' }),
  postalCode: z.string().min(1, { message: 'Postal code is required' }),
  isDefault: z.boolean().default(false),
});

/**
 * @openapi
 * /api/buyer/addresses:
 *   get:
 *     summary: Get buyer delivery addresses
 *     tags:
 *       - Address
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of buyer delivery addresses
 *       401:
 *         description: Unauthorized
 */
export const getAddresses = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const addresses = await prisma.deliveryAddress.findMany({
      where: { buyerId: user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return res.status(200).json(addresses);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @openapi
 * /api/buyer/addresses:
 *   post:
 *     summary: Create a delivery address
 *     tags:
 *       - Address
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - label
 *               - recipientName
 *               - phone
 *               - addressLine
 *               - city
 *               - province
 *               - postalCode
 *             properties:
 *               label:
 *                 type: string
 *                 example: Rumah Utama
 *               recipientName:
 *                 type: string
 *                 example: Jane Doe
 *               phone:
 *                 type: string
 *                 example: 08123456789
 *               addressLine:
 *                 type: string
 *                 example: Jl. Bahari No. 45
 *               city:
 *                 type: string
 *                 example: Balikpapan
 *               province:
 *                 type: string
 *                 example: Kalimantan Timur
 *               postalCode:
 *                 type: string
 *                 example: 76111
 *               isDefault:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Address created successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 */
export const createAddress = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const result = createAddressSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
  }

  const data = result.data;

  try {
    const newAddress = await prisma.$transaction(async (tx) => {
      // If setting as default, update other addresses isDefault = false
      if (data.isDefault) {
        await tx.deliveryAddress.updateMany({
          where: { buyerId: user.id },
          data: { isDefault: false },
        });
      }

      // If buyer has no address, make this the default regardless
      const count = await tx.deliveryAddress.count({
        where: { buyerId: user.id },
      });

      return await tx.deliveryAddress.create({
        data: {
          ...data,
          buyerId: user.id,
          isDefault: count === 0 ? true : data.isDefault,
        },
      });
    });

    return res.status(201).json(newAddress);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @openapi
 * /api/buyer/addresses/{id}:
 *   put:
 *     summary: Update delivery address
 *     tags:
 *       - Address
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               - label
 *               - recipientName
 *               - phone
 *               - addressLine
 *               - city
 *               - province
 *               - postalCode
 *             properties:
 *               label:
 *                 type: string
 *               recipientName:
 *                 type: string
 *               phone:
 *                 type: string
 *               addressLine:
 *                 type: string
 *               city:
 *                 type: string
 *               province:
 *                 type: string
 *               postalCode:
 *                 type: string
 *               isDefault:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Address updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Not owner)
 *       404:
 *         description: Address not found
 */
export const updateAddress = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const result = updateAddressSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
  }

  const data = result.data;

  try {
    const address = await prisma.deliveryAddress.findUnique({
      where: { id },
    });

    if (!address) {
      return res.status(404).json({ error: 'Address not found' });
    }

    if (address.buyerId !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not own this address' });
    }

    const updatedAddress = await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.deliveryAddress.updateMany({
          where: { buyerId: user.id },
          data: { isDefault: false },
        });
      }

      return await tx.deliveryAddress.update({
        where: { id },
        data: {
          ...data,
        },
      });
    });

    return res.status(200).json(updatedAddress);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @openapi
 * /api/buyer/addresses/{id}:
 *   delete:
 *     summary: Delete delivery address
 *     tags:
 *       - Address
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
 *         description: Address deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Not owner)
 *       404:
 *         description: Address not found
 */
export const deleteAddress = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const address = await prisma.deliveryAddress.findUnique({
      where: { id },
    });

    if (!address) {
      return res.status(404).json({ error: 'Address not found' });
    }

    if (address.buyerId !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not own this address' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.deliveryAddress.delete({
        where: { id },
      });

      // If the deleted address was default, make another one default
      if (address.isDefault) {
        const nextAddress = await tx.deliveryAddress.findFirst({
          where: { buyerId: user.id },
          orderBy: { createdAt: 'desc' },
        });

        if (nextAddress) {
          await tx.deliveryAddress.update({
            where: { id: nextAddress.id },
            data: { isDefault: true },
          });
        }
      }
    });

    return res.status(200).json({ message: 'Address deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @openapi
 * /api/buyer/addresses/{id}/default:
 *   patch:
 *     summary: Set address as default
 *     tags:
 *       - Address
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
 *         description: Address set as default successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Not owner)
 *       404:
 *         description: Address not found
 */
export const setDefaultAddress = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const address = await prisma.deliveryAddress.findUnique({
      where: { id },
    });

    if (!address) {
      return res.status(404).json({ error: 'Address not found' });
    }

    if (address.buyerId !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not own this address' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.deliveryAddress.updateMany({
        where: { buyerId: user.id },
        data: { isDefault: false },
      });

      return await tx.deliveryAddress.update({
        where: { id },
        data: { isDefault: true },
      });
    });

    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
