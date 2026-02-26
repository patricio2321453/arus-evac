import { useRef, useEffect } from "react";
import MapLibre from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MaplibreTerradrawControl } from "@watergis/maplibre-gl-terradraw";
import "@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css";

function Map() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<MapLibre.Map | null>(null);

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
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  return <div ref={mapContainer} className="h-full w-full"></div>;
}

export default Map;
