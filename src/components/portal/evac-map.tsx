"use client";

// QAS33 Public Portal — reusable interactive evacuation-center map (Leaflet).
//
// - Leaflet + markercluster are loaded CLIENT-ONLY via dynamic import inside
//   useEffect (SSR-safe); a fresh <div> host is created per init so React 19
//   strict-mode double-mount can never reuse a torn-down map instance.
// - Markers are L.divIcon status dots (no bundled icon assets → avoids the
//   classic bundler marker-icon 404 bug). Selection shows a pulsing ring.
// - Clicking a marker calls onSelect(id) — the parent owns popup/detail UI,
//   keeping presentation in React.
// - Legend overlay + optional user-location dot + auto fit-bounds.

import * as React from "react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";

import { cn } from "@/lib/utils";
import type { EvacCenterDTO, EvacCenterStatus } from "@/lib/qas33/emergency-types";

/** Fallback view — Pio Duran town center. */
const DEFAULT_CENTER: [number, number] = [13.0429, 123.4536];
const DEFAULT_ZOOM = 12;

/** Solid marker colors per status (kept in sync with EVAC_STATUS_META dots). */
const STATUS_HEX: Record<EvacCenterStatus, string> = {
  OPEN: "#10b981",
  NEAR_CAPACITY: "#f59e0b",
  FULL: "#ef4444",
  CLOSED: "#94a3b8",
  PREPARING: "#3b82f6",
};

export interface EvacMapProps {
  centers: EvacCenterDTO[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
  /** Show the status legend overlay (default true). */
  showLegend?: boolean;
  userLocation?: { lat: number; lng: number } | null;
  /** Fit bounds to the centers whenever they change (default true). */
  autoFit?: boolean;
  /** Scroll-wheel zoom (disable for small embedded maps). Default true. */
  scrollWheelZoom?: boolean;
}

export function EvacMap({
  centers,
  selectedId = null,
  onSelect,
  className,
  showLegend = true,
  userLocation = null,
  autoFit = true,
  scrollWheelZoom = true,
}: EvacMapProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<LeafletMap | null>(null);
  const clusterRef = React.useRef<unknown | null>(null);
  const markersRef = React.useRef<Map<string, LeafletMarker>>(new Map());
  const userMarkerRef = React.useRef<LeafletMarker | null>(null);
  const onSelectRef = React.useRef(onSelect);
  const selectedRef = React.useRef(selectedId);
  const autoFitRef = React.useRef(autoFit);
  const [ready, setReady] = React.useState(false);
  const [loadError, setLoadError] = React.useState(false);

  // Signature of everything rendered on the map — the marker layer is rebuilt
  // ONLY when this actually changes. The portal's 60s auto-refresh produces a
  // fresh centers array identity on every poll; rebuilding unconditionally
  // would flicker markers, close open popups and re-fit the viewport
  // (fitBounds) out from under the user mid-pan.
  const centersSig = React.useMemo(
    () =>
      centers
        .map(
          (c) =>
            `${c.id}:${c.name}:${c.status}:${c.currentOccupants}:${c.capacity}:${c.capacityFamilies ?? ""}:${
              c.latitude ?? ""
            },${c.longitude ?? ""}`
        )
        .join("|"),
    [centers]
  );

  onSelectRef.current = onSelect;
  selectedRef.current = selectedId;
  autoFitRef.current = autoFit;

  // ---- init (client-only, strict-mode safe) -----------------------------
  React.useEffect(() => {
    let destroyed = false;
    (async () => {
      try {
        const L = (await import("leaflet")).default;
        // markercluster's UMD wrapper resolves leaflet from the bundle, but
        // fall back to the global for maximum bundler compatibility.
        (window as unknown as { L?: typeof L }).L = L;
        await import("leaflet.markercluster");
        if (destroyed || !hostRef.current) return;
        if (mapRef.current) return; // already initialized

        const mapEl = document.createElement("div");
        mapEl.style.position = "absolute";
        mapEl.style.inset = "0";
        hostRef.current.appendChild(mapEl);

        const map = L.map(mapEl, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          zoomControl: true,
          scrollWheelZoom,
          attributionControl: true,
        });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        const cluster = L.markerClusterGroup({
          disableClusteringAtZoom: 15,
          maxClusterRadius: 60,
          showCoverageOnHover: false,
          spiderfyOnMaxZoom: true,
          iconCreateFunction: (c: { getChildCount(): number }) => {
            const n = c.getChildCount();
            const cls = n >= 10 ? "portal-evac-cluster-lg" : n >= 4 ? "portal-evac-cluster-md" : "portal-evac-cluster-sm";
            return L.divIcon({
              html: `<div class="portal-evac-cluster ${cls}"><span>${n}</span></div>`,
              className: "portal-evac-cluster-icon",
              iconSize: [40, 40],
              iconAnchor: [20, 20],
            });
          },
        });
        map.addLayer(cluster);

        mapRef.current = map;
        clusterRef.current = cluster;
        setReady(true);
        // The host may still be settling (e.g. inside an opening overlay).
        window.setTimeout(() => map.invalidateSize(), 60);
      } catch (err) {
        console.error("[EvacMap] failed to initialize Leaflet", err);
        if (!destroyed) setLoadError(true);
      }
    })();

    return () => {
      destroyed = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      clusterRef.current = null;
      markersRef.current.clear();
      userMarkerRef.current = null;
      setReady(false);
    };
  }, []);

  // ---- markers sync (centers) --------------------------------------------
  React.useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    const cluster = clusterRef.current as
      | { clearLayers(): void; addLayer(m: LeafletMarker): void }
      | null;
    if (!map || !cluster) return;

    void (async () => {
      const L = (await import("leaflet")).default;
      cluster.clearLayers();
      markersRef.current.clear();

      const withGps = centers.filter(
        (c) => c.latitude != null && c.longitude != null && Number.isFinite(c.latitude) && Number.isFinite(c.longitude)
      );
      for (const c of withGps) {
        const color = STATUS_HEX[c.status] ?? STATUS_HEX.OPEN;
        const selected = c.id === selectedRef.current;
        const marker = L.marker([c.latitude as number, c.longitude as number], {
          icon: L.divIcon({
            className: "portal-evac-marker-icon",
            html: `<div class="portal-evac-marker${selected ? " is-selected" : ""}" style="--portal-evac-color:${color}"></div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          }),
          keyboard: false,
          title: c.name,
          riseOnHover: true,
        });
        marker.on("click", () => onSelectRef.current?.(c.id));
        cluster.addLayer(marker);
        markersRef.current.set(c.id, marker);
      }

      if (autoFitRef.current && withGps.length > 0 && map) {
        if (withGps.length === 1) {
          map.setView([withGps[0].latitude as number, withGps[0].longitude as number], 15);
        } else {
          const bounds = L.latLngBounds(
            withGps.map((c) => [c.latitude as number, c.longitude as number] as [number, number])
          );
          map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
        }
      }
    })();
    // Deps are intentionally [ready, centersSig] only — centers is captured
    // through the signature, so a fresh array identity from the 60s
    // auto-refresh never rebuilds the layer or resets the viewport.
  }, [ready, centersSig]);

  // ---- selection sync -----------------------------------------------------
  React.useEffect(() => {
    if (!ready) return;
    const markers = markersRef.current;
    if (markers.size === 0) return;
    void (async () => {
      const L = (await import("leaflet")).default;
      for (const [id, marker] of markers) {
        const color = STATUS_HEX[centers.find((c) => c.id === id)?.status ?? "OPEN"] ?? STATUS_HEX.OPEN;
        const selected = id === selectedId;
        marker.setIcon(
          L.divIcon({
            className: "portal-evac-marker-icon",
            html: `<div class="portal-evac-marker${selected ? " is-selected" : ""}" style="--portal-evac-color:${color}"></div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          })
        );
        if (selected) marker.setZIndexOffset(1000);
        else marker.setZIndexOffset(0);
      }
    })();
    // centersSig (not centers): avoid icon churn on every 60s auto-refresh.
  }, [ready, selectedId, centersSig]);

  // ---- user location -------------------------------------------------------
  React.useEffect(() => {
    if (!ready) return;
    void (async () => {
      const map = mapRef.current;
      if (!map) return;
      if (!userLocation) {
        if (userMarkerRef.current) {
          map.removeLayer(userMarkerRef.current);
          userMarkerRef.current = null;
        }
        return;
      }
      const L = (await import("leaflet")).default;
      const icon = L.divIcon({
        className: "portal-evac-user-icon",
        html: `<div class="portal-evac-user" title="Your location"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
      } else {
        const m = L.marker([userLocation.lat, userLocation.lng], { icon, keyboard: false, title: "Your location" });
        m.addTo(map);
        userMarkerRef.current = m;
      }
    })();
  }, [ready, userLocation]);

  // ---- resize handling ------------------------------------------------------
  React.useEffect(() => {
    if (!ready || !hostRef.current) return;
    const host = hostRef.current;
    const ro = new ResizeObserver(() => mapRef.current?.invalidateSize());
    ro.observe(host);
    return () => ro.disconnect();
  }, [ready]);

  const legendItems: Array<{ label: string; hex: string }> = [
    { label: "Open", hex: STATUS_HEX.OPEN },
    { label: "Near capacity", hex: STATUS_HEX.NEAR_CAPACITY },
    { label: "Full", hex: STATUS_HEX.FULL },
    { label: "Preparing", hex: STATUS_HEX.PREPARING },
    { label: "Closed", hex: STATUS_HEX.CLOSED },
  ];

  return (
    <div
      ref={hostRef}
      role="application"
      aria-label="Interactive map of evacuation centers in Pio Duran"
      className={cn("relative h-full min-h-0 w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100", className)}
    >
      {loadError ? (
        <div className="absolute inset-0 z-[500] flex flex-col items-center justify-center gap-2 bg-slate-50 p-6 text-center">
          <span className="text-sm font-semibold text-slate-700">Map unavailable</span>
          <p className="text-xs text-slate-500">The interactive map could not be loaded. Browse the list instead.</p>
        </div>
      ) : null}

      {!ready && !loadError ? (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-slate-100/80" aria-busy="true">
          <span className="text-xs font-semibold text-slate-500">Loading map…</span>
        </div>
      ) : null}

      {showLegend && ready ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[600] max-w-[calc(100%-1.5rem)] rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">Evacuation status</p>
          <ul className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
            {legendItems.map((it) => (
              <li key={it.label} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full border border-white shadow-sm" style={{ backgroundColor: it.hex }} />
                {it.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
