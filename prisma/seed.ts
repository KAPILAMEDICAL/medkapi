/**
 * DEMO DATA SEED SCRIPT
 * ---------------------------------------------------------------------
 * Everything this script creates is fictional demonstration data for
 * local development and evaluation — company names, product brand
 * names, customer firms and figures are all invented and are NOT real
 * Kapila Medical Agencies business information. The app marks this
 * with a Setting row (`seed.isDemoData`) that the admin dashboard reads
 * to show a persistent "DEMO DATA" notice. Before go-live, run
 * `npm run db:seed:production` (see docs/DEPLOYMENT.md) instead, which
 * only creates the first Super Admin account and reference settings —
 * no fictional catalog/customer data.
 */
import { PrismaClient, Role, CustomerType, OrderSource, PaymentMode, LedgerEntryType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateOrderNumber, generatePaymentNumber } from '../src/lib/ids';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding DEMO DATA — see header comment in prisma/seed.ts');

  // --- Settings --------------------------------------------------------
  await prisma.setting.upsert({
    where: { key: 'seed.isDemoData' },
    update: { valueJson: true },
    create: { key: 'seed.isDemoData', valueJson: true },
  });
  await prisma.setting.upsert({
    where: { key: 'business.info' },
    update: {},
    create: {
      key: 'business.info',
      valueJson: {
        name: 'Kapila Medical Agencies',
        tagline: 'Pharmaceutical Wholesale & Distribution',
        address: 'Sirsi, Uttara Kannada, Karnataka',
        gstDefaultPercent: 12,
      },
    },
  });
  await prisma.setting.upsert({
    where: { key: 'order.settings' },
    update: {},
    create: { key: 'order.settings', valueJson: { requireAdminApprovalForNewOrders: false, minOrderValue: 0 } },
  });

  // --- Super admin (real bootstrap credential, from env) ----------------
  const superAdminMobile = process.env.SUPER_ADMIN_MOBILE ?? '9900000000';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD ?? 'ChangeMe@123';
  const superAdmin = await prisma.user.upsert({
    where: { mobile: superAdminMobile },
    update: {},
    create: {
      role: Role.SUPER_ADMIN,
      mobile: superAdminMobile,
      email: 'admin@kapilamedical.example',
      name: 'Super Admin',
      passwordHash: await bcrypt.hash(superAdminPassword, 10),
    },
  });
  console.log(`Super admin ready: mobile=${superAdminMobile} password=${superAdminPassword} (CHANGE AFTER FIRST LOGIN)`);

  const salesManagerUser = await prisma.user.upsert({
    where: { mobile: '9900000001' },
    update: {},
    create: {
      role: Role.SALES_MANAGER,
      mobile: '9900000001',
      email: 'manager@kapilamedical.example',
      name: 'Ramesh Hegde',
      passwordHash: await bcrypt.hash('Manager@123', 10),
    },
  });

  // --- Salesmen ----------------------------------------------------------
  const salesmenSeed = [
    { mobile: '9900000010', name: 'Suresh Naik', code: 'SM001', territory: 'Sirsi Town' },
    { mobile: '9900000011', name: 'Ganesh Bhat', code: 'SM002', territory: 'Yellapur Road' },
  ];
  const salesmen = [];
  for (const s of salesmenSeed) {
    const user = await prisma.user.upsert({
      where: { mobile: s.mobile },
      update: {},
      create: { role: Role.SALES_BOY, mobile: s.mobile, name: s.name },
    });
    const salesman = await prisma.salesman.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        employeeCode: s.code,
        name: s.name,
        mobile: s.mobile,
        territory: s.territory,
        monthlySalesTarget: 500000,
        monthlyCollectionTarget: 400000,
        managerUserId: salesManagerUser.id,
      },
    });
    salesmen.push(salesman);
  }

  // --- Companies, divisions, categories -----------------------------------
  const categoryNames = [
    'Analgesics',
    'Antibiotics',
    'Antacids & Gastro',
    'Vitamins & Supplements',
    'Cardiac Care',
    'Diabetes Care',
    'Cough & Cold',
    'Dermatology',
  ];
  const categories: Record<string, { id: string }> = {};
  for (const name of categoryNames) {
    categories[name] = await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }

  const companiesSeed = [
    { name: 'Zenith Pharmaceuticals', divisions: ['Zenith Cardio', 'Zenith General'] },
    { name: 'Vitalis Life Sciences', divisions: ['Vitalis Wellness'] },
    { name: 'MediCore Formulations', divisions: ['MediCore Derma', 'MediCore Gastro'] },
    { name: 'Sanjeevani Pharma', divisions: ['Sanjeevani Ayush-Allo'] },
  ];
  const companies = [];
  for (const c of companiesSeed) {
    const company = await prisma.company.upsert({
      where: { name: c.name },
      update: {},
      create: {
        name: c.name,
        slug: slugify(c.name),
        description: `${c.name} — demo pharmaceutical manufacturer used for catalog illustration.`,
        isActive: true,
      },
    });
    const divisions = [];
    for (const dName of c.divisions) {
      divisions.push(
        await prisma.division.upsert({
          where: { companyId_name: { companyId: company.id, name: dName } },
          update: {},
          create: { companyId: company.id, name: dName },
        }),
      );
    }
    companies.push({ company, divisions });
  }

  // --- Products ------------------------------------------------------------
  const productTemplates = [
    { brand: 'Parexol', composition: 'Paracetamol 650mg', category: 'Analgesics', mrp: 32, pack: '15 Tablets' },
    { brand: 'Parexol Forte', composition: 'Paracetamol 1000mg', category: 'Analgesics', mrp: 45, pack: '10 Tablets' },
    { brand: 'Diclonac', composition: 'Diclofenac 50mg', category: 'Analgesics', mrp: 28, pack: '10 Tablets' },
    { brand: 'Amoxigold', composition: 'Amoxicillin 500mg', category: 'Antibiotics', mrp: 85, pack: '10 Capsules' },
    { brand: 'Azimax', composition: 'Azithromycin 500mg', category: 'Antibiotics', mrp: 110, pack: '3 Tablets' },
    { brand: 'Ciprovel', composition: 'Ciprofloxacin 500mg', category: 'Antibiotics', mrp: 60, pack: '10 Tablets' },
    { brand: 'Pantogest', composition: 'Pantoprazole 40mg', category: 'Antacids & Gastro', mrp: 95, pack: '15 Tablets' },
    { brand: 'Omezcure', composition: 'Omeprazole 20mg', category: 'Antacids & Gastro', mrp: 55, pack: '14 Capsules' },
    { brand: 'Famodine', composition: 'Famotidine 40mg', category: 'Antacids & Gastro', mrp: 40, pack: '10 Tablets' },
    { brand: 'Vitacharge D3', composition: 'Vitamin D3 60000 IU', category: 'Vitamins & Supplements', mrp: 130, pack: '4 Capsules' },
    { brand: 'B-Complex Plus', composition: 'Vitamin B-Complex + B12', category: 'Vitamins & Supplements', mrp: 75, pack: '15 Tablets' },
    { brand: 'C-Boost', composition: 'Ascorbic Acid 500mg', category: 'Vitamins & Supplements', mrp: 60, pack: '15 Tablets' },
    { brand: 'Amloheart', composition: 'Amlodipine 5mg', category: 'Cardiac Care', mrp: 42, pack: '15 Tablets' },
    { brand: 'Losarcare', composition: 'Losartan 50mg', category: 'Cardiac Care', mrp: 68, pack: '15 Tablets' },
    { brand: 'Atorstat', composition: 'Atorvastatin 10mg', category: 'Cardiac Care', mrp: 90, pack: '10 Tablets' },
    { brand: 'Metforge', composition: 'Metformin 500mg', category: 'Diabetes Care', mrp: 38, pack: '15 Tablets' },
    { brand: 'Glimirange', composition: 'Glimepiride 2mg', category: 'Diabetes Care', mrp: 72, pack: '10 Tablets' },
    { brand: 'Cetrizex', composition: 'Cetirizine 10mg', category: 'Cough & Cold', mrp: 20, pack: '10 Tablets' },
    { brand: 'Coflex Syrup', composition: 'Dextromethorphan + Chlorpheniramine', category: 'Cough & Cold', mrp: 85, pack: '100ml Bottle' },
    { brand: 'Salbutol Inhaler', composition: 'Salbutamol 100mcg', category: 'Cough & Cold', mrp: 140, pack: '1 Inhaler' },
    { brand: 'Dermaclear Cream', composition: 'Clotrimazole 1%', category: 'Dermatology', mrp: 65, pack: '20g Tube' },
    { brand: 'Sunshield SPF50', composition: 'Broad Spectrum Sunscreen', category: 'Dermatology', mrp: 220, pack: '50g Tube' },
  ];

  const products = [];
  for (let i = 0; i < productTemplates.length; i++) {
    const t = productTemplates[i]!;
    const { company, divisions } = companies[i % companies.length]!;
    const mrp = t.mrp;
    const ptr = Math.round(mrp * 0.78 * 100) / 100;
    const pts = Math.round(mrp * 0.72 * 100) / 100;
    const product = await prisma.product.upsert({
      where: { slug: slugify(`${t.brand}-${t.pack}`) },
      update: {},
      create: {
        name: `${t.brand} (${t.pack})`,
        slug: slugify(`${t.brand}-${t.pack}`),
        companyId: company.id,
        divisionId: divisions[0]?.id,
        categoryId: categories[t.category]!.id,
        composition: t.composition,
        packSize: t.pack,
        sku: `SKU-${String(i + 1).padStart(4, '0')}`,
        productCode: `PC-${String(i + 1).padStart(4, '0')}`,
        hsnCode: '3004',
        mrp,
        ptr,
        pts,
        gstPercent: 12,
        stockQty: 200 + i * 17,
        minOrderQty: 1,
        isFastMoving: i % 4 === 0,
        isFeatured: i % 5 === 0,
        isActive: true,
      },
    });
    products.push(product);
  }

  // --- Offers --------------------------------------------------------------
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await prisma.offer.create({
    data: {
      title: 'Buy 10 Get 1 Free — Parexol Range',
      description: 'Introductory scheme on the full Parexol analgesics range.',
      schemeText: '10 + 1',
      productId: products[0]!.id,
      startDate: now,
      endDate: in30Days,
      minQty: 10,
      visibleToCustomers: true,
      visibleToSales: true,
    },
  });
  await prisma.offer.create({
    data: {
      title: 'Vitalis Wellness Monsoon Offer',
      description: 'Special trade offer on the full Vitamins & Supplements range.',
      schemeText: '5% extra discount',
      companyId: companies[1]!.company.id,
      startDate: now,
      endDate: in30Days,
      visibleToCustomers: true,
      visibleToSales: true,
    },
  });

  // --- Customers -------------------------------------------------------------
  const customersSeed = [
    { firm: 'Sirsi City Medicals', owner: 'Anand Shet', mobile: '9900001001', city: 'Sirsi', status: 'APPROVED' as const },
    { firm: 'Yellapur Pharma Point', owner: 'Vinayak Naik', mobile: '9900001002', city: 'Yellapur', status: 'APPROVED' as const },
    { firm: 'Kumta Health Store', owner: 'Prakash Bhat', mobile: '9900001003', city: 'Kumta', status: 'APPROVED' as const },
    { firm: 'Siddapur General Medicals', owner: 'Manjunath Gowda', mobile: '9900001004', city: 'Siddapur', status: 'APPROVED' as const },
    { firm: 'Honnavar Care Pharmacy', owner: 'Deepa Rao', mobile: '9900001005', city: 'Honnavar', status: 'PENDING_APPROVAL' as const },
  ];
  const customers = [];
  for (const c of customersSeed) {
    const user = await prisma.user.upsert({
      where: { mobile: c.mobile },
      update: {},
      create: { role: Role.CUSTOMER, mobile: c.mobile },
    });
    const customer = await prisma.customer.upsert({
      where: { mobile: c.mobile },
      update: {},
      create: {
        userId: user.id,
        firmName: c.firm,
        ownerName: c.owner,
        mobile: c.mobile,
        address: `Main Road, ${c.city}`,
        city: c.city,
        pincode: '581401',
        customerType: CustomerType.PHARMACY,
        status: c.status,
        priceVisibility: 'MRP_AND_PTR',
        assignedSalesmanId: salesmen[customers.length % salesmen.length]?.id,
        approvedByUserId: c.status === 'APPROVED' ? superAdmin.id : null,
        approvedAt: c.status === 'APPROVED' ? now : null,
      },
    });
    customers.push(customer);
  }

  // --- Sample orders + ledger for the first customer -----------------------
  // Guard: orders/payments/expenses below are not upserts, so only create
  // them the first time this seed runs against a given database.
  const demoCustomer = customers[0]!;
  const alreadySeeded = (await prisma.order.count({ where: { customerId: demoCustomer.id } })) > 0;
  if (alreadySeeded) {
    console.log('Orders/payments/expenses already seeded — skipping to avoid duplicates.');
    console.log('Demo data seed complete.');
    return;
  }
  const orderStatuses = ['DELIVERED', 'PROCESSING', 'BOOKED'] as const;
  let runningBalance = 0;
  // Opening balance
  runningBalance += 12500;
  await prisma.ledgerEntry.create({
    data: {
      customerId: demoCustomer.id,
      entryType: LedgerEntryType.OPENING_BALANCE,
      description: 'Opening balance carried forward (demo)',
      debit: 12500,
      balanceAfter: runningBalance,
      entryDate: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
    },
  });

  for (let i = 0; i < orderStatuses.length; i++) {
    const items = products.slice(i * 3, i * 3 + 3);
    let subtotal = 0;
    const orderItemsData = items.map((p) => {
      const qty = 5 + i;
      const lineTotal = Number(p.mrp) * qty;
      subtotal += lineTotal;
      return {
        productId: p.id,
        quantity: qty,
        unitPrice: p.mrp,
        gstPercent: p.gstPercent,
        lineTotal,
      };
    });
    const taxTotal = Math.round(subtotal * 0.12 * 100) / 100;
    const grandTotal = Math.round((subtotal + taxTotal) * 100) / 100;

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        customerId: demoCustomer.id,
        createdByUserId: superAdmin.id,
        salesmanId: salesmen[0]!.id,
        source: OrderSource.SALES_APP,
        status: orderStatuses[i],
        subtotal,
        taxTotal,
        grandTotal,
        bookedAt: new Date(now.getTime() - (10 - i * 3) * 24 * 60 * 60 * 1000),
        items: { create: orderItemsData },
      },
    });

    runningBalance += grandTotal;
    await prisma.ledgerEntry.create({
      data: {
        customerId: demoCustomer.id,
        entryType: LedgerEntryType.INVOICE,
        referenceOrderId: order.id,
        description: `Invoice for order ${order.orderNumber}`,
        debit: grandTotal,
        balanceAfter: runningBalance,
        entryDate: order.bookedAt,
      },
    });
  }

  // A payment against the ledger
  const payment = await prisma.payment.create({
    data: {
      paymentNumber: generatePaymentNumber(),
      customerId: demoCustomer.id,
      salesmanId: salesmen[0]!.id,
      recordedByUserId: superAdmin.id,
      amount: 8000,
      mode: PaymentMode.UPI,
      status: 'VERIFIED',
      referenceNumber: 'UPI-DEMO-84213',
      paidAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
      verifiedByUserId: superAdmin.id,
      verifiedAt: now,
    },
  });
  runningBalance -= 8000;
  await prisma.ledgerEntry.create({
    data: {
      customerId: demoCustomer.id,
      entryType: LedgerEntryType.PAYMENT,
      referencePaymentId: payment.id,
      description: `Payment received — ${payment.paymentNumber}`,
      credit: 8000,
      balanceAfter: runningBalance,
      entryDate: payment.paidAt,
    },
  });

  // --- Today's tour schedule for salesman 1 --------------------------------
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tour = await prisma.tourSchedule.upsert({
    where: { salesmanId_scheduleDate: { salesmanId: salesmen[0]!.id, scheduleDate: today } },
    update: {},
    create: {
      salesmanId: salesmen[0]!.id,
      scheduleDate: today,
      createdByUserId: salesManagerUser.id,
    },
  });
  const approvedCustomers = customers.filter((c) => c.status === 'APPROVED');
  const existingStops = await prisma.tourStop.count({ where: { tourScheduleId: tour.id } });
  if (existingStops === 0) {
    for (let i = 0; i < approvedCustomers.length; i++) {
      await prisma.tourStop.create({
        data: {
          tourScheduleId: tour.id,
          customerId: approvedCustomers[i]!.id,
          sequence: i + 1,
          plannedTime: `${9 + i}:00`,
          objective: i === 0 ? 'Collect pending payment + book monthly order' : 'Routine order booking',
        },
      });
    }
  }

  // --- Expenses --------------------------------------------------------------
  await prisma.expense.create({
    data: {
      salesmanId: salesmen[0]!.id,
      category: 'PETROL',
      amount: 350,
      expenseDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      merchant: 'Sirsi Highway Fuel Point',
      status: 'SUBMITTED',
    },
  });
  await prisma.expense.create({
    data: {
      salesmanId: salesmen[1]!.id,
      category: 'FOOD',
      amount: 180,
      expenseDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      merchant: 'Udupi Krishna Bhavan',
      status: 'APPROVED',
      reviewedByUserId: salesManagerUser.id,
      reviewedAt: now,
    },
  });

  console.log('Demo data seed complete.');
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
