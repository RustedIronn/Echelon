import { motion } from "framer-motion";
import TimelineItem from "./TimelineItem";
import { getCurrentTask } from "@/shared/time";

export default function Timeline({ tasks, toggleTask }) {
  const current = getCurrentTask(tasks);

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
            current={current?.id === task.id}
          />
        </motion.div>
      ))}
    </div>
  );
}
