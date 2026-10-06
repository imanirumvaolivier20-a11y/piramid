// Demo data for local testing: `npm run db:seed`.
// Sign in with the development login as owner@demo.test, company@demo.test,
// engineer@demo.test or worker@demo.test. Safe to run repeatedly.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const CATEGORIES = [
  { name: "Engineer", dailyRate: 25000 },
  { name: "Foreman", dailyRate: 12000 },
  { name: "Store Keeper", dailyRate: 8000 },
  { name: "Builder / Mason", dailyRate: 7000 },
  { name: "Aid / Helper", dailyRate: 3500 },
];

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return new Date(date.toISOString().slice(0, 10));
}

async function reset() {
  const demoUsers = { email: { endsWith: "@demo.test" } };
  await prisma.project.deleteMany({ where: { account: { owner: demoUsers } } });
  await prisma.account.deleteMany({ where: { owner: demoUsers } });
  await prisma.user.deleteMany({ where: demoUsers });
}

async function main() {
  await reset();

  const [aline, eric, jean, claude] = await Promise.all(
    [
      { email: "owner@demo.test", name: "Aline Uwase" },
      { email: "company@demo.test", name: "Eric Mugisha" },
      { email: "engineer@demo.test", name: "Jean Habimana" },
      { email: "worker@demo.test", name: "Claude Niyonzima" },
    ].map((data) => prisma.user.create({ data })),
  );

  const homeowner = await prisma.account.create({
    data: {
      typeKey: "HOMEOWNER",
      name: "Aline Uwase",
      username: "aline-uwase",
      email: aline.email,
      location: "Kigali",
      ownerId: aline.id,
      inviteCode: "ALINE001",
      memberships: { create: { userId: aline.id, role: "OWNER" } },
      categories: { create: CATEGORIES },
    },
  });

  const company = await prisma.account.create({
    data: {
      typeKey: "COMPANY",
      name: "Kigali Builders Ltd",
      username: "kigali-builders",
      email: eric.email,
      phone: "+250 788 000 111",
      location: "Kigali, Gasabo",
      bio: "Residential and commercial construction. Ten years of building in Kigali.",
      ownerId: eric.id,
      inviteCode: "KIGALI01",
      memberships: {
        create: [
          { userId: eric.id, role: "OWNER" },
          { userId: claude.id, role: "MEMBER" },
        ],
      },
      categories: { create: CATEGORIES },
    },
    include: { categories: true },
  });
  const category = (name: string) =>
    company.categories.find((c) => c.name === name)!;

  await prisma.account.create({
    data: {
      typeKey: "ENGINEER",
      name: "Jean Habimana",
      username: "jean-habimana",
      email: jean.email,
      location: "Musanze",
      bio: "Civil engineer. Site supervision and structural works.",
      ownerId: jean.id,
      inviteCode: "JEAN0001",
      memberships: { create: { userId: jean.id, role: "OWNER" } },
      categories: { create: CATEGORIES },
    },
  });

  await prisma.account.create({
    data: {
      typeKey: "WORKER",
      name: "Claude Niyonzima",
      username: "claude-niyonzima",
      email: claude.email,
      ownerId: claude.id,
      memberships: { create: { userId: claude.id, role: "OWNER" } },
    },
  });

  const roster = await Promise.all(
    [
      {
        name: "Claude Niyonzima",
        category: "Foreman",
        email: claude.email,
        userId: claude.id,
      },
      {
        name: "Diane Mukamana",
        category: "Store Keeper",
        phone: "+250 788 000 222",
      },
      { name: "Patrick Nshuti", category: "Builder / Mason" },
      { name: "Emmanuel Bizimana", category: "Builder / Mason" },
      { name: "Olive Ingabire", category: "Aid / Helper" },
    ].map(({ category: categoryName, ...worker }) =>
      prisma.worker.create({
        data: {
          ...worker,
          accountId: company.id,
          categoryId: category(categoryName).id,
        },
      }),
    ),
  );

  const house = await prisma.project.create({
    data: {
      accountId: homeowner.id,
      name: "Family house in Kicukiro",
      location: "Kicukiro, Kigali",
      description: "Four-bedroom single-storey house.",
      startDate: daysAgo(21),
      createdById: aline.id,
      contracts: {
        create: {
          ownerAccountId: homeowner.id,
          contractorAccountId: company.id,
          engagementModel: "OWNER_FUNDS",
          status: "ACTIVE",
          hiredById: aline.id,
          createdAt: daysAgo(20),
          respondedAt: daysAgo(20),
        },
      },
      members: {
        create: [
          { workerId: roster[0].id, accountId: company.id, role: "FOREMAN" },
          {
            workerId: roster[1].id,
            accountId: company.id,
            role: "STORE_KEEPER",
          },
          { workerId: roster[2].id, accountId: company.id, role: "BUILDER" },
          { workerId: roster[4].id, accountId: company.id, role: "AID" },
        ],
      },
    },
  });

  await prisma.project.create({
    data: {
      accountId: homeowner.id,
      name: "Boundary wall",
      location: "Kicukiro, Kigali",
      status: "PLANNING",
      createdById: aline.id,
    },
  });

  const reports = [
    {
      day: 3,
      description:
        "Excavated the foundation trenches on the north and east sides. Ground is firm, no water found.",
      materials: [],
      builders: 2,
      aids: 4,
    },
    {
      day: 2,
      description:
        "Poured blinding concrete in all trenches and set out the foundation walls.",
      materials: [
        { name: "Cement", quantity: 12, unit: "bags" },
        { name: "Sand", quantity: 3, unit: "m³" },
        { name: "Gravel", quantity: 4, unit: "m³" },
      ],
      builders: 3,
      aids: 4,
    },
    {
      day: 1,
      description:
        "Built the first three courses of the stone foundation wall on the north side.",
      materials: [
        { name: "Cement", quantity: 8, unit: "bags" },
        { name: "Foundation stones", quantity: 2, unit: "trucks" },
      ],
      builders: 4,
      aids: 5,
    },
  ];

  for (const report of reports) {
    await prisma.dailyReport.create({
      data: {
        projectId: house.id,
        accountId: company.id,
        createdById: eric.id,
        date: daysAgo(report.day),
        description: report.description,
        workersCount: report.builders + report.aids + 1,
        materials: { create: report.materials },
        wages: {
          create: [
            {
              categoryId: category("Foreman").id,
              categoryName: "Foreman",
              workers: 1,
              amount: 12000,
            },
            {
              categoryId: category("Builder / Mason").id,
              categoryName: "Builder / Mason",
              workers: report.builders,
              amount: report.builders * 7000,
            },
            {
              categoryId: category("Aid / Helper").id,
              categoryName: "Aid / Helper",
              workers: report.aids,
              amount: report.aids * 3500,
            },
          ],
        },
      },
    });
  }

  await prisma.expense.createMany({
    data: (
      [
        {
          category: "PERMITS",
          amount: 150000,
          date: daysAgo(18),
          note: "Building permit fee",
          accountId: homeowner.id,
          createdById: aline.id,
        },
        {
          category: "TRANSPORT",
          amount: 45000,
          date: daysAgo(2),
          note: "Truck hire for sand and gravel",
          accountId: company.id,
          createdById: eric.id,
        },
        {
          category: "EQUIPMENT",
          amount: 30000,
          date: daysAgo(1),
          note: "Wheelbarrows and shovels",
          accountId: company.id,
          createdById: eric.id,
        },
      ] as const
    ).map((expense) => ({ ...expense, projectId: house.id })),
  });

  // Material requests: one delivered (with a short count), one approved by
  // the company itself, one waiting for the owner.
  const delivered = await prisma.materialRequest.create({
    data: {
      projectId: house.id,
      number: 1,
      fromAccountId: company.id,
      toAccountId: homeowner.id,
      status: "RECEIVED",
      note: "For the foundation concrete.",
      requestedById: eric.id,
      createdAt: daysAgo(5),
      decidedById: aline.id,
      decidedAt: daysAgo(4),
      receivedById: claude.id,
      receivedAt: daysAgo(3),
      receivedNote: "One bag of cement arrived torn.",
      items: {
        create: [
          { name: "Cement", details: "CIMERWA 42.5R, 50 kg bags", quantity: 25, unit: "bags", unitPrice: 11500, receivedQuantity: 24, sortOrder: 0 },
          { name: "Sand", details: "Washed river sand", quantity: 4, unit: "m³", unitPrice: 25000, receivedQuantity: 4, sortOrder: 1 },
          { name: "Gravel", details: "Crushed 20 mm", quantity: 4, unit: "m³", unitPrice: 30000, receivedQuantity: 4, sortOrder: 2 },
        ],
      },
    },
  });
  await prisma.expense.create({
    data: {
      projectId: house.id,
      accountId: homeowner.id,
      category: "MATERIALS",
      amount: 24 * 11500 + 4 * 25000 + 4 * 30000,
      date: daysAgo(3),
      note: "Material request #1",
      materialRequestId: delivered.id,
      createdById: claude.id,
    },
  });
  await prisma.materialRequest.create({
    data: {
      projectId: house.id,
      number: 2,
      fromAccountId: company.id,
      toAccountId: company.id,
      status: "APPROVED",
      requestedById: claude.id,
      createdAt: daysAgo(2),
      decidedById: eric.id,
      decidedAt: daysAgo(1),
      decisionNote: "We pay for these ourselves.",
      items: {
        create: [{ name: "Foundation stones", quantity: 3, unit: "trucks", unitPrice: 120000, sortOrder: 0 }],
      },
    },
  });
  await prisma.materialRequest.create({
    data: {
      projectId: house.id,
      number: 3,
      fromAccountId: company.id,
      toAccountId: homeowner.id,
      requestedById: eric.id,
      neededBy: daysAgo(-4),
      note: "Needed before we start the ring beam.",
      items: {
        create: [
          { name: "Iron bars", details: "Y12, 12 m long", quantity: 40, unit: "pcs", unitPrice: 9500, sortOrder: 0 },
          { name: "Binding wire", quantity: 5, unit: "kg", sortOrder: 1 },
        ],
      },
    },
  });
  await prisma.expense.create({
    data: {
      projectId: house.id,
      accountId: company.id,
      category: "SALARIES",
      amount: 400000,
      date: daysAgo(1),
      note: "Site engineer, monthly salary",
      createdById: eric.id,
    },
  });

  console.log(
    "Seeded demo data. Development logins: owner@demo.test, company@demo.test, engineer@demo.test, worker@demo.test",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
