// Add the Interactive Satellite Map homepage section (template "satelliteMap")
// and apply the compact frontpage order: hero → weather → map → the rest in
// their current relative order. Then publish so the public site updates.
// Run: bun scripts/add-satellite-map-section.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const { publishHomepages, templateDefaultConfig } = await import("../src/lib/qas33/portal-server");

  // ---- 1. Create the map section when missing -----------------------------
  const existing = await db.homepageSection.findUnique({ where: { sectionKey: "map" } });
  let mapId: string | undefined = existing?.id;
  if (!existing) {
    const row = await db.homepageSection.create({
      data: {
        sectionKey: "map",
        template: "satelliteMap",
        name: "Interactive Map — Pio Duran",
        heading: "Pio Duran Interactive Map",
        subtitle: "Live satellite view · evacuation centers · hazard overlays",
        status: "ACTIVE",
        displayOrder: 2, // corrected by the reorder below
        config: JSON.stringify(templateDefaultConfig("satelliteMap")),
      },
    });
    mapId = row.id;
    console.log("Created homepage section 'map' (template satelliteMap).");
  } else {
    console.log(`Homepage section 'map' already exists (template ${existing.template}) — skipping create.`);
  }

  // ---- 2. Reorder ALL sections: hero → weather → map → rest ---------------
  const sections = await db.homepageSection.findMany({ orderBy: { displayOrder: "asc" } });
  const byTemplate = (t: string) => sections.find((s) => s.template === t);
  const hero = byTemplate("hero");
  const weather = byTemplate("weather");
  const map = sections.find((s) => s.id === mapId);
  const head = [hero, weather, map].filter((s): s is NonNullable<typeof s> => Boolean(s));
  const rest = sections.filter((s) => !head.includes(s)); // keeps current relative order
  const order = [...head, ...rest];
  for (let i = 0; i < order.length; i++) {
    await db.homepageSection.update({ where: { id: order[i].id }, data: { displayOrder: i } });
  }
  console.log(`Reordered ${order.length} sections:`);
  console.log(`  ${order.map((s) => s.sectionKey).join(" → ")}`);

  // ---- 3. Publish so the public site updates -------------------------------
  const data = await publishHomepages("Interactive satellite map section + compact frontpage order");
  console.log(`Published homepage v${data.version} — ${data.sections.length} sections in the snapshot.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
