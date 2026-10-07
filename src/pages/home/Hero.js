import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { EASE_OUT } from "../../design/motion";
import GemStage from "./GemStage";
import { AccessAction } from "./AccessAction";
import { EXAMPLE_STONE } from "./examples";

export default function Hero({ heroRef }) {
  const reduce = useReducedMotion();
  const rise = (i) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
      : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, ease: EASE_OUT, delay: 0.06 * i } };

  return (
    <section ref={heroRef} className="home-hero" aria-labelledby="home-title">
      <div className="home-container home-hero-grid">
        <div className="home-hero-copy">
          <motion.p className="home-eyebrow" {...rise(0)}>
            <span className="home-brand-dot" aria-hidden="true" />
            Gemstone DNA
          </motion.p>
          <motion.h1 id="home-title" className="home-h1" {...rise(1)}>
            The digital identity <span className="home-h1-soft">of every gemstone.</span>
          </motion.h1>
          <motion.p className="home-lede" {...rise(2)}>
            Each stone gets one permanent page — photographs, 360° video, laboratory report and full specifications —
            opened from the QR code on its label.
          </motion.p>
          <motion.div className="home-actions" {...rise(3)}>
            <AccessAction />
            <Link className="home-link" to={`/${EXAMPLE_STONE}`}>
              See a live DNA page
              <ChevronRight className="home-link-chevron" size={17} strokeWidth={2} aria-hidden="true" />
            </Link>
          </motion.div>
        </div>
        <GemStage heroRef={heroRef} />
      </div>
    </section>
  );
}
