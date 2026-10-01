"use client";

// QAS33 Public Portal — Interactive Satellite Map section ("satelliteMap").
// ---------------------------------------------------------------------------
// Esri World Imagery satellite base (default) with a places/labels reference
// layer, or OpenStreetMap streets — segmented toggle, top-right. Evacuation
// centers (LIVE data, clustered status-dot markers with rich popups) plus
// admin-published GeoJSON/KML hazard overlay layers (GET /api/public/map/layers)
// with per-layer eye toggles. Follows evac-map.tsx conventions: client-only
// dynamic Leaflet import, fresh <div> host per init (React 19 strict-mode
// safe), ResizeObserver invalidateSize, loading/error overlays.

import * as React from "react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { FeatureGroup as LeafletFeatureGroup, Map as LeafletMap, Marker as LeafletMarker, TileLayer as LeafletTileLayer } from "leaflet";
import { ChevronDown, Eye, EyeOff, Layers, Map as MapIcon, Satellite as SatelliteIcon } from "lucide-react";
import type { FeatureCollection as GeoJsonFC } from "geojson";

import { cn } from "@/lib/utils";
import type { EvacCenterDTO, EvacCenterStatus, PublicEvacResponse } from "@/lib/qas33/emergency-types";
import { EVAC_STATUS_META } from "@/lib/qas33/emergency-types";

// ---------------------------------------------------------------------------
// Constants & types
// ---------------------------------------------------------------------------

/** Pio Duran town center. */
const DEFAULT_CENTER: [number, number] = [13.0429, 123.4536];
const DEFAULT_ZOOM = 12;

const ESRI_IMAGERY_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_LABELS_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTRIBUTION = "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics";
const OSM_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Solid marker colors per status (mirrors evac-map.tsx / EVAC_STATUS_META). */
const STATUS_HEX: Record<EvacCenterStatus, string> = {
  OPEN: "#10b981",
  NEAR_CAPACITY: "#f59e0b",
  FULL: "#ef4444",
  CLOSED: "#94a3b8",
  PREPARING: "#3b82f6",
};

interface PublicMapOverlay {
  id: string;
  name: string;
  kind: string;
  strokeColor: string | null;
  fillColor: string | null;
  featureCount: number;
  geojson: unknown;
}

// ---------------------------------------------------------------------------
// Popup builders (DOM elements — dark-on-light readable, XSS-safe via
// textContent; never innerHTML for dynamic text)
// ---------------------------------------------------------------------------

function popupChip(text: string): HTMLElement {
  const el = document.createElement("p");
  el.className = "sat-pop-chip";
  el.textContent = text;
  return el;
}

function buildEvacPopup(c: EvacCenterDTO): HTMLElement {
  const root = document.createElement("div");
  root.className = "portal-sat-popup";

  root.appendChild(popupChip("Evacuation Center"));

  const name = document.createElement("p");
  name.className = "sat-pop-name";
  name.textContent = c.name;
  root.appendChild(name);

  const brgy = document.createElement("p");
  brgy.className = "sat-pop-sub";
  brgy.textContent = `Brgy. ${c.barangay}${c.address ? ` · ${c.address}` : ""}`;
  root.appendChild(brgy);

  // Status badge: colored dot + label
  const statusRow = document.createElement("p");
  statusRow.className = "sat-pop-status";
  const dot = document.createElement("span");
  dot.className = "sat-pop-dot";
  dot.style.backgroundColor = STATUS_HEX[c.status] ?? STATUS_HEX.OPEN;
  const statusLabel = document.createElement("span");
  statusLabel.textContent = EVAC_STATUS_META[c.status]?.label ?? c.status;
  statusLabel.style.color = STATUS_HEX[c.status] ?? STATUS_HEX.OPEN;
  statusLabel.style.fontWeight = "600";
  statusRow.append(dot, statusLabel);
  root.appendChild(statusRow);

  // Capacity line + available slots
  const capacity = document.createElement("p");
  capacity.className = "sat-pop-cap";
  if (c.capacity > 0) {
    capacity.textContent = `${c.currentOccupants} / ${c.capacity} occupants (${c.occupancyPct}%)`;
    root.appendChild(capacity);
    if (c.capacityFamilies != null) {
      const fams = document.createElement("p");
      fams.className = "sat-pop-cap";
      fams.textContent = `Rated for ${c.capacityFamilies} families`;
      root.appendChild(fams);
    }
    const slots = document.createElement("p");
    slots.className = "sat-pop-slots";
    slots.textContent =
      c.availableSlots > 0 ? `${c.availableSlots} slot${c.availableSlots === 1 ? "" : "s"} available` : "No slots available";
    root.appendChild(slots);
  } else {
    capacity.textContent = `${c.currentOccupants} occupants · capacity not set`;
    root.appendChild(capacity);
  }

  // Actions: call + directions
  const actions = document.createElement("div");
  actions.className = "sat-pop-actions";
  if (c.contactNumber) {
    const call = document.createElement("a");
    call.href = `tel:${c.contactNumber.replace(/[^+\d]/g, "")}`;
    call.textContent = "Call";
    actions.appendChild(call);
  }
  const dir = document.createElement("a");
  dir.href = `https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`;
  dir.target = "_blank";
  dir.rel = "noopener noreferrer";
  dir.textContent = "Directions";
  actions.appendChild(dir);
  root.appendChild(actions);

  return root;
}

function buildOverlayPopup(overlayName: string, props: Record<string, unknown>): HTMLElement {
  const root = document.createElement("div");
  root.className = "portal-sat-popup";

  root.appendChild(popupChip(overlayName));

  const title = document.createElement("p");
  title.className = "sat-pop-name";
  const t = typeof props.name === "string" && props.name ? props.name : typeof props.title === "string" && props.title ? props.title : "";
  title.textContent = t || "Map feature";
  root.appendChild(title);

  if (typeof props.description === "string" && props.description) {
    const desc = document.createElement("p");
    desc.className = "sat-pop-desc";
    desc.textContent = props.description;
    root.appendChild(desc);
  }
  return root;
}

// ---------------------------------------------------------------------------
// Section body
// ---------------------------------------------------------------------------

export function SatelliteMapSectionBody({ evacuation }: { evacuation?: PublicEvacResponse | null }) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<LeafletMap | null>(null);
  const satRef = React.useRef<LeafletTileLayer | null>(null);
  const labelsRef = React.useRef<LeafletTileLayer | null>(null);
  const streetsRef = React.useRef<LeafletTileLayer | null>(null);
  const overlayGroupsRef = React.useRef<Map<string, LeafletFeatureGroup>>(new Map());
  const clusterRef = React.useRef<LeafletFeatureGroup | null>(null);

  const [ready, setReady] = React.useState(false);
  const [loadError, setLoadError] = React.useState(false);
  const [base, setBase] = React.useState<"satellite" | "streets">("satellite");
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [evacVisible, setEvacVisible] = React.useState(true);
  const [overlays, setOverlays] = React.useState<PublicMapOverlay[]>([]);
  const [layerVisible, setLayerVisible] = React.useState<Record<string, boolean>>({});
  const [layersError, setLayersError] = React.useState<string | null>(null);
  const [layersNonce, setLayersNonce] = React.useState(0);

  const centers = React.useMemo(
    () =>
      (evacuation?.centers ?? []).filter(
        (c) => c.latitude != null && c.longitude != null && Number.isFinite(c.latitude) && Number.isFinite(c.longitude)
      ),
    [evacuation]
  );

  // Signature of everything rendered in the evacuation layer (markers AND
  // popup content) — the layer is rebuilt ONLY when this actually changes.
  // The portal's 60s auto-refresh produces a fresh array identity on every
  // poll; rebuilding unconditionally would flicker markers and close a popup
  // the user is reading.
  const centersSig = React.useMemo(
    () =>
      centers
        .map(
          (c) =>
            `${c.id}:${c.name}:${c.barangay}:${c.address ?? ""}:${c.status}:${c.currentOccupants}:${c.capacity}:${
              c.occupancyPct
            }:${c.capacityFamilies ?? ""}:${c.availableSlots}:${c.contactNumber ?? ""}:${c.latitude},${c.longitude}`
        )
        .join("|"),
    [centers]
  );

  // ---- init (client-only, strict-mode safe) --------------------------------
  React.useEffect(() => {
    let destroyed = false;
    (async () => {
      try {
        const L = (await import("leaflet")).default;
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
          scrollWheelZoom: true, // dedicated map section — wheel zoom stays on
          attributionControl: true,
        });

        // Reference labels live in a dedicated pane above the imagery tiles
        // (tilePane 200) but below vector overlays + markers.
        map.createPane("satLabels");
        const labelsPane = map.getPane("satLabels");
        if (labelsPane) labelsPane.style.zIndex = "350";

        const satellite = L.tileLayer(ESRI_IMAGERY_URL, { maxZoom: 19, attribution: ESRI_ATTRIBUTION });
        const labels = L.tileLayer(ESRI_LABELS_URL, { pane: "satLabels", maxZoom: 19, attribution: "" });
        const streets = L.tileLayer(OSM_URL, { maxZoom: 19, attribution: OSM_ATTRIBUTION });
        satellite.addTo(map);
        labels.addTo(map);

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
        satRef.current = satellite;
        labelsRef.current = labels;
        streetsRef.current = streets;
        clusterRef.current = cluster;
        setReady(true);
        window.setTimeout(() => map.invalidateSize(), 60);
      } catch (err) {
        console.error("[SatelliteMap] failed to initialize Leaflet", err);
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
      overlayGroupsRef.current.clear();
      setReady(false);
    };
  }, []);

  // ---- base layer switch (Satellite ⇄ Streets) -----------------------------
  React.useEffect(() => {
    const map = mapRef.current;
    const sat = satRef.current;
    const labels = labelsRef.current;
    const streets = streetsRef.current;
    if (!ready || !map || !sat || !labels || !streets) return;
    if (base === "satellite") {
      map.removeLayer(streets);
      map.addLayer(sat);
      map.addLayer(labels);
    } else {
      map.removeLayer(sat);
      map.removeLayer(labels);
      map.addLayer(streets);
    }
  }, [ready, base]);

  // ---- evacuation markers (rebuilt when the live data changes) -------------
  React.useEffect(() => {
    if (!ready) return;
    const cluster = clusterRef.current;
    if (!cluster) return;

    void (async () => {
      const L = (await import("leaflet")).default;
      cluster.clearLayers();
      for (const c of centers) {
        const color = STATUS_HEX[c.status] ?? STATUS_HEX.OPEN;
        const marker = L.marker([c.latitude as number, c.longitude as number], {
          icon: L.divIcon({
            className: "portal-evac-marker-icon",
            html: `<div class="portal-evac-marker" style="--portal-evac-color:${color}"></div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          }),
          keyboard: false,
          title: c.name,
          riseOnHover: true,
        });
        marker.bindPopup(buildEvacPopup(c), { maxWidth: 300 });
        cluster.addLayer(marker);
      }
    })();
    // Deps are intentionally [ready, centersSig] only — centers is captured
    // through the signature, so a fresh array identity from the 60s
    // auto-refresh never rebuilds the layer or closes an open popup.
  }, [ready, centersSig]);

  // ---- evacuation layer visibility ------------------------------------------
  React.useEffect(() => {
    const map = mapRef.current;
    const group = clusterRef.current;
    if (!ready || !map || !group) return;
    if (evacVisible) map.addLayer(group);
    else map.removeLayer(group);
  }, [ready, evacVisible]);

  // ---- overlay layers: fetch published layers -------------------------------
  React.useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    fetch("/api/public/map/layers", { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ overlays?: PublicMapOverlay[] }>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (!alive) return;
        setOverlays(Array.isArray(data.overlays) ? data.overlays : []);
        setLayersError(null);
      })
      .catch(() => {
        if (!alive) return;
        setLayersError("Overlay layers could not be loaded.");
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [layersNonce]);

  // ---- overlay layers: build GeoJSON groups ---------------------------------
  React.useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;

    void (async () => {
      const L = (await import("leaflet")).default;
      // Drop previous groups from the map before rebuilding.
      for (const group of overlayGroupsRef.current.values()) {
        if (map.hasLayer(group)) map.removeLayer(group);
      }
      overlayGroupsRef.current.clear();

      const nextVisible: Record<string, boolean> = {};
      for (const o of overlays) {
        if (!o.geojson || typeof o.geojson !== "object") continue;
        const group = L.featureGroup();
        const stroke = o.strokeColor || "#f2b705";
        const fill = o.fillColor || "#1d3fae";
        try {
          L.geoJSON(o.geojson as GeoJsonFC, {
            style: { color: stroke, weight: 2.5, fillColor: fill, fillOpacity: 0.18 },
            pointToLayer: (_feature, latlng) =>
              L.circleMarker(latlng, { radius: 6, color: stroke, weight: 2.5, fillColor: fill, fillOpacity: 0.3 }),
            onEachFeature: (feature, layer) => {
              const props = (feature?.properties ?? {}) as Record<string, unknown>;
              layer.bindPopup(buildOverlayPopup(o.name, props), { maxWidth: 300 });
            },
          }).addTo(group);
        } catch (err) {
          console.error("[SatelliteMap] invalid overlay layer skipped", o.name, err);
          continue;
        }
        overlayGroupsRef.current.set(o.id, group);
        nextVisible[o.id] = true; // published layers default ON
      }
      // Publish the visibility map (default ON for every built layer) — this
      // also re-triggers the visibility effect below, which adds the groups.
      setLayerVisible(nextVisible);
    })();
  }, [ready, overlays]);

  // ---- overlay layers: visibility toggles ------------------------------------
  React.useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const [id, group] of overlayGroupsRef.current) {
      const on = layerVisible[id] !== false;
      if (on && !map.hasLayer(group)) map.addLayer(group);
      if (!on && map.hasLayer(group)) map.removeLayer(group);
    }
  }, [ready, layerVisible, overlays]);

  // ---- open the layer panel by default on ≥ sm screens -----------------------
  React.useEffect(() => {
    const t = window.setTimeout(() => {
      if (window.matchMedia("(min-width: 640px)").matches) setPanelOpen(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  // ---- resize handling ---------------------------------------------------------
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

  const hasEvacLayer = centers.length > 0;

  return (
    <div
      role="application"
      aria-label="Interactive satellite map of Pio Duran with evacuation centers and hazard overlays"
      className="relative h-[400px] w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 sm:h-[480px] lg:h-[540px]"
    >
      {/* Leaflet host (fresh map div appended inside by the init effect) */}
      <div ref={hostRef} className="absolute inset-0" />

      {/* Base layer segmented control (top-right) */}
      <div className="absolute right-3 top-3 z-[1100] flex items-center gap-1 rounded-full p-1 portal-glass-strong" role="group" aria-label="Base map style">
        <button
          type="button"
          aria-pressed={base === "satellite"}
          onClick={() => setBase("satellite")}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold",
            base === "satellite" ? "bg-gov-blue text-white shadow-sm" : "text-slate-700 hover:bg-white/60"
          )}
        >
          <SatelliteIcon aria-hidden="true" className="size-3.5" /> Satellite
        </button>
        <button
          type="button"
          aria-pressed={base === "streets"}
          onClick={() => setBase("streets")}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold",
            base === "streets" ? "bg-gov-blue text-white shadow-sm" : "text-slate-700 hover:bg-white/60"
          )}
        >
          <MapIcon aria-hidden="true" className="size-3.5" /> Map
        </button>
      </div>

      {/* Layer control panel (top-left, collapsible on mobile) */}
      <div className="absolute left-3 top-3 z-[1100] w-60 max-w-[calc(100%-1.5rem)] overflow-hidden rounded-xl portal-glass-strong">
        <button
          type="button"
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen((o) => !o)}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-800 hover:bg-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
        >
          <Layers aria-hidden="true" className="size-4 text-gov-blue" />
          Map layers
          <ChevronDown aria-hidden="true" className={cn("ml-auto size-4 transition-transform", panelOpen && "rotate-180")} />
        </button>
        {panelOpen ? (
          <div className="space-y-1 border-t border-white/50 px-2 py-2">
            {hasEvacLayer ? (
              <LayerRow
                label="Evacuation Centers"
                badge="LIVE"
                visible={evacVisible}
                onToggle={() => setEvacVisible((v) => !v)}
              />
            ) : null}
            {overlays.map((o) => (
              <LayerRow
                key={o.id}
                label={o.name}
                badge={o.kind === "kml" ? "KML" : "GEOJSON"}
                visible={layerVisible[o.id] !== false}
                onToggle={() => setLayerVisible((p) => ({ ...p, [o.id]: p[o.id] === false }))}
              />
            ))}
            {overlays.length === 0 ? (
              <p className="px-1.5 py-1.5 text-[11px] leading-snug text-slate-600">
                {layersError ? (
                  <>
                    {layersError}{" "}
                    <button
                      type="button"
                      onClick={() => setLayersNonce((n) => n + 1)}
                      className="font-semibold text-gov-blue underline-offset-2 hover:underline"
                    >
                      Retry
                    </button>
                  </>
                ) : (
                  "No overlay layers published"
                )}
              </p>
            ) : null}
            {layersError && overlays.length > 0 ? <p className="px-1.5 py-1 text-[10px] text-amber-700">{layersError}</p> : null}
          </div>
        ) : null}
      </div>

      {/* Legend (bottom-left) */}
      {ready ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[1100] max-w-[calc(100%-1.5rem)] rounded-xl px-3 py-2.5 portal-glass-strong">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-600">Evacuation status</p>
          <ul className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
            {legendItems.map((it) => (
              <li key={it.label} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-800">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full border border-white shadow-sm" style={{ backgroundColor: it.hex }} />
                {it.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Loading / error overlays (like evac-map) */}
      {loadError ? (
        <div className="absolute inset-0 z-[1200] flex flex-col items-center justify-center gap-2 bg-slate-50 p-6 text-center">
          <span className="text-sm font-semibold text-slate-700">Map unavailable</span>
          <p className="text-xs text-slate-500">The interactive map could not be loaded. Please try again later.</p>
        </div>
      ) : null}

      {!ready && !loadError ? (
        <div className="absolute inset-0 z-[1200] flex items-center justify-center bg-slate-100/80" aria-busy="true">
          <span className="text-xs font-semibold text-slate-500">Loading map…</span>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layer row (eye toggle + label + kind badge)
// ---------------------------------------------------------------------------

function LayerRow({ label, badge, visible, onToggle }: { label: string; badge: string; visible: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 hover:bg-white/40">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={visible}
        aria-label={visible ? `Hide ${label} layer` : `Show ${label} layer`}
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-gov-blue transition-colors hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
      >
        {visible ? <Eye aria-hidden="true" className="size-4" /> : <EyeOff aria-hidden="true" className="size-4 text-slate-400" />}
      </button>
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800" title={label}>
        {label}
      </span>
      <span
        className={cn(
          "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide",
          badge === "LIVE" && "bg-emerald-100 text-emerald-700",
          badge === "KML" && "bg-blue-100 text-blue-700",
          badge === "GEOJSON" && "bg-amber-100 text-amber-700"
        )}
      >
        {badge}
      </span>
    </div>
  );
}
