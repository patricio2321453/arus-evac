import type { ShelterRecord } from "../../shelterData";
import {
  RENDER_COST_HINT_BY_KIND,
  STATUS_OPTIONS,
  type LayerConfig,
  type LayerFilters,
  type LayerKind,
} from "./types";
import { getLayerLabelForKind, normalizeLayerOrder } from "./config";
import minimizeIcon from "../../assets/icons/minimize.png";

const KIND_SEARCH_ALIASES: Record<LayerKind, string[]> = {
  shelterPins: ["shelter pin", "pin", "pins", "location", "marker"],
  shelterStatusHalo: ["shelter halo", "halo", "status", "heatmap", "ring", "ringed"],
  selectedShelterHighlight: ["selected", "selection", "highlight", "focus", "single", "target"],
  hazardFill: ["hazard fill", "hazard", "flood", "risk", "isochrone"],
  hazardOutline: ["hazard outline", "flood outline", "flood edge", "isochrones", "ring"],
  populationPolygons: ["population polygon", "population", "densities", "footprint", "areas"],
  populationOutlines: ["population outline", "population boundary", "impact boundary", "isochrone edge"],
  populationSelection: ["population selection", "selected population", "focused population", "municipality focus"],
};

type LayerManagementPanelProps = {
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  layerSearchValue: string;
  onLayerSearchValueChange: (value: string) => void;
  layerKindToAdd: LayerKind;
  onLayerKindToAddChange: (kind: LayerKind) => void;
  selectableLayerKinds: LayerKind[];
  onAddLayer: () => void;
  hasSavedPreset: boolean;
  onSavePreset: () => void;
  onLoadPreset: () => void;
  onResetStack: () => void;
  onShowAllLayers: () => void;
  onHideAllLayers: () => void;
  onClearAllLayers: () => void;
  visibilityPresetOptions: string[];
  selectedVisibilityPurpose: string;
  visibilityPurposeInput: string;
  onVisibilityPurposeInputChange: (value: string) => void;
  onVisibilityPurposeChange: (value: string) => void;
  onSaveVisibilityPreset: () => void;
  onApplyVisibilityPreset: () => void;
  onDeleteVisibilityPreset: () => void;
  hasVisibilityPresetForSelectedPurpose: boolean;
  hasAnyVisibilityPreset: boolean;
  layerConfigs: LayerConfig[];
  selectedLayerConfigId: string | null;
  onSelectLayerConfig: (layerId: string) => void;
  onUpdateLayer: (layerId: string, updater: (layerConfig: LayerConfig) => LayerConfig) => void;
  onMoveLayer: (layerId: string, direction: -1 | 1) => void;
  onZoomToLayer: (layerConfig: LayerConfig) => void;
  onRemoveLayer: (layerId: string) => void;
  selectedLayerConfig: LayerConfig | null;
  selectedLayerFeatureCount: number;
  layerDiagnosticsUpdatedAt: Date;
  isLayerInspectorCollapsed: boolean;
  onToggleLayerInspectorCollapsed: () => void;
  onToggleLayerStatusFilter: (
    layerId: string,
    status: ShelterRecord["status"],
    checked: boolean
  ) => void;
};

function LayerManagementPanel({
  isCollapsed,
  onToggleCollapsed,
  layerSearchValue,
  onLayerSearchValueChange,
  layerKindToAdd,
  onLayerKindToAddChange,
  selectableLayerKinds,
  onAddLayer,
  hasSavedPreset,
  onSavePreset,
  onLoadPreset,
  onResetStack,
  onShowAllLayers,
  onHideAllLayers,
  onClearAllLayers,
  visibilityPresetOptions,
  selectedVisibilityPurpose,
  visibilityPurposeInput,
  onVisibilityPurposeInputChange,
  onVisibilityPurposeChange,
  onSaveVisibilityPreset,
  onApplyVisibilityPreset,
  onDeleteVisibilityPreset,
  hasVisibilityPresetForSelectedPurpose,
  hasAnyVisibilityPreset,
  layerConfigs,
  selectedLayerConfigId,
  onSelectLayerConfig,
  onUpdateLayer,
  onMoveLayer,
  onZoomToLayer,
  onRemoveLayer,
  selectedLayerConfig,
  selectedLayerFeatureCount,
  layerDiagnosticsUpdatedAt,
  isLayerInspectorCollapsed,
  onToggleLayerInspectorCollapsed,
  onToggleLayerStatusFilter,
}: LayerManagementPanelProps) {
  const sortedLayerConfigs = normalizeLayerOrder([...layerConfigs].sort((a, b) => a.order - b.order));
  const query = layerSearchValue.trim().toLowerCase();
  const queryTokens = query.length > 0 ? query.split(/\s+/).filter(Boolean) : [];

  const searchableLayers = sortedLayerConfigs
    .map((layerConfig) => {
      if (queryTokens.length === 0) {
        return { layerConfig, searchScore: 0 };
      }

      const layerLabel = getLayerLabelForKind(layerConfig.kind).toLowerCase();
      const aliases = KIND_SEARCH_ALIASES[layerConfig.kind] ?? [];
      const statusText = layerConfig.filters.statuses.join(" ").toLowerCase();
      const regionText =
        layerConfig.filters.region.toLowerCase() === "all"
          ? "all regions any region"
          : layerConfig.filters.region.toLowerCase();
      const municipalityText =
        layerConfig.filters.municipalityCity.trim().length === 0
          ? "all municipalities all cities"
          : layerConfig.filters.municipalityCity.toLowerCase();
      const visibilityText = layerConfig.visible ? "visible shown" : "hidden off";
      const searchableText = [
        layerConfig.name,
        layerConfig.id,
        layerConfig.group,
        layerConfig.kind,
        layerLabel,
        ...aliases,
        regionText,
        municipalityText,
        statusText,
        visibilityText,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase())
        .join(" ");

      const matchesAllTokens = queryTokens.every((token) => searchableText.includes(token));
      if (!matchesAllTokens) return null;

      let score = 0;
      for (const token of queryTokens) {
        if (layerConfig.name.toLowerCase().includes(token)) score += 3;
        if (layerLabel.includes(token)) score += 2;
        if (regionText.includes(token)) score += 2;
        if (municipalityText.includes(token)) score += 1;
        if (statusText.includes(token)) score += 1;
        if (visibilityText.includes(token)) score += 1;
      }

      return { layerConfig, searchScore: score };
    })
    .filter((entry): entry is { layerConfig: LayerConfig; searchScore: number } => entry !== null)
    .sort((a, b) => {
      if (b.searchScore !== a.searchScore) return b.searchScore - a.searchScore;
      if (query.length > 0) {
        const aName = a.layerConfig.name.toLowerCase();
        const bName = b.layerConfig.name.toLowerCase();
        if (aName === query && bName !== query) return -1;
        if (bName === query && aName !== query) return 1;
      }
      return a.layerConfig.order - b.layerConfig.order;
    });

  const filteredLayerConfigs = searchableLayers.map((entry) => entry.layerConfig);

  return (
    <div className="absolute left-3 top-3 z-20 w-[340px] overflow-hidden rounded-lg border border-neutral-300 bg-white/95 shadow-lg backdrop-blur-[2px]">
      <div className="flex items-start justify-between border-b border-neutral-200 px-3 py-2">
        <div>
          <div className="text-sm font-bold text-neutral-900">Layer Management</div>
          <div className="text-[11px] text-neutral-500">Manage shelter and map layers</div>
        </div>
        <button
          type="button"
          className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-neutral-300 bg-white/90 p-1 hover:bg-neutral-100"
          aria-label={isCollapsed ? "Expand layer panel" : "Collapse layer panel"}
          onClick={onToggleCollapsed}
        >
          <img
            src={minimizeIcon}
            alt=""
            className={`h-4 w-4 transition-transform ${isCollapsed ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {!isCollapsed && (
        <div className="h-[78vh] overflow-y-scroll overflow-x-hidden p-3">
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                value={layerSearchValue}
                onChange={(event) => onLayerSearchValueChange(event.target.value)}
                className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-xs"
                placeholder="Search name, kind, region, city, status"
              />
              {query.length > 0 && (
                <button
                  type="button"
                  className="rounded border border-neutral-300 px-2 py-1 text-[11px] text-neutral-600 hover:bg-neutral-100"
                  onClick={() => onLayerSearchValueChange("")}
                >
                  Clear
                </button>
              )}
            </div>
            {query.length > 0 && (
              <div className="text-[10px] text-neutral-500">
                {filteredLayerConfigs.length === 0
                  ? "No layers found."
                  : `Showing ${filteredLayerConfigs.length} of ${sortedLayerConfigs.length} layers`}
              </div>
            )}
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <select
                value={layerKindToAdd}
                onChange={(event) => onLayerKindToAddChange(event.target.value as LayerKind)}
                className="rounded border border-neutral-300 px-2 py-1 text-xs"
                disabled={selectableLayerKinds.length === 0}
              >
                {selectableLayerKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {getLayerLabelForKind(kind)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={selectableLayerKinds.length === 0}
                onClick={onAddLayer}
              >
                + Add Layer
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100"
                onClick={onSavePreset}
              >
                Save Preset
              </button>
              <button
                type="button"
                className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!hasSavedPreset}
                onClick={onLoadPreset}
              >
                Load Preset
              </button>
              <button
                type="button"
                className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100"
                onClick={onResetStack}
              >
                Reset Stack
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={layerConfigs.length === 0}
                onClick={onShowAllLayers}
              >
                Show All
              </button>
              <button
                type="button"
                className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={layerConfigs.length === 0}
                onClick={onHideAllLayers}
              >
                Hide All
              </button>
              <button
                type="button"
                className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={layerConfigs.length === 0}
                onClick={onClearAllLayers}
              >
                Clear All
              </button>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-semibold text-neutral-700">Visibility by Purpose</div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <select
                  value={selectedVisibilityPurpose}
                  onChange={(event) => onVisibilityPurposeChange(event.target.value)}
                  className="rounded border border-neutral-300 px-2 py-1 text-xs"
                  disabled={visibilityPresetOptions.length === 0}
                >
                  {visibilityPresetOptions.length > 0 ? (
                    visibilityPresetOptions.map((purpose) => (
                      <option key={purpose} value={purpose}>
                        {purpose}
                      </option>
                    ))
                  ) : (
                    <option value={selectedVisibilityPurpose || "General"}>General</option>
                  )}
                </select>
                <button
                  type="button"
                  className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!hasVisibilityPresetForSelectedPurpose}
                  onClick={onDeleteVisibilityPreset}
                >
                  Delete Preset
                </button>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  type="text"
                  value={visibilityPurposeInput}
                  onChange={(event) => onVisibilityPurposeInputChange(event.target.value)}
                  placeholder="Purpose name"
                  className="rounded border border-neutral-300 px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={onSaveVisibilityPreset}
                  disabled={!(visibilityPurposeInput.trim().length > 0 || selectedVisibilityPurpose)}
                >
                  Save Preset
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!hasAnyVisibilityPreset}
                  onClick={onApplyVisibilityPreset}
                >
                  Apply Preset
                </button>
              </div>
              {!hasAnyVisibilityPreset && (
                <div className="text-[11px] text-neutral-500">
                  Save a purpose preset to store and reuse per-layer visibility.
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <div className="text-xs font-semibold text-neutral-700">Active Layers</div>
            {filteredLayerConfigs.length === 0 && (
              <div className="rounded border border-dashed border-neutral-300 p-2 text-xs text-neutral-500">
                No layers match your search.
              </div>
            )}
            {filteredLayerConfigs.map((layerConfig, index) => (
              <div
                key={layerConfig.id}
                className={`rounded border p-2 ${
                  selectedLayerConfigId === layerConfig.id
                    ? "border-blue-300 bg-blue-50/60"
                    : "border-neutral-200 bg-white"
                }`}
                onClick={() => onSelectLayerConfig(layerConfig.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  onSelectLayerConfig(layerConfig.id);
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-neutral-800">
                      {layerConfig.name}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      {layerConfig.group} • {layerConfig.kind}
                    </div>
                  </div>
                  <label className="flex items-center gap-1 text-[11px] text-neutral-600">
                    <input
                      type="checkbox"
                      checked={layerConfig.visible}
                      onChange={(event) =>
                        onUpdateLayer(layerConfig.id, (current) => ({
                          ...current,
                          visible: event.target.checked,
                        }))
                      }
                      onClick={(event) => event.stopPropagation()}
                    />
                    Visible
                  </label>
                </div>

                <div className="mt-2">
                  <label className="block text-[11px] text-neutral-500">
                    Opacity: {Math.round(layerConfig.style.opacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(layerConfig.style.opacity * 100)}
                    onChange={(event) =>
                      onUpdateLayer(layerConfig.id, (current) => ({
                        ...current,
                        style: {
                          ...current.style,
                          opacity: Number(event.target.value) / 100,
                        },
                      }))
                    }
                    onClick={(event) => event.stopPropagation()}
                    className="w-full"
                  />
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="rounded border border-neutral-300 px-2 py-0.5 text-[11px] hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={index === 0}
                      onClick={(event) => {
                        event.stopPropagation();
                        onMoveLayer(layerConfig.id, -1);
                      }}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="rounded border border-neutral-300 px-2 py-0.5 text-[11px] hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={index === filteredLayerConfigs.length - 1}
                      onClick={(event) => {
                        event.stopPropagation();
                        onMoveLayer(layerConfig.id, 1);
                      }}
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      className="rounded border border-neutral-300 px-2 py-0.5 text-[11px] hover:bg-neutral-100"
                      onClick={(event) => {
                        event.stopPropagation();
                        onZoomToLayer(layerConfig);
                      }}
                    >
                      Zoom To
                    </button>
                  </div>
                  <button
                    type="button"
                    className="rounded border border-red-300 px-2 py-0.5 text-[11px] text-red-700 hover:bg-red-50"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveLayer(layerConfig.id);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          {selectedLayerConfig && (
            <div className="mt-3 rounded border border-neutral-200 bg-white p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-semibold text-neutral-700">Layer Inspector</div>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-neutral-300 bg-white/90 p-1 hover:bg-neutral-100"
                  aria-label={
                    isLayerInspectorCollapsed
                      ? "Expand layer inspector"
                      : "Collapse layer inspector"
                  }
                  onClick={onToggleLayerInspectorCollapsed}
                >
                  <img
                    src={minimizeIcon}
                    alt=""
                    className={`h-4 w-4 transition-transform ${
                      isLayerInspectorCollapsed ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </div>

              <div
                className={`overflow-hidden transition-all duration-200 ${
                  isLayerInspectorCollapsed
                    ? "pointer-events-none max-h-0 opacity-0"
                    : "pointer-events-auto max-h-[1000px] opacity-100"
                }`}
              >
                <div className="mt-2 space-y-2">
                  <label className="block text-[11px] text-neutral-600">
                    Name
                    <input
                      value={selectedLayerConfig.name}
                      onChange={(event) =>
                        onUpdateLayer(selectedLayerConfig.id, (current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-xs"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-[11px] text-neutral-600">
                      Region
                      <select
                        value={selectedLayerConfig.filters.region}
                        onChange={(event) =>
                          onUpdateLayer(selectedLayerConfig.id, (current) => ({
                            ...current,
                            filters: {
                              ...current.filters,
                              region: event.target.value as LayerFilters["region"],
                            },
                          }))
                        }
                        className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-xs"
                      >
                        <option value="all">All</option>
                        <option value="Luzon">Luzon</option>
                        <option value="Visayas">Visayas</option>
                        <option value="Mindanao">Mindanao</option>
                      </select>
                    </label>

                    <label className="block text-[11px] text-neutral-600">
                      Municipality/City
                      <input
                        value={selectedLayerConfig.filters.municipalityCity}
                        onChange={(event) =>
                          onUpdateLayer(selectedLayerConfig.id, (current) => ({
                            ...current,
                            filters: {
                              ...current.filters,
                              municipalityCity: event.target.value,
                            },
                          }))
                        }
                        className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-xs"
                        placeholder="Any"
                      />
                    </label>
                  </div>

                  {(selectedLayerConfig.kind === "shelterPins" ||
                    selectedLayerConfig.kind === "shelterStatusHalo" ||
                    selectedLayerConfig.kind === "selectedShelterHighlight") && (
                    <div>
                      <div className="text-[11px] text-neutral-600">Status Filters</div>
                      <div className="mt-1 flex gap-2">
                        {STATUS_OPTIONS.map((status) => (
                          <label
                            key={status}
                            className="inline-flex items-center gap-1 text-[11px] text-neutral-700"
                          >
                            <input
                              type="checkbox"
                              checked={selectedLayerConfig.filters.statuses.includes(status)}
                              onChange={(event) =>
                                onToggleLayerStatusFilter(
                                  selectedLayerConfig.id,
                                  status,
                                  event.target.checked
                                )
                              }
                            />
                            {status}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-[11px] text-neutral-600">
                      Opacity ({Math.round(selectedLayerConfig.style.opacity * 100)}%)
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(selectedLayerConfig.style.opacity * 100)}
                        onChange={(event) =>
                          onUpdateLayer(selectedLayerConfig.id, (current) => ({
                            ...current,
                            style: {
                              ...current.style,
                              opacity: Number(event.target.value) / 100,
                            },
                          }))
                        }
                        className="mt-1 w-full"
                      />
                    </label>

                    {selectedLayerConfig.kind === "shelterPins" ? (
                      <label className="block text-[11px] text-neutral-600">
                        Icon Size ({selectedLayerConfig.style.iconSize.toFixed(2)})
                        <input
                          type="range"
                          min={0.03}
                          max={0.2}
                          step={0.01}
                          value={selectedLayerConfig.style.iconSize}
                          onChange={(event) =>
                            onUpdateLayer(selectedLayerConfig.id, (current) => ({
                              ...current,
                              style: {
                                ...current.style,
                                iconSize: Number(event.target.value),
                              },
                            }))
                          }
                          className="mt-1 w-full"
                        />
                      </label>
                    ) : (
                      <label className="block text-[11px] text-neutral-600">
                        Radius ({selectedLayerConfig.style.radius.toFixed(0)})
                        <input
                          type="range"
                          min={4}
                          max={28}
                          step={1}
                          value={selectedLayerConfig.style.radius}
                          onChange={(event) =>
                            onUpdateLayer(selectedLayerConfig.id, (current) => ({
                              ...current,
                              style: {
                                ...current.style,
                                radius: Number(event.target.value),
                              },
                            }))
                          }
                          className="mt-1 w-full"
                        />
                      </label>
                    )}
                  </div>

                  {selectedLayerConfig.kind !== "shelterPins" && (
                    <label className="block text-[11px] text-neutral-600">
                      Stroke Width ({selectedLayerConfig.style.strokeWidth.toFixed(1)})
                      <input
                        type="range"
                        min={0}
                        max={6}
                        step={0.5}
                        value={selectedLayerConfig.style.strokeWidth}
                        onChange={(event) =>
                          onUpdateLayer(selectedLayerConfig.id, (current) => ({
                            ...current,
                            style: {
                              ...current.style,
                              strokeWidth: Number(event.target.value),
                            },
                          }))
                        }
                        className="mt-1 w-full"
                      />
                    </label>
                  )}

                  <label className="inline-flex items-center gap-2 text-[11px] text-neutral-700">
                    <input
                      type="checkbox"
                      checked={selectedLayerConfig.timeSync}
                      onChange={(event) =>
                        onUpdateLayer(selectedLayerConfig.id, (current) => ({
                          ...current,
                          timeSync: event.target.checked,
                        }))
                      }
                    />
                    Sync to playback time
                  </label>

                  <div className="rounded border border-neutral-200 bg-neutral-50 p-2 text-[11px] text-neutral-600">
                    <div>Feature Count: {selectedLayerFeatureCount}</div>
                    <div>Render Cost: {RENDER_COST_HINT_BY_KIND[selectedLayerConfig.kind]}</div>
                    <div>Last Update: {layerDiagnosticsUpdatedAt.toLocaleTimeString()}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default LayerManagementPanel;
