import {
  Crosshair,
  Dumbbell,
  Gamepad2,
  Sprout,
  Sun,
  Utensils,
} from "lucide-react";

export const categories = {
  foundation: {
    name: "Foundation",
    color: "#667084",
    background: "#E4E7EC",
    icon: Sun,
  },
  movement: {
    name: "Movement",
    color: "#A24F75",
    background: "#EEDDE6",
    icon: Dumbbell,
  },
  nourishment: {
    name: "Nourishment",
    color: "#4D806F",
    background: "#DCEAE4",
    icon: Utensils,
  },
  focus: {
    name: "Focus",
    color: "#287B87",
    background: "#D9E9EC",
    icon: Crosshair,
  },
  build: {
    name: "Build",
    color: "#6B61A0",
    background: "#E3E0F0",
    icon: Sprout,
  },
  unwind: {
    name: "Unwind",
    color: "#764E70",
    background: "#E9DDE7",
    icon: Gamepad2,
  },
};
