import { motion, type HTMLMotionProps, type Variants } from "framer-motion";
import { type ReactNode } from "react";

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const item: Variants = {
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

interface MotionStaggerProps extends Omit<HTMLMotionProps<"div">, "variants" | "initial" | "animate" | "whileInView" | "viewport"> {
  children: ReactNode;
  /** When true, the cascade only fires when the container enters the viewport. */
  inView?: boolean;
}

export default function MotionStagger({ children, className, inView = false, ...rest }: MotionStaggerProps) {
  if (inView) {
    return (
      <motion.div
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15, margin: "0px 0px -10% 0px" }}
        className={className}
        {...rest}
      >
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div variants={container} initial="hidden" animate="show" className={className} {...rest}>
      {children}
    </motion.div>
  );
}

interface MotionStaggerItemProps extends Omit<HTMLMotionProps<"div">, "variants"> {
  children: ReactNode;
}

export function MotionStaggerItem({ children, className, ...rest }: MotionStaggerItemProps) {
  return (
    <motion.div variants={item} className={className} {...rest}>
      {children}
    </motion.div>
  );
}
