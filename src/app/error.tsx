"use client";

// QAS33 — route segment error boundary. Catches render/runtime errors inside
// the client tree (portal / consoles) and offers a branded recovery path
// instead of Next.js's default error screen.
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-lg font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error occurred while loading this part of QAS33. Your data is safe —
          try again, or reload the portal.
        </p>
        {error.digest && (
          <p className="mt-3 rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
            Error reference: {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Button onClick={reset} className="w-full sm:w-auto">
            <RotateCcw className="size-4" aria-hidden="true" />
            Try again
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => {
              window.location.assign("/");
            }}
          >
            Back to portal
          </Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          QAS33 · MDRRMO Pio Duran — Barangay DRRM Plan Review, Tracking, Submission &amp;
          Management System
        </p>
      </div>
    </main>
  );
}
