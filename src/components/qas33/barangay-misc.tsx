"use client";

// QAS33 Barangay Portal — Profile tab
// (Access PIN management lives in the Settings tab.)

import { Settings2, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/qas33/api";
import type { BarangayOverview, SessionInfo } from "@/lib/qas33/types";

// DB names may already carry the "Barangay" prefix (Poblacion I–V) — strip it
// so composed strings never read "Barangay Barangay III".
const bareBarangayName = (name: string) => name.replace(/^Barangay\s+/i, "").trim();

// ---------------------------------------------------------------------------
// Profile tab
// ---------------------------------------------------------------------------

export function ProfileTab({
  session,
  overview,
  onOpenSettings,
}: {
  session: SessionInfo;
  overview: BarangayOverview | null;
  onOpenSettings: () => void;
}) {
  const barangay = overview?.barangay ?? session.barangay;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Barangay information, security and session details.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {/* Barangay info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="size-4 text-primary" aria-hidden="true" />
              Barangay Information
            </CardTitle>
            <CardDescription>Official records maintained by the MDRRMO.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Barangay</dt>
                <dd className="font-medium">{barangay?.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Barangay Code</dt>
                <dd className="font-mono font-medium">{barangay?.code ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Punong Barangay</dt>
                <dd className="text-right font-medium">{barangay?.captain ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Population</dt>
                <dd className="font-medium">
                  {overview?.barangay.population != null
                    ? overview.barangay.population.toLocaleString("en-PH")
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Households</dt>
                <dd className="font-medium">
                  {overview?.barangay.households != null
                    ? overview.barangay.households.toLocaleString("en-PH")
                    : "—"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Access & security pointer (PIN form lives in Settings) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                Access &amp; Security
              </CardTitle>
              <CardDescription>
                Your Access PIN and portal preferences are managed in Settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={onOpenSettings}>
                <Settings2 className="size-4" aria-hidden="true" /> Open Settings
              </Button>
            </CardContent>
          </Card>

          {/* Session info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Session</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Logged in as</dt>
                  <dd className="text-right font-medium">
                    Barangay {bareBarangayName(session.barangay?.name ?? "")}
                    {session.barangay && <span className="block font-mono text-xs text-muted-foreground">{session.barangay.code}</span>}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Role</dt>
                  <dd className="font-medium">Barangay (BDRRMP Preparer)</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Session expires</dt>
                  <dd className="text-right font-medium">{formatDateTime(session.expiresAt)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
