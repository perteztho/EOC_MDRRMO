// QAS33 Task 22-a — clean up E2E test artifacts between verification runs.
// Run: bun scripts/e2e-cleanup-22a.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // broadcasts + delivery logs + targets created by the E2E suite
  const broadcasts = await prisma.broadcast.findMany({
    where: { OR: [{ title: { startsWith: "Test Broadcast" } }, { title: { startsWith: "Scheduled Test Broadcast" } }, { title: { startsWith: "Staff Critical Test" } }] },
    select: { id: true, title: true },
  });
  for (const b of broadcasts) {
    await prisma.notificationDeliveryLog.deleteMany({ where: { broadcastId: b.id } });
    await prisma.broadcastTarget.deleteMany({ where: { broadcastId: b.id } });
    await prisma.broadcast.delete({ where: { id: b.id } });
    console.log(`  ↳ deleted broadcast "${b.title}"`);
  }

  // fan-out artifacts
  const del1 = await prisma.announcement.deleteMany({ where: { title: { contains: "Test Broadcast" } } });
  const del2 = await prisma.tickerMessage.deleteMany({ where: { message: { contains: "Water service in Barangay I" } } });
  const del3 = await prisma.newsArticle.deleteMany({ where: { title: { contains: "Test Broadcast" } } });
  const del4 = await prisma.publicAlert.deleteMany({ where: { title: { contains: "Test Broadcast" } } });
  const del5 = await prisma.evacuationAnnouncement.deleteMany({ where: { title: { contains: "Test Broadcast" } } });
  console.log(`  ↳ fan-out rows removed: announcements=${del1.count} ticker=${del2.count} news=${del3.count} alerts=${del4.count} evacAnn=${del5.count}`);

  // test evacuation center(s)
  const del6 = await prisma.evacuationCenter.deleteMany({ where: { name: { contains: "Agol Test Evacuation Site" } } });
  const del7 = await prisma.evacuationCenter.deleteMany({ where: { name: { contains: "Test Center Bad GPS" } } });
  console.log(`  ↳ test centers removed: ${del6.count + del7.count}`);

  // fake push subscription
  const del8 = await prisma.notificationSubscription.deleteMany({ where: { endpoint: { contains: "fake-test-endpoint" } } });
  console.log(`  ↳ fake push subscriptions removed: ${del8.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
