import { Link } from "react-router-dom";
import { ArrowUpRight, Dumbbell, Leaf, ListTodo } from "lucide-react";

import { Card } from "@ui";
import { useHabits } from "@features/habits/store";
import { useWorkout } from "@features/workout/store";
import { getTodayWorkout, getWorkoutDuration } from "@features/workout/utils";
import { getToday } from "@/shared/date";
import { usePlanner } from "@features/planner/store";
import { getTodayPlannerTasks } from "@features/planner/tasks";

export default function TodaySummaries() {
  const habits = useHabits((state) => state.habits);
  const sessions = useWorkout((state) => state.sessions);
  const workout = getTodayWorkout();
  const completedHabits = habits.filter((habit) => habit.done).length;
  const habitTotal = habits.length || 5;
  const habitPercent = Math.round((completedHabits / habitTotal) * 100);
  const trainedToday = sessions.some((session) => session.date === getToday());
  const workoutMinutes = getWorkoutDuration(workout);
  const plannerTasks = usePlanner((state) => state.document.tasks);
  const dueToday = getTodayPlannerTasks(plannerTasks).filter((task) => !task.completedAt);

  return (
    <div className="today-summary-grid">
      <Card material="clear" className="today-summary-card today-habit-orbit">
        <div className="today-habit-meter" style={{ "--habit-progress": `${habitPercent}%` }} aria-label={`${completedHabits} of ${habitTotal} habits complete`}>
          <span><strong>{completedHabits}</strong><small>of {habitTotal}</small></span>
        </div>
        <div className="today-support-copy">
          <span><Leaf size={14} aria-hidden="true" /> Daily rituals</span>
          <strong>{habitPercent === 100 ? "Orbit complete" : `${habitTotal - completedHabits} still in orbit`}</strong>
          <Link to="/habits">Tend habits <ArrowUpRight size={14} /></Link>
        </div>
      </Card>

      <Card material="clear" className={`today-summary-card today-workout-signal ${trainedToday ? "is-complete" : ""}`}>
        <span className="today-workout-icon"><Dumbbell size={20} aria-hidden="true" /></span>
        <div className="today-support-copy">
          <span>{trainedToday ? "Training logged" : workout ? "Today’s training" : "Recovery day"}</span>
          <strong>{trainedToday ? "Body work complete" : workout?.title ?? "Restore and reset"}</strong>
          <small>{trainedToday ? "Stored in workout history" : workout ? `${workout.exercises.length} exercises · ${workoutMinutes === null ? "flexible duration" : `about ${workoutMinutes} min`}` : "No prescribed workout today"}</small>
          <Link to="/workouts/today">{trainedToday ? "View session" : workout ? "Open workout" : "Open training"} <ArrowUpRight size={14} /></Link>
        </div>
      </Card>

      <Card material="clear" className="today-summary-card today-planner-signal">
        <span className="today-workout-icon"><ListTodo size={20} aria-hidden="true" /></span>
        <div className="today-support-copy">
          <span>Planner due today</span>
          <strong>{dueToday.length ? `${dueToday.length} one-off ${dueToday.length === 1 ? "action" : "actions"}` : "Desk clear"}</strong>
          <small>{dueToday[0]?.title ?? "Nothing extra is due today."}</small>
          <Link to="/plan/planner/today">Open today’s plan <ArrowUpRight size={14} /></Link>
        </div>
      </Card>
    </div>
  );
}
