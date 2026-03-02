import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection, Point } from "geojson";
import MapLibre, { type GeoJSONSource, type MapGeoJSONFeature } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MaplibreTerradrawControl } from "@watergis/maplibre-gl-terradraw";
import "@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css";
import { type ShelterRecord } from "./shelterData";
import pinIcon from "./assets/icons/pin.png";

const SHELTER_SOURCE_ID = "shelter-locations";
const SHELTER_LAYER_ID = "shelter-location-pins";
const SHELTER_PIN_IMAGE_ID = "shelter-pin-image";

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

function toShelterFeatureCollection(
  shelters: ShelterRecord[]
): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: shelters.map((shelter) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [shelter.longitude, shelter.latitude],
      },
      properties: {
        id: shelter.id,
        name: shelter.name,
        region: shelter.region,
        municipalityCity: shelter.municipalityCity,
        status: shelter.status,
      },
    })),
  };
}

function ensureShelterLayer(map: MapLibre.Map) {
  if (!map.getSource(SHELTER_SOURCE_ID)) {
    map.addSource(SHELTER_SOURCE_ID, {
      type: "geojson",
      data: toShelterFeatureCollection([]),
    });
  }

  const addPinLayer = () => {
    if (map.getLayer(SHELTER_LAYER_ID)) return;
    map.addLayer({
      id: SHELTER_LAYER_ID,
      type: "symbol",
      source: SHELTER_SOURCE_ID,
      layout: {
        "icon-image": SHELTER_PIN_IMAGE_ID,
        "icon-size": 0.08,
        "icon-anchor": "bottom",
        "icon-allow-overlap": true,
      },
    });
  };

  if (map.hasImage(SHELTER_PIN_IMAGE_ID)) {
    addPinLayer();
    return;
  }

  void map
    .loadImage(pinIcon)
    .then((response) => {
      if (!map.hasImage(SHELTER_PIN_IMAGE_ID)) {
        map.addImage(SHELTER_PIN_IMAGE_ID, response.data);
      }
      addPinLayer();
    })
    .catch(() => {
      // Keep map functional even if custom pin loading fails.
    });
}

function setShelterSourceData(map: MapLibre.Map, shelters: ShelterRecord[]) {
  ensureShelterLayer(map);
  const source = map.getSource(SHELTER_SOURCE_ID);
  if (!source) return;

  (source as GeoJSONSource).setData(toShelterFeatureCollection(shelters));
}

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
  const [selectedShelterId, setSelectedShelterId] = useState<string | null>(null);

  const selectedShelter = useMemo(
    () => shelters.find((shelter) => shelter.id === selectedShelterId) ?? null,
    [selectedShelterId, shelters]
  );
  const selectedShelterStatusColors = useMemo(() => {
    if (!selectedShelter) return null;
    return getStatusColorTokens(selectedShelter.status);
  }, [selectedShelter]);

  useEffect(() => {
    sheltersRef.current = shelters;
  }, [shelters]);

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
      setShelterSourceData(map, sheltersRef.current);
      hoverPopupRef.current = new MapLibre.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 16,
        className: "shelter-hover-popup",
      });

      map.on("mousemove", (event) => {
        if (!map.getLayer(SHELTER_LAYER_ID)) {
          map.getCanvas().style.cursor = "";
          hoveredShelterIdRef.current = null;
          hoverPopupRef.current?.remove();
          return;
        }

        const hoveredFeature = map.queryRenderedFeatures(event.point, {
          layers: [SHELTER_LAYER_ID],
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
        if (!map.getLayer(SHELTER_LAYER_ID)) {
          return;
        }

        const clickedFeature = map.queryRenderedFeatures(event.point, {
          layers: [SHELTER_LAYER_ID],
        })[0];
        if (!clickedFeature) {
          setSelectedShelterId(null);
          return;
        }

        const shelter = findShelterByFeature(sheltersRef.current, clickedFeature);
        if (!shelter) return;

        setSelectedShelterId(shelter.id);
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
    setShelterSourceData(map, shelters);
  }, [shelters]);

  useEffect(() => {
    if (areaFilterFocusRequest.requestId === 0) return;

    const map = mapInstance.current;
    if (!map || !map.isStyleLoaded()) return;

    const focusIdSet = new Set(areaFilterFocusRequest.shelterIds);
    const focusShelters = shelters.filter((shelter) => focusIdSet.has(shelter.id));
    if (focusShelters.length === 0) return;

    setShelterSourceData(map, shelters);
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
  }, [shelterCardFocusRequest, shelters]);

  useEffect(() => {
    if (!selectedShelterId) return;
    const stillExists = shelters.some((shelter) => shelter.id === selectedShelterId);
    if (!stillExists) {
      setSelectedShelterId(null);
    }
  }, [selectedShelterId, shelters]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainer} className="h-full w-full"></div>
      {selectedShelter && (
        <div className="shelter-detail-panel absolute left-3 top-3 z-10 w-[280px] rounded-lg border border-neutral-200 bg-white/95 p-3 shadow-lg backdrop-blur-[1px]">
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
            <div>Available: {(selectedShelter.capacity - selectedShelter.occupancy).toLocaleString()}</div>
            <div>Contact: {selectedShelter.contact}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Map;
