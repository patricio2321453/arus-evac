import { useEffect, useState } from "react";
import { Box, Flex, Grid, Theme } from "@radix-ui/themes";
import Map from "./Map";
import Shelter from "./Shelter";
import SimulationPanel from "./SimulationPanel";
import HazardManagement from "./HazardManagement";
import Population from "./Population";
import { initialHazards, type HazardRecord } from "./hazardData";
import { initialShelters, type ShelterRecord } from "./shelterData";
import homeIcon from "./assets/icons/home.png";
import typhoonIcon from "./assets/icons/typhoon.png";
import peopleIcon from "./assets/icons/people.png";
import warningIcon from "./assets/icons/warning.png";

const STORAGE_KEY_SHELTERS = "arus-evac.shelters.v1";
const STORAGE_KEY_HAZARDS = "arus-evac.hazards.v1";

const navItems = [
  { id: "home", label: "Home", icon: homeIcon },
  { id: "typhoon", label: "Typhoon", icon: typhoonIcon },
  { id: "hazardManagement", label: "Hazard Management", icon: warningIcon },
  { id: "population", label: "Population", icon: peopleIcon },
] as const;

function loadSheltersFromStorage() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY_SHELTERS);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as ShelterRecord[];
  } catch {
    return null;
  }
}

function loadHazardsFromStorage() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY_HAZARDS);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as HazardRecord[];
  } catch {
    return null;
  }
}

function App() {
  const [activeNav, setActiveNav] = useState<(typeof navItems)[number]["id"]>(
    "home"
  );
  const [shelters, setShelters] = useState<ShelterRecord[]>(
    () => loadSheltersFromStorage() ?? initialShelters
  );
  const [hazards, setHazards] = useState<HazardRecord[]>(
    () => loadHazardsFromStorage() ?? initialHazards
  );
  const [editingHazardId, setEditingHazardId] = useState<string | null>(null);
  const [selectedHazardForPopulationId, setSelectedHazardForPopulationId] =
    useState<string | null>(null);
  const [areaFilterFocusRequest, setAreaFilterFocusRequest] = useState<{
    shelterIds: string[];
    requestId: number;
  }>({
    shelterIds: [],
    requestId: 0,
  });
  const [shelterCardFocusRequest, setShelterCardFocusRequest] = useState<{
    shelterId: string | null;
    requestId: number;
  }>({
    shelterId: null,
    requestId: 0,
  });
  const [hazardCardFocusRequest, setHazardCardFocusRequest] = useState<{
    hazardId: string | null;
    latitude: number | null;
    longitude: number | null;
    requestId: number;
  }>({
    hazardId: null,
    latitude: null,
    longitude: null,
    requestId: 0,
  });
  const [populationCardFocusRequest, setPopulationCardFocusRequest] = useState<{
    municipality: string | null;
    latitude: number | null;
    longitude: number | null;
    requestId: number;
  }>({
    municipality: null,
    latitude: null,
    longitude: null,
    requestId: 0,
  });

  function handleAreaFilterFocus(filteredShelters: ShelterRecord[]) {
    setAreaFilterFocusRequest((current) => ({
      shelterIds: filteredShelters.map((shelter) => shelter.id),
      requestId: current.requestId + 1,
    }));
  }

  function handleShelterCardFocus(shelterId: string) {
    setShelterCardFocusRequest((current) => ({
      shelterId,
      requestId: current.requestId + 1,
    }));
  }

  function handleHazardCardFocus(hazardId: string, latitude: number, longitude: number) {
    setHazardCardFocusRequest((current) => ({
      hazardId,
      latitude,
      longitude,
      requestId: current.requestId + 1,
    }));
  }

  function handlePopulationCardFocus(
    municipality: string,
    latitude: number,
    longitude: number
  ) {
    setPopulationCardFocusRequest((current) => ({
      municipality,
      latitude,
      longitude,
      requestId: current.requestId + 1,
    }));
  }

  function handleHazardEditingIdChange(nextId: string | null) {
    setEditingHazardId(nextId);
  }

  function handleHazardSelectionChange(nextHazardId: string | null) {
    setSelectedHazardForPopulationId(nextHazardId);
  }

  function handleHazardGeometryChange(hazardId: string, isochroneGeometry: GeoJSON.Polygon) {
    setHazards((currentHazards) =>
      currentHazards.map((hazard) =>
        hazard.id === hazardId ? { ...hazard, isochroneGeometry } : hazard
      )
    );
  }

  useEffect(() => {
    if (activeNav !== "hazardManagement") {
      setEditingHazardId(null);
    }
  }, [activeNav]);

  useEffect(() => {
    if (!selectedHazardForPopulationId) return;
    const exists = hazards.some((hazard) => hazard.id === selectedHazardForPopulationId);
    if (!exists) {
      setSelectedHazardForPopulationId(null);
    }
  }, [hazards, selectedHazardForPopulationId]);

  const selectedHazardForPopulation = selectedHazardForPopulationId
    ? hazards.find((hazard) => hazard.id === selectedHazardForPopulationId) ?? null
    : null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY_SHELTERS, JSON.stringify(shelters));
  }, [shelters]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY_HAZARDS, JSON.stringify(hazards));
  }, [hazards]);

  return (
    <Theme>
      {/* Sidebar.tsx */}
      <Grid
        columns={"1fr 3fr"}
        rows={"1"}
        className="h-screen w-screen min-h-0 overflow-hidden"
      >
        {/* Aside */}
        <Grid columns={"1fr 7fr"} rows={"1"} className="h-full min-h-0 overflow-hidden">
          <Box className="border-r border-r-neutral-200">
            <Flex direction={"column"} align={"center"} py={"5"} gap={"3"}>
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={item.label}
                  aria-pressed={activeNav === item.id}
                  className={`nav-icon-button ${
                    activeNav === item.id ? "is-active" : ""
                  }`}
                  onClick={() => setActiveNav(item.id)}
                >
                  <img
                    src={item.icon}
                    alt={`${item.label} icon`}
                    className="nav-icon-image"
                  />
                </button>
              ))}
            </Flex>
          </Box>
          <Flex
            direction={"column"}
            gap={"5"}
            p={"3"}
            className="min-h-0 h-full overflow-hidden border-r border-r-neutral-200"
          >
            <Box className="min-h-0 flex-1 overflow-y-auto">
              {activeNav === "home" && (
                <Shelter
                  shelters={shelters}
                  setShelters={setShelters}
                  onAreaFilterFocus={handleAreaFilterFocus}
                  onShelterCardFocus={handleShelterCardFocus}
                />
              )}
              {activeNav === "typhoon" && <SimulationPanel />}
              {activeNav === "population" && (
                <Population
                  shelters={shelters}
                  selectedHazard={selectedHazardForPopulation}
                  onPopulationCardFocus={handlePopulationCardFocus}
                />
              )}
              {activeNav === "hazardManagement" && (
                <HazardManagement
                  hazards={hazards}
                  setHazards={setHazards}
                  editingHazardId={editingHazardId}
                  onEditingHazardIdChange={handleHazardEditingIdChange}
                  onHazardCardFocus={handleHazardCardFocus}
                />
              )}
            </Box>
          </Flex>
        </Grid>
        {/* Main */}
        <Box className="h-full w-full overflow-hidden">
          <Map
            activePanel={activeNav}
            shelters={shelters}
            hazards={hazards}
            editingHazardId={editingHazardId}
            onHazardGeometryChange={handleHazardGeometryChange}
            onHazardSelectionChange={handleHazardSelectionChange}
            areaFilterFocusRequest={areaFilterFocusRequest}
            shelterCardFocusRequest={shelterCardFocusRequest}
            hazardCardFocusRequest={hazardCardFocusRequest}
            populationCardFocusRequest={populationCardFocusRequest}
          />
        </Box>
      </Grid>
    </Theme>
  );
}

export default App;
