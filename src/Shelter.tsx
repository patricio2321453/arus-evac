import { ArrowLeftIcon, PlusIcon } from "@radix-ui/react-icons";
import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  Select,
  Switch,
  Text,
  TextArea,
  TextField,
} from "@radix-ui/themes";
import { useEffect, useMemo, useState } from "react";
import editIcon from "./assets/icons/editing.png";
import trashIcon from "./assets/icons/trash.png";

type ShelterRecord = {
  id: string;
  name: string;
  area: string;
  address: string;
  capacity: number;
  occupancy: number;
  status: "Open" | "Limited" | "Full";
  contact: string;
  medicalSupport: "Yes" | "No";
  lastUpdated: string;
};

const initialShelters: ShelterRecord[] = [
  {
    id: "s-001",
    name: "San Isidro Community Hall",
    area: "North Zone",
    address: "Blk 2 P. Gomez St., San Isidro",
    capacity: 280,
    occupancy: 162,
    status: "Open",
    contact: "0917-215-4451",
    medicalSupport: "Yes",
    lastUpdated: "10 mins ago",
  },
  {
    id: "s-002",
    name: "Riverside Elementary Gym",
    area: "North Zone",
    address: "Riverside Rd., Brgy. 12",
    capacity: 190,
    occupancy: 171,
    status: "Limited",
    contact: "0918-433-1022",
    medicalSupport: "No",
    lastUpdated: "16 mins ago",
  },
  {
    id: "s-003",
    name: "City Sports Complex",
    area: "Central Zone",
    address: "Quezon Ave., City Proper",
    capacity: 540,
    occupancy: 520,
    status: "Full",
    contact: "0920-115-4777",
    medicalSupport: "Yes",
    lastUpdated: "8 mins ago",
  },
  {
    id: "s-004",
    name: "Sta. Cruz Covered Court",
    area: "Central Zone",
    address: "Mabini St., Sta. Cruz",
    capacity: 210,
    occupancy: 124,
    status: "Open",
    contact: "0919-332-6480",
    medicalSupport: "Yes",
    lastUpdated: "22 mins ago",
  },
  {
    id: "s-005",
    name: "South Bay Multipurpose Center",
    area: "South Zone",
    address: "Harbor View Dr., South Bay",
    capacity: 320,
    occupancy: 319,
    status: "Full",
    contact: "0916-775-2931",
    medicalSupport: "No",
    lastUpdated: "5 mins ago",
  },
  {
    id: "s-006",
    name: "Lakeside National High School",
    area: "South Zone",
    address: "Lakeside Rd., Brgy. Maligaya",
    capacity: 410,
    occupancy: 248,
    status: "Open",
    contact: "0935-228-6670",
    medicalSupport: "Yes",
    lastUpdated: "14 mins ago",
  },
];

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Box className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
      <Text as="div" size="1" color="gray">
        {label}
      </Text>
      <Text as="div" size="4" weight="bold">
        {value}
      </Text>
    </Box>
  );
}

function ShelterDetail({ label, value }: { label: string; value: string }) {
  return (
    <Flex justify="between" gap="2">
      <Text size="1" color="gray">
        {label}
      </Text>
      <Text size="1" weight="medium">
        {value}
      </Text>
    </Flex>
  );
}

function getStatusColor(status: ShelterRecord["status"]) {
  if (status === "Open") return "green" as const;
  if (status === "Limited") return "orange" as const;
  return "red" as const;
}

function parsePositiveNumber(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function Form({ setPanel }: { setPanel: (p: "list" | "form") => void }) {
  return (
    <>
      <button onClick={() => setPanel("list")}>
        <ArrowLeftIcon width={"32"} height={"32"} />
      </button>
      <Heading size="8">Add Shelter</Heading>
      <Flex direction="column" gap="3" className="max-h-[72vh] overflow-y-auto pr-1">
        <Flex direction="column" gap="1">
          <Text weight={"bold"}>Name</Text>
          <TextField.Root placeholder="Shelter Name" />
        </Flex>
        <Flex direction="column" gap="1">
          <Text weight={"bold"}>Address</Text>
          <TextField.Root placeholder="Street, barangay, city" />
        </Flex>
        <Grid columns="2" gap="2">
          <Flex direction="column" gap="1">
            <Text weight={"bold"}>Area</Text>
            <Select.Root defaultValue="North Zone">
              <Select.Trigger />
              <Select.Content>
                <Select.Item value="North Zone">North Zone</Select.Item>
                <Select.Item value="Central Zone">Central Zone</Select.Item>
                <Select.Item value="South Zone">South Zone</Select.Item>
              </Select.Content>
            </Select.Root>
          </Flex>
          <Flex direction="column" gap="1">
            <Text weight={"bold"}>Status</Text>
            <Select.Root defaultValue="Open">
              <Select.Trigger />
              <Select.Content>
                <Select.Item value="Open">Open</Select.Item>
                <Select.Item value="Limited">Limited</Select.Item>
                <Select.Item value="Full">Full</Select.Item>
              </Select.Content>
            </Select.Root>
          </Flex>
        </Grid>
        <Grid columns="2" gap="2">
          <Flex direction="column" gap="1">
            <Text weight={"bold"}>Current Occupancy</Text>
            <TextField.Root placeholder="Occupied persons" type="number" />
          </Flex>
          <Flex direction="column" gap="1">
            <Text weight={"bold"}>Capacity</Text>
            <TextField.Root placeholder="Max persons" type="number" />
          </Flex>
        </Grid>
        <Grid columns="2" gap="2">
          <Flex direction="column" gap="1">
            <Text weight={"bold"}>Contact Person</Text>
            <TextField.Root placeholder="Name of focal person" />
          </Flex>
          <Flex direction="column" gap="1">
            <Text weight={"bold"}>Contact Number</Text>
            <TextField.Root placeholder="09xx-xxx-xxxx" />
          </Flex>
        </Grid>
        <Grid columns="2" gap="2">
          <Flex direction="column" gap="1">
            <Text weight={"bold"}>Latitude</Text>
            <TextField.Root placeholder="e.g. 13.12345" />
          </Flex>
          <Flex direction="column" gap="1">
            <Text weight={"bold"}>Longitude</Text>
            <TextField.Root placeholder="e.g. 121.12345" />
          </Flex>
        </Grid>
        <Flex
          align="center"
          justify="between"
          className="rounded-md border border-neutral-200 px-3 py-2"
        >
          <Text weight={"bold"}>Medical Support Available</Text>
          <Switch defaultChecked />
        </Flex>
        <Flex direction="column" gap="1">
          <Text weight={"bold"}>Remarks</Text>
          <TextArea placeholder="Notes on supplies, access roads, or special conditions" />
        </Flex>
        <Flex gap="2">
          <Button variant="soft" color="gray" onClick={() => setPanel("list")}>
            Cancel
          </Button>
          <Button>Add Shelter</Button>
        </Flex>
      </Flex>
      <Text size="1" color="gray" className="mt-2">
        Tip: Fill coordinates to place this shelter precisely on the map later.
      </Text>
    </>
  );
}

type ListProps = {
  setPanel: (p: "list" | "form") => void;
  shelters: ShelterRecord[];
  onDeleteShelter: (id: string) => void;
  onDeleteShelters: (ids: string[]) => void;
  onUpdateShelter: (shelter: ShelterRecord) => void;
};

function List({
  setPanel,
  shelters,
  onDeleteShelter,
  onDeleteShelters,
  onUpdateShelter,
}: ListProps) {
  const [searchValue, setSearchValue] = useState("");
  const [selectedArea, setSelectedArea] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingShelterId, setEditingShelterId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ShelterRecord | null>(null);

  const areas = useMemo(
    () => [...new Set(shelters.map((shelter) => shelter.area))],
    [shelters]
  );

  const filteredShelters = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    return shelters.filter((shelter) => {
      const matchesArea =
        selectedArea === "all" || shelter.area === selectedArea;
      const matchesSearch =
        query.length === 0 ||
        shelter.name.toLowerCase().includes(query) ||
        shelter.address.toLowerCase().includes(query);

      return matchesArea && matchesSearch;
    });
  }, [shelters, searchValue, selectedArea]);

  const totals = useMemo(() => {
    const totalCapacity = filteredShelters.reduce(
      (sum, shelter) => sum + shelter.capacity,
      0
    );
    const totalOccupied = filteredShelters.reduce(
      (sum, shelter) => sum + shelter.occupancy,
      0
    );
    const totalAvailable = totalCapacity - totalOccupied;
    const utilization =
      totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

    return {
      totalShelters: filteredShelters.length,
      totalCapacity,
      totalOccupied,
      totalAvailable,
      utilization,
    };
  }, [filteredShelters]);

  useEffect(() => {
    const availableIds = new Set(shelters.map((shelter) => shelter.id));
    setSelectedIds((current) => current.filter((id) => availableIds.has(id)));

    if (editingShelterId && !availableIds.has(editingShelterId)) {
      setEditingShelterId(null);
      setEditDraft(null);
    }
  }, [shelters, editingShelterId]);

  const visibleIds = filteredShelters.map((shelter) => shelter.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  function toggleSelectShelter(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((currentId) => currentId !== id)
        : [...current, id]
    );
  }

  function toggleSelectVisible() {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !visibleIds.includes(id))
      );
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      visibleIds.forEach((id) => next.add(id));
      return [...next];
    });
  }

  function beginEdit(shelter: ShelterRecord) {
    setEditingShelterId(shelter.id);
    setEditDraft({ ...shelter });
  }

  function updateDraft(changes: Partial<ShelterRecord>) {
    setEditDraft((current) => (current ? { ...current, ...changes } : current));
  }

  function saveEdit() {
    if (!editDraft) return;
    const normalized: ShelterRecord = {
      ...editDraft,
      occupancy: Math.min(editDraft.occupancy, editDraft.capacity),
      lastUpdated: "just now",
    };
    onUpdateShelter(normalized);
    setEditingShelterId(null);
    setEditDraft(null);
  }

  function deleteSingleShelter(id: string) {
    onDeleteShelter(id);
    setSelectedIds((current) => current.filter((currentId) => currentId !== id));
  }

  function deleteSelectedShelters() {
    if (selectedIds.length === 0) return;
    onDeleteShelters(selectedIds);
    setSelectedIds([]);
    setEditingShelterId(null);
    setEditDraft(null);
  }

  return (
    <>
      <Heading size="8">Shelter</Heading>
      <Flex direction="column" gap="3">
        <Text size="2" color="gray">
          Review shelter readiness, monitor occupancy pressure, and manage
          available evacuation sites for flood and typhoon response planning.
        </Text>

        <Box className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <Text as="div" size="2" weight="bold">
            Planning Note
          </Text>
          <Text as="div" size="1" color="gray">
            Shelter figures are for planning support and should be validated
            with on-ground reports when available.
          </Text>
        </Box>

        <Button onClick={() => setPanel("form")}>
          <PlusIcon />
          Add Shelter
        </Button>

        <TextField.Root
          placeholder="Search shelter or address"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
        />

        <Flex direction="column" gap="1">
          <Flex align="center" justify="between">
            <Text size="2" weight="bold">
              Area Filter
            </Text>
            <button
              type="button"
              className="shelter-inline-button"
              onClick={toggleSelectVisible}
            >
              {allVisibleSelected ? "Unselect Visible" : "Select Visible"}
            </button>
          </Flex>
          <Select.Root value={selectedArea} onValueChange={setSelectedArea}>
            <Select.Trigger />
            <Select.Content>
              <Select.Item value="all">All Areas</Select.Item>
              {areas.map((area) => (
                <Select.Item key={area} value={area}>
                  {area}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Flex>

        {selectedIds.length > 0 && (
          <Box className="rounded-lg border border-red-200 bg-red-50 p-2">
            <Flex align="center" justify="between" gap="2">
              <Text size="2" weight="medium">
                {selectedIds.length} shelter
                {selectedIds.length > 1 ? "s" : ""} selected
              </Text>
              <Flex gap="2">
                <Button
                  variant="soft"
                  color="gray"
                  size="1"
                  onClick={() => setSelectedIds([])}
                >
                  Clear
                </Button>
                <Button color="red" size="1" onClick={deleteSelectedShelters}>
                  <img src={trashIcon} alt="Delete selected shelters" className="shelter-action-icon" />
                  Delete Selected
                </Button>
              </Flex>
            </Flex>
          </Box>
        )}

        <Box className="rounded-lg border border-neutral-200 p-3">
          <Text as="div" size="2" weight="bold">
            Metrics Summary
          </Text>
          <Text as="div" size="1" color="gray">
            {selectedArea === "all"
              ? "Coverage: all shelter areas"
              : `Coverage: ${selectedArea}`}
          </Text>

          <Grid columns="2" gap="2" className="mt-3">
            <MetricCard label="Shelters" value={`${totals.totalShelters}`} />
            <MetricCard
              label="Capacity"
              value={totals.totalCapacity.toLocaleString()}
            />
            <MetricCard
              label="Occupied"
              value={totals.totalOccupied.toLocaleString()}
            />
            <MetricCard
              label="Available"
              value={totals.totalAvailable.toLocaleString()}
            />
          </Grid>

          <Text as="div" size="1" color="gray" className="mt-3">
            Utilization: {totals.utilization}%
          </Text>
        </Box>

        <Flex direction="column" gap="2" className="max-h-[40vh] overflow-y-auto">
          {filteredShelters.map((shelter) => {
            const isEditing = shelter.id === editingShelterId && editDraft !== null;
            const isSelected = selectedIds.includes(shelter.id);

            return (
              <Box
                key={shelter.id}
                className={`rounded-lg border p-3 shadow-sm ${
                  isSelected ? "border-blue-300 bg-blue-50/50" : "border-neutral-200"
                }`}
              >
                <Flex align="start" gap="2">
                  <input
                    type="checkbox"
                    className="shelter-select-checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectShelter(shelter.id)}
                    aria-label={`Select ${shelter.name}`}
                  />
                  <Box className="w-full">
                    {!isEditing && (
                      <>
                        <Flex align="start" justify="between" gap="2">
                          <Box>
                            <Text as="div" weight="bold">
                              {shelter.name}
                            </Text>
                            <Text as="div" size="1" color="gray">
                              {shelter.area}
                            </Text>
                          </Box>
                          <Flex align="center" gap="2">
                            <Badge color={getStatusColor(shelter.status)}>
                              {shelter.status}
                            </Badge>
                            <button
                              type="button"
                              className="shelter-action-icon-button"
                              onClick={() => beginEdit(shelter)}
                              aria-label={`Edit ${shelter.name}`}
                            >
                              <img src={editIcon} alt="" className="shelter-action-icon" />
                            </button>
                            <button
                              type="button"
                              className="shelter-action-icon-button shelter-delete-button"
                              onClick={() => deleteSingleShelter(shelter.id)}
                              aria-label={`Delete ${shelter.name}`}
                            >
                              <img src={trashIcon} alt="" className="shelter-action-icon" />
                            </button>
                          </Flex>
                        </Flex>

                        <Text as="div" size="1" className="mt-1">
                          {shelter.address}
                        </Text>

                        <Flex direction="column" gap="1" className="mt-3">
                          <ShelterDetail
                            label="Capacity"
                            value={shelter.capacity.toLocaleString()}
                          />
                          <ShelterDetail
                            label="Occupied"
                            value={shelter.occupancy.toLocaleString()}
                          />
                          <ShelterDetail
                            label="Available"
                            value={`${(shelter.capacity - shelter.occupancy).toLocaleString()}`}
                          />
                          <ShelterDetail label="Medical Support" value={shelter.medicalSupport} />
                          <ShelterDetail label="Contact" value={shelter.contact} />
                          <ShelterDetail label="Last Updated" value={shelter.lastUpdated} />
                        </Flex>
                      </>
                    )}

                    {isEditing && editDraft && (
                      <Flex direction="column" gap="2">
                        <TextField.Root
                          value={editDraft.name}
                          onChange={(event) => updateDraft({ name: event.target.value })}
                          placeholder="Shelter Name"
                        />
                        <TextField.Root
                          value={editDraft.address}
                          onChange={(event) => updateDraft({ address: event.target.value })}
                          placeholder="Address"
                        />
                        <Grid columns="2" gap="2">
                          <Select.Root
                            value={editDraft.area}
                            onValueChange={(value) => updateDraft({ area: value })}
                          >
                            <Select.Trigger />
                            <Select.Content>
                              {areas.map((area) => (
                                <Select.Item key={area} value={area}>
                                  {area}
                                </Select.Item>
                              ))}
                            </Select.Content>
                          </Select.Root>
                          <Select.Root
                            value={editDraft.status}
                            onValueChange={(value) =>
                              updateDraft({
                                status: value as ShelterRecord["status"],
                              })
                            }
                          >
                            <Select.Trigger />
                            <Select.Content>
                              <Select.Item value="Open">Open</Select.Item>
                              <Select.Item value="Limited">Limited</Select.Item>
                              <Select.Item value="Full">Full</Select.Item>
                            </Select.Content>
                          </Select.Root>
                        </Grid>
                        <Grid columns="2" gap="2">
                          <TextField.Root
                            value={String(editDraft.occupancy)}
                            onChange={(event) =>
                              updateDraft({
                                occupancy: parsePositiveNumber(event.target.value),
                              })
                            }
                            type="number"
                            placeholder="Occupied"
                          />
                          <TextField.Root
                            value={String(editDraft.capacity)}
                            onChange={(event) =>
                              updateDraft({
                                capacity: parsePositiveNumber(event.target.value),
                              })
                            }
                            type="number"
                            placeholder="Capacity"
                          />
                        </Grid>
                        <TextField.Root
                          value={editDraft.contact}
                          onChange={(event) => updateDraft({ contact: event.target.value })}
                          placeholder="Contact Number"
                        />
                        <Flex align="center" justify="between">
                          <Text size="2">Medical Support</Text>
                          <Switch
                            checked={editDraft.medicalSupport === "Yes"}
                            onCheckedChange={(checked) =>
                              updateDraft({ medicalSupport: checked ? "Yes" : "No" })
                            }
                          />
                        </Flex>
                        <Flex gap="2">
                          <Button
                            variant="soft"
                            color="gray"
                            size="1"
                            onClick={() => {
                              setEditingShelterId(null);
                              setEditDraft(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button size="1" onClick={saveEdit}>
                            Save
                          </Button>
                        </Flex>
                      </Flex>
                    )}
                  </Box>
                </Flex>
              </Box>
            );
          })}

          {filteredShelters.length === 0 && (
            <Box className="rounded-md border border-dashed border-neutral-300 px-3 py-5 text-center">
              <Text size="2" color="gray">
                No shelters found for this area/filter.
              </Text>
            </Box>
          )}
        </Flex>
      </Flex>
    </>
  );
}

function Shelter() {
  const [panel, setPanel] = useState<"list" | "form">("list");
  const [shelters, setShelters] = useState<ShelterRecord[]>(initialShelters);

  function deleteShelter(id: string) {
    setShelters((current) => current.filter((shelter) => shelter.id !== id));
  }

  function deleteShelters(ids: string[]) {
    const idSet = new Set(ids);
    setShelters((current) =>
      current.filter((shelter) => !idSet.has(shelter.id))
    );
  }

  function updateShelter(updatedShelter: ShelterRecord) {
    setShelters((current) =>
      current.map((shelter) =>
        shelter.id === updatedShelter.id ? updatedShelter : shelter
      )
    );
  }

  return (
    <>
      {panel === "list" && (
        <List
          setPanel={setPanel}
          shelters={shelters}
          onDeleteShelter={deleteShelter}
          onDeleteShelters={deleteShelters}
          onUpdateShelter={updateShelter}
        />
      )}
      {panel === "form" && <Form setPanel={setPanel} />}
    </>
  );
}

export default Shelter;
