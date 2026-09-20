import { motion } from "framer-motion";
import TimelineItem from "./TimelineItem";
import { getCurrentScheduleItem, getScheduleMinutes } from "../time";

export default function Timeline({ tasks, toggleTask, onFocus }) {
  const current = getCurrentScheduleItem(tasks);
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const next = tasks.find(
    (task) => !task.done && getScheduleMinutes(task.start) > currentMinutes,
  );

  return (
    <div className="timeline">
      {tasks.map((task, index) => (
        <motion.div
          key={task.id}
          initial={{
            opacity: 0,
            x: -10,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
          transition={{
            delay: index * 0.04,
          }}
        >
          <TimelineItem
            task={task}
            toggleTask={toggleTask}
            onFocus={onFocus}
            current={current?.id === task.id}
            next={next?.id === task.id}
            past={!task.done && getScheduleMinutes(task.end) <= currentMinutes}
          />
        </motion.div>
      ))}
    </div>
  );
}
