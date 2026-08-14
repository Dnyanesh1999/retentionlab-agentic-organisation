/**
 * StaggerReveal — reveal a list of children with a shared, staggered entrance.
 *
 * Inspiration: the "staggered container" pattern popularised by Motion
 * Primitives and Magic UI. This version is adapted for RetentionLab case rows
 * and agent lists: it keeps semantic DOM (`ul`/`ol` → `li`), animates only
 * `opacity`/`transform`, runs exactly once (no ambient/infinite loop), and
 * collapses to a plain instant render under reduced motion.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { motion, type Variants } from "motion/react";

import { useMotionConfig, useResolvedReducedMotion } from "./motionContext";

type SemanticTag = "div" | "ul" | "ol" | "section" | "li";

// The component references are module-level constants. Creating them through
// a function during render breaks React's static-component invariant.
const motionTags: Record<SemanticTag, typeof motion.div> = {
  div: motion.div,
  ul: motion.ul as typeof motion.div,
  ol: motion.ol as typeof motion.div,
  section: motion.section as typeof motion.div,
  li: motion.li as typeof motion.div,
};

type StaggerContextValue = {
  itemVariants: Variants;
};

const StaggerContext = createContext<StaggerContextValue | null>(null);

type StaggerRevealProps = {
  children: ReactNode;
  /** Semantic container element. Defaults to `div`. */
  as?: SemanticTag;
  /** When to play: on mount, or the first time it scrolls into view. */
  trigger?: "mount" | "inView";
  /** Per-child delay in seconds. Defaults to the shared stagger token. */
  gap?: number;
  /** Vertical travel of each item in px (transform only). */
  distance?: number;
  reducedMotion?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
};

export function StaggerReveal({
  children,
  as = "div",
  trigger = "inView",
  gap,
  distance = 12,
  reducedMotion,
  className,
  id,
  "aria-label": ariaLabel,
}: StaggerRevealProps) {
  const { stagger, ease, duration } = useMotionConfig();
  const shouldReduceMotion = useResolvedReducedMotion(reducedMotion);
  const perChild = gap ?? stagger;

  const containerVariants = useMemo<Variants>(
    () => ({
      hidden: {},
      shown: {
        transition: { staggerChildren: shouldReduceMotion ? 0 : perChild },
      },
    }),
    [perChild, shouldReduceMotion],
  );

  const itemVariants = useMemo<Variants>(
    () => ({
      hidden: shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: distance },
      shown: {
        opacity: 1,
        y: 0,
        transition: { duration: duration.base, ease: ease.entrance },
      },
    }),
    [distance, duration.base, ease.entrance, shouldReduceMotion],
  );

  const MotionTag = motionTags[as];
  const contextValue = useMemo(() => ({ itemVariants }), [itemVariants]);

  // Under reduced motion there is nothing to reveal: render the shown state
  // immediately with no scroll gate or transition.
  const animation =
    shouldReduceMotion || trigger === "mount"
      ? { initial: shouldReduceMotion ? undefined : "hidden", animate: "shown" as const }
      : {
          initial: "hidden" as const,
          whileInView: "shown" as const,
          viewport: { once: true, amount: 0.2 },
        };

  return (
    <StaggerContext.Provider value={contextValue}>
      <MotionTag
        aria-label={ariaLabel}
        className={className}
        id={id}
        variants={containerVariants}
        {...animation}
      >
        {children}
      </MotionTag>
    </StaggerContext.Provider>
  );
}

type StaggerItemProps = {
  children: ReactNode;
  /** Semantic item element. Use `li` inside a `ul`/`ol` container. */
  as?: SemanticTag;
  className?: string;
};

/**
 * A single revealed child. Inherits the entrance from its parent
 * {@link StaggerReveal}; renders plainly (no motion wrapper) if used outside one.
 */
export function StaggerItem({ children, as = "div", className }: StaggerItemProps) {
  const context = useContext(StaggerContext);
  const MotionTag = motionTags[as];

  if (!context) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag className={className} variants={context.itemVariants}>
      {children}
    </MotionTag>
  );
}

StaggerReveal.Item = StaggerItem;
