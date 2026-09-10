import { motion, type HTMLMotionProps } from "framer-motion";
import { type ReactNode } from "react";

interface MotionPressProps extends Omit<HTMLMotionProps<"button">, "whileTap" | "whileHover"> {
  children: ReactNode;
  /** When true the element will receive a quick success-pulse on click. */
  pulseOnTap?: boolean;
}

/**
 * Button-shaped press animation: subtle scale-down on tap with a tiny
 * spring rebound. Use for primary CTAs where you want a tactile feel.
 */
export default function MotionPress({
  children,
  className,
  ...rest
}: MotionPressProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.015 }}
      transition={{ type: "spring", stiffness: 500, damping: 30, mass: 0.4 }}
      className={className}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
