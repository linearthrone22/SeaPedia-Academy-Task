import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { Role } from '@prisma/client';
import prisma from '../utils/prisma';
import { TokenPayload } from '../middlewares/auth.middleware';

const RoleEnum = z.nativeEnum(Role);

// Zod validation schemas
const registerSchema = z.object({
  username: z.string().min(3, { message: 'Username must be at least 3 characters long' }),
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters long' }),
  roles: z.array(RoleEnum).default([Role.BUYER]).optional(),
});

const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(1, { message: 'Password is required' }),
});

const selectRoleSchema = z.object({
  role: RoleEnum,
});

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: buyer_john
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: secret123
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [ADMIN, SELLER, BUYER, DRIVER]
 *                 example: [BUYER]
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation failed or User/Email already exists
 */
export const register = async (req: Request, res: Response) => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
  }

  const { username, email, password, roles } = result.data;
  const finalRoles = roles && roles.length > 0 ? roles : [Role.BUYER];

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'Registration failed',
        message: 'Username or email already exists',
      });
    }

    // Hash password with bcryptjs (saltRounds: 12)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create User + UserRole records in a transaction
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        roles: {
          create: finalRoles.map((role) => ({ role })),
        },
      },
      include: {
        roles: true,
      },
    });

    // Return 201 with user profile (no password)
    return res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      roles: newUser.roles.map((r) => r.role),
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Log in a user
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: secret123
 *     responses:
 *       200:
 *         description: Login successful, token returned
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Invalid credentials
 */
export const login = async (req: Request, res: Response) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
  }

  const { email, password } = result.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { roles: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const rolesList = user.roles.map((ur) => ur.role);
    const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key_here';
    const payload: TokenPayload = { userId: user.id };

    if (rolesList.length === 1) {
      payload.activeRole = rolesList[0];
    } else {
      payload.roles = rolesList;
    }

    const token = jwt.sign(payload, jwtSecret, { expiresIn: '7d' });

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        roles: rolesList,
        activeRole: payload.activeRole || null,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @openapi
 * /api/auth/select-role:
 *   post:
 *     summary: Select active role (for users with multiple roles)
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [ADMIN, SELLER, BUYER, DRIVER]
 *                 example: SELLER
 *     responses:
 *       200:
 *         description: Active role updated successfully, new token returned
 *       400:
 *         description: Validation failed or user does not own role
 *       401:
 *         description: Unauthorized
 */
export const selectRole = async (req: Request, res: Response) => {
  const result = selectRoleSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
  }

  const { role } = result.data;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Verify user owns this role
  if (!user.roles.includes(role)) {
    return res.status(400).json({
      error: 'Invalid role selection',
      message: `User does not possess the role: ${role}`,
    });
  }

  const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key_here';
  const payload: TokenPayload = {
    userId: user.id,
    activeRole: role,
  };

  const token = jwt.sign(payload, jwtSecret, { expiresIn: '7d' });

  return res.status(200).json({
    token,
    activeRole: role,
  });
};

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Log out current user (Client drops token)
 *     tags:
 *       - Authentication
 *     responses:
 *       200:
 *         description: Logout successful
 */
export const logout = async (req: Request, res: Response) => {
  return res.status(200).json({ message: 'Logout successful' });
};

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Get current logged-in user profile
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile details
 *       401:
 *         description: Unauthorized
 */
export const me = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return res.status(200).json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles,
      activeRole: user.activeRole || null,
    },
  });
};
