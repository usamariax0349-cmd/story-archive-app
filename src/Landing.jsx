import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  AnimatePresence,
} from "framer-motion";

const NIGHT = "#171310";
const DRAWER = "#241A12";
const PAPER = "#EDE4D3";
const PAPER_DIM = "#E1D5B8";
const INK = "#211C16";
const INK_SOFT = "#9A8F79";
const VIOLET = "#5B4A87";
const GOLD = "#D9B25C";

const FADE_UP = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};

// Coarse pointer (touch) vs fine pointer (mouse) — used to swap
// hover-dependent interactions for touch-friendly equivalents, since
// touch has no real hover state and can leave elements visually "stuck"
// mid-hover after a tap.
function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    setIsTouch(mq.matches);
    const handler = (e) => setIsTouch(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isTouch;
}

// True for phone-width viewports — used to swap the desktop card fan for a
// single large swipeable card, since a multi-card fan doesn't have room to
// be "big" on a narrow screen the way a phone-native carousel does.
function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

function LandingStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Newsreader:ital,wght@0,400;0,500;1,400;1,500&family=Courier+Prime:wght@400;700&display=swap');
      .sa-landing { --radius: clamp(120px, 16vw, 240px); background:${NIGHT}; color:${PAPER}; font-family:'Newsreader',serif; }
      .sa-landing h1, .sa-landing h2 { font-family:'Fraunces',serif; font-weight:700; margin:0; }
      .sa-landing .mono { font-family:'Courier Prime',monospace; letter-spacing:0.14em; text-transform:uppercase; }
      .sa-landing ::selection { background:${VIOLET}; color:${PAPER}; }
      .sa-hero { min-height:100vh; display:flex; align-items:center; padding-top:96px; padding-bottom:64px; }
      .sa-stage { perspective:1200px; overflow:hidden; cursor:ns-resize; touch-action:pan-y; }
      .sa-ring { transform-style:preserve-3d; }
      .sa-book { position:absolute; top:50%; left:50%; width:clamp(95px,12vw,160px); aspect-ratio:2/3; transform-style:preserve-3d; cursor:pointer; background:none; border:none; padding:0; will-change:transform; }
      .sa-book-face { position:absolute; inset:0; border-radius:6px; overflow:hidden; backface-visibility:hidden; box-shadow:0 20px 45px -18px rgba(0,0,0,0.75); border:1px solid rgba(217,178,92,0.35); }
      .sa-book-back { position:absolute; inset:0; border-radius:6px; backface-visibility:hidden; transform:rotateY(180deg); box-shadow:0 20px 45px -18px rgba(0,0,0,0.75); }
      .sa-book:focus-visible .sa-book-face, .sa-book:focus-visible .sa-book-back { outline: 2px solid #D9B25C; outline-offset: 2px; }
      .sa-stack-card { cursor:pointer; background:none; border:none; padding:0; text-align:left; will-change:transform; }
      .sa-stack-card:focus-visible { outline: 2px solid #D9B25C; outline-offset: 4px; border-radius: 6px; }
      .sa-mobile-stack-card { cursor:grab; background:none; padding:0; text-align:left; will-change:transform; }
      .sa-mobile-stack-card:active { cursor:grabbing; }
      .sa-mobile-stack-card:focus-visible { outline: 2px solid #D9B25C; outline-offset: 4px; }
      @media (max-width: 1023px) {
        .sa-hero { min-height:auto; align-items:flex-start; padding-top:88px; padding-bottom:40px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .sa-landing * { animation-duration:0.001ms !important; transition-duration:0.001ms !important; }
      }
    `}</style>
  );
}

function EnterPill({ onEnter, label = "Enter the Archive" }) {
  return (
    <motion.button
      onClick={onEnter}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.5 }}
      whileHover={{ y: -2, boxShadow: "0 14px 30px -10px rgba(0,0,0,0.7)" }}
      whileTap={{ scale: 0.96 }}
      className="fixed top-5 right-5 z-50 mono text-[10px] sm:text-xs px-4 py-2 rounded-full"
      style={{ background: PAPER, color: INK, border: `1px solid rgba(0,0,0,0.15)` }}
    >
      {label} →
    </motion.button>
  );
}

// Idle-spinning book carousel. Left alone, it slowly turns on its own;
// hovering it and scrolling the wheel takes manual control of the rotation
// (and stops the page itself from scrolling) — move the pointer off it and
// the wheel goes back to scrolling the page normally.
function BookStage({ stories, onSelectStory }) {
  const stageRef = useRef(null);
  const rotation = useMotionValue(0);
  const n = stories.length;
  const anglePer = 360 / n;
  const lastInteraction = useRef(0);
  const isTouch = useIsTouchDevice();
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  useAnimationFrame((_, delta) => {
    if (reducedMotion) return;
    if (Date.now() - lastInteraction.current < 900) return;
    rotation.set(rotation.get() + delta * 0.0065);
  });

  // Desktop: hovering the stage and scrolling the wheel rotates it (and
  // stops the page from scrolling). Touch: a left/right swipe rotates it,
  // while an up/down swipe is left alone so the page still scrolls
  // normally — the gesture's dominant axis decides which one it is.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    function onWheel(e) {
      e.preventDefault();
      lastInteraction.current = Date.now();
      rotation.set(rotation.get() + e.deltaY * 0.15);
    }

    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let gesture = null; // "horizontal" | "vertical" | null (undecided)
    let didDrag = false; // true once a swipe has genuinely rotated the ring

    function onTouchStart(e) {
      const t = e.touches[0];
      startX = lastX = t.clientX;
      startY = t.clientY;
      gesture = null;
    }
    function onTouchMove(e) {
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (gesture === null) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        gesture = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }
      if (gesture === "horizontal") {
        e.preventDefault();
        didDrag = true;
        lastInteraction.current = Date.now();
        rotation.set(rotation.get() + (t.clientX - lastX) * 0.6);
        lastX = t.clientX;
      }
      // vertical gesture: leave untouched, the page scrolls normally
    }
    // A swipe that ends on top of a book would otherwise also fire that
    // book's click a moment later (the browser's usual tap-to-click
    // synthesis) and navigate away unintentionally — swallow that one click.
    function onTouchEnd() {
      if (!didDrag) return;
      window.setTimeout(() => {
        didDrag = false;
      }, 400);
    }
    function onClickCapture(e) {
      if (didDrag) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    el.addEventListener("click", onClickCapture, true);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, [rotation]);

  const [activeIndex, setActiveIndex] = useState(0);
  useMotionValueEvent(rotation, "change", (v) => {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < n; i++) {
      let a = (i * anglePer + v) % 360;
      if (a < 0) a += 360;
      const dist = Math.min(a, 360 - a);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    if (best !== activeIndex) setActiveIndex(best);
  });

  const activeStory = stories[activeIndex];

  return (
    <div className="w-full">
      <div ref={stageRef} className="sa-stage relative mx-auto" style={{ height: "min(56vh, 480px)", maxWidth: 680 }}>
        <motion.div
          className="sa-ring absolute"
          style={{ top: "50%", left: "50%", width: 1, height: 1, rotateY: rotation }}
        >
          {stories.map((story, i) => {
            const angle = i * anglePer;
            return (
              <motion.button
                key={story.id}
                type="button"
                className="sa-book"
                aria-label={`Open ${story.title}`}
                onClick={() => onSelectStory && onSelectStory(story)}
                whileHover={isTouch ? undefined : { scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                transformTemplate={(_, generated) => `translate(-50%,-50%) rotateY(${angle}deg) translateZ(var(--radius)) ${generated}`}
              >
                <div
                  className="sa-book-face"
                  style={{
                    backgroundImage: story.coverArt ? `url(${story.coverArt})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundColor: story.accent,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: `linear-gradient(to top, rgba(10,8,6,0.92), rgba(10,8,6,0.05) 55%)`,
                    }}
                  />
                  <div style={{ position: "absolute", left: 8, right: 8, bottom: 8 }}>
                    <div className="mono" style={{ fontSize: 7, color: GOLD }}>
                      {story.genre}
                    </div>
                    <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 11, color: PAPER, lineHeight: 1.15, marginTop: 2 }}>
                      {story.title}
                    </div>
                  </div>
                </div>
                <div className="sa-book-back" style={{ background: `linear-gradient(160deg, ${story.accent}, #171310)` }} />
              </motion.button>
            );
          })}
        </motion.div>
      </div>

      <div className="mt-6 text-center">
        <div className="mono text-[10px] mb-4" style={{ color: INK_SOFT }}>
          {isTouch ? "Swipe the shelf to browse" : "Hover the shelf & scroll to browse"}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStory.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <div className="mono text-xs" style={{ color: activeStory.accent }}>
              {activeStory.genre}
            </div>
            <h2 className="mt-2" style={{ fontSize: "clamp(1.2rem,2.2vw,1.7rem)", color: PAPER }}>
              {activeStory.title}
            </h2>
            <p className="mt-2 max-w-sm mx-auto" style={{ color: PAPER_DIM, fontStyle: "italic", fontSize: "0.9rem" }}>
              {activeStory.blurb}
            </p>
          </motion.div>
        </AnimatePresence>
        <div className="flex justify-center gap-2 mt-5">
          {stories.map((s, i) => (
            <div
              key={s.id}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: i === activeIndex ? PAPER : "rgba(237,228,212,0.25)",
                transform: i === activeIndex ? "scale(1.4)" : "scale(1)",
                transition: "background .3s ease, transform .3s ease",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TiltCard({ character }) {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 200, damping: 18 });
  const sry = useSpring(ry, { stiffness: 200, damping: 18 });

  function onMove(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * 14);
    rx.set(-py * 14);
  }
  function onLeave() {
    rx.set(0);
    ry.set(0);
  }

  const statuses = useMemo(
    () => [
      "still guarded around you",
      "warmer, since you covered for her",
      "watching to see if you'll slip again",
      "trusts you more than she lets on",
    ],
    []
  );
  const [statusI, setStatusI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStatusI((i) => (i + 1) % statuses.length), 3200);
    return () => clearInterval(t);
  }, [statuses.length]);

  return (
    <motion.div
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ rotateX: srx, rotateY: sry, transformStyle: "preserve-3d" }}
      className="max-w-sm mx-auto"
    >
      <div
        className="rounded-sm p-6"
        style={{ background: PAPER, color: INK, boxShadow: "0 30px 60px -20px rgba(0,0,0,0.6)", border: `1px solid ${PAPER_DIM}` }}
      >
        <div
          className="rounded-sm mb-4 flex items-center justify-center overflow-hidden"
          style={{
            aspectRatio: "3/3.6",
            background: character?.art ? undefined : `linear-gradient(145deg, ${VIOLET}, #2f2650)`,
            backgroundImage: character?.art ? `url(${character.art})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center top",
          }}
        />
        <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 20 }}>{character?.name}</div>
        <div className="mono text-[10px] mt-1" style={{ color: "#6B6152" }}>
          {character?.role}
        </div>
        <div
          className="mt-4 pt-4 min-h-[2.6em]"
          style={{ borderTop: `1px dashed ${PAPER_DIM}`, fontStyle: "italic", fontSize: "0.95rem" }}
        >
          <AnimatePresence mode="wait">
            <motion.p
              key={statusI}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35 }}
              style={{ margin: 0 }}
            >
              {statuses[statusI]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function ChoicesDiagram() {
  const lineProps = { fill: "none", stroke: PAPER_DIM, strokeWidth: 2, strokeLinecap: "round" };
  const nodeInit = { fill: NIGHT, stroke: PAPER, strokeWidth: 2 };
  const nodeLit = { fill: VIOLET, stroke: VIOLET, strokeWidth: 2 };

  return (
    <div className="flex justify-center">
      <svg viewBox="0 0 760 340" style={{ width: "100%", maxWidth: 760, overflow: "visible" }}>
        <motion.path
          {...lineProps}
          d="M 380 20 L 380 120"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
        {[
          { d: "M 380 120 C 380 170, 140 170, 140 240", delay: 0.35 },
          { d: "M 380 120 C 380 170, 380 170, 380 240", delay: 0.5 },
          { d: "M 380 120 C 380 170, 620 170, 620 240", delay: 0.65 },
        ].map((p, i) => (
          <motion.path
            key={i}
            {...lineProps}
            d={p.d}
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: p.delay }}
          />
        ))}

        <motion.circle cx="380" cy="20" r="7" {...nodeInit} />
        <motion.circle cx="380" cy="120" r="7" {...nodeInit} />
        {[
          { cx: 140, delay: 0.8, label: "Trust her" },
          { cx: 380, delay: 0.95, label: "Stay silent" },
          { cx: 620, delay: 1.1, label: "Walk away" },
        ].map((n, i) => (
          <React.Fragment key={i}>
            <motion.circle
              cx={n.cx}
              cy="240"
              r="7"
              initial={nodeInit}
              whileInView={nodeLit}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.3, delay: n.delay }}
            />
            <text
              x={n.cx}
              y="270"
              textAnchor="middle"
              className="mono"
              style={{ fontSize: 10, fill: PAPER_DIM }}
            >
              {n.label}
            </text>
          </React.Fragment>
        ))}
      </svg>
    </div>
  );
}

const SWIPE_OFFSET_THRESHOLD = 80;
const SWIPE_CONFIDENCE_THRESHOLD = 8000;
function swipePower(offset, velocity) {
  return Math.abs(offset) * Math.abs(velocity);
}

const cardSlideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 80 : -80, opacity: 0, scale: 0.94 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir) => ({ x: dir < 0 ? 80 : -80, opacity: 0, scale: 0.94 }),
};

// Phone version of the closing "stack": one large, edge-to-edge card at a
// time instead of the desktop fan, since there isn't room to lay 7 cards
// out side by side and still have any of them be big. A left/right drag
// pages to the next/previous story, wrapping around at either end.
function MobileStackCarousel({ stories, onSelectStory }) {
  const n = stories.length;
  const wrap = (i) => ((i % n) + n) % n;
  const [[page, direction], setPage] = useState([0, 0]);
  const index = wrap(page);
  const story = stories[index];
  // Framer's onTap doesn't reliably suppress itself after a drag gesture on
  // this element (the constrained x snaps back to 0, which can read as "no
  // real movement" to the tap recognizer) — track it ourselves so a swipe
  // doesn't also open whichever story the finger happened to land on.
  const draggingRef = useRef(false);

  function paginate(dir) {
    setPage([page + dir, dir]);
  }

  return (
    <div>
      <div
        className="relative mx-auto"
        style={{ width: "min(92vw, 460px)", aspectRatio: "2/3", overflow: "hidden", borderRadius: 12 }}
      >
        <AnimatePresence initial={false} custom={direction}>
          <motion.button
            key={story.id}
            type="button"
            aria-label={`Open ${story.title}`}
            custom={direction}
            variants={cardSlideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ x: { type: "spring", stiffness: 320, damping: 32 }, opacity: { duration: 0.2 }, scale: { duration: 0.2 } }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.8}
            onDragStart={() => {
              draggingRef.current = true;
            }}
            onDragEnd={(e, { offset, velocity }) => {
              const swipe = swipePower(offset.x, velocity.x);
              if (offset.x < -SWIPE_OFFSET_THRESHOLD || (offset.x < 0 && swipe > SWIPE_CONFIDENCE_THRESHOLD)) paginate(1);
              else if (offset.x > SWIPE_OFFSET_THRESHOLD || (offset.x > 0 && swipe > SWIPE_CONFIDENCE_THRESHOLD)) paginate(-1);
              window.setTimeout(() => {
                draggingRef.current = false;
              }, 200);
            }}
            onTap={() => {
              if (draggingRef.current) return;
              onSelectStory && onSelectStory(story);
            }}
            className="sa-mobile-stack-card absolute inset-0 rounded-xl overflow-hidden"
            style={{
              background: story.coverArt ? undefined : `linear-gradient(160deg, ${story.accent}, #171310)`,
              backgroundImage: story.coverArt ? `url(${story.coverArt})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 25px 60px -20px rgba(0,0,0,0.75)",
              touchAction: "pan-y",
            }}
          >
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(to top, rgba(10,8,6,0.92), rgba(10,8,6,0.05) 55%)" }}
            />
            <div className="absolute left-4 right-4 bottom-4 text-left">
              <div className="mono text-xs" style={{ color: GOLD }}>
                {story.genre}
              </div>
              <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: "1.3rem", color: PAPER, marginTop: 4, lineHeight: 1.15 }}>
                {story.title}
              </div>
            </div>
          </motion.button>
        </AnimatePresence>
      </div>

      <div className="mono text-[10px] mt-4 text-center" style={{ color: INK_SOFT }}>
        Swipe to browse
      </div>
      <div className="flex justify-center gap-2 mt-3">
        {stories.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Go to ${s.title}`}
            onClick={() => setPage([i, i > index ? 1 : -1])}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              padding: 0,
              border: "none",
              background: i === index ? PAPER : "rgba(237,228,212,0.25)",
              transform: i === index ? "scale(1.4)" : "scale(1)",
              transition: "background .3s ease, transform .3s ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function WorldDiagram({ stories }) {
  const ref = useRef(null);
  const rows = stories.slice(0, 5);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 30%"] });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 90, damping: 26, mass: 0.4 });
  const [activeRow, setActiveRow] = useState(0);
  useMotionValueEvent(smoothProgress, "change", (p) => {
    const idx = Math.min(rows.length - 1, Math.max(0, Math.floor(p * rows.length)));
    if (idx !== activeRow) setActiveRow(idx);
  });

  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 30;

  return (
    <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
      <div className="flex justify-center">
        <motion.svg
          viewBox={`0 0 ${size} ${size}`}
          style={{ width: "100%", height: "auto", maxWidth: size }}
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        >
          {[r, r * 0.68, r * 0.36].map((rad, i) => (
            <circle key={i} cx={cx} cy={cy} r={rad} fill="none" stroke={PAPER_DIM} strokeOpacity={0.18} />
          ))}
          {rows.map((s, i) => {
            const angle = (i / rows.length) * Math.PI * 2 - Math.PI / 2;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            const active = i === activeRow;
            return (
              <g key={s.id}>
                <line x1={cx} y1={cy} x2={x} y2={y} stroke={s.accent} strokeOpacity={active ? 0.55 : 0.15} strokeWidth={1} />
                <circle cx={x} cy={y} r={active ? 7 : 4.5} fill={s.accent} opacity={active ? 1 : 0.5} />
              </g>
            );
          })}
        </motion.svg>
      </div>
      <div className="flex flex-col gap-3">
        {rows.map((s, i) => (
          <div
            key={s.id}
            className="flex items-center gap-3 text-sm transition-opacity duration-300"
            style={{ opacity: i === activeRow ? 1 : 0.4, color: i === activeRow ? PAPER : PAPER_DIM }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.accent, flexShrink: 0 }} />
            {s.title}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Landing({ stories, featuredCharacter, onEnter, onSelectStory }) {
  const isTouch = useIsTouchDevice();
  const isMobile = useIsMobileViewport();
  return (
    <div className="sa-landing min-h-screen w-full">
      <LandingStyles />
      <EnterPill onEnter={onEnter} />

      <section className="sa-hero px-6 sm:px-10 lg:px-16">
        <div className="w-full mx-auto max-w-6xl flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          <div style={{ flex: "1 1 380px", maxWidth: 480, textAlign: "left" }}>
            <span className="mono text-xs" style={{ color: VIOLET }}>
              Story Archive
            </span>
            <h1 className="mt-4" style={{ fontSize: "clamp(2.2rem,5vw,3.6rem)", lineHeight: 1.05, color: PAPER }}>
              Every story <em style={{ fontStyle: "italic", color: GOLD }}>remembers</em> you.
            </h1>
            <p className="mt-5" style={{ color: PAPER_DIM, fontStyle: "italic", fontSize: "1.05rem" }}>
              Pick a story, play a character, and watch a world that keeps living even when you're not looking.
            </p>
            <motion.button
              onClick={onEnter}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="mono text-xs inline-flex items-center gap-2 mt-8 px-6 py-3 rounded-sm"
              style={{ background: PAPER, color: INK, border: "1px solid rgba(0,0,0,0.15)" }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#8B3A3A" }} />
              Start Reading
            </motion.button>
          </div>
          <div style={{ flex: "1 1 380px", minWidth: 0, width: "100%" }}>
            <BookStage stories={stories} onSelectStory={onSelectStory} />
          </div>
        </div>
      </section>

      <section className="py-24 sm:py-36 px-6" style={{ background: NIGHT }}>
        <div className="max-w-5xl mx-auto">
          <motion.div variants={FADE_UP} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} className="max-w-xl mb-16">
            <span className="mono text-xs" style={{ color: INK_SOFT }}>
              A world that remembers
            </span>
            <h2 className="mt-3" style={{ fontSize: "clamp(1.8rem,4vw,2.6rem)", color: PAPER }}>
              Characters aren't scenery. They're people.
            </h2>
            <p className="mt-4" style={{ color: PAPER_DIM }}>
              Every character has their own likes, dislikes, and moods — and a memory of exactly what you've done.
              They react to you differently than to anyone else, and that changes as the story goes on.
            </p>
          </motion.div>
          <div className="grid md:grid-cols-2 gap-14 items-center">
            <motion.div variants={FADE_UP} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }}>
              <TiltCard character={featuredCharacter} />
            </motion.div>
            <motion.p
              variants={FADE_UP}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.4 }}
              style={{ color: PAPER_DIM, fontSize: "1.05rem" }}
            >
              Say something careless, and she remembers. Cover for her once, and she remembers that too. Nothing
              resets between conversations — the way a character feels about you today is built from everything
              that came before.
            </motion.p>
          </div>
        </div>
      </section>

      <section className="py-24 sm:py-36 px-6" style={{ background: DRAWER }}>
        <div className="max-w-5xl mx-auto">
          <motion.div variants={FADE_UP} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} className="max-w-xl mb-10">
            <span className="mono text-xs" style={{ color: "#C9A227" }}>
              Choices that actually matter
            </span>
            <h2 className="mt-3" style={{ fontSize: "clamp(1.8rem,4vw,2.6rem)", color: PAPER }}>
              Nothing resets. Nothing repeats.
            </h2>
            <p className="mt-4" style={{ color: PAPER_DIM }}>
              Every choice shapes what happens later — new obstacles, changed relationships, outcomes that stick.
              The story moves forward, always, never in a loop.
            </p>
          </motion.div>
          <ChoicesDiagram />
        </div>
      </section>

      <section className="py-24 sm:py-36 px-6" style={{ background: NIGHT }}>
        <div className="max-w-5xl mx-auto">
          <motion.div variants={FADE_UP} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} className="max-w-xl mb-14">
            <span className="mono text-xs" style={{ color: VIOLET }}>
              Built on a living world
            </span>
            <h2 className="mt-3" style={{ fontSize: "clamp(1.8rem,4vw,2.6rem)", color: PAPER }}>
              Kingdoms, guilds, and history — discovered, not dumped.
            </h2>
            <p className="mt-4" style={{ color: PAPER_DIM }}>
              Every world has real economies, politics, and geography. It surfaces naturally as the story unfolds,
              one place and one name at a time.
            </p>
          </motion.div>
          <WorldDiagram stories={stories} />
        </div>
      </section>

      <section className="py-32 sm:py-44 px-6 text-center" style={{ background: NIGHT }}>
        {isMobile ? (
          <div className="mb-16">
            <MobileStackCarousel stories={stories} onSelectStory={onSelectStory} />
          </div>
        ) : (
          <motion.div
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.5 }}
            className="relative mx-auto mb-16"
            style={{ width: "min(92vw, 700px)", height: 300 }}
          >
            {stories.map((s, i) => {
              const n = stories.length;
              const offset = i - (n - 1) / 2;
              // Responsive card size/spacing (capped on desktop, shrinking on
              // narrow viewports) so the fan can never overflow the screen.
              const cardWidthCss = "min(176px, 24vw)";
              const spacingCss = "min(68px, 9vw)";
              return (
                <motion.button
                  key={s.id}
                  type="button"
                  className="sa-stack-card absolute top-0 left-1/2 rounded overflow-hidden group"
                  aria-label={`Open ${s.title}`}
                  onClick={() => onSelectStory && onSelectStory(s)}
                  variants={{ hidden: { opacity: 0, y: 40 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } } }}
                  whileHover={isTouch ? undefined : { y: -22, scale: 1.06, zIndex: 20, transition: { duration: 0.25 } }}
                  whileTap={{ scale: 0.98 }}
                  transformTemplate={(_, generated) => `rotate(${offset * 6}deg) ${generated}`}
                  style={{
                    width: cardWidthCss,
                    aspectRatio: "2/3",
                    marginLeft: `calc(${cardWidthCss} / -2 + ${offset} * ${spacingCss})`,
                    transformOrigin: "bottom center",
                    background: s.coverArt ? undefined : `linear-gradient(160deg, ${s.accent}, #171310)`,
                    backgroundImage: s.coverArt ? `url(${s.coverArt})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    zIndex: i,
                    border: "1px solid rgba(255,255,255,0.1)",
                    boxShadow: "0 20px 50px -20px rgba(0,0,0,0.7)",
                  }}
                >
                  <div
                    className={`absolute inset-0 ${isTouch ? "opacity-100" : "opacity-70 group-hover:opacity-100 group-focus-visible:opacity-100"}`}
                    style={{
                      transition: "opacity .2s ease",
                      background: "linear-gradient(to top, rgba(10,8,6,0.92), rgba(10,8,6,0.08) 60%)",
                    }}
                  />
                  <div className="absolute left-2 right-2 bottom-2 text-left">
                    <div className="mono" style={{ fontSize: 8, color: GOLD }}>
                      {s.genre}
                    </div>
                    <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 11.5, color: PAPER, lineHeight: 1.15, marginTop: 2 }}>
                      {s.title}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        )}
        <motion.h2 variants={FADE_UP} initial="hidden" whileInView="show" viewport={{ once: true }} style={{ fontSize: "clamp(2rem,5vw,3rem)", color: PAPER }}>
          Begin your story.
        </motion.h2>
        <motion.p variants={FADE_UP} initial="hidden" whileInView="show" viewport={{ once: true }} className="mt-4" style={{ color: PAPER_DIM, fontStyle: "italic" }}>
          Seven worlds. One archive. Pick a card, or start below.
        </motion.p>
        <motion.button
          onClick={onEnter}
          variants={FADE_UP}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          whileHover={{ y: -2, boxShadow: "0 16px 36px -10px rgba(0,0,0,0.7)" }}
          whileTap={{ scale: 0.97 }}
          className="mono text-xs inline-flex items-center gap-2 mt-10 px-8 py-4 rounded-sm"
          style={{ background: PAPER, color: INK, border: "1px solid rgba(0,0,0,0.15)" }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#8B3A3A" }} />
          Open the Archive
        </motion.button>
      </section>

      <footer className="py-10 text-center text-xs" style={{ color: INK_SOFT, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        Story Archive — an interactive fiction app.
      </footer>
    </div>
  );
}
