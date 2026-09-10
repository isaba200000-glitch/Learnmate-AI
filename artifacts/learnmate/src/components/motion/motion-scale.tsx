import { motion, type HTMLMotionProps } from "framer-motion";
import { type ReactNode } from "react";

interface MotionScaleProps extends Omit<HTMLMotionProps<"div">, "whileHover" | "whileTap"> {
  children: ReactNode;
  /** Hover scale factor. Defaults to 1.02 (subtle). */
  hover?: number;
  /** Tap scale factor. Defaults to 0.98. */
  tap?: number;
}

/**
 * Card / button hover-tap with subtle spring physics.
 * Drop-in replacement for `hover:scale-105 active:scale-95`.
 */
export default function MotionScale({
  children,
  hover = 1.02,
  tap = 0.98,
  className,
  ...rest
}: MotionScaleProps) {
  return (
    <motion.div
      whileHover={{ scale: hover, transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] } }}
      whileTap={{ scale: tap, transition: { duration: 0.1 } }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
