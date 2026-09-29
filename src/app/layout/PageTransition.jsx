import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { useReducedMotion } from "@ui";

export default function PageTransition({ children }) {
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      key={location.pathname}
      initial={{
        opacity: reducedMotion ? 1 : 0,
        y: reducedMotion ? 0 : 4,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      exit={{
        opacity: 0,
        y: reducedMotion ? 0 : -2,
      }}
      transition={{
        duration: reducedMotion ? 0 : 0.16,
      }}
    >
      {children}
    </motion.div>
  );
}
