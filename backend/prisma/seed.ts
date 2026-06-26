import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing database tables...');
  await prisma.walletTransaction.deleteMany({});
  await prisma.wallet.deleteMany({});
  await prisma.cartItem.deleteMany({});
  await prisma.cart.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.orderStatusHistory.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.deliveryAddress.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.store.deleteMany({});
  await prisma.userRole.deleteMany({});
  await prisma.applicationReview.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Seeding database...');

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('admin123', 12);
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
  console.log(`Created admin user: ${admin.username}`);

  // Create seller user
  const sellerPasswordHash = await bcrypt.hash('seller123', 12);
  const seller = await prisma.user.create({
    data: {
      username: 'bahariseller',
      email: 'seller@seapedia.com',
      password: sellerPasswordHash,
      roles: {
        create: [
          {
            role: Role.SELLER,
          },
        ],
      },
    },
  });
  console.log(`Created seller user: ${seller.username}`);

  // Create buyer user
  const buyerPasswordHash = await bcrypt.hash('buyer123', 12);
  const buyer = await prisma.user.create({
    data: {
      username: 'baharibuyer',
      email: 'buyer@seapedia.com',
      password: buyerPasswordHash,
      roles: {
        create: [
          {
            role: Role.BUYER,
          },
        ],
      },
    },
  });
  console.log(`Created buyer user: ${buyer.username}`);

  // Create wallet for buyer
  const buyerWallet = await prisma.wallet.create({
    data: {
      buyerId: buyer.id,
      balance: 1000000, // Initial balance Rp 1.000.000 (Decimal)
    },
  });
  console.log(`Created wallet for buyer with balance: ${buyerWallet.balance.toString()}`);

  // Create wallet transaction for buyer
  await prisma.walletTransaction.create({
    data: {
      walletId: buyerWallet.id,
      type: 'TOPUP',
      amount: 1000000,
      description: 'Initial seeding topup',
    },
  });

  // Create demo store
  const store = await prisma.store.create({
    data: {
      name: 'Toko Bahari Pratama',
      description: 'Menyediakan hasil laut segar berkualitas tinggi langsung dari nelayan Balikpapan.',
      sellerId: seller.id,
    },
  });
  console.log(`Created store: ${store.name}`);

  // Create 5 dummy products
  const products = [
    {
      name: 'Premium Scuba Gear Set',
      description: 'Complete high-end scuba diving set including regulator, BCD, mask, and fins.',
      price: 799.99,
      stock: 15,
      imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=500',
      storeId: store.id,
    },
    {
      name: 'Marine GPS Navigator',
      description: 'Waterproof marine navigator with detailed coast charts and preloaded maps.',
      price: 349.99,
      stock: 25,
      imageUrl: 'https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=500',
      storeId: store.id,
    },
    {
      name: 'Professional Carbon Fishing Rod',
      description: 'High-durability carbon fiber fishing rod with premium reel and multi-hook set.',
      price: 129.50,
      stock: 50,
      imageUrl: 'https://images.unsplash.com/photo-1544551763-c7827a51c4a0?w=500',
      storeId: store.id,
    },
    {
      name: 'Inflatable Sea Kayak',
      description: 'Heavy duty two-person inflatable kayak with aluminum paddles and high pressure pump.',
      price: 249.99,
      stock: 8,
      imageUrl: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=500',
      storeId: store.id,
    },
    {
      name: 'Ikan Tuna Sirip Biru Segar',
      description: 'Ikan Tuna Sirip Biru segar tangkapan hari ini, dipotong rapi dan divakum.',
      price: 45.00,
      stock: 30,
      imageUrl: 'https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?w=500',
      storeId: store.id,
    },
  ];

  for (const product of products) {
    await prisma.product.create({
      data: product,
    });
  }
  console.log('Seeded 5 products.');

  // Create default delivery address for buyer
  const address = await prisma.deliveryAddress.create({
    data: {
      buyerId: buyer.id,
      label: 'Rumah Utama',
      recipientName: 'Bahari Buyer',
      phone: '081234567890',
      addressLine: 'Jl. Merdeka No. 12',
      city: 'Balikpapan',
      province: 'Kalimantan Timur',
      postalCode: '76111',
      isDefault: true,
    },
  });
  console.log(`Created delivery address: ${address.label}`);

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
