// Verifies tenant isolation against the seeded demo data: `npm run test:rls`.
// Run `npm run db:seed` first.
import "dotenv/config";
import { dbFor, prisma } from "../src/lib/db";

let failures = 0;

function check(label: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures++;
}

async function rejects(action: () => Promise<unknown>) {
  try {
    await action();
    return false;
  } catch {
    return true;
  }
}

async function main() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: "@demo.test" } } });
  const user = (name: string) => users.find((u) => u.email === `${name}@demo.test`)!;
  if (users.length < 4) throw new Error("Demo users not found. Run `npm run db:seed` first.");

  const owner = dbFor(user("owner").id);
  const company = dbFor(user("company").id);
  const engineer = dbFor(user("engineer").id);
  const nobody = dbFor("no-such-user");

  const house = await prisma.project.findFirstOrThrow({ where: { name: "Family house in Kicukiro" } });
  const companyAccount = await prisma.account.findUniqueOrThrow({ where: { username: "kigali-builders" } });
  const engineerAccount = await prisma.account.findUniqueOrThrow({ where: { username: "jean-habimana" } });

  check("owner sees both of their projects", (await owner.project.count()) === 2);
  check("hired company sees only the project it is hired on", (await company.project.count()) === 1);
  check("unrelated engineer sees no projects", (await engineer.project.count()) === 0);
  check("unknown user sees no projects", (await nobody.project.count()) === 0);

  check("unrelated engineer sees no daily reports", (await engineer.dailyReport.count()) === 0);
  check("unrelated engineer sees no report materials", (await engineer.dailyReportMaterial.count()) === 0);
  check("unrelated engineer sees no wages", (await engineer.dailyReportWage.count()) === 0);
  check("unrelated engineer sees no expenses", (await engineer.expense.count()) === 0);
  check("unrelated engineer sees no contracts", (await engineer.contract.count()) === 0);
  check("unrelated engineer sees no other account's workers", (await engineer.worker.count()) === 0);
  check(
    "engineer sees only their own worker categories",
    (await engineer.workerCategory.count({ where: { accountId: { not: engineerAccount.id } } })) === 0,
  );

  check("owner sees the company's reports on their project", (await owner.dailyReport.count()) === 3);
  check("owner sees company workers assigned to their project", (await owner.worker.count()) === 4);
  check(
    "owner cannot see the company's unassigned workers",
    (await owner.worker.count({ where: { accountId: companyAccount.id } })) === 4 &&
      (await prisma.worker.count({ where: { accountId: companyAccount.id } })) === 5,
  );

  check(
    "unrelated engineer cannot add an expense to the project",
    await rejects(() =>
      engineer.expense.create({
        data: {
          projectId: house.id,
          accountId: engineerAccount.id,
          category: "OTHER",
          amount: 1,
          date: new Date(),
          createdById: user("engineer").id,
        },
      }),
    ),
  );
  check(
    "hired company cannot rename the owner's project",
    await rejects(() => company.project.update({ where: { id: house.id }, data: { name: "Hijacked" } })),
  );
  check(
    "unrelated engineer cannot create a project in another account",
    await rejects(() =>
      engineer.project.create({
        data: { accountId: companyAccount.id, name: "Intruder", createdById: user("engineer").id },
      }),
    ),
  );
  check(
    "engineer's update of someone else's project changes nothing",
    (await engineer.project.updateMany({ where: { id: house.id }, data: { name: "Hijacked" } })).count === 0,
  );
}

main()
  .catch((error) => {
    console.error(error);
    failures++;
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log(failures === 0 ? "\nTenant isolation holds." : `\n${failures} check(s) failed.`);
    process.exitCode = failures === 0 ? 0 : 1;
  });
