import { useState } from "react";
import { Box, Flex, Grid, Theme } from "@radix-ui/themes";
import Map from "./Map";
import Shelter from "./Shelter";
import SimulationPanel from "./SimulationPanel";
import homeIcon from "./assets/icons/home.png";
import typhoonIcon from "./assets/icons/typhoon.png";

const navItems = [
  { id: "home", label: "Home", icon: homeIcon },
  { id: "typhoon", label: "Typhoon", icon: typhoonIcon },
] as const;

function App() {
  const [activeNav, setActiveNav] = useState<(typeof navItems)[number]["id"]>(
    "home"
  );

  return (
    <Theme>
      {/* Sidebar.tsx */}
      <Grid columns={"1fr 3fr"} rows={"1"} className="h-screen w-screen">
        {/* Aside */}
        <Grid columns={"1fr 7fr"} rows={"1"}>
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
            className="border-r border-r-neutral-200"
          >
            {activeNav === "home" && <Shelter />}
            {activeNav === "typhoon" && <SimulationPanel />}
          </Flex>
        </Grid>
        {/* Main */}
        <Box>
          <Map />
        </Box>
      </Grid>
    </Theme>
  );
}

export default App;
