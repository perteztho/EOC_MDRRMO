// Seed the public portal defaults (sections, widgets, site configs, content)
// Run: bun scripts/seed-portal.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const { seedPortalConfig, seedPortalContent, publishHomepages, getActiveSnapshot } = await import("../src/lib/qas33/portal-server");
  await seedPortalConfig();
  await seedPortalContent();
  const active = await getActiveSnapshot();
  if (!active) {
    const data = await publishHomepages("Seeded defaults");
    console.log(`Portal seeded & published as version ${data.version}`);
  } else {
    console.log(`Active snapshot v${active.version} already exists — content/config seeded only.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
