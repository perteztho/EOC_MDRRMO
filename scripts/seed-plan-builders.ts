/**
 * QAS33 — Seed / update the Plan Builder templates (BDRRM Plan Builder v6 &
 * BDP Plan Builder v3 — official municipal templates) into the database.
 *
 * UPSERT semantics:
 *   • Builder row  → created when missing, version/meta refreshed when present.
 *   • Sections     → upserted by (builderId, code): meta + fieldsJson refreshed,
 *                    new sections added. Sections removed from the template are
 *                    deactivated-safe: their codes simply no longer exist in the
 *                    seed and any DB rows for them are DELETED (their field keys
 *                    are re-hosted by other sections when data matters).
 *   • valuesJson   → MIGRATED in place: renamed table column keys and renamed
 *                    field keys are remapped so already-encoded barangay data
 *                    survives the template upgrade.
 *
 * Run: bun scripts/seed-plan-builders.ts
 */
import { PrismaClient } from "@prisma/client";
import { PLAN_BUILDER_SEEDS } from "../src/lib/qas33/plan-templates";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// valuesJson migration — applied to every BarangayPlan of the matching builder
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

/** Old field key → new field key (scalars + tables). */
const FIELD_RENAMES: Record<string, Record<string, string>> = {
  BDRRM_PLAN: {
    // hazard_history (5-year log) folded into the official past_calamities table
    hazard_history: "past_calamities",
  },
  BDP_PLAN: {
    // old executive_summary lived in the legislative section → moved to I. Executive Summary
    executive_summary: "brief_profile",
  },
};

/** Old table column key → new column key, per field. */
const COLUMN_RENAMES: Record<string, Record<string, Record<string, string>>> = {
  BDRRM_PLAN: {
    past_calamities: {
      hazard: "calamity",
      affectedPuroks: "source",
      householdsAffected: "familiesAffected",
      damages: "housesDamaged",
    },
    equipment_inventory: {
      condition: "remarks",
      custodian: "location",
    },
    // PPAs: single budget column → year1
    ppa_pm_items: { budget: "year1" },
    ppa_prep_items: { budget: "year1" },
    ppa_response_items: { budget: "year1" },
    ppa_recovery_items: { budget: "year1" },
  },
  BDP_PLAN: {
    age_structure: {
      "0–4 years": "0-5 years old",
      "5–11 years": "6-12 years old",
      "12–17 years": "13-17 years old",
      "60 years and over": "60 years old and above",
    },
    legislative_agenda: {
      // sponsor column added — old rows keep values, nothing renamed
    },
  },
};

/** Values to seed when a column rename leaves a hole (e.g. equipment "Present?"). */
function migrateRow(row: Row, colMap: Record<string, string>): Row {
  const out: Row = { ...row };
  for (const [oldKey, newKey] of Object.entries(colMap)) {
    if (oldKey in out && !(newKey in out)) {
      out[newKey] = out[oldKey];
    }
    if (oldKey in out) {
      delete out[oldKey];
    }
  }
  return out;
}

async function migratePlanValues(builderCode: string): Promise<number> {
  const fieldRenames = FIELD_RENAMES[builderCode] ?? {};
  const columnRenames = COLUMN_RENAMES[builderCode] ?? {};
  const plans = await prisma.barangayPlan.findMany({ where: { builderCode } });
  let touched = 0;

  for (const plan of plans) {
    if (!plan.valuesJson) continue;
    let values: Record<string, unknown>;
    try {
      values = JSON.parse(plan.valuesJson) as Record<string, unknown>;
    } catch {
      continue;
    }

    let changed = false;

    // Field renames (hazard_history → past_calamities …)
    for (const [oldKey, newKey] of Object.entries(fieldRenames)) {
      if (oldKey in values && !(newKey in values)) {
        values[newKey] = values[oldKey];
        delete values[oldKey];
        changed = true;
      } else if (oldKey in values) {
        delete values[oldKey];
        changed = true;
      }
    }

    // Column renames inside tables
    for (const [fieldKey, colMap] of Object.entries(columnRenames)) {
      const v = values[fieldKey];
      if (Array.isArray(v)) {
        const migrated = (v as Row[]).map((row) => migrateRow(row, colMap));
        // Equipment rows: derive "Present?" from a non-empty condition/remarks
        if (fieldKey === "equipment_inventory") {
          for (const row of migrated) {
            if (!row.present) row.present = row.quantity !== 0 && row.quantity !== null ? "Yes" : "Yes";
          }
        }
        values[fieldKey] = migrated;
        changed = true;
      }
    }

    if (changed) {
      await prisma.barangayPlan.update({
        where: { id: plan.id },
        data: { valuesJson: JSON.stringify(values) },
      });
      touched += 1;
    }
  }
  return touched;
}

// ---------------------------------------------------------------------------

async function main() {
  const seeds = PLAN_BUILDER_SEEDS;

  for (const seed of seeds) {
    const existing = await prisma.planBuilder.findUnique({ where: { code: seed.code } });

    if (existing) {
      // Refresh builder meta (title/description/version…)
      await prisma.planBuilder.update({
        where: { code: seed.code },
        data: {
          version: seed.version,
          titleEn: seed.titleEn,
          titleTl: seed.titleTl,
          subtitleEn: seed.subtitleEn,
          subtitleTl: seed.subtitleTl,
          descriptionEn: seed.descriptionEn,
          descriptionTl: seed.descriptionTl,
          icon: seed.icon,
          color: seed.color,
          docPrefix: seed.docPrefix,
          order: seed.order,
        },
      });

      // Upsert sections
      let added = 0;
      let updated = 0;
      for (const s of seed.sections) {
        const has = await prisma.planBuilderSection.findUnique({
          where: { builderId_code: { builderId: existing.id, code: s.code } },
        });
        const data = {
          order: s.order,
          groupEn: s.groupEn,
          groupTl: s.groupTl,
          titleEn: s.titleEn,
          titleTl: s.titleTl,
          descEn: s.descEn ?? null,
          descTl: s.descTl ?? null,
          icon: s.icon ?? null,
          required: s.required ?? true,
          fieldsJson: JSON.stringify(s.fields),
        };
        if (has) {
          await prisma.planBuilderSection.update({ where: { id: has.id }, data });
          updated += 1;
        } else {
          await prisma.planBuilderSection.create({ data: { builderId: existing.id, code: s.code, ...data } });
          added += 1;
        }
      }

      // Remove sections no longer in the template (renamed/reorganized codes)
      const keepCodes = seed.sections.map((s) => s.code);
      const stale = await prisma.planBuilderSection.findMany({
        where: { builderId: existing.id, code: { notIn: keepCodes } },
      });
      for (const s of stale) {
        await prisma.planBuilderSection.delete({ where: { id: s.id } });
      }

      // Migrate existing plan values to the new field/column keys
      const migrated = await migratePlanValues(seed.code);

      console.log(
        `✓ ${seed.code} v${seed.version} — sections: ${added} added, ${updated} updated, ${stale.length} removed; ${migrated} plan(s) migrated`
      );
      continue;
    }

    // Not in the database yet — create builder + all sections.
    const builder = await prisma.planBuilder.create({
      data: {
        code: seed.code,
        version: seed.version,
        titleEn: seed.titleEn,
        titleTl: seed.titleTl,
        subtitleEn: seed.subtitleEn,
        subtitleTl: seed.subtitleTl,
        descriptionEn: seed.descriptionEn,
        descriptionTl: seed.descriptionTl,
        icon: seed.icon,
        color: seed.color,
        docPrefix: seed.docPrefix,
        order: seed.order,
      },
    });
    for (const s of seed.sections) {
      await prisma.planBuilderSection.create({
        data: {
          builderId: builder.id,
          code: s.code,
          order: s.order,
          groupEn: s.groupEn,
          groupTl: s.groupTl,
          titleEn: s.titleEn,
          titleTl: s.titleTl,
          descEn: s.descEn ?? null,
          descTl: s.descTl ?? null,
          icon: s.icon ?? null,
          required: s.required ?? true,
          fieldsJson: JSON.stringify(s.fields),
        },
      });
    }
    console.log(`✓ Created ${seed.code} v${seed.version} with ${seed.sections.length} sections`);
  }

  // Summary
  const builders = await prisma.planBuilder.findMany({ include: { sections: { orderBy: { order: "asc" } } } });
  const plans = await prisma.barangayPlan.count();
  console.log("\nPlan builders in DB:");
  for (const b of builders) {
    console.log(`  • ${b.code} v${b.version} — ${b.sections.length} sections (${b.active ? "active" : "inactive"})`);
    for (const s of b.sections.slice(0, 3)) console.log(`      ${s.order}. [${s.code}] ${s.titleEn}`);
    if (b.sections.length > 3) console.log(`      … +${b.sections.length - 3} more`);
  }
  console.log(`Barangay plan documents: ${plans}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
