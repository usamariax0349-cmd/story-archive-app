import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
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

function LandingStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Newsreader:ital,wght@0,400;0,500;1,400;1,500&family=Courier+Prime:wght@400;700&display=swap');
      .sa-landing { --radius: clamp(150px, 24vw, 320px); background:${NIGHT}; color:${PAPER}; font-family:'Newsreader',serif; }
      .sa-landing h1, .sa-landing h2 { font-family:'Fraunces',serif; font-weight:700; margin:0; }
      .sa-landing .mono { font-family:'Courier Prime',monospace; letter-spacing:0.14em; text-transform:uppercase; }
      .sa-landing ::selection { background:${VIOLET}; color:${PAPER}; }
      .sa-stage { perspective:1400px; }
      .sa-ring { transform-style:preserve-3d; }
      .sa-book { position:absolute; top:50%; left:50%; width:clamp(120px,15vw,190px); aspect-ratio:2/3; transform-style:preserve-3d; }
      .sa-book-face { position:absolute; inset:0; border-radius:6px; overflow:hidden; backface-visibility:hidden; box-shadow:0 20px 45px -18px rgba(0,0,0,0.75); border:1px solid rgba(217,178,92,0.35); }
      .sa-book-back { position:absolute; inset:0; border-radius:6px; backface-visibility:hidden; transform:rotateY(180deg); box-shadow:0 20px 45px -18px rgba(0,0,0,0.75); }
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

function BookRing({ stories, containerRef }) {
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });
  const introEnd = 0.08;
  const n = stories.length;
  const totalSweep = ((n - 1) / n) * 360;

  const groupRotate = useTransform(scrollYProgress, [0, introEnd, 1], [0, 0, -totalSweep]);
  const heroOpacity = useTransform(scrollYProgress, [0, introEnd], [1, 0]);
  const hintOpacity = useTransform(scrollYProgress, [0, introEnd * 0.6], [1, 0]);
  const labelOpacity = useTransform(scrollYProgress, [introEnd * 0.75, introEnd], [0, 1]);

  const [activeIndex, setActiveIndex] = useState(-1);

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    if (p < introEnd) {
      if (activeIndex !== -1) setActiveIndex(-1);
      return;
    }
    const local = (p - introEnd) / (1 - introEnd);
    const idx = Math.min(n - 1, Math.max(0, Math.floor(local * n)));
    if (idx !== activeIndex) setActiveIndex(idx);
  });

  const activeStory = activeIndex >= 0 ? stories[activeIndex] : null;

  return (
    <div className="absolute inset-0 flex items-center justify-center sa-stage">
      <motion.div className="sa-ring relative" style={{ width: 1, height: 1, rotateY: groupRotate }}>
        {stories.map((story, i) => {
          const angle = i * (360 / n);
          return (
            <div
              key={story.id}
              className="sa-book"
              style={{ transform: `translate(-50%,-50%) rotateY(${angle}deg) translateZ(var(--radius))` }}
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
                <div style={{ position: "absolute", left: 10, right: 10, bottom: 10 }}>
                  <div className="mono" style={{ fontSize: 9, color: GOLD }}>
                    {story.genre}
                  </div>
                  <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 13, color: PAPER, lineHeight: 1.15, marginTop: 2 }}>
                    {story.title}
                  </div>
                </div>
              </div>
              <div className="sa-book-back" style={{ background: `linear-gradient(160deg, ${story.accent}, #171310)` }} />
            </div>
          );
        })}
      </motion.div>

      <motion.div
        style={{ opacity: heroOpacity }}
        className="relative z-10 text-center pointer-events-none max-w-xl px-6"
      >
        <span className="mono text-xs" style={{ color: VIOLET }}>
          Story Archive
        </span>
        <h1 className="mt-4" style={{ fontSize: "clamp(2.2rem,6vw,4.2rem)", lineHeight: 1.05, color: PAPER, textShadow: "0 4px 30px rgba(0,0,0,0.5)" }}>
          Every story <em style={{ fontStyle: "italic", color: GOLD }}>remembers</em> you.
        </h1>
        <p className="mt-5" style={{ color: PAPER_DIM, fontStyle: "italic", fontSize: "clamp(1rem,1.6vw,1.15rem)" }}>
          Pick a story, play a character, and watch a world that keeps living even when you're not looking.
        </p>
      </motion.div>

      <motion.div
        style={{ opacity: hintOpacity }}
        className="absolute bottom-9 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10"
      >
        <span className="mono text-[10px]" style={{ color: INK_SOFT }}>
          Scroll
        </span>
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          style={{ width: 1, height: 34, background: `linear-gradient(${PAPER_DIM}, transparent)` }}
        />
      </motion.div>

      <AnimatePresence mode="wait">
        {activeStory && (
          <motion.div
            key={activeStory.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            style={{ opacity: labelOpacity }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center z-10 pointer-events-none px-6"
          >
            <div className="mono text-xs" style={{ color: activeStory.accent }}>
              {activeStory.genre}
            </div>
            <h2 className="mt-3" style={{ fontSize: "clamp(1.7rem,4.2vw,2.9rem)", color: PAPER, textShadow: "0 4px 24px rgba(0,0,0,0.55)", lineHeight: 1.08 }}>
              {activeStory.title}
            </h2>
            <p className="mt-3 max-w-md mx-auto" style={{ color: PAPER_DIM, fontStyle: "italic" }}>
              {activeStory.blurb}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute right-5 top-1/2 -translate-y-1/2 z-10 hidden sm:flex flex-col gap-3">
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

function WorldDiagram({ stories }) {
  const ref = useRef(null);
  const rows = stories.slice(0, 5);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 30%"] });
  const [activeRow, setActiveRow] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (p) => {
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
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
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

export default function Landing({ stories, featuredCharacter, onEnter }) {
  const heroRef = useRef(null);

  return (
    <div className="sa-landing min-h-screen w-full">
      <LandingStyles />
      <EnterPill onEnter={onEnter} />

      <div ref={heroRef} style={{ position: "relative", height: "360vh" }}>
        <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>
          <BookRing stories={stories} containerRef={heroRef} />
        </div>
      </div>

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
        <motion.div
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.5 }}
          className="relative mx-auto mb-12"
          style={{ width: 200, height: 260 }}
        >
          {stories.map((s, i) => (
            <motion.div
              key={s.id}
              variants={{ hidden: { opacity: 0, y: 40 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } } }}
              className="absolute inset-0 rounded"
              style={{
                background: `linear-gradient(160deg, ${s.accent}, #171310)`,
                transform: `translate(${(i - 3) * 3}px, ${(i - 3) * -3}px) rotate(${(i - 3) * 2.4}deg)`,
                zIndex: i,
                border: "1px solid rgba(255,255,255,0.06)",
                boxShadow: "0 20px 50px -20px rgba(0,0,0,0.7)",
              }}
            />
          ))}
        </motion.div>
        <motion.h2 variants={FADE_UP} initial="hidden" whileInView="show" viewport={{ once: true }} style={{ fontSize: "clamp(2rem,5vw,3rem)", color: PAPER }}>
          Begin your story.
        </motion.h2>
        <motion.p variants={FADE_UP} initial="hidden" whileInView="show" viewport={{ once: true }} className="mt-4" style={{ color: PAPER_DIM, fontStyle: "italic" }}>
          Seven worlds. One archive. Your choices.
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
