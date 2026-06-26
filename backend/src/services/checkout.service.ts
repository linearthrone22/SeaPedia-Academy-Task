import prisma from '../utils/prisma';
import { Prisma } from '@prisma/client';

export interface CheckoutParams {
  buyerId: string;
  deliveryAddressId: string;
  deliveryMethod: 'INSTANT' | 'NEXT_DAY' | 'REGULAR';
}

export const executeCheckout = async ({
  buyerId,
  deliveryAddressId,
  deliveryMethod,
}: CheckoutParams) => {
  // 1. Get cart
  const cart = await prisma.cart.findUnique({
    where: { buyerId },
    include: {
      items: {
        include: { product: true },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    throw new Error('Keranjang belanja kosong');
  }

  // 2. Validate address
  const address = await prisma.deliveryAddress.findUnique({
    where: { id: deliveryAddressId },
  });

  if (!address || address.buyerId !== buyerId) {
    throw new Error('Alamat pengiriman tidak valid atau bukan milik pembeli');
  }

  // 3. Calculate subtotal
  let subtotal = new Prisma.Decimal(0);
  for (const item of cart.items) {
    subtotal = subtotal.add(item.product.price.mul(item.quantity));
  }

  // 4. Calculate deliveryFee
  let deliveryFeeVal = 0;
  if (deliveryMethod === 'INSTANT') deliveryFeeVal = 25000;
  else if (deliveryMethod === 'NEXT_DAY') deliveryFeeVal = 15000;
  else deliveryFeeVal = 9000;

  const deliveryFee = new Prisma.Decimal(deliveryFeeVal);

  // 5. taxAmount = (subtotal + deliveryFee) * 0.12
  const taxAmount = subtotal.add(deliveryFee).mul(new Prisma.Decimal(0.12));

  // 6. finalTotal = subtotal + deliveryFee + taxAmount
  const totalAmount = subtotal.add(deliveryFee).add(taxAmount);

  // 7. Check wallet
  let wallet = await prisma.wallet.findUnique({
    where: { buyerId },
  });

  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { buyerId, balance: 0 },
    });
  }

  if (wallet.balance.lessThan(totalAmount)) {
    throw new Error('Saldo dompet tidak mencukupi untuk melakukan checkout');
  }

  // 8. Fetch product stock and verify
  for (const item of cart.items) {
    if (item.product.stock < item.quantity) {
      throw new Error(`Stok produk "${item.product.name}" tidak mencukupi`);
    }
  }

  // 9. Atomic Transaction
  const order = await prisma.$transaction(async (tx) => {
    // Deduct stock for each product
    for (const item of cart.items) {
      const updatedProduct = await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: {
            decrement: item.quantity,
          },
        },
      });

      if (updatedProduct.stock < 0) {
        throw new Error(`Stok produk "${item.product.name}" habis selama pemrosesan checkout`);
      }
    }

    // Deduct wallet balance
    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: {
          decrement: totalAmount,
        },
      },
    });

    if (updatedWallet.balance.lessThan(0)) {
      throw new Error('Saldo dompet tidak mencukupi');
    }

    // Get store info
    const store = await tx.store.findUnique({
      where: { id: cart.storeId! },
    });

    if (!store) {
      throw new Error('Toko tidak ditemukan');
    }

    // Create Order
    const newOrder = await tx.order.create({
      data: {
        buyerId,
        sellerId: store.sellerId,
        storeId: store.id,
        deliveryMethod,
        deliveryAddressId,
        subtotal,
        deliveryFee,
        taxAmount,
        totalAmount,
        status: 'SEDANG_DIKEMAS',
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            productName: item.product.name,
            price: item.product.price,
            quantity: item.quantity,
          })),
        },
        statusHistory: {
          create: [
            {
              status: 'SEDANG_DIKEMAS',
              note: 'Pesanan berhasil dibuat dan sedang dikemas oleh penjual',
            },
          ],
        },
      },
      include: {
        items: true,
        statusHistory: true,
        deliveryAddress: true,
      },
    });

    // Create Wallet Transaction (Payment)
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'PAYMENT',
        amount: totalAmount,
        description: `Pembayaran pesanan #${newOrder.id.substring(0, 8).toUpperCase()}`,
        orderId: newOrder.id,
      },
    });

    // Clear cart items and reset storeId
    await tx.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    await tx.cart.update({
      where: { id: cart.id },
      data: { storeId: null },
    });

    return newOrder;
  });

  return order;
};
