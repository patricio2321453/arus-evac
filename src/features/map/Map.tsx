import { useState, useRef, useEffect } from "react";
import maplibregl from "maplibre-gl";
import osrmTextInstructions, { Compiler, CompileOptions, RouteStep } from "osrm-text-instructions";
import { OSRMResponse, OSRMRoute } from "../../osrm";

function Map() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  
  const [instructions, setInstructions] = useState<string[]>([]);
  const [startQuery, setStartQuery] = useState("");
  const [endQuery, setEndQuery] = useState("");

  const compiler = osrmTextInstructions("v5");

  async function geocode(query: string): Promise<[number, number] | null> {
    const url = "https://nominatim.openstreetmap.org/search?format=json&q=" + encodeURIComponent(query);
    const res = await fetch(url);
    const data = await res.json();
    
    if (!data || data.length === 0) return null;
      return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
    }

  

  async function handleSearch() {
    const start = await geocode(startQuery);
    const end = await geocode(endQuery);

    if (!start || !end) {
      alert("Location not found.");
      return;
    }

    markers.current.forEach(m=> m.remove());
    markers.current = [];

    markers.current.push(
      new maplibregl.Marker({ color: "green" })
        .setLngLat(start!)
        .addTo(mapInstance.current!)
    );

    markers.current.push(
      new maplibregl.Marker({ color: "red" })
        .setLngLat(end!)
        .addTo(mapInstance.current!)
    );

    if(!mapInstance.current) return;

    getRoute(start!, end!);

  }

  async function getRoute(start: [number, number], end: [number, number]) {
  const url = `http://localhost:5000/route/v1/foot/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&overview=full&steps=true`;
  
  const res = await fetch (url);
  const osrmData: OSRMResponse = await res.json();
  const route: OSRMRoute = osrmData.routes[0];
  const coordinates = osrmData.routes[0].geometry.coordinates;


  const source = mapInstance.current!.getSource("route") as maplibregl.GeoJSONSource;

  
  source.setData({
    type: "Feature",
    properties: {},
    geometry: { 
      type: "LineString",
      coordinates,
    },
  })

  
  try {
    const newInstructions: string[] = [];
    route.legs.forEach((leg: any, legIndex: number) => {
      leg.steps.forEach((step: RouteStep) => {
        const options: CompileOptions = {
          legCount: route.legs.length,
          legIndex,
          formatToken: (token, value) =>
            token === "way_name" ? `<strong>${value}</strong>` : value,
        };
        const instruction = compiler.compile("en", step, options);
        newInstructions.push(instruction);
     });
    });
    setInstructions(newInstructions);
  } catch (err) {
   console.error("Failed to generate OSRM instructions:", err);
}


}

  useEffect(() => {
    if (mapContainer.current && !mapInstance.current) {
      mapInstance.current = new maplibregl.Map({
        container: mapContainer.current,
        style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json", //working tile server
        center: [121.0, 12.5], //starting point Philippines
        zoom: 5,
      });


      let points: [number, number][] = [];

      mapInstance.current.on("click", (e) => {  
        const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        points.push(lngLat);

        markers.current.forEach((marker) => marker.remove());
        markers.current = [];

        points.forEach((point, index) => {
          const color = index === 0 ? "green" : index === points.length - 1 ? "red" : "blue";
          const marker = new maplibregl.Marker({ color })
            .setLngLat(point)
            .addTo(mapInstance.current!);
          markers.current.push(marker);
        });

        if (points.length === 2) {
          getRoute(points[0], points[1]);
          points = [];
        }
      });

        
    mapInstance.current.on("load", () => {
      mapInstance.current!.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [],
          }
        }
      });
    

    mapInstance.current!.addLayer({
      id: "route-line",
      type: "line",
      source: "route",
      paint: {
        "line-color": "#2563eb",
        "line-width": 4,
      },
    });
  });
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  return (
    <div style = {{position: 'relative', width: '100%', height: '100vh'}}>
      <div
        style = {{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          width: '200px',
          padding: '0.5rem',
          borderRadius: '5px',
          backgroundColor: 'white',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 10,
        }}
        >
          <input
            type="text"
            placeholder="Starting Point"
            value={startQuery}
            onChange={(e) => setStartQuery(e.target.value)}
            style = {{
              width: '100%',
              padding: '0.5rem',
              marginBottom: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
          <input
            type="text"
            placeholder="Destination"
            value={endQuery}
            onChange={(e) => setEndQuery(e.target.value)}
            style = {{
              width: '100%',
              padding: '0.5rem',
              marginBottom: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />

          <button
            onClick={handleSearch}
            style = {{
              width: '100%',
              padding: '0.5rem',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
            >
              Start
            </button>
        </div>

    <div 
      ref={mapContainer} 
      style={{
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        zIndex: 1
         }}/>

    <div
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        width: '15%',
        height: '100vh',
        overflowY: 'auto',
        padding: '1rem',
        borderLeft: '1px solid #ccc',
        boxShadow: ' -2px 0 8px rgba(0,0,0,0.1)',
        backgroundColor: '#f9f9f9',
        zIndex: 10
      }}
    >
        <h2 
          style = {{ 
          fontSize: '1.8rem',
          fontWeight: 'bold',
          marginBottom: '1rem'
          }}>
            Directions
          </h2>
          <ol>
            {instructions.map((inst, i) => (
              <li key={i}
              style = {{
                marginBottom: '1rem',
                paddingBottom: '0.5rem',
                borderBottom: '1px solid #eee',
              }}
              dangerouslySetInnerHTML={{ __html: inst }} />
            ))}
          </ol>
        </div>
    </div>


  );
}

export default Map

