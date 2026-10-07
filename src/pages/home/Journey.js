import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight } from "lucide-react";
import GemStage, { STILL_SIZES, stillSrc } from "./GemStage";
import { AccessAction } from "./AccessAction";
import { EXAMPLE_STONE } from "./examples";
import { gemSupport } from "./gemSupport";
import { CHAPTERS, STILLS, chapterAt } from "./timeline";

const COPY = {
  cut: {
    title: "Cut to bring out its light.",
    text: "Facet by facet, the rough becomes a gemstone — and every detail of it becomes worth knowing exactly.",
  },
  mapped: {
    title: "Then, every detail recorded.",
    text: "Its photographs and 360° video, its laboratory report and its specifications — gathered in one record.",
  },
  identified: {
    title: "Now it has an identity.",
    text: "One permanent DNA page at its own address, opened from the QR code on its label by anyone who holds the stone.",
  },
};

const RECORD_ITEMS = ["Photographs", "360° video", "Laboratory report", "Specifications"];

const LiveLink = () => (
  <Link className="home-link" to={`/${EXAMPLE_STONE}`}>
    See a live DNA page
    <ChevronRight className="home-link-chevron" size={17} strokeWidth={2} aria-hidden="true" />
  </Link>
);

const Intro = () => (
  <>
    <p className="home-eyebrow">
      <span className="home-brand-dot" aria-hidden="true" />
      Gemstone DNA
    </p>
    <h1 id="home-title" className="home-h1">
      The digital identity <span className="home-h1-soft">of every gemstone.</span>
    </h1>
    <p className="home-lede">
      Every stone begins in the rough, one of a kind. Gems DNA gives each one a permanent identity — a page of its own,
      opened from the QR code on its label.
    </p>
    <div className="home-actions">
      <AccessAction />
      <LiveLink />
    </div>
  </>
);

function usePrefersReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduce, setReduce] = useState(() => typeof window !== "undefined" && Boolean(window.matchMedia?.(query).matches));
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return undefined;
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduce;
}

export default function Journey() {
  const reduce = usePrefersReducedMotion();
  return reduce ? <StillJourney /> : <ScrollJourney />;
}

/**
 * The hero as a short scroll story — rough, cut, mapped, identified — told by
 * the stone and by the chapter text beside it. Ordinary page scroll drives it
 * (a tall section with a sticky stage); nothing is hijacked, and every
 * chapter can be reached directly from the step rail.
 */
function ScrollJourney() {
  const sectionRef = useRef(null);
  const motion = useRef({ progress: 0, pointerX: 0, pointerY: 0, still: false });
  const [tier] = useState(gemSupport);
  const [chapter, setChapter] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    let frame = 0;
    const read = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const span = Math.max(rect.height - window.innerHeight, 1);
      const p = Math.min(1, Math.max(0, -rect.top / span));
      motion.current.progress = p;
      setChapter(chapterAt(p));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const goTo = useCallback((index) => {
    const section = sectionRef.current;
    const top = section.getBoundingClientRect().top + window.scrollY;
    const span = section.offsetHeight - window.innerHeight;
    window.scrollTo({ top: Math.round(top + CHAPTERS[index].focus * span), behavior: "smooth" });
  }, []);

  // Keyboard users tabbing into a chapter that isn't on screen yet.
  const onChapterFocus = (index) => () => {
    if (index !== chapter) goTo(index);
  };

  return (
    <section ref={sectionRef} className="home-journey" aria-labelledby="home-title">
      <div className="home-journey-sticky">
        <div className="home-container home-journey-grid">
          <div className="home-journey-copy">
            <div className="home-chapters">
              <div className={`home-chapter${chapter === 0 ? " is-active" : ""}`} onFocus={onChapterFocus(0)}>
                <Intro />
              </div>
              {CHAPTERS.slice(1).map(({ id, label }, i) => (
                <div key={id} className={`home-chapter${chapter === i + 1 ? " is-active" : ""}`} onFocus={onChapterFocus(i + 1)}>
                  <p className="home-eyebrow">{label}</p>
                  <h2 className="home-chapter-title">{COPY[id].title}</h2>
                  <p className="home-lede">{COPY[id].text}</p>
                  {id === "identified" && (
                    <div className="home-actions">
                      <LiveLink />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <nav className="home-rail" aria-label="Story chapters">
              <ol>
                {CHAPTERS.map(({ id, label }, i) => (
                  <li key={id}>
                    <button
                      type="button"
                      className={`home-rail-step${i <= chapter ? " is-reached" : ""}`}
                      aria-current={i === chapter ? "step" : undefined}
                      onClick={() => goTo(i)}
                    >
                      <span className="home-rail-bar" aria-hidden="true" />
                      <span className="home-rail-label">{label}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
          <div className="home-journey-visual">
            <GemStage motion={motion} tier={tier} chapter={chapter} />
            <div className={`home-record${chapter === 3 ? " is-shown" : ""}`} aria-hidden="true">
              <p className="home-record-eyebrow">
                <span className="home-brand-dot" />
                Gems DNA record
              </p>
              <p className="home-record-address">
                gems-dna.com/<span>stock-number</span>
              </p>
              <ul>
                {RECORD_ITEMS.map((item, i) => (
                  <li key={item} style={{ "--i": i }}>
                    <span className="home-record-check">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Reduced motion: the same story as a calm sequence of stills. */
function StillJourney() {
  return (
    <>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-container home-hero-grid">
          <div className="home-hero-copy">
            <Intro />
          </div>
          <div className="home-stage">
            <img
              className="home-stage-poster is-shown"
              src={stillSrc("identified", 1080)}
              srcSet={`${stillSrc("identified", 640)} 640w, ${stillSrc("identified", 1080)} 1080w`}
              sizes={STILL_SIZES}
              width="1080"
              height="993"
              alt=""
              fetchPriority="high"
            />
          </div>
        </div>
      </section>
      <section className="home-section home-steps-section" aria-labelledby="home-steps-title">
        <div className="home-container">
          <h2 id="home-steps-title" className="home-section-title">
            From rough to record.
          </h2>
          <ol className="home-steps">
            {CHAPTERS.map(({ id, label }) => (
              <li key={id} className="home-step">
                <img src={stillSrc(id, 640)} width="640" height="588" loading="lazy" decoding="async" alt={STILLS[id].alt} />
                <p className="home-eyebrow">{label}</p>
                {COPY[id] ? (
                  <>
                    <h3 className="home-step-title">{COPY[id].title}</h3>
                    <p className="home-step-text">{COPY[id].text}</p>
                  </>
                ) : (
                  <>
                    <h3 className="home-step-title">It begins as a stone.</h3>
                    <p className="home-step-text">Rough, one of a kind, and not yet recorded anywhere.</p>
                  </>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
