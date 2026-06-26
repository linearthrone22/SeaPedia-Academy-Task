import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Clear existing data to avoid conflicts during multiple runs
  await prisma.userRole.deleteMany({});
  await prisma.applicationReview.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Seeding database...');

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@seapedia.com',
      password: adminPasswordHash,
      roles: {
        create: [
          {
            role: Role.ADMIN,
          },
        ],
      },
    },
  });
  console.log(`Created admin user with ID: ${admin.id}`);

  // Create 4 dummy products
  const products = [
    {
      name: 'Premium Scuba Gear Set',
      description: 'Complete high-end scuba diving set including regulator, BCD, mask, and fins.',
      price: 799.99,
      stock: 15,
      imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=500',
    },
    {
      name: 'Marine GPS Navigator',
      description: 'Waterproof marine navigator with detailed coast charts and preloaded maps.',
      price: 349.99,
      stock: 25,
      imageUrl: 'https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=500',
    },
    {
      name: 'Professional Carbon Fishing Rod',
      description: 'High-durability carbon fiber fishing rod with premium reel and multi-hook set.',
      price: 129.50,
      stock: 50,
      imageUrl: 'https://images.unsplash.com/photo-1544551763-c7827a51c4a0?w=500',
    },
    {
      name: 'Inflatable Sea Kayak',
      description: 'Heavy duty two-person inflatable kayak with aluminum paddles and high pressure pump.',
      price: 249.99,
      stock: 8,
      imageUrl: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=500',
    },
  ];

  for (const product of products) {
    const createdProduct = await prisma.product.create({
      data: product,
    });
    console.log(`Created product: ${createdProduct.name} (${createdProduct.id})`);
  }

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
