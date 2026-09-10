import { motion, type HTMLMotionProps, type Variants } from "framer-motion";
import { type ReactNode } from "react";

const variants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    filter: "blur(8px)",
  },
  show: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.55,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

interface MotionFadeProps extends Omit<HTMLMotionProps<"div">, "variants" | "initial" | "animate" | "whileInView" | "viewport"> {
  children: ReactNode;
  /** Additional delay in seconds (useful when nested inside MotionStagger). */
  delay?: number;
  /**
   * When true, the entrance animation only fires when the element enters
   * the viewport. Default false (animates on mount) to preserve existing
   * behavior for above-the-fold content.
   */
  inView?: boolean;
}

/**
 * Premium arrival: blur-to-focus + subtle scale-and-spring on mount.
 * Drop-in replacement for the previous fade+slide variant.
 */
export default function MotionFade({
  children,
  delay = 0,
  className,
  inView = false,
  ...rest
}: MotionFadeProps) {
  if (inView) {
    return (
      <motion.div
        variants={variants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15, margin: "0px 0px -10% 0px" }}
        transition={{ delay }}
        className={className}
        {...rest}
      >
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="show"
      transition={{ delay }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
