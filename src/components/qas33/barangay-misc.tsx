"use client";

// QAS33 Barangay Portal — Profile tab

import { useState } from "react";
import { Info, ShieldCheck, UserRound } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api, formatDateTime } from "@/lib/qas33/api";
import type { BarangayOverview, SessionInfo } from "@/lib/qas33/types";
import { errMsg } from "./barangay-shared";

// DB names may already carry the "Barangay" prefix (Poblacion I–V) — strip it
// so composed strings never read "Barangay Barangay III".
const bareBarangayName = (name: string) => name.replace(/^Barangay\s+/i, "").trim();

// ---------------------------------------------------------------------------
// Profile tab
// ---------------------------------------------------------------------------

export function ProfileTab({ session, overview }: { session: SessionInfo; overview: BarangayOverview | null }) {
  const { toast } = useToast();
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const barangay = overview?.barangay ?? session.barangay;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!currentPin || !newPin || !confirmPin) {
      setFormError("Please fill in all fields.");
      return;
    }
    if (newPin.length < 6) {
      setFormError("New PIN must be at least 6 characters.");
      return;
    }
    if (newPin !== confirmPin) {
      setFormError("New PIN and confirmation do not match.");
      return;
    }
    if (newPin === currentPin) {
      setFormError("New PIN must be different from the current PIN.");
      return;
    }
    setSaving(true);
    try {
      await api.changePin(currentPin, newPin, confirmPin);
      toast({
        title: "PIN updated",
        description: "Use your new Access PIN the next time you log in.",
      });
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    } catch (err) {
      toast({ variant: "destructive", title: "Could not change PIN", description: errMsg(err) });
    } finally {
      setSaving(false);
    }
  }

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
          {/* Security */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                Change Access PIN
              </CardTitle>
              <CardDescription>
                Keep your PIN secret. If you forget it, the MDRRMO can issue a reset.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-3" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="current-pin">Current PIN</Label>
                  <Input
                    id="current-pin"
                    type="password"
                    autoComplete="current-password"
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-pin">New PIN</Label>
                    <Input
                      id="new-pin"
                      type="password"
                      autoComplete="new-password"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-pin">Confirm New PIN</Label>
                    <Input
                      id="confirm-pin"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      disabled={saving}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Minimum of 6 characters.</p>
                {formError && (
                  <Alert variant="destructive" className="py-2">
                    <Info />
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" disabled={saving}>
                  {saving ? "Updating…" : "Update PIN"}
                </Button>
              </form>
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
