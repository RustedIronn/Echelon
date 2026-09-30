import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useToday } from "@features/plan/schedule/js/todayStore.js";
import { useFocusSurface } from "../js/surface";

export default function FocusCompatibility() {
  const location = useLocation();
  const navigate = useNavigate();
  const tasks = useToday((state) => state.tasks);
  const openFor = useFocusSurface((state) => state.openFor);
  const mission = location.state?.mission ?? tasks.find((item) => item.id === location.state?.missionId) ?? null;

  useEffect(() => {
    openFor(mission);
    navigate(location.state?.returnTo ?? "/", { replace: true });
  }, [openFor, mission, navigate, location.state?.returnTo]);

  return null;
}
