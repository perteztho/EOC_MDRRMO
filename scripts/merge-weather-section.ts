/**
 * One-time migration: merge the standalone "Live Weather" and "7-Day Forecast"
 * homepage sections into the single "Live Weather & 7-Day Outlook" section.
 *
 *  • Updates the weather section row (name/heading/subtitle/description).
 *  • Deletes the standalone forecast section row.
 *  • Re-publishes so the public site reflects the merge immediately.
 *
 * Run: bun run scripts/merge-weather-section.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const { publishHomepages } = await import("../src/lib/qas33/portal-server");

  // 1. Update the weather section (the merged section keeps key "weather")
  const weather = await db.homepageSection.findFirst({ where: { template: "weather" } });
  if (!weather) {
    console.log("No weather section found — nothing to merge.");
    return;
  }
  await db.homepageSection.update({
    where: { id: weather.id },
    data: {
      name: "Live Weather & 7-Day Outlook",
      heading: "Live Weather & 7-Day Outlook",
      subtitle: "Observed at Pio Duran AWS + OpenWeatherMap 7-day forecast",
      description:
        "Current observed conditions from the municipal automatic weather station together with the 7-day outlook — one complete weather picture. Never fabricated; always verify with PAGASA.",
    },
  });
  console.log(`✓ Updated weather section ${weather.id} → merged "Live Weather & 7-Day Outlook"`);

  // 2. Remove the standalone forecast section (now part of the merged block)
  const forecastSections = await db.homepageSection.findMany({ where: { template: "forecast" } });
  for (const f of forecastSections) {
    await db.homepageSection.delete({ where: { id: f.id } });
    console.log(`✓ Deleted standalone forecast section ${f.id} ("${f.name}")`);
  }

  // 3. Re-publish so the public homepage reflects the merge
  const snap = await publishHomepages("Merged Live Weather + 7-Day Outlook into one section");
  console.log(`✓ Published homepage v${snap.version} — ${snap.sections.length} sections active`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
