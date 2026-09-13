import { useEffect, useRef } from "react";

import { getToday } from "@/shared/date";
import {
  getMillisecondsUntilNextLocalDay,
  hasLocalDayChanged,
} from "@/shared/dayRollover";
import { useToday } from "@/features/schedule/todayStore";
import { useHabits } from "@/features/habits/store";
import { useSync } from "@/ui/useSync";

const TIMER_BUFFER_MS = 50;

export default function useDayRollover() {
  const dayRef = useRef(getToday());

  useEffect(() => {
    let timeoutId;

    const scheduleNextCheck = (now = new Date()) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(
        checkDay,
        getMillisecondsUntilNextLocalDay(now) + TIMER_BUFFER_MS,
      );
    };

    const checkDay = () => {
      const now = new Date();

      if (hasLocalDayChanged(dayRef.current, now)) {
        dayRef.current = getToday(now);
        Promise.all([
          useToday.getState().rolloverDay(),
          useHabits.getState().rolloverDay(),
        ]).catch(() => useSync.getState().setSyncError());
      }

      scheduleNextCheck(now);
    };

    const checkVisibleDay = () => {
      if (!document.hidden) checkDay();
    };

    scheduleNextCheck();
    window.addEventListener("focus", checkDay);
    document.addEventListener("visibilitychange", checkVisibleDay);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("focus", checkDay);
      document.removeEventListener("visibilitychange", checkVisibleDay);
    };
  }, []);
}
