// QAS33 — 404 not-found page (branded, bilingual English/Tagalog).
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16 text-center">
      <p className="font-mono text-sm font-semibold tracking-widest text-primary">ERROR 404</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Page not found</h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        The page you are looking for does not exist or has been moved.{" "}
        <span lang="tl">
          Ang pahinang hinahanap ninyo ay hindi matagpuan o nailipat na.
        </span>
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Return to QAS33 portal
      </Link>
      <p className="mt-8 text-xs text-muted-foreground">
        QAS33 · MDRRMO Pio Duran — Barangay DRRM Plan Review, Tracking, Submission &amp;
        Management System
      </p>
    </main>
  );
}
