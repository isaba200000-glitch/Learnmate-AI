import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ticket, Atom, Compass, Star, ArrowRight } from 'lucide-react';

// ————— Palette —————
const C = {
  cream: '#F3E7D3',
  paper: '#EFE0C8',
  teal: '#1F5C57',
  tealDeep: '#16433F',
  orange: '#D9622B',
  orangeDeep: '#B84A1B',
  mustard: '#E8B547',
  walnut: '#3E2D22',
  red: '#C8472B',
};

// ————— Decorative bits —————
const Starburst = ({ size = 120, color = C.mustard, spokes = 16, className = '', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={style}>
    {Array.from({ length: spokes }).map((_, i) => {
      const a = (i / spokes) * Math.PI * 2;
      const long = i % 2 === 0 ? 48 : 30;
      return (
        <line key={i} x1={50} y1={50} x2={50 + Math.cos(a) * long} y2={50 + Math.sin(a) * long}
          stroke={color} strokeWidth={i % 2 === 0 ? 2.5 : 1.5} strokeLinecap="round" />
      );
    })}
    <circle cx={50} cy={50} r={6} fill={color} />
  </svg>
);

const AtomOrbits = ({ size = 220, color = C.cream }) => (
  <svg width={size} height={size} viewBox="0 0 200 200">
    {[0, 60, 120].map((r) => (
      <ellipse key={r} cx={100} cy={100} rx={88} ry={34} fill="none" stroke={color} strokeWidth={2.5}
        transform={`rotate(${r} 100 100)`} />
    ))}
    <circle cx={100} cy={100} r={11} fill={C.mustard} />
    <circle cx={188} cy={100} r={6} fill={color} />
    <circle cx={56} cy={158} r={6} fill={C.mustard} />
    <circle cx={56} cy={42} r={6} fill={color} />
  </svg>
);

const Boomerang = ({ size = 200, color = C.cream, flip = false }) => (
  <svg width={size} height={size * 0.6} viewBox="0 0 200 120" style={{ transform: flip ? 'scaleX(-1)' : 'none' }}>
    <path d="M10 110 C 40 20, 90 10, 190 14 C 110 30, 70 60, 46 112 Z" fill={color} />
    <circle cx={170} cy={20} r={5} fill={C.mustard} />
    <circle cx={30} cy={100} r={5} fill={C.mustard} />
  </svg>
);

// ————— Data —————
const SPECS = [
  { feature: 'Async constellation boards', orbit: 'Unlimited orbital lanes', nomad: '12 expedition tracks', win: 'orbit' },
  { feature: 'Time-zone autopilot', orbit: 'Predictive — schedules itself', nomad: 'Manual sundial mode', win: 'orbit' },
  { feature: 'Holo-standups', orbit: '4K presence capsules', nomad: 'Audio postcards only', win: 'orbit' },
  { feature: 'Offline desert mode', orbit: 'Cache up to 14 days', nomad: 'Infinite — built for the dunes', win: 'nomad' },
  { feature: 'Coworking passport', orbit: '180 partner lounges', nomad: '420 outposts, 6 continents', win: 'nomad' },
  { feature: 'Focus-ray blocking', orbit: 'Atomic Do-Not-Disturb', nomad: 'Campfire quiet hours', win: 'orbit' },
  { feature: 'Price per crew member', orbit: '$18 / lunar month', nomad: '$11 / lunar month', win: 'nomad' },
];

const views = ['feature', 'specs', 'verdict'];
const viewLabels = { feature: 'The Feature', specs: 'Spec Sheet', verdict: 'The Verdict' };

// ————— Transition presets —————
const pageVariants = {
  initial: { opacity: 0, y: 36, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -28, scale: 0.99, transition: { duration: 0.35, ease: [0.55, 0, 0.55, 0.2] } },
};

export default function App() {
  const [view, setView] = useState('feature');

  return (
    <div className="min-h-screen w-full" style={{ background: C.walnut }}>
      <link href="https://fonts.googleapis.com/css2?family=Alfa+Slab+One&family=Yellowtail&family=Jost:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: `
        .slab { font-family: 'Alfa Slab One', serif; }
        .script { font-family: 'Yellowtail', cursive; }
        .body-font { font-family: 'Jost', sans-serif; }
        .grain::after {
          content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .35; mix-blend-mode: multiply;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.18'/%3E%3C/svg%3E");
        }
        @keyframes spinSlow { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
        .spin-slow { animation: spinSlow 40s linear infinite; }
        @keyframes drift { 0%,100% { transform: translateY(0);} 50% { transform: translateY(-10px);} }
        .drift { animation: drift 6s ease-in-out infinite; }
        .ticket-notch { clip-path: polygon(0 0, 100% 0, 100% 38%, 96% 50%, 100% 62%, 100% 100%, 0 100%, 0 62%, 4% 50%, 0 38%); }
        ::selection { background: ${C.mustard}; color: ${C.walnut}; }
      `}} />

      {/* Wood frame around the poster */}
      <div className="body-font mx-auto max-w-[1100px] px-4 py-8 md:py-12">
        <div className="relative shadow-[0_30px_80px_rgba(0,0,0,0.55)]" style={{ background: C.cream, border: `10px solid #5A4232`, outline: `3px solid ${C.mustard}`, outlineOffset: '-16px' }}>
          <div className="grain relative overflow-hidden">

            {/* ——— Top marquee ——— */}
            <header className="relative px-6 md:px-12 pt-10 pb-6 text-center" style={{ color: C.walnut }}>
              <div className="flex items-center justify-center gap-3 text-[11px] md:text-xs tracking-[0.45em] font-semibold uppercase">
                <span className="h-px w-10 md:w-24" style={{ background: C.walnut }} />
                Tomorrow Pictures presents · In Glorious WorkColor
                <span className="h-px w-10 md:w-24" style={{ background: C.walnut }} />
              </div>
              <h1 className="slab mt-4 text-3xl md:text-5xl leading-tight" style={{ color: C.teal }}>
                THE GREAT WORKSPACE
              </h1>
              <div className="slab text-4xl md:text-7xl leading-none mt-1" style={{ color: C.red }}>
                SHOWDOWN
              </div>
              <p className="script text-2xl md:text-4xl mt-3" style={{ color: C.orange }}>
                a spectacular double feature for the office of tomorrow
              </p>
            </header>

            {/* ——— Ticket tabs ——— */}
            <nav className="relative z-10 flex justify-center gap-3 md:gap-5 px-4 pb-2">
              {views.map((v) => {
                const active = v === view;
                return (
                  <button key={v} onClick={() => setView(v)}
                    className="ticket-notch relative px-5 md:px-8 py-2.5 text-[11px] md:text-sm font-bold uppercase tracking-[0.18em] transition-all duration-300"
                    style={{
                      background: active ? C.red : C.paper,
                      color: active ? C.cream : C.walnut,
                      border: `2px dashed ${active ? C.cream : C.walnut}`,
                      transform: active ? 'translateY(-3px) rotate(-1deg)' : 'rotate(0deg)',
                      boxShadow: active ? '0 8px 20px rgba(200,71,43,0.35)' : 'none',
                    }}>
                    <span className="flex items-center gap-2"><Ticket size={14} /> {viewLabels[v]}</span>
                  </button>
                );
              })}
            </nav>

            {/* ——— Animated views ——— */}
            <div className="relative min-h-[640px]">
              <AnimatePresence mode="wait">

                {/* ============ VIEW 1 : POSTER ============ */}
                {view === 'feature' && (
                  <motion.section key="feature" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="px-6 md:px-12 py-8">
                    <div className="relative grid md:grid-cols-2 gap-0 overflow-hidden rounded-t-[140px] md:rounded-t-[200px]" style={{ border: `4px solid ${C.walnut}` }}>

                      {/* Orbitdesk side */}
                      <div className="relative flex flex-col items-center px-8 pt-14 pb-12 text-center" style={{ background: C.teal, color: C.cream }}>
                        <div className="spin-slow"><AtomOrbits size={200} /></div>
                        <p className="mt-6 text-[10px] tracking-[0.5em] uppercase font-semibold" style={{ color: C.mustard }}>Starring</p>
                        <h2 className="slab text-4xl md:text-5xl mt-1">ORBITDESK</h2>
                        <p className="script text-2xl mt-2" style={{ color: C.mustard }}>the coworking cloud of the space age</p>
                        <p className="mt-4 max-w-xs text-sm leading-relaxed opacity-90">
                          One command deck for every async crew. Holo-standups, predictive time-zone autopilot, and focus rays that bend distraction itself.
                        </p>
                        <div className="mt-6 flex items-center gap-2 text-xs font-bold tracking-[0.2em] uppercase">
                          <Atom size={16} color={C.mustard} /> For mission-control teams
                        </div>
                      </div>

                      {/* Nomad side */}
                      <div className="relative flex flex-col items-center px-8 pt-14 pb-12 text-center" style={{ background: C.orange, color: C.cream }}>
                        <div className="drift relative">
                          <Boomerang size={210} color={C.cream} />
                          <Boomerang size={150} color={C.tealDeep} flip />
                        </div>
                        <p className="mt-6 text-[10px] tracking-[0.5em] uppercase font-semibold" style={{ color: C.walnut }}>Co-starring</p>
                        <h2 className="slab text-4xl md:text-5xl mt-1">NOMAD ATLAS</h2>
                        <p className="script text-2xl mt-2" style={{ color: C.cream }}>work from anywhere the jet stream takes you</p>
                        <p className="mt-4 max-w-xs text-sm leading-relaxed opacity-95">
                          A passport to 420 coworking outposts, infinite offline desert mode, and campfire quiet hours for the wandering professional.
                        </p>
                        <div className="mt-6 flex items-center gap-2 text-xs font-bold tracking-[0.2em] uppercase" style={{ color: C.walnut }}>
                          <Compass size={16} /> For roaming free agents
                        </div>
                      </div>

                      {/* VS burst */}
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                        <div className="relative flex items-center justify-center">
                          <Starburst size={170} color={C.mustard} spokes={20} className="spin-slow" />
                          <div className="absolute flex h-20 w-20 items-center justify-center rounded-full" style={{ background: C.red, border: `4px solid ${C.cream}`, boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
                            <span className="script text-4xl" style={{ color: C.cream }}>vs</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Credit block */}
                    <div className="mt-8 text-center" style={{ color: C.walnut }}>
                      <p className="text-[10px] md:text-xs uppercase tracking-[0.3em] leading-relaxed font-medium opacity-80">
                        Directed by The Distributed Future · Produced by Asynchronous Studios · Featuring 14 Time Zones in a single take<br />
                        Music by The Notification Quartet · Costumes by Comfortable Knitwear · Filmed entirely on location, everywhere
                      </p>
                      <button onClick={() => setView('specs')} className="group mt-6 inline-flex items-center gap-2 px-7 py-3 text-sm font-bold uppercase tracking-[0.2em] transition-transform duration-300 hover:-translate-y-0.5"
                        style={{ background: C.teal, color: C.cream, borderRadius: '999px 12px 999px 12px', boxShadow: `4px 4px 0 ${C.mustard}` }}>
                        Compare the contenders <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                      </button>
                    </div>
                  </motion.section>
                )}

                {/* ============ VIEW 2 : SPEC SHEET ============ */}
                {view === 'specs' && (
                  <motion.section key="specs" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="px-6 md:px-14 py-10">
                    <div className="text-center" style={{ color: C.walnut }}>
                      <p className="script text-3xl" style={{ color: C.orange }}>tale of the tape</p>
                      <h2 className="slab text-3xl md:text-4xl mt-1" style={{ color: C.teal }}>OFFICIAL SPECIFICATION CARD</h2>
                    </div>

                    <div className="mt-8 overflow-hidden rounded-2xl" style={{ border: `3px solid ${C.walnut}` }}>
                      {/* Header row */}
                      <div className="grid grid-cols-[1.2fr_1fr_1fr] text-center text-xs md:text-sm font-bold uppercase tracking-[0.15em]" style={{ background: C.walnut, color: C.cream }}>
                        <div className="px-4 py-4 text-left">Capability</div>
                        <div className="px-4 py-4" style={{ background: C.teal }}>Orbitdesk</div>
                        <div className="px-4 py-4" style={{ background: C.orange }}>Nomad Atlas</div>
                      </div>
                      {SPECS.map((row, i) => (
                        <motion.div key={row.feature}
                          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.15 + i * 0.07, duration: 0.4 }}
                          className="grid grid-cols-[1.2fr_1fr_1fr] text-sm"
                          style={{ background: i % 2 ? C.paper : C.cream, color: C.walnut, borderTop: `1px dashed ${C.walnut}55` }}>
                          <div className="px-4 py-3.5 font-semibold">{row.feature}</div>
                          <div className="relative px-4 py-3.5 text-center">
                            {row.win === 'orbit' && <Starburst size={26} color={C.teal} spokes={12} className="absolute left-2 top-1/2 -translate-y-1/2" />}
                            <span className={row.win === 'orbit' ? 'font-bold' : 'opacity-75'}>{row.orbit}</span>
                          </div>
                          <div className="relative px-4 py-3.5 text-center">
                            {row.win === 'nomad' && <Starburst size={26} color={C.orange} spokes={12} className="absolute left-2 top-1/2 -translate-y-1/2" />}
                            <span className={row.win === 'nomad' ? 'font-bold' : 'opacity-75'}>{row.nomad}</span>
                          </div>
                        </motion.div>
                      ))}
                      {/* Tally */}
                      <div className="grid grid-cols-[1.2fr_1fr_1fr] text-center font-bold uppercase tracking-[0.15em] text-xs md:text-sm" style={{ background: C.mustard, color: C.walnut, borderTop: `3px solid ${C.walnut}` }}>
                        <div className="px-4 py-4 text-left">Round score</div>
                        <div className="px-4 py-4">4 categories</div>
                        <div className="px-4 py-4">3 categories</div>
                      </div>
                    </div>

                    <div className="mt-8 text-center">
                      <button onClick={() => setView('verdict')} className="group inline-flex items-center gap-2 px-7 py-3 text-sm font-bold uppercase tracking-[0.2em] transition-transform duration-300 hover:-translate-y-0.5"
                        style={{ background: C.red, color: C.cream, borderRadius: '12px 999px 12px 999px', boxShadow: `4px 4px 0 ${C.teal}` }}>
                        Roll the verdict <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                      </button>
                    </div>
                  </motion.section>
                )}

                {/* ============ VIEW 3 : VERDICT ============ */}
                {view === 'verdict' && (
                  <motion.section key="verdict" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="relative px-6 md:px-14 py-12">
                    <Starburst size={140} color={`${C.mustard}66`} className="absolute -left-6 top-8 spin-slow" />
                    <Starburst size={110} color={`${C.teal}40`} className="absolute right-2 bottom-10 spin-slow" />

                    <div className="relative mx-auto max-w-3xl text-center" style={{ color: C.walnut }}>
                      <p className="script text-3xl" style={{ color: C.orange }}>the critics agree</p>
                      <h2 className="slab text-4xl md:text-6xl mt-2 leading-tight" style={{ color: C.teal }}>
                        TWO FUTURES.<br />ONE GLORIOUS WORKWEEK.
                      </h2>

                      <div className="mt-8 grid gap-6 md:grid-cols-2 text-left">
                        <div className="relative p-7" style={{ background: C.teal, color: C.cream, borderRadius: '90px 18px 18px 18px' }}>
                          <div className="flex gap-1">{[...Array(5)].map((_, i) => <Star key={i} size={18} fill={C.mustard} color={C.mustard} />)}</div>
                          <h3 className="slab text-2xl mt-3">Choose ORBITDESK</h3>
                          <p className="mt-2 text-sm leading-relaxed opacity-90">
                            …if your team is a mission-control room scattered across the globe. The autopilot scheduling alone saves crews 6 hours a week — and the holo-standups feel like the future kept its promise.
                          </p>
                          <p className="script text-xl mt-4" style={{ color: C.mustard }}>"Async, the way the World's Fair imagined it."</p>
                        </div>
                        <div className="relative p-7" style={{ background: C.orange, color: C.cream, borderRadius: '18px 90px 18px 18px' }}>
                          <div className="flex gap-1">{[...Array(4)].map((_, i) => <Star key={i} size={18} fill={C.cream} color={C.cream} />)}<Star size={18} color={C.cream} /></div>
                          <h3 className="slab text-2xl mt-3">Choose NOMAD ATLAS</h3>
                          <p className="mt-2 text-sm leading-relaxed">
                            …if your office is wherever the boarding pass says. Unmatched offline mode, the largest coworking passport on Earth, and a price that leaves room for the window seat.
                          </p>
                          <p className="script text-xl mt-4" style={{ color: C.walnut }}>"Freedom, beautifully engineered."</p>
                        </div>
                      </div>

                      <div className="mt-10 inline-block px-8 py-4" style={{ background: C.walnut, color: C.cream, borderRadius: '999px' }}>
                        <p className="text-[11px] uppercase tracking-[0.4em] font-semibold" style={{ color: C.mustard }}>Now showing</p>
                        <p className="slab text-xl md:text-2xl mt-1">AT A WORKSPACE NEAR YOU — FREE 30-DAY PREMIERE</p>
                      </div>

                      <div className="mt-6">
                        <button onClick={() => setView('feature')} className="text-xs font-bold uppercase tracking-[0.25em] underline underline-offset-4 transition-opacity hover:opacity-60" style={{ color: C.teal }}>
                          ← Back to the marquee
                        </button>
                      </div>
                    </div>
                  </motion.section>
                )}
              </AnimatePresence>
            </div>

            {/* ——— Footer strip ——— */}
            <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 py-5 text-[10px] uppercase tracking-[0.35em] font-semibold" style={{ background: C.walnut, color: C.cream }}>
              <span style={{ color: C.mustard }}>★</span> Rated R-EMOTE
              <span style={{ color: C.mustard }}>★</span> Approved by the Bureau of Tomorrow
              <span style={{ color: C.mustard }}>★</span> MCMLVII — MMXXV
              <span style={{ color: C.mustard }}>★</span>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}