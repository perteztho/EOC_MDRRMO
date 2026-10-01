import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBarangay } from "@/lib/qas33/auth";

// GET — tutorials in the barangay's selected language
export async function GET() {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const submission = await db.submission.findFirst({ where: { barangayId: resolved.barangay.id }, orderBy: { year: "desc" } });
  const lang = submission?.templateLang || "EN";
  const tutorials = await db.tutorial.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
  });
  return NextResponse.json({
    lang,
    tutorials: tutorials.map((t) => ({
      key: t.key,
      title: lang === "TL" ? t.titleTl : t.titleEn,
      body: lang === "TL" ? t.bodyTl : t.bodyEn,
    })),
  });
}
