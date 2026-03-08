import { useEffect, useMemo, useRef, useState } from "react";
import type { MapGeoJSONFeature } from "maplibre-gl";
import MapLibre from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MaplibreTerradrawControl } from "@watergis/maplibre-gl-terradraw";
import "@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css";
import { type ShelterRecord } from "./shelterData";
import LayerManagementPanel from "./map/layerManagement/LayerManagementPanel";
import {
  cloneLayerConfigs,
  createDefaultLayerStack,
  createLayerConfig,
  createDefaultLayerStyle,
  normalizeLayerOrder,
  getLayerLabelForKind,
} from "./map/layerManagement/config";
import {
  getFilteredShelters,
  getInteractiveLayerIds,
  syncManagedLayers,
} from "./map/layerManagement/mapSync";
import { STATUS_OPTIONS, type LayerConfig, type LayerKind } from "./map/layerManagement/types";
import minimizeIcon from "./assets/icons/minimize.png";

const STORAGE_KEY_LAYER_PRESET = "arus-evac-layer-management.saved-preset.v1";
const STORAGE_KEY_LAYER_STACK = "arus-evac-layer-management.layer-stack.v1";
const STORAGE_KEY_LAYER_VISIBILITY_PRESETS = "arus-evac-layer-management.layer-visibility-presets.v1";
const DEFAULT_VISIBILITY_PRESET_PURPOSE = "General";

function sanitizeStatus(value: unknown): ShelterRecord["status"] {
  if (value === "Open" || value === "Limited" || value === "Full") return value;
  return "Open";
}

function sanitizeLayerKind(value: unknown): LayerKind | null {
  if (
    value === "shelterPins" ||
    value === "shelterStatusHalo" ||
    value === "selectedShelterHighlight"
  ) {
    return value;
  }
  return null;
}

function sanitizeLayerConfig(value: unknown): LayerConfig | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const kind = sanitizeLayerKind(candidate.kind);
  if (!kind) return null;

  const filters = candidate.filters && typeof candidate.filters === "object" ? candidate.filters : {};
  const filterRegion =
    typeof (filters as Record<string, unknown>).region === "string"
      ? String((filters as Record<string, unknown>).region)
      : "all";
  const filterMunicipalityCity =
    typeof (filters as Record<string, unknown>).municipalityCity === "string"
      ? String((filters as Record<string, unknown>).municipalityCity)
      : "";
  const filterStatuses = Array.isArray((filters as Record<string, unknown>).statuses)
    ? ((filters as Record<string, unknown>).statuses as unknown[]).map((status) =>
        sanitizeStatus(status)
      )
    : [...STATUS_OPTIONS];

  const normalizedFilters = {
    region: filterRegion as LayerConfig["filters"]["region"],
    municipalityCity: filterMunicipalityCity,
    statuses:
      filterStatuses.length === 0 ? ([...STATUS_OPTIONS] as ShelterRecord["status"][]) : Array.from(
        new Set(filterStatuses)
      ),
  };

  const style = candidate.style && typeof candidate.style === "object" ? candidate.style : {};
  const normalizedStyle = {
    ...createDefaultLayerStyle(kind),
    ...(style as Record<string, unknown>),
  };
  const normalizedStyleWithNumbers = {
    opacity: Number.isFinite(normalizedStyle.opacity as number) ? (normalizedStyle.opacity as number) : 0,
    iconSize: Number.isFinite(normalizedStyle.iconSize as number)
      ? (normalizedStyle.iconSize as number)
      : 0,
    radius: Number.isFinite(normalizedStyle.radius as number) ? (normalizedStyle.radius as number) : 0,
    strokeWidth: Number.isFinite(normalizedStyle.strokeWidth as number)
      ? (normalizedStyle.strokeWidth as number)
      : 0,
  };

  return {
    id:
      typeof candidate.id === "string" && candidate.id.length > 0
        ? candidate.id
        : `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    name:
      typeof candidate.name === "string" && candidate.name.length > 0
        ? candidate.name
        : getLayerLabelForKind(kind),
    group:
      candidate.group === "Shelters" ? "Shelters" : "Shelters",
    visible:
      typeof candidate.visible === "boolean" ? candidate.visible : true,
    order:
      typeof candidate.order === "number" && Number.isFinite(candidate.order)
        ? candidate.order
        : 0,
    filters: {
      region: normalizedFilters.region,
      municipalityCity: filterMunicipalityCity,
      statuses: normalizedFilters.statuses,
    },
    style: normalizedStyleWithNumbers,
    timeSync:
      typeof candidate.timeSync === "boolean" ? candidate.timeSync : false,
  };
}

type LayerVisibilityPreset = Partial<Record<LayerKind, boolean>>;
type LayerVisibilityPresetStore = Record<string, LayerVisibilityPreset>;

function sanitizeLayerVisibilityPresetStore(value: unknown): LayerVisibilityPresetStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const result: LayerVisibilityPresetStore = {};
  const candidates = value as Record<string, unknown>;

  Object.entries(candidates).forEach(([purpose, rawPreset]) => {
    if (typeof purpose !== "string") return;
    const normalizedPurpose = purpose.trim();
    if (!normalizedPurpose) return;

    if (!rawPreset || typeof rawPreset !== "object" || Array.isArray(rawPreset)) return;
    const preset: LayerVisibilityPreset = {};
    const entries = rawPreset as Record<string, unknown>;

    Object.entries(entries).forEach(([kindValue, visibility]) => {
      const kind = sanitizeLayerKind(kindValue);
      if (!kind || typeof visibility !== "boolean") return;
      preset[kind] = visibility;
    });

    if (Object.keys(preset).length > 0) {
      result[normalizedPurpose] = preset;
    }
  });

  return result;
}

function toSortedPresetPurposeList(presetStore: LayerVisibilityPresetStore) {
  return Object.keys(presetStore).sort((a, b) => a.localeCompare(b));
}

function snapshotLayerVisibility(layerConfigs: LayerConfig[]) {
  return layerConfigs.reduce<LayerVisibilityPreset>((acc, layerConfig) => {
    acc[layerConfig.kind] = layerConfig.visible;
    return acc;
  }, {});
}

function applyLayerVisibilitySnapshot(
  layerConfigs: LayerConfig[],
  snapshot: LayerVisibilityPreset | null
) {
  if (!snapshot) return layerConfigs;

  return layerConfigs.map((layerConfig) => {
    if (!(layerConfig.kind in snapshot)) return layerConfig;
    const visible = snapshot[layerConfig.kind];
    if (typeof visible !== "boolean") return layerConfig;
    return {
      ...layerConfig,
      visible,
    };
  });
}

function loadLayerStackFromStorage() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY_LAYER_STACK);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const sanitized = parsed
      .map((item) => sanitizeLayerConfig(item))
      .filter((item): item is LayerConfig => item !== null);
    if (sanitized.length === 0) return null;

    return normalizeLayerOrder(sanitized);
  } catch {
    return null;
  }
}

function loadLayerPresetFromStorage() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY_LAYER_PRESET);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const sanitized = parsed
      .map((item) => sanitizeLayerConfig(item))
      .filter((item): item is LayerConfig => item !== null);
    if (sanitized.length === 0) return null;
    return normalizeLayerOrder(sanitized);
  } catch {
    return null;
  }
}

function loadLayerVisibilityPresetsFromStorage() {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(STORAGE_KEY_LAYER_VISIBILITY_PRESETS);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return sanitizeLayerVisibilityPresetStore(parsed);
  } catch {
    return {};
  }
}

function persistLayerVisibilityPresetsToStorage(layerVisibilityPresets: LayerVisibilityPresetStore) {
  if (typeof window === "undefined") return;
  if (Object.keys(layerVisibilityPresets).length === 0) {
    window.localStorage.removeItem(STORAGE_KEY_LAYER_VISIBILITY_PRESETS);
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY_LAYER_VISIBILITY_PRESETS,
    JSON.stringify(layerVisibilityPresets)
  );
}

function persistLayerPresetToStorage(layerConfigs: LayerConfig[] | null) {
  if (typeof window === "undefined") return;
  if (!layerConfigs || layerConfigs.length === 0) {
    window.localStorage.removeItem(STORAGE_KEY_LAYER_PRESET);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY_LAYER_PRESET, JSON.stringify(layerConfigs));
}

function persistLayerStackToStorage(layerConfigs: LayerConfig[] | null) {
  if (typeof window === "undefined") return;
  if (!layerConfigs || layerConfigs.length === 0) {
    window.localStorage.removeItem(STORAGE_KEY_LAYER_STACK);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY_LAYER_STACK, JSON.stringify(layerConfigs));
}

type AreaFilterFocusRequest = {
  shelterIds: string[];
  requestId: number;
};

type MapProps = {
  shelters: ShelterRecord[];
  areaFilterFocusRequest: AreaFilterFocusRequest;
  shelterCardFocusRequest: {
    shelterId: string | null;
    requestId: number;
  };
};

function fitMapToShelters(map: MapLibre.Map, shelters: ShelterRecord[]) {
  if (shelters.length === 0) return;

  const bounds = new MapLibre.LngLatBounds(
    [shelters[0].longitude, shelters[0].latitude],
    [shelters[0].longitude, shelters[0].latitude]
  );

  for (let i = 1; i < shelters.length; i += 1) {
    bounds.extend([shelters[i].longitude, shelters[i].latitude]);
  }

  map.fitBounds(bounds, {
    padding: 96,
    maxZoom: 12,
    duration: 750,
  });
}

function flyToShelter(map: MapLibre.Map, shelter: ShelterRecord) {
  map.flyTo({
    center: [shelter.longitude, shelter.latitude],
    zoom: 13,
    duration: 900,
    essential: true,
  });
}

function getFeatureShelterId(feature: MapGeoJSONFeature): string | null {
  const rawId = feature.properties?.id;
  if (typeof rawId !== "string") return null;
  return rawId;
}

function findShelterByFeature(
  shelters: ShelterRecord[],
  feature: MapGeoJSONFeature
): ShelterRecord | null {
  const shelterId = getFeatureShelterId(feature);
  if (!shelterId) return null;
  return shelters.find((shelter) => shelter.id === shelterId) ?? null;
}

function getStatusColorTokens(status: ShelterRecord["status"]) {
  if (status === "Open") {
    return {
      text: "#166534",
      background: "#dcfce7",
      border: "#86efac",
    };
  }

  if (status === "Limited") {
    return {
      text: "#9a3412",
      background: "#fef3c7",
      border: "#fcd34d",
    };
  }

  return {
    text: "#991b1b",
    background: "#fee2e2",
    border: "#fca5a5",
  };
}

function getLayerMeaning(kind: LayerKind) {
  if (kind === "shelterPins") {
    return "Pin marks exact shelter location.";
  }

  if (kind === "shelterStatusHalo") {
    return "Halo shows status with color and opacity.";
  }

  return "Highlights only the selected shelter.";
}

function LayerLegendPanel({
  layerConfigs,
  sortedLayerConfigs,
  hasSelectedShelter,
  isCollapsed,
  onToggleCollapsed,
}: {
  layerConfigs: LayerConfig[];
  sortedLayerConfigs: LayerConfig[];
  hasSelectedShelter: boolean;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const activeCount = sortedLayerConfigs.filter((layerConfig) => layerConfig.visible).length;

  return (
      <section
        className={`shelter-legend-panel absolute right-3 top-3 z-20 ${
          isCollapsed ? "w-[240px]" : "w-[300px]"
        } rounded-lg border border-neutral-300 bg-white/95 shadow-lg backdrop-blur-[2px]`}
        aria-label="Map legend"
      >
        <div className="flex items-start justify-between border-b border-neutral-200 px-3 py-2">
          <div>
            <div className="text-sm font-bold text-neutral-900">Legend</div>
            <div className="text-[11px] text-neutral-500">
              Interpretation for current map view
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-neutral-300 bg-white/90 p-1 hover:bg-neutral-100"
            onClick={onToggleCollapsed}
            aria-label={isCollapsed ? "Expand legend panel" : "Collapse legend panel"}
          >
            <img
              src={minimizeIcon}
              alt=""
              className={`h-4 w-4 transition-transform ${isCollapsed ? "rotate-180" : ""}`}
            />
          </button>
        </div>

      <div className="space-y-2 p-3">
        <div>
          <div className="text-xs font-semibold text-neutral-700">Shelter Status</div>
          <div className="mt-1 space-y-1">
            {STATUS_OPTIONS.map((status) => {
              const statusColors = getStatusColorTokens(status);
              const label =
                status === "Open" ? "Available" : status === "Limited" ? "Partial" : "Full";
              return (
                <div
                  key={status}
                  className="flex items-center justify-between gap-2 text-[11px] text-neutral-700"
                >
                  <span>{status}</span>
                  <span
                    className="inline-flex rounded-full border px-2 py-[1px] text-[11px] font-semibold"
                    style={{
                      color: statusColors.text,
                      backgroundColor: statusColors.background,
                      borderColor: statusColors.border,
                    }}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {!isCollapsed && (
          <div>
            <div className="text-xs font-semibold text-neutral-700">
              Active Layers ({activeCount})
            </div>
            <div className="mt-1 space-y-2">
              {sortedLayerConfigs.length === 0 && (
                <div className="rounded border border-dashed border-neutral-300 px-2 py-1 text-[11px] text-neutral-500">
                  No layers configured.
                </div>
              )}

              {sortedLayerConfigs.map((layerConfig) => (
                <div
                  key={layerConfig.id}
                  className="rounded border border-neutral-200 bg-neutral-50/70 px-2 py-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-semibold text-neutral-800">
                      {getLayerLabelForKind(layerConfig.kind)}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-[1px] text-[10px] font-semibold ${
                        layerConfig.visible
                          ? "border border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border border-neutral-300 bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {layerConfig.visible ? "Visible" : "Hidden"}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-neutral-600">
                    {getLayerMeaning(layerConfig.kind)}
                  </div>
                  <div className="mt-1 text-[11px] text-neutral-500">
                    Name: {layerConfig.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isCollapsed ? (
          <div>
            <div className="text-xs font-semibold text-neutral-700">Active Layers</div>
            <div className="mt-1 text-[11px] text-neutral-600">
              {layerConfigs.length === 0
                ? "No layers."
                : `${activeCount} of ${layerConfigs.length} visible`}
            </div>
            <div className="text-[11px] text-neutral-500">
              Expand to inspect names, meaning, and visibility state.
            </div>
          </div>
        ) : (
          <div>
          <div className="text-xs font-semibold text-neutral-700">Quick Interpretation</div>
          <div className="mt-1 text-[11px] leading-relaxed text-neutral-600">
            {layerConfigs.length === 0
              ? "Enable at least one layer to visualize shelter data."
              : hasSelectedShelter
                ? "Click a visible pin or halo to open a shelter detail panel."
                : "Click any visible pin or halo to inspect shelter details."}
          </div>
        </div>
        )}
      </div>
    </section>
  );
}

function buildHoverPopupContent(shelter: ShelterRecord): HTMLDivElement {
  const container = document.createElement("div");
  container.className = "shelter-hover-popup-content";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "2px";
  container.style.maxWidth = "220px";

  const name = document.createElement("div");
  name.style.fontWeight = "700";
  name.style.fontSize = "12px";
  name.textContent = shelter.name;

  const location = document.createElement("div");
  location.style.fontSize = "11px";
  location.style.color = "#4b5563";
  location.textContent = `${shelter.municipalityCity}, ${shelter.region}`;

  const statusRow = document.createElement("div");
  statusRow.style.display = "flex";
  statusRow.style.alignItems = "center";
  statusRow.style.gap = "6px";

  const statusLabel = document.createElement("span");
  statusLabel.style.fontSize = "11px";
  statusLabel.style.color = "#4b5563";
  statusLabel.textContent = "Status";

  const status = document.createElement("span");
  const statusColors = getStatusColorTokens(shelter.status);
  status.style.fontSize = "11px";
  status.style.fontWeight = "600";
  status.style.color = statusColors.text;
  status.style.backgroundColor = statusColors.background;
  status.style.border = `1px solid ${statusColors.border}`;
  status.style.borderRadius = "9999px";
  status.style.padding = "1px 6px";
  status.textContent = shelter.status;

  statusRow.append(statusLabel, status);
  container.append(name, location, statusRow);
  return container;
}

function Map({
  shelters,
  areaFilterFocusRequest,
  shelterCardFocusRequest,
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<MapLibre.Map | null>(null);
  const sheltersRef = useRef<ShelterRecord[]>(shelters);
  const hoverPopupRef = useRef<MapLibre.Popup | null>(null);
  const hoveredShelterIdRef = useRef<string | null>(null);
  const selectedShelterIdRef = useRef<string | null>(null);
  const layerConfigsRef = useRef<LayerConfig[]>(createDefaultLayerStack());

  const [selectedShelterId, setSelectedShelterId] = useState<string | null>(null);
  const [layerConfigs, setLayerConfigs] = useState<LayerConfig[]>(() => {
    const savedStack = loadLayerStackFromStorage();
    return savedStack ?? createDefaultLayerStack();
  });
  const [selectedLayerConfigId, setSelectedLayerConfigId] = useState<string | null>(null);
  const [layerSearchValue, setLayerSearchValue] = useState("");
  const [layerKindToAdd, setLayerKindToAdd] = useState<LayerKind>("shelterStatusHalo");
  const [savedLayerPreset, setSavedLayerPreset] = useState<LayerConfig[] | null>(() =>
    loadLayerPresetFromStorage()
  );
  const [layerVisibilityPresets, setLayerVisibilityPresets] = useState<LayerVisibilityPresetStore>(
    () => loadLayerVisibilityPresetsFromStorage()
  );
  const [selectedVisibilityPurpose, setSelectedVisibilityPurpose] = useState<string>(
    DEFAULT_VISIBILITY_PRESET_PURPOSE
  );
  const [visibilityPurposeInput, setVisibilityPurposeInput] = useState("");
  const [isLayerPanelCollapsed, setIsLayerPanelCollapsed] = useState(false);
  const [isLegendCollapsed, setIsLegendCollapsed] = useState(false);
  const [isLayerInspectorCollapsed, setIsLayerInspectorCollapsed] = useState(false);
  const [layerDiagnosticsUpdatedAt, setLayerDiagnosticsUpdatedAt] = useState<Date>(
    new Date()
  );

  const selectedShelter = useMemo(
    () => shelters.find((shelter) => shelter.id === selectedShelterId) ?? null,
    [selectedShelterId, shelters]
  );
  const selectableLayerKinds = useMemo(
    () =>
      (["shelterPins", "shelterStatusHalo", "selectedShelterHighlight"] as LayerKind[]).filter(
        (kind) => !layerConfigs.some((layerConfig) => layerConfig.kind === kind)
      ),
    [layerConfigs]
  );
  const sortedLayerConfigs = useMemo(
    () => [...layerConfigs].sort((a, b) => a.order - b.order),
    [layerConfigs]
  );
  const selectedLayerConfig = useMemo(
    () =>
      sortedLayerConfigs.find((layerConfig) => layerConfig.id === selectedLayerConfigId) ?? null,
    [selectedLayerConfigId, sortedLayerConfigs]
  );
  const selectedLayerFeatureCount = useMemo(() => {
    if (!selectedLayerConfig) return 0;
    return getFilteredShelters(
      shelters,
      selectedLayerConfig.filters,
      selectedLayerConfig.kind,
      selectedShelterId
    ).length;
  }, [selectedLayerConfig, selectedShelterId, shelters]);
  const visibilityPurposeOptions = useMemo(
    () => toSortedPresetPurposeList(layerVisibilityPresets),
    [layerVisibilityPresets]
  );
  const hasVisibilityPresetForSelectedPurpose =
    selectedVisibilityPurpose.trim().length > 0 && selectedVisibilityPurpose in layerVisibilityPresets;
  const selectedShelterStatusColors = useMemo(() => {
    if (!selectedShelter) return null;
    return getStatusColorTokens(selectedShelter.status);
  }, [selectedShelter]);

  useEffect(() => {
    sheltersRef.current = shelters;
  }, [shelters]);

  useEffect(() => {
    persistLayerStackToStorage(layerConfigs);
  }, [layerConfigs]);

  useEffect(() => {
    persistLayerVisibilityPresetsToStorage(layerVisibilityPresets);
  }, [layerVisibilityPresets]);

  useEffect(() => {
    selectedShelterIdRef.current = selectedShelterId;
  }, [selectedShelterId]);

  useEffect(() => {
    layerConfigsRef.current = layerConfigs;
  }, [layerConfigs]);

  useEffect(() => {
    setLayerDiagnosticsUpdatedAt(new Date());
  }, [layerConfigs, shelters]);

  useEffect(() => {
    if (layerConfigs.length === 0) {
      setSelectedLayerConfigId(null);
      return;
    }

    if (selectedLayerConfigId && layerConfigs.some((layer) => layer.id === selectedLayerConfigId)) {
      return;
    }

    setSelectedLayerConfigId(layerConfigs[0].id);
  }, [layerConfigs, selectedLayerConfigId]);

  useEffect(() => {
    if (selectableLayerKinds.length === 0) return;
    if (selectableLayerKinds.includes(layerKindToAdd)) return;
    setLayerKindToAdd(selectableLayerKinds[0]);
  }, [layerKindToAdd, selectableLayerKinds]);

  useEffect(() => {
    if (!selectedVisibilityPurpose) return;
    const snapshot = layerVisibilityPresets[selectedVisibilityPurpose];
    if (!snapshot) return;
    setLayerConfigs((current) => applyLayerVisibilitySnapshot(current, snapshot));
  }, [selectedVisibilityPurpose, layerVisibilityPresets]);

  useEffect(() => {
    const purposeInOptions = layerVisibilityPresets[selectedVisibilityPurpose];
    if (purposeInOptions) return;
    if (visibilityPurposeOptions.length === 0) {
      if (selectedVisibilityPurpose !== DEFAULT_VISIBILITY_PRESET_PURPOSE) {
        setSelectedVisibilityPurpose(DEFAULT_VISIBILITY_PRESET_PURPOSE);
      }
      return;
    }

    setSelectedVisibilityPurpose(visibilityPurposeOptions[0]);
  }, [visibilityPurposeOptions, layerVisibilityPresets, selectedVisibilityPurpose]);

  function updateLayerConfig(
    layerId: string,
    updater: (layerConfig: LayerConfig) => LayerConfig
  ) {
    setLayerConfigs((current) =>
      current.map((layerConfig) =>
        layerConfig.id === layerId ? updater(layerConfig) : layerConfig
      )
    );
  }

  function moveLayer(layerId: string, direction: -1 | 1) {
    setLayerConfigs((current) => {
      const ordered = [...current].sort((a, b) => a.order - b.order);
      const currentIndex = ordered.findIndex((layerConfig) => layerConfig.id === layerId);
      if (currentIndex < 0) return current;

      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= ordered.length) return current;

      const nextOrdered = [...ordered];
      const [movingLayer] = nextOrdered.splice(currentIndex, 1);
      nextOrdered.splice(nextIndex, 0, movingLayer);

      return normalizeLayerOrder(nextOrdered);
    });
  }

  function handleAddLayer() {
    if (selectableLayerKinds.length === 0) return;

    setLayerConfigs((current) =>
      normalizeLayerOrder([...current, createLayerConfig(layerKindToAdd, current.length)])
    );
  }

  function handleRemoveLayer(layerId: string) {
    setLayerConfigs((current) =>
      normalizeLayerOrder(current.filter((layerConfig) => layerConfig.id !== layerId))
    );
  }

  function handleSavePreset() {
    const nextPreset = cloneLayerConfigs(layerConfigs);
    const normalizedPreset = normalizeLayerOrder(nextPreset);
    setSavedLayerPreset(normalizedPreset);
    persistLayerPresetToStorage(normalizedPreset);
  }

  function handleLoadPreset() {
    const stored = loadLayerPresetFromStorage();
    const presetToLoad = stored ?? savedLayerPreset;
    if (!presetToLoad) return;
    setLayerConfigs(normalizeLayerOrder(cloneLayerConfigs(presetToLoad)));
  }

  function resolveVisibilityPurposeForAction() {
    const normalizedInput = visibilityPurposeInput.trim();
    if (normalizedInput.length > 0 && layerVisibilityPresets[normalizedInput]) {
      return normalizedInput;
    }

    const selectedNormalized = selectedVisibilityPurpose.trim();
    if (selectedNormalized.length > 0 && layerVisibilityPresets[selectedNormalized]) {
      return selectedNormalized;
    }

    return "";
  }

  function handleSaveVisibilityPreset() {
    const purpose =
      visibilityPurposeInput.trim().length > 0
        ? visibilityPurposeInput.trim()
        : selectedVisibilityPurpose.trim();
    if (!purpose) return;

    setLayerVisibilityPresets((current) => {
      const next = {
        ...current,
        [purpose]: snapshotLayerVisibility(layerConfigs),
      };
      return next;
    });
    setSelectedVisibilityPurpose(purpose);
    setVisibilityPurposeInput("");
  }

  function handleApplyVisibilityPreset() {
    const purpose = resolveVisibilityPurposeForAction();
    if (!purpose) return;
    const snapshot = layerVisibilityPresets[purpose];
    if (!snapshot) return;
    setLayerConfigs((current) => applyLayerVisibilitySnapshot(current, snapshot));
    setSelectedVisibilityPurpose(purpose);
  }

  function handleDeleteVisibilityPreset() {
    const purpose = resolveVisibilityPurposeForAction();
    if (!purpose || !layerVisibilityPresets[purpose]) return;

    setLayerVisibilityPresets((current) => {
      if (!current[purpose]) return current;
      const next = { ...current };
      delete next[purpose];
      return next;
    });
    setSelectedVisibilityPurpose((current) => {
      if (current !== purpose) return current;
      const nextPurposes = Object.keys(layerVisibilityPresets).filter((name) => name !== purpose);
      return nextPurposes[0] ?? DEFAULT_VISIBILITY_PRESET_PURPOSE;
    });
    if (visibilityPurposeInput.trim().length > 0 && visibilityPurposeInput.trim() === purpose) {
      setVisibilityPurposeInput("");
    }
  }

  function handleVisibilityPurposeChange(nextPurpose: string) {
    setSelectedVisibilityPurpose(nextPurpose);
    setVisibilityPurposeInput("");
  }

  function handleResetLayerStack() {
    setLayerConfigs(createDefaultLayerStack());
  }

  function handleShowAllLayers() {
    setLayerConfigs((current) =>
      current.map((layerConfig) => ({ ...layerConfig, visible: true }))
    );
  }

  function handleHideAllLayers() {
    setLayerConfigs((current) =>
      current.map((layerConfig) => ({ ...layerConfig, visible: false }))
    );
  }

  function handleClearAllLayers() {
    setLayerConfigs([]);
  }

  function handleZoomToLayer(layerConfig: LayerConfig) {
    const map = mapInstance.current;
    if (!map) return;

    const layerShelters = getFilteredShelters(
      sheltersRef.current,
      layerConfig.filters,
      layerConfig.kind,
      selectedShelterIdRef.current
    );
    if (layerShelters.length === 0) return;

    if (layerShelters.length === 1) {
      flyToShelter(map, layerShelters[0]);
      return;
    }

    fitMapToShelters(map, layerShelters);
  }

  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    const map = new MapLibre.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [121, 13],
      zoom: 5,
    });

    mapInstance.current = map;

    map.on("load", () => {
      void syncManagedLayers(
        map,
        sheltersRef.current,
        layerConfigsRef.current,
        selectedShelterIdRef.current
      );
      hoverPopupRef.current = new MapLibre.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 16,
        className: "shelter-hover-popup",
      });

      map.on("mousemove", (event) => {
        const interactiveLayerIds = getInteractiveLayerIds(map, layerConfigsRef.current);
        if (interactiveLayerIds.length === 0) {
          map.getCanvas().style.cursor = "";
          hoveredShelterIdRef.current = null;
          hoverPopupRef.current?.remove();
          return;
        }

        const hoveredFeature = map.queryRenderedFeatures(event.point, {
          layers: interactiveLayerIds,
        })[0];
        const hoverPopup = hoverPopupRef.current;

        if (!hoveredFeature || !hoverPopup) {
          map.getCanvas().style.cursor = "";
          hoveredShelterIdRef.current = null;
          hoverPopup?.remove();
          return;
        }

        const shelter = findShelterByFeature(sheltersRef.current, hoveredFeature);
        if (!shelter) {
          map.getCanvas().style.cursor = "";
          hoveredShelterIdRef.current = null;
          hoverPopup.remove();
          return;
        }

        if (hoveredShelterIdRef.current === shelter.id) return;
        hoveredShelterIdRef.current = shelter.id;
        map.getCanvas().style.cursor = "pointer";
        hoverPopup
          .setLngLat([shelter.longitude, shelter.latitude])
          .setDOMContent(buildHoverPopupContent(shelter))
          .addTo(map);
      });

      map.on("click", (event) => {
        const interactiveLayerIds = getInteractiveLayerIds(map, layerConfigsRef.current);
        if (interactiveLayerIds.length === 0) {
          return;
        }

        const clickedFeature = map.queryRenderedFeatures(event.point, {
          layers: interactiveLayerIds,
        })[0];
        if (!clickedFeature) {
          setSelectedShelterId(null);
          selectedShelterIdRef.current = null;
          return;
        }

        const shelter = findShelterByFeature(sheltersRef.current, clickedFeature);
        if (!shelter) return;

        setSelectedShelterId(shelter.id);
        selectedShelterIdRef.current = shelter.id;
        hoveredShelterIdRef.current = null;
        hoverPopupRef.current?.remove();
        flyToShelter(map, shelter);
      });

      const draw = new MaplibreTerradrawControl({
        modes: [
          "render",
          "point",
          "marker",
          "linestring",
          "polygon",
          "rectangle",
          "circle",
          "freehand",
          "freehand-linestring",
          "angled-rectangle",
          "sensor",
          "sector",
          "select",
          "delete-selection",
          "delete",
          "download",
        ],
        open: true,
        showDeleteConfirmation: false,
      });

      map.addControl(draw, "top-left");
    });

    return () => {
      hoveredShelterIdRef.current = null;
      hoverPopupRef.current?.remove();
      hoverPopupRef.current = null;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !map.isStyleLoaded()) return;
    void syncManagedLayers(map, shelters, layerConfigs, selectedShelterId);
  }, [layerConfigs, selectedShelterId, shelters]);

  useEffect(() => {
    if (areaFilterFocusRequest.requestId === 0) return;

    const map = mapInstance.current;
    if (!map || !map.isStyleLoaded()) return;

    const focusIdSet = new Set(areaFilterFocusRequest.shelterIds);
    const focusShelters = shelters.filter((shelter) => focusIdSet.has(shelter.id));
    if (focusShelters.length === 0) return;

    fitMapToShelters(map, focusShelters);
  }, [areaFilterFocusRequest, shelters]);

  useEffect(() => {
    if (shelterCardFocusRequest.requestId === 0) return;
    if (!shelterCardFocusRequest.shelterId) return;

    const map = mapInstance.current;
    if (!map || !map.isStyleLoaded()) return;

    const targetShelter = shelters.find(
      (shelter) => shelter.id === shelterCardFocusRequest.shelterId
    );
    if (!targetShelter) return;

    flyToShelter(map, targetShelter);
    setSelectedShelterId(targetShelter.id);
    selectedShelterIdRef.current = targetShelter.id;
  }, [shelterCardFocusRequest, shelters]);

  useEffect(() => {
    if (!selectedShelterId) return;
    const stillExists = shelters.some((shelter) => shelter.id === selectedShelterId);
    if (!stillExists) {
      setSelectedShelterId(null);
      selectedShelterIdRef.current = null;
    }
  }, [selectedShelterId, shelters]);

  function toggleLayerStatusFilter(
    layerId: string,
    status: ShelterRecord["status"],
    checked: boolean
  ) {
    updateLayerConfig(layerId, (layerConfig) => {
      const currentSet = new Set(layerConfig.filters.statuses);
      if (checked) currentSet.add(status);
      else currentSet.delete(status);

      const nextStatuses = STATUS_OPTIONS.filter((option) => currentSet.has(option));
      return {
        ...layerConfig,
        filters: {
          ...layerConfig.filters,
          statuses: nextStatuses.length === 0 ? [...STATUS_OPTIONS] : nextStatuses,
        },
      };
    });
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={mapContainer} className="h-full w-full"></div>

      <LayerManagementPanel
        isCollapsed={isLayerPanelCollapsed}
        onToggleCollapsed={() => setIsLayerPanelCollapsed((current) => !current)}
        layerSearchValue={layerSearchValue}
        onLayerSearchValueChange={setLayerSearchValue}
        layerKindToAdd={layerKindToAdd}
        onLayerKindToAddChange={setLayerKindToAdd}
        selectableLayerKinds={selectableLayerKinds}
        onAddLayer={handleAddLayer}
        hasSavedPreset={Boolean(savedLayerPreset)}
        onSavePreset={handleSavePreset}
        onLoadPreset={handleLoadPreset}
        onResetStack={handleResetLayerStack}
        onShowAllLayers={handleShowAllLayers}
        onHideAllLayers={handleHideAllLayers}
        onClearAllLayers={handleClearAllLayers}
              visibilityPresetOptions={visibilityPurposeOptions}
                selectedVisibilityPurpose={selectedVisibilityPurpose}
                visibilityPurposeInput={visibilityPurposeInput}
                onVisibilityPurposeInputChange={setVisibilityPurposeInput}
                onVisibilityPurposeChange={handleVisibilityPurposeChange}
                onSaveVisibilityPreset={handleSaveVisibilityPreset}
        onApplyVisibilityPreset={handleApplyVisibilityPreset}
        onDeleteVisibilityPreset={handleDeleteVisibilityPreset}
        hasVisibilityPresetForSelectedPurpose={hasVisibilityPresetForSelectedPurpose}
        hasAnyVisibilityPreset={visibilityPurposeOptions.length > 0}
        layerConfigs={layerConfigs}
        selectedLayerConfigId={selectedLayerConfigId}
        onSelectLayerConfig={setSelectedLayerConfigId}
        onUpdateLayer={updateLayerConfig}
        onMoveLayer={moveLayer}
        onZoomToLayer={handleZoomToLayer}
        onRemoveLayer={handleRemoveLayer}
        selectedLayerConfig={selectedLayerConfig}
        selectedLayerFeatureCount={selectedLayerFeatureCount}
        layerDiagnosticsUpdatedAt={layerDiagnosticsUpdatedAt}
        isLayerInspectorCollapsed={isLayerInspectorCollapsed}
        onToggleLayerInspectorCollapsed={() =>
          setIsLayerInspectorCollapsed((current) => !current)
        }
        onToggleLayerStatusFilter={toggleLayerStatusFilter}
      />

      <LayerLegendPanel
        layerConfigs={layerConfigs}
        sortedLayerConfigs={sortedLayerConfigs}
        hasSelectedShelter={Boolean(selectedShelter)}
        isCollapsed={isLegendCollapsed}
        onToggleCollapsed={() => setIsLegendCollapsed((current) => !current)}
      />

      {selectedShelter && (
        <div className="shelter-detail-panel absolute bottom-3 left-3 z-10 w-[280px] rounded-lg border border-neutral-200 bg-white/95 p-3 shadow-lg backdrop-blur-[1px]">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-neutral-900">{selectedShelter.name}</div>
              <div className="text-xs text-neutral-600">
                {selectedShelter.municipalityCity}, {selectedShelter.region}
              </div>
            </div>
            <button
              type="button"
              className="rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-700 hover:bg-neutral-100"
              onClick={() => setSelectedShelterId(null)}
            >
              Close
            </button>
          </div>
          <div className="space-y-1 text-xs text-neutral-700">
            <div className="flex items-center gap-2">
              <span>Status:</span>
              <span
                className="inline-flex rounded-full px-2 py-[1px] text-[11px] font-semibold"
                style={{
                  color: selectedShelterStatusColors?.text,
                  backgroundColor: selectedShelterStatusColors?.background,
                  border: `1px solid ${selectedShelterStatusColors?.border ?? "transparent"}`,
                }}
              >
                {selectedShelter.status}
              </span>
            </div>
            <div>Address: {selectedShelter.address}</div>
            <div>
              Occupancy: {selectedShelter.occupancy.toLocaleString()} /{" "}
              {selectedShelter.capacity.toLocaleString()}
            </div>
            <div>
              Available:{" "}
              {(selectedShelter.capacity - selectedShelter.occupancy).toLocaleString()}
            </div>
            <div>Contact: {selectedShelter.contact}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Map;
