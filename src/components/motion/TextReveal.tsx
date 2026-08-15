/**
 * TextReveal — lift a line of display type into place, word by word.
 *
 * Inspiration: the masked "text effect" family in Motion Primitives, tuned
 * down for RetentionLab's editorial voice — one short rise per word, played
 * once, with no ambient loop.
 *
 * Accessibility is the reason this component owns its own element rather than
 * sitting inside one. The animated words are `aria-hidden`, which would leave
 * a heading with an empty accessible name; by rendering the heading itself the
 * component can name it with the complete, unsplit string.
 */
import { Fragment, useMemo } from "react";
import { motion, type Variants } from "motion/react";

import { useMotionConfig, useResolvedReducedMotion } from "./motionContext";

import "./motion.css";

type RevealTag = "h1" | "h2" | "h3" | "p" | "span";

const motionTags: Record<RevealTag, typeof motion.span> = {
  h1: motion.h1 as typeof motion.span,
  h2: motion.h2 as typeof motion.span,
  h3: motion.h3 as typeof motion.span,
  p: motion.p as typeof motion.span,
  span: motion.span,
};

type TextRevealProps = {
  /** The complete string. Also becomes the accessible name. */
  text: string;
  /** Element to render. Defaults to `span`. */
  as?: RevealTag;
  /** When to play: on mount, or the first time it scrolls into view. */
  trigger?: "mount" | "inView";
  /** Per-word delay in seconds. Defaults to a third of the shared stagger. */
  gap?: number;
  reducedMotion?: boolean;
  className?: string;
  id?: string;
};

/**
 * Split on spaces but keep explicit newlines as their own break tokens, so a
 * hero line that was authored across two lines still breaks where intended.
 */
function tokenise(text: string): string[] {
  return text.split("\n").flatMap((line, lineIndex) => {
    const words = line.split(" ").filter((word) => word.length > 0);
    return lineIndex === 0 ? words : ["\n", ...words];
  });
}

export function TextReveal({
  text,
  as = "span",
  trigger = "mount",
  gap,
  reducedMotion,
  className,
  id,
}: TextRevealProps) {
  const { stagger, duration, ease } = useMotionConfig();
  const shouldReduceMotion = useResolvedReducedMotion(reducedMotion);
  const perWord = gap ?? stagger / 3;
  const tokens = useMemo(() => tokenise(text), [text]);

  const containerVariants = useMemo<Variants>(
    () => ({
      hidden: {},
      shown: { transition: { staggerChildren: shouldReduceMotion ? 0 : perWord } },
    }),
    [perWord, shouldReduceMotion],
  );

  const wordVariants = useMemo<Variants>(
    () => ({
      hidden: shouldReduceMotion ? { opacity: 1, y: "0%" } : { opacity: 0, y: "62%" },
      shown: {
        opacity: 1,
        y: "0%",
        transition: { duration: duration.slow, ease: ease.entrance },
      },
    }),
    [duration.slow, ease.entrance, shouldReduceMotion],
  );

  const MotionTag = motionTags[as];

  // Under reduced motion there is nothing to reveal: render the plain string
  // with no split, no mask and no scroll gate.
  if (shouldReduceMotion) {
    const Tag = as;
    return (
      <Tag className={className} data-reduced-motion="true" id={id}>
        {text}
      </Tag>
    );
  }

  const animation =
    trigger === "mount"
      ? { initial: "hidden" as const, animate: "shown" as const }
      : {
          initial: "hidden" as const,
          whileInView: "shown" as const,
          viewport: { once: true, amount: 0.4 },
        };

  return (
    <MotionTag
      aria-label={text}
      className={className}
      id={id}
      variants={containerVariants}
      {...animation}
    >
      {tokens.map((token, index) =>
        token === "\n" ? (
          <br aria-hidden="true" key={`break-${index}`} />
        ) : (
          <Fragment key={`${token}-${index}`}>
            {/* A real space between the inline-block masks, so the line both
                wraps naturally and reads back with its words separated. */}
            {index > 0 && tokens[index - 1] !== "\n" ? " " : null}
            <span aria-hidden="true" className="text-reveal__mask">
              <motion.span className="text-reveal__word" variants={wordVariants}>
                {token}
              </motion.span>
            </span>
          </Fragment>
        ),
      )}
    </MotionTag>
  );
}
