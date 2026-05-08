import { useId } from 'react'
import type * as React from 'react'

export function TowerShip({ tType, color, size }: { tType: string; color: string; size: number }) {
  const s = size
  const svgId = useId().replace(/:/g, '')
  const paintGrad = `tower-paint-${svgId}`
  const hullGrad = `tower-hull-${svgId}`
  const glassGrad = `tower-glass-${svgId}`
  const engineGrad = `tower-engine-${svgId}`

  const core = color
  const hull = `url(#${hullGrad})`
  const paint = `url(#${paintGrad})`
  const glass = `url(#${glassGrad})`
  const engine = `url(#${engineGrad})`
  const dark = '#172130'
  const metal = '#617086'

  const defs = (
    <defs>
      <linearGradient id={hullGrad} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f8fbff" />
        <stop offset="55%" stopColor="#ced9e7" />
        <stop offset="100%" stopColor="#7e8ea5" />
      </linearGradient>
      <linearGradient id={paintGrad} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
        <stop offset="18%" stopColor={core} stopOpacity="0.98" />
        <stop offset="100%" stopColor={core} stopOpacity="0.4" />
      </linearGradient>
      <linearGradient id={glassGrad} x1="0" y1="0" x2="0.7" y2="1">
        <stop offset="0%" stopColor="#f8feff" />
        <stop offset="40%" stopColor="#9cecff" />
        <stop offset="100%" stopColor="#2f6f9e" />
      </linearGradient>
      <radialGradient id={engineGrad} cx="0.5" cy="0.45" r="0.7">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
        <stop offset="28%" stopColor="#b9f6ff" stopOpacity="0.95" />
        <stop offset="68%" stopColor="#4ee0ff" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#4ee0ff" stopOpacity="0" />
      </radialGradient>
    </defs>
  )

  // ── Shared reusable micro-elements ────────────────────────────────────────
  // 2-engine glow nozzles at rear
  const eng2 = <>
    <ellipse cx="26" cy="57" rx="4.5" ry="6" fill={engine} opacity="0.92" />
    <ellipse cx="38" cy="57" rx="4.5" ry="6" fill={engine} opacity="0.92" />
  </>
  // 3-engine cluster at rear
  const eng3 = <>
    <ellipse cx="23" cy="57" rx="3.8" ry="5" fill={engine} opacity="0.88" />
    <ellipse cx="32" cy="59" rx="3.5" ry="4.5" fill={engine} opacity="0.92" />
    <ellipse cx="41" cy="57" rx="3.8" ry="5" fill={engine} opacity="0.88" />
  </>

  const shapes: Record<string, React.ReactNode> = {

    // ── SCOUT: X-Wing quad interceptor ── 4 spread wings + 4 laser cannons ──
    fast: <>
      {/* Fuselage spine */}
      <path d="M30 4 L34 4 L36 15 L36 52 L32 63 L28 52 L28 15 Z" fill={hull} />
      <path d="M30.5 7 L33.5 7 L35 17 L35 48 L32 57 L29 48 L29 17 Z" fill={paint} opacity="0.9" />
      {/* Forward-port wing — swept back */}
      <path d="M30 18 L29 29 L3 22 L1 14 L9 11 Z" fill={hull} />
      {/* Forward-stbd wing */}
      <path d="M34 18 L35 29 L61 22 L63 14 L55 11 Z" fill={hull} />
      {/* Aft-port wing */}
      <path d="M28.5 33 L27 44 L2 49 L1 41 L7 37 Z" fill={hull} />
      {/* Aft-stbd wing */}
      <path d="M35.5 33 L37 44 L62 49 L63 41 L57 37 Z" fill={hull} />
      {/* Color accent stripes */}
      <path d="M8 12 L28 22" stroke={core} strokeWidth="5" strokeLinecap="butt" />
      <path d="M56 12 L36 22" stroke={core} strokeWidth="5" strokeLinecap="butt" />
      <path d="M7 42 L26 42.5" stroke={core} strokeWidth="4.5" strokeLinecap="butt" />
      <path d="M57 42 L38 42.5" stroke={core} strokeWidth="4.5" strokeLinecap="butt" />
      {/* 4 laser cannon barrels at wing tips */}
      <line x1="-1" y1="15" x2="9" y2="15" stroke={metal} strokeWidth="3.2" strokeLinecap="square" />
      <line x1="55" y1="15" x2="65" y2="15" stroke={metal} strokeWidth="3.2" strokeLinecap="square" />
      <line x1="-1" y1="41.5" x2="8" y2="41.5" stroke={metal} strokeWidth="3.2" strokeLinecap="square" />
      <line x1="56" y1="41.5" x2="65" y2="41.5" stroke={metal} strokeWidth="3.2" strokeLinecap="square" />
      {/* Cockpit canopy */}
      <path d="M30 10 C28 13 28 21 32 23 C36 21 36 13 34 10 Z" fill={glass} opacity="0.95" />
      {/* Panel seam */}
      <path d="M26 33 L32 30 L38 33" stroke="#ffffff7a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {eng2}
    </>,

    // ── RAIL GUN: SR-71 stealth delta ── ultra-long barrel + swept wings ─────
    xwing: <>
      <path d="M30 4 H34 L36 13 L35 52 L32 62 L29 52 L28 13 Z" fill={hull} />
      <path d="M30.5 7 H33.5 L34.7 15 L34 48 L32 56 L30 48 L29.3 15 Z" fill={paint} opacity="0.92" />
      <path d="M28.5 18 L25 31 L1 19 L3 11 L12 12 Z" fill={hull} />
      <path d="M35.5 18 L39 31 L63 19 L61 11 L52 12 Z" fill={hull} />
      <path d="M27.5 34 L24 47 L1 54 L3 45 L16 38 Z" fill={hull} />
      <path d="M36.5 34 L40 47 L63 54 L61 45 L48 38 Z" fill={hull} />
      <path d="M7 14 L27 23" stroke={core} strokeWidth="5.2" strokeLinecap="square" />
      <path d="M57 14 L37 23" stroke={core} strokeWidth="5.2" strokeLinecap="square" />
      <path d="M7 49 L26 42" stroke={core} strokeWidth="5.2" strokeLinecap="square" />
      <path d="M57 49 L38 42" stroke={core} strokeWidth="5.2" strokeLinecap="square" />
      <line x1="-1" y1="12" x2="11" y2="14" stroke={metal} strokeWidth="3.2" strokeLinecap="square" />
      <line x1="65" y1="12" x2="53" y2="14" stroke={metal} strokeWidth="3.2" strokeLinecap="square" />
      <line x1="-1" y1="55" x2="12" y2="51" stroke={metal} strokeWidth="3.2" strokeLinecap="square" />
      <line x1="65" y1="55" x2="52" y2="51" stroke={metal} strokeWidth="3.2" strokeLinecap="square" />
      <path d="M29 10 C28 15 28.4 23 32 25 C35.6 23 36 15 35 10 Z" fill={glass} opacity="0.95" />
      <path d="M25 28 L32 24 L39 28" stroke="#ffffff7a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <ellipse cx="27" cy="57" rx="4" ry="5.6" fill={engine} opacity="0.9" />
      <ellipse cx="37" cy="57" rx="4" ry="5.6" fill={engine} opacity="0.9" />
    </>,

    sniper: <>
      {/* Narrow spine hull */}
      <path d="M32 4 L38 9 L42 20 L46 34 L42 59 L22 59 L18 34 L22 20 L26 9 Z" fill={hull} />
      <path d="M32 7 L37 11 L40 21 L43 33 L39 54 L25 54 L21 33 L24 21 L27 11 Z" fill={paint} opacity="0.92" />
      {/* Ultra-long barrel pair extending past nose */}
      <rect x="30.5" y="-5" width="2.5" height="22" rx="1.2" fill={dark} />
      <rect x="31" y="-4" width="2" height="21" rx="1" fill="#9bb0c5" opacity="0.75" />
      {/* Swept-back delta wings — sharply angled */}
      <path d="M27 21 L21 13 L2 45 L4 52 L17 49 L26 35 Z" fill={hull} />
      <path d="M37 21 L43 13 L62 45 L60 52 L47 49 L38 35 Z" fill={hull} />
      {/* Wing color bar near fuselage */}
      <path d="M6 48 L18 40 L25 40" stroke={core} strokeWidth="4.5" strokeLinecap="square" />
      <path d="M58 48 L46 40 L39 40" stroke={core} strokeWidth="4.5" strokeLinecap="square" />
      {/* Scope block on barrel */}
      <rect x="28" y="10" width="8" height="6" rx="1.5" fill={dark} />
      <rect x="29.5" y="11" width="5" height="4" rx="1" fill="#9bb0c5" opacity="0.65" />
      {/* Cockpit */}
      <path d="M30.5 13 L29 16 L29 22 L32 23.5 L35 22 L35 16 L33.5 13 Z" fill={glass} />
      {eng3}
    </>,

    // ── BOMBER: Rocket-style strike craft ── pointed hull + hard wing pods ──
    aoe: <>
      {/* Pointed center fuselage, similar language to Rocket */}
      <path d="M30 5 L34 5 L37 15 L38 51 L32 62 L26 51 L27 15 Z" fill={hull} />
      <path d="M30.5 8 L33.5 8 L35.5 16 L36 47 L32 56 L28 47 L28.5 16 Z" fill={paint} opacity="0.9" />
      {/* Broad swept wings */}
      <path d="M29 20 L25 45 L4 52 L2 44 L16 33 L24 26 Z" fill={hull} />
      <path d="M35 20 L39 45 L60 52 L62 44 L48 33 L40 26 Z" fill={hull} />
      {/* Twin bomb racks each side (all angular) */}
      <path d="M5 28 L12 28 L13 41 L6 45 L4 38 Z" fill={dark} />
      <path d="M14 33 L21 33 L22 45 L16 48 L13 42 Z" fill={dark} />
      <path d="M59 28 L52 28 L51 41 L58 45 L60 38 Z" fill={dark} />
      <path d="M50 33 L43 33 L42 45 L48 48 L51 42 Z" fill={dark} />
      {/* Warhead tips */}
      <path d="M6 28 L9 22 L12 28" fill={core} opacity="0.9" />
      <path d="M15 33 L18 27 L21 33" fill={core} opacity="0.82" />
      <path d="M58 28 L55 22 L52 28" fill={core} opacity="0.9" />
      <path d="M49 33 L46 27 L43 33" fill={core} opacity="0.82" />
      {/* Angular bomb bay hatch */}
      <path d="M32 25 L38 31 L32 37 L26 31 Z" fill={dark} opacity="0.92" />
      <path d="M32 27 L35.5 31 L32 35 L28.5 31 Z" fill="#fff8b0" opacity="0.9" />
      {/* Spine panel */}
      <path d="M29 30 L32 28 L35 30 L35 44 L32 47 L29 44 Z" fill="#ffffff24" />
      {eng2}
    </>,

    // ── CRYO: Sharp arrowhead fighter ── angular ice prism, swept wings ──────
    slow: <>
      {/* Sharp arrowhead fuselage — no blobs */}
      <path d="M32 5 L40 12 L44 24 L42 50 L36 60 L28 60 L22 50 L20 24 L24 12 Z" fill={hull} />
      <path d="M32 8 L38 14 L41 24 L39 46 L35 55 L29 55 L25 46 L23 24 L26 14 Z" fill={paint} opacity="0.9" />
      {/* Swept cryo wings */}
      <path d="M23 24 L18 16 L1 34 L3 42 L21 38 L24 30 Z" fill={hull} />
      <path d="M41 24 L46 16 L63 34 L61 42 L43 38 L40 30 Z" fill={hull} />
      {/* Wing color accent */}
      <path d="M4 39 L18 32 L23 32" stroke={core} strokeWidth="4" strokeLinecap="square" />
      <path d="M60 39 L46 32 L41 32" stroke={core} strokeWidth="4" strokeLinecap="square" />
      {/* Forward ice prism emitter — sharp diamond, NO circles */}
      <path d="M32 5 L37 14 L32 21 L27 14 Z" fill="#d8fbff" opacity="0.92" />
      <path d="M32 8 L35 14 L32 19 L29 14 Z" fill="#ffffff" opacity="0.95" />
      {/* Ice beam spine down fuselage */}
      <line x1="32" y1="21" x2="32" y2="44" stroke="#a8f5ff" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      {/* Ice exhaust jets */}
      <path d="M23 49 L18 59" stroke="#a8f5ffcc" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M41 49 L46 59" stroke="#a8f5ffcc" strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="26" cy="57" rx="4" ry="5.5" fill={engine} opacity="0.88" />
      <ellipse cx="38" cy="57" rx="4" ry="5.5" fill={engine} opacity="0.88" />
    </>,

    // ── CANNON: Heavy gunship ── swept attack wings + massive triple cannon ──
    burst: <>
      {/* Central armored fuselage */}
      <path d="M26 8 H38 L43 16 L44 44 L38 60 H26 L20 44 L21 16 Z" fill={hull} />
      <path d="M28 11 H36 L40 18 L41 41 L36 55 H28 L24 41 L23 18 Z" fill={paint} opacity="0.9" />
      {/* Triple-barrel forward cannon */}
      <rect x="27.5" y="-5" width="9" height="24" rx="3" fill={dark} />
      <rect x="28.5" y="-4" width="7" height="22" rx="2.5" fill="#8797a9" opacity="0.84" />
      <rect x="30" y="-2" width="4" height="20" rx="2" fill="#c4cedb" opacity="0.72" />
      {/* Wide swept attack wings — proper fighter wings */}
      <path d="M22 17 L18 10 L1 31 L3 42 L22 37 L24 27 Z" fill={hull} />
      <path d="M42 17 L46 10 L63 31 L61 42 L42 37 L40 27 Z" fill={hull} />
      {/* Wing weapon hardpoints */}
      <path d="M3 31 L16 28 L20 35 L4 39 Z" fill={dark} />
      <path d="M61 31 L48 28 L44 35 L60 39 Z" fill={dark} />
      <rect x="3" y="31" width="13" height="5" rx="1.5" fill={core} opacity="0.82" />
      <rect x="48" y="31" width="13" height="5" rx="1.5" fill={core} opacity="0.82" />
      {/* Wing color accent */}
      <path d="M4 38 L18 33 L22 33" stroke={core} strokeWidth="4" strokeLinecap="square" />
      <path d="M60 38 L46 33 L42 33" stroke={core} strokeWidth="4" strokeLinecap="square" />
      {/* Cockpit slit */}
      <path d="M27 13 H37 L38.5 15 V20 L37 21.5 H27 L25.5 20 V15 Z" fill={glass} opacity="0.88" />
      {eng3}
    </>,

    // ── GATLING: Assault striker ── rocket-like frame + 6 forward barrels ───
    gatling: <>
      {/* Rocket-like center hull with pointed nose */}
      <path d="M29 4 L35 4 L38 15 L39 50 L32 62 L25 50 L26 15 Z" fill={hull} />
      <path d="M29.5 7 L34.5 7 L36.5 16 L37 46 L32 56 L27 46 L27.5 16 Z" fill={paint} opacity="0.9" />
      {/* Heavy swept wings with hard edges */}
      <path d="M28 20 L24 43 L5 50 L2 42 L15 33 L23 26 Z" fill={hull} />
      <path d="M36 20 L40 43 L59 50 L62 42 L49 33 L41 26 Z" fill={hull} />
      {/* Side weapon sponsons */}
      <path d="M6 29 L14 29 L15 41 L8 45 L5 39 Z" fill={dark} />
      <path d="M58 29 L50 29 L49 41 L56 45 L59 39 Z" fill={dark} />
      {/* 6 gatling barrels in a broad rack */}
      <rect x="18" y="-6" width="3" height="20" fill={dark} />
      <rect x="22" y="-7" width="3" height="22" fill="#9bb0c5" />
      <rect x="26" y="-6" width="3" height="20" fill={dark} />
      <rect x="35" y="-6" width="3" height="20" fill={dark} />
      <rect x="39" y="-7" width="3" height="22" fill="#9bb0c5" />
      <rect x="43" y="-6" width="3" height="20" fill={dark} />
      {/* Barrel rack braces */}
      <rect x="17" y="4" width="30" height="4" fill={metal} opacity="0.82" />
      <rect x="17" y="10" width="30" height="3" fill={metal} opacity="0.62" />
      {/* Spine accents */}
      <path d="M29 31 L32 29 L35 31 L35 45 L32 48 L29 45 Z" fill="#ffffff24" />
      <path d="M8 44 L22 37" stroke={core} strokeWidth="4.5" strokeLinecap="square" />
      <path d="M56 44 L42 37" stroke={core} strokeWidth="4.5" strokeLinecap="square" />
      {eng3}
    </>,

    // ── ROCKET: Swept missile destroyer ── 4 visible pods + warhead tips ────
    rocket: <>
      {/* Central fuselage */}
      <path d="M30 5 L34 5 L36 14 L37 52 L32 62 L27 52 L28 14 Z" fill={hull} />
      <path d="M30.5 8 L33.5 8 L35 15 L35.5 48 L32 56 L28.5 48 L29 15 Z" fill={paint} opacity="0.9" />
      {/* Wide swept wings */}
      <path d="M30 21 L28 46 L5 51 L2 43 L18 33 L27 25 Z" fill={hull} />
      <path d="M34 21 L36 46 L59 51 L62 43 L46 33 L37 25 Z" fill={hull} />
      {/* 4 missile pods (angular, NOT circles) */}
      <path d="M4 27 L13 27 L13 46 L6 46 L3 38 Z" fill={dark} />
      <path d="M15 32 L23 32 L23 48 L17 48 L14 41 Z" fill={dark} />
      <path d="M51 27 L60 27 L61 38 L58 46 L51 46 Z" fill={dark} />
      <path d="M41 32 L49 32 L50 41 L47 48 L41 48 Z" fill={dark} />
      {/* Missile warhead tips */}
      <path d="M6 27 L8.5 21 L11 27" fill={core} opacity="0.92" />
      <path d="M17 32 L19.5 26 L22 32" fill={core} opacity="0.82" />
      <path d="M53 27 L56 21 L59 27" fill={core} opacity="0.92" />
      <path d="M43 32 L45.5 26 L48 32" fill={core} opacity="0.82" />
      {/* Nose cannon */}
      <rect x="30" y="1" width="4" height="16" rx="2" fill="#9bb0c5" />
      {/* Cockpit */}
      <path d="M29.5 9 L29 11 L29 20 L32 22 L35 20 L35 11 L34.5 9 Z" fill={glass} />
      {eng2}
    </>,

    // ── LASER: Kite/diamond hull ── angular prism emitter, swept fins ────────
    laser: <>
      {/* Diamond kite hull */}
      <path d="M32 4 L44 15 L47 30 L42 50 L32 62 L22 50 L17 30 L20 15 Z" fill={hull} />
      <path d="M32 7 L41 16 L44 29 L39 46 L32 55 L25 46 L20 29 L23 16 Z" fill={paint} opacity="0.9" />
      {/* Long swept-back wing fins */}
      <path d="M22 17 L4 48 L8 55 L22 45 L26 32 Z" fill={hull} />
      <path d="M42 17 L60 48 L56 55 L42 45 L38 32 Z" fill={hull} />
      {/* Wing accent */}
      <path d="M7 51 L20 41 L24 41" stroke={core} strokeWidth="3.5" strokeLinecap="square" />
      <path d="M57 51 L44 41 L40 41" stroke={core} strokeWidth="3.5" strokeLinecap="square" />
      {/* Angular prism emitter at nose tip — NO circles */}
      <path d="M32 4 L37 11 L34 14 L30 14 L27 11 Z" fill="#c8f6ff" opacity="0.96" />
      <path d="M32 6 L35.5 11 L33.5 13 L30.5 13 L28.5 11 Z" fill="#ffffff" opacity="0.9" />
      {/* Energy beam spine */}
      <line x1="32" y1="14" x2="32" y2="24" stroke="#a0f4ff" strokeWidth="3.2" strokeLinecap="round" opacity="0.9" />
      <line x1="32" y1="24" x2="32" y2="44" stroke="#a0f4ff" strokeWidth="1.6" strokeLinecap="round" opacity="0.4" />
      {/* Wing fin exhaust tips */}
      <path d="M10 53 L5 61" stroke={core} strokeWidth="3" strokeLinecap="round" />
      <path d="M54 53 L59 61" stroke={core} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="26" cy="58" rx="4.5" ry="5.5" fill={engine} opacity="0.9" />
      <ellipse cx="38" cy="58" rx="4.5" ry="5.5" fill={engine} opacity="0.9" />
    </>,

    // ── ORBITAL: Triple-missile cruiser ── rocket body + 3 launch rails ─────
    artillery: <>
      {/* Rocket-like capital hull with pointed nose */}
      <path d="M30 4 L34 4 L40 14 L43 30 L40 49 L34 62 L30 62 L24 49 L21 30 L24 14 Z" fill={hull} />
      <path d="M30.5 7 L33.5 7 L38 16 L40 30 L37.5 46 L33.5 56 L30.5 56 L26.5 46 L24 30 L26 16 Z" fill={paint} opacity="0.88" />
      {/* Large support wings like Rocket class */}
      <path d="M25 22 L21 44 L4 50 L2 42 L15 33 L20 27 Z" fill={hull} />
      <path d="M39 22 L43 44 L60 50 L62 42 L49 33 L44 27 Z" fill={hull} />
      {/* 3 launch rails / silos across center */}
      <path d="M14 21 L22 21 L22 45 L14 45 Z" fill={dark} />
      <path d="M28 17 L36 17 L36 46 L28 46 Z" fill={dark} />
      <path d="M42 21 L50 21 L50 45 L42 45 Z" fill={dark} />
      {/* 3 rocket warheads */}
      <path d="M14 21 L18 13 L22 21" fill={core} opacity="0.9" />
      <path d="M28 17 L32 8 L36 17" fill={core} opacity="0.98" />
      <path d="M42 21 L46 13 L50 21" fill={core} opacity="0.9" />
      {/* Rail separators */}
      <line x1="24" y1="20" x2="24" y2="46" stroke="#ffffff3d" strokeWidth="1.4" />
      <line x1="40" y1="20" x2="40" y2="46" stroke="#ffffff3d" strokeWidth="1.4" />
      {/* Targeting chevron */}
      <path d="M32 48 L36 52 L32 56 L28 52 Z" fill="#fff5bc" opacity="0.8" />
      <path d="M26 52 L32 49 L38 52" stroke="#ffffff9a" strokeWidth="1.5" fill="none" />
      {eng3}
    </>,

    // DREADNOUGHT: Broad armored battleship inspired by a side-profile capital ship.
    dreadnought: <>
      <path d="M11 54 L8 44 L11 29 L15 18 L24 8 L32 2 L40 8 L49 18 L53 29 L56 44 L53 54 L42 61 H22 Z" fill="#161d27" />
      <path d="M17 51 L14 42 L17 30 L21 21 L27 12 L32 7 L37 12 L43 21 L47 30 L50 42 L47 51 L39 56 H25 Z" fill="#303b49" />
      <path d="M21 11 L32 0 L43 11 L39 21 L34 18 L34 42 H30 L30 18 L25 21 Z" fill="#222b36" />
      <path d="M6 39 L0 28 L5 19 L20 24 L18 42 Z" fill="#263240" />
      <path d="M58 39 L64 28 L59 19 L44 24 L46 42 Z" fill="#263240" />
      <path d="M8 46 L21 42 L24 51 L15 58 Z" fill="#1f2935" />
      <path d="M56 46 L43 42 L40 51 L49 58 Z" fill="#1f2935" />
      <rect x="25" y="20" width="14" height="26" rx="3" fill="#111827" opacity="0.95" />
      <rect x="28" y="15" width="8" height="37" rx="2" fill="#6f7c8c" opacity="0.55" />
      <rect x="12" y="31" width="16" height="5" rx="1.5" fill="#0b111a" />
      <rect x="36" y="31" width="16" height="5" rx="1.5" fill="#0b111a" />
      <rect x="14" y="27" width="13" height="2.5" fill="#8b98a8" opacity="0.72" />
      <rect x="37" y="27" width="13" height="2.5" fill="#8b98a8" opacity="0.72" />
      <path d="M24 14 H40 L38 20 H26 Z" fill="#9aa7b7" opacity="0.65" />
      <path d="M20 24 H27 V28 H20 Z M37 24 H44 V28 H37 Z M18 38 H25 V42 H18 Z M39 38 H46 V42 H39 Z" fill="#748293" opacity="0.72" />
      <path d="M31 8 H33 V47 H31 Z" fill={core} opacity="0.78" />
      <path d="M18 50 H46 L41 59 H23 Z" fill="#111827" />
      <ellipse cx="22" cy="59" rx="5" ry="4.5" fill={engine} opacity="0.9" />
      <ellipse cx="32" cy="61" rx="5" ry="4.8" fill={engine} opacity="0.95" />
      <ellipse cx="42" cy="59" rx="5" ry="4.5" fill={engine} opacity="0.9" />
    </>,
  }

  return (
    <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 4px 10px #000a)' }}>
      {defs}
      {shapes[tType] ?? shapes.fast}
    </svg>
  )
}

export function AlienShip({ variant, isBoss, isFinalBoss, bossKind, color, size }: { variant: number; isBoss: boolean; isFinalBoss: boolean; bossKind?: string; color: string; size: number }) {
  const s = Math.max(8, size)
  const svgId = useId().replace(/:/g, '')
  const shellGrad = `alien-shell-${svgId}`
  const paintGrad = `alien-paint-${svgId}`
  const eyeGrad = `alien-eye-${svgId}`
  const c = color
  const shell = `url(#${shellGrad})`
  const paint = `url(#${paintGrad})`
  const eye = `url(#${eyeGrad})`
  const dark = '#0e0817'
  const spine = '#2c173a'

  const defs = (
    <defs>
      <linearGradient id={shellGrad} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#5a2e72" />
        <stop offset="55%" stopColor="#2a1040" />
        <stop offset="100%" stopColor="#100818" />
      </linearGradient>
      <linearGradient id={paintGrad} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffe6f8" stopOpacity="0.88" />
        <stop offset="18%" stopColor={c} stopOpacity="0.98" />
        <stop offset="100%" stopColor={c} stopOpacity="0.38" />
      </linearGradient>
      <radialGradient id={eyeGrad} cx="0.5" cy="0.42" r="0.72">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="28%" stopColor="#fffacd" />
        <stop offset="62%" stopColor="#7ef5ff" />
        <stop offset="100%" stopColor="#7ef5ff" stopOpacity="0" />
      </radialGradient>
    </defs>
  )

  // ── FINAL BOSS: Biomechanical star fortress ──────────────────────────────
  if (isFinalBoss) {
    return (
      <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 6px 16px #000a)' }}>
        {defs}
        {/* Outer star-fortress hull — 8 spiked points */}
        <path d="M32 2 L38 12 L50 8 L46 20 L60 22 L52 31 L60 40 L46 42 L50 54 L38 50 L32 62 L26 50 L14 54 L18 42 L4 40 L12 31 L4 22 L18 20 L14 8 L26 12 Z" fill={shell} />
        {/* Inner armored hull */}
        <path d="M32 8 L36 15 L46 12 L43 21 L52 23 L46 30 L52 37 L43 39 L46 48 L36 45 L32 52 L28 45 L18 48 L21 39 L12 37 L18 30 L12 23 L21 21 L18 12 L28 15 Z" fill={paint} opacity="0.82" />
        {/* Spike weapon tips (8 points) */}
        <circle cx="32" cy="3" r="2.8" fill={c} opacity="0.96" />
        <circle cx="60" cy="22" r="2.8" fill={c} opacity="0.92" />
        <circle cx="60" cy="40" r="2.8" fill={c} opacity="0.92" />
        <circle cx="32" cy="61" r="2.8" fill={c} opacity="0.96" />
        <circle cx="4" cy="40" r="2.8" fill={c} opacity="0.92" />
        <circle cx="4" cy="22" r="2.8" fill={c} opacity="0.92" />
        <circle cx="50" cy="9" r="2.2" fill={c} opacity="0.78" />
        <circle cx="14" cy="9" r="2.2" fill={c} opacity="0.78" />
        {/* Central power core (massive) */}
        <circle cx="32" cy="32" r="14" fill={dark} />
        <circle cx="32" cy="32" r="10" fill="#0a0516" />
        <circle cx="32" cy="32" r="7" fill={eye} opacity="0.78" />
        <circle cx="32" cy="32" r="4" fill="#fffde0" opacity="0.96" />
        <circle cx="32" cy="32" r="2" fill="#ffffff" />
        {/* Weapon ring details */}
        <path d="M20 20 L32 16 L44 20" stroke="#ffffff66" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M20 44 L32 48 L44 44" stroke="#ffffff44" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </svg>
    )
  }

  // ── BOSS: Alien assault carrier — wide crescent + 3 gun batteries ────────
  if (isBoss) {
    if (bossKind === 'orb') {
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 6px 14px #000a)' }}>
          {defs}
          <circle cx="32" cy="32" r="25" fill={shell} />
          <circle cx="32" cy="32" r="18" fill={paint} opacity="0.82" />
          <path d="M32 3 L38 16 L32 22 L26 16 Z M61 32 L48 38 L42 32 L48 26 Z M32 61 L26 48 L32 42 L38 48 Z M3 32 L16 26 L22 32 L16 38 Z" fill={spine} />
          <circle cx="32" cy="32" r="11" fill={dark} />
          <circle cx="32" cy="32" r="7" fill={eye} opacity="0.85" />
          <circle cx="32" cy="32" r="3.5" fill="#fff" />
        </svg>
      )
    }

    if (bossKind === 'serpent') {
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 6px 14px #000a)' }}>
          {defs}
          <path d="M32 3 L43 12 L45 24 L39 31 L47 39 L44 53 L32 61 L20 53 L17 39 L25 31 L19 24 L21 12 Z" fill={shell} />
          <path d="M32 9 L39 15 L40 23 L32 29 L24 23 L25 15 Z" fill={paint} />
          <path d="M26 31 L32 27 L38 31 L41 42 L36 52 H28 L23 42 Z" fill={paint} opacity="0.78" />
          <path d="M20 18 L5 9 L8 26 L20 26 Z M44 18 L59 9 L56 26 L44 26 Z M20 44 L5 57 L10 39 L22 36 Z M44 44 L59 57 L54 39 L42 36 Z" fill={spine} />
          <ellipse cx="32" cy="22" rx="8" ry="6" fill={eye} opacity="0.78" />
          <circle cx="32" cy="22" r="3" fill="#fff" />
        </svg>
      )
    }

    if (bossKind === 'mantis') {
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 6px 14px #000a)' }}>
          {defs}
          <path d="M26 8 H38 L43 22 L40 49 L32 60 L24 49 L21 22 Z" fill={shell} />
          <path d="M28 13 H36 L39 24 L37 45 L32 53 L27 45 L25 24 Z" fill={paint} opacity="0.86" />
          <path d="M23 20 L4 7 L7 25 L20 35 Z M41 20 L60 7 L57 25 L44 35 Z M18 35 L2 54 L15 50 L26 38 Z M46 35 L62 54 L49 50 L38 38 Z" fill={spine} />
          <path d="M5 8 L20 33 M59 8 L44 33" stroke={c} strokeWidth="2.4" strokeLinecap="round" opacity="0.75" />
          <ellipse cx="32" cy="25" rx="8" ry="6" fill={eye} opacity="0.76" />
        </svg>
      )
    }

    if (bossKind === 'hydra') {
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 6px 14px #000a)' }}>
          {defs}
          <path d="M17 18 L26 8 L32 18 L38 8 L47 18 L46 39 L38 55 H26 L18 39 Z" fill={shell} />
          <path d="M10 21 L18 10 L26 19 L24 34 L14 39 Z M27 20 L32 7 L37 20 L36 39 L28 39 Z M38 19 L46 10 L54 21 L50 39 L40 34 Z" fill={paint} opacity="0.84" />
          <circle cx="18" cy="24" r="5" fill={eye} opacity="0.72" />
          <circle cx="32" cy="22" r="6" fill={eye} opacity="0.82" />
          <circle cx="46" cy="24" r="5" fill={eye} opacity="0.72" />
          <path d="M18 42 L26 55 H38 L46 42 L39 48 H25 Z" fill={spine} />
        </svg>
      )
    }

    if (bossKind === 'gate') {
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 6px 14px #000a)' }}>
          {defs}
          <path d="M8 9 H56 L62 18 L57 32 L62 46 L56 55 H8 L2 46 L7 32 L2 18 Z" fill={shell} />
          <path d="M15 16 H49 L53 24 L48 32 L53 40 L49 48 H15 L11 40 L16 32 L11 24 Z" fill={paint} opacity="0.78" />
          <rect x="25" y="9" width="14" height="46" rx="3" fill={dark} />
          <circle cx="32" cy="32" r="11" fill={eye} opacity="0.7" />
          <circle cx="32" cy="32" r="5" fill="#fff" opacity="0.92" />
        </svg>
      )
    }

    return (
      <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 6px 14px #000a)' }}>
        {defs}
        {/* Wide carrier hull */}
        <path d="M6 32 C8 18 18 10 32 9 C46 10 56 18 58 32 C55 46 46 54 32 56 C18 54 9 46 6 32 Z" fill={shell} />
        <path d="M12 31 C13 20 20 15 32 14 C44 15 51 20 52 31 C50 40 44 46 32 47 C20 46 14 40 12 31 Z" fill={paint} opacity="0.9" />
        {/* Forward bow spike */}
        <path d="M29 9 L32 2 L35 9 L33.5 13 L30.5 13 Z" fill={c} opacity="0.9" />
        {/* Extended side carrier wings / landing decks */}
        <path d="M12 27 L2 20 L1 36 L12 36 Z" fill={spine} />
        <path d="M52 27 L62 20 L63 36 L52 36 Z" fill={spine} />
        <path d="M3 23 L1 20 L2 36 L4 36" stroke={c} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.7" />
        <path d="M61 23 L63 20 L62 36 L60 36" stroke={c} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.7" />
        {/* 3 gun battery arrays */}
        <rect x="13" y="17" width="9" height="4.5" rx="2" fill={dark} />
        <rect x="13.5" y="18" width="7" height="2.5" rx="1.2" fill={c} opacity="0.72" />
        <rect x="27.5" y="7" width="9" height="4.5" rx="2" fill={dark} />
        <rect x="28" y="8" width="7" height="2.5" rx="1.2" fill={c} opacity="0.72" />
        <rect x="42" y="17" width="9" height="4.5" rx="2" fill={dark} />
        <rect x="42.5" y="18" width="7" height="2.5" rx="1.2" fill={c} opacity="0.72" />
        {/* Command bridge sensor eye */}
        <ellipse cx="32" cy="28" rx="11" ry="7" fill={eye} opacity="0.6" />
        <circle cx="32" cy="28" r="4.5" fill="#fffae0" opacity="0.88" />
        <circle cx="32" cy="28" r="2" fill="#ffffff" />
        {/* Thruster bank */}
        <rect x="10" y="49" width="13" height="6" rx="3" fill="#5c3872" />
        <rect x="26" y="52" width="12" height="6" rx="3" fill="#5c3872" />
        <rect x="41" y="49" width="13" height="6" rx="3" fill="#5c3872" />
      </svg>
    )
  }

  switch (variant % 4) {
    // ── Variant 0: Scorpion disc — saucer with 4 scorpion claw spines ──────
    case 0:
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 4px 10px #000a)' }}>
          {defs}
          {/* Saucer hull */}
          <path d="M12 34 C13 22 21 15 32 15 C43 15 51 22 52 34 C51 44 43 50 32 51 C21 50 13 44 12 34 Z" fill={shell} />
          <path d="M17 33 C18 24 23 20 32 19 C41 20 46 24 47 33 C46 40 41 44 32 45 C23 44 18 40 17 33 Z" fill={paint} opacity="0.92" />
          {/* Scorpion claw spines (4 directions) */}
          <path d="M17 23 L3 13 L2 20 L11 25 Z" fill={spine} />
          <path d="M47 23 L61 13 L62 20 L53 25 Z" fill={spine} />
          <path d="M17 43 L3 53 L5 59 L15 49 Z" fill={spine} />
          <path d="M47 43 L61 53 L59 59 L49 49 Z" fill={spine} />
          {/* Claw glow tips */}
          <circle cx="2" cy="13" r="2.5" fill={c} opacity="0.9" />
          <circle cx="62" cy="13" r="2.5" fill={c} opacity="0.9" />
          <circle cx="3" cy="56" r="2.5" fill={c} opacity="0.8" />
          <circle cx="61" cy="56" r="2.5" fill={c} opacity="0.8" />
          {/* Central eye */}
          <ellipse cx="32" cy="32" rx="9" ry="7" fill={eye} opacity="0.75" />
          <circle cx="32" cy="32" r="3.5" fill="#ffffff" opacity="0.9" />
        </svg>
      )

    // ── Variant 1: Bat-wing fighter — dark swept wings, predator silhouette ─
    case 1:
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 4px 10px #000a)' }}>
          {defs}
          {/* Central spine/fuselage */}
          <path d="M30 10 L34 10 L36 20 L35 50 L32 57 L29 50 L28 20 Z" fill={shell} />
          {/* Large swept bat-wings */}
          <path d="M30 18 L13 11 L2 28 L6 39 L20 37 L28 28 Z" fill={paint} />
          <path d="M34 18 L51 11 L62 28 L58 39 L44 37 L36 28 Z" fill={paint} />
          {/* Wing inner shadow for depth */}
          <path d="M28 22 L15 16 L6 30 L9 36 L19 34 Z" fill="#00000030" />
          <path d="M36 22 L49 16 L58 30 L55 36 L45 34 Z" fill="#00000030" />
          {/* Wing edge accents */}
          <path d="M4 27 L13 12" stroke={c} strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
          <path d="M60 27 L51 12" stroke={c} strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
          {/* Claw wing tips */}
          <path d="M6 37 L2 45 L8 49 L12 41 Z" fill={spine} />
          <path d="M58 37 L62 45 L56 49 L52 41 Z" fill={spine} />
          {/* Eye */}
          <ellipse cx="32" cy="30" rx="8" ry="6" fill={eye} opacity="0.72" />
          <circle cx="32" cy="30" r="3.2" fill="#ffffff" opacity="0.88" />
        </svg>
      )

    // ── Variant 2: Crescent scythe — sharp arced hull, hollow center ────────
    case 2:
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 4px 10px #000a)' }}>
          {defs}
          {/* Outer crescent/ring */}
          <path d="M32 4 L52 12 L61 28 L57 46 L44 56 L32 59 L20 56 L7 46 L3 28 L12 12 Z" fill={shell} />
          {/* Inner void — creates crescent illusion */}
          <path d="M32 13 L46 19 L51 28 L47 42 L37 50 L32 51 L27 50 L17 42 L13 28 L18 19 Z" fill={dark} />
          {/* Central bridge connecting crescent */}
          <path d="M30 16 H34 L34 49 H30 Z" fill={paint} opacity="0.75" />
          {/* Forward tip weapon spike */}
          <path d="M29 11 L32 4 L35 11 L33.5 15 L30.5 15 Z" fill={c} opacity="0.94" />
          {/* Crescent interior glow lines */}
          <path d="M20 20 L28 34" stroke={c} strokeWidth="1.8" strokeLinecap="round" opacity="0.6" />
          <path d="M44 20 L36 34" stroke={c} strokeWidth="1.8" strokeLinecap="round" opacity="0.6" />
          {/* Eye / sensor */}
          <circle cx="32" cy="30" r="5.5" fill={eye} opacity="0.8" />
          <circle cx="32" cy="30" r="2.5" fill="#ffffff" opacity="0.94" />
        </svg>
      )

    // ── Variant 3: Spider cruiser — oval body, 4 weapon tentacle appendages ─
    default:
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 4px 10px #000a)' }}>
          {defs}
          {/* Central oval body */}
          <ellipse cx="32" cy="32" rx="14" ry="12" fill={shell} />
          <ellipse cx="32" cy="32" rx="10" ry="8.5" fill={paint} opacity="0.92" />
          {/* 4 long spider appendages */}
          <path d="M22 22 L4 7 L8 13 L18 23 Z" fill={spine} />
          <path d="M42 22 L60 7 L56 13 L46 23 Z" fill={spine} />
          <path d="M22 42 L4 57 L8 51 L18 41 Z" fill={spine} />
          <path d="M42 42 L60 57 L56 51 L46 41 Z" fill={spine} />
          {/* Weapon tips (glowing orbs) */}
          <circle cx="4" cy="7" r="3" fill={c} opacity="0.96" />
          <circle cx="60" cy="7" r="3" fill={c} opacity="0.96" />
          <circle cx="4" cy="57" r="3" fill={c} opacity="0.88" />
          <circle cx="60" cy="57" r="3" fill={c} opacity="0.88" />
          {/* Core eye */}
          <ellipse cx="32" cy="32" rx="7" ry="5.5" fill={eye} opacity="0.78" />
          <circle cx="32" cy="32" r="3" fill="#ffffff" opacity="0.88" />
        </svg>
      )
  }
}

export function EarthHQIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 0 6px #7dd3fcbb)' }}>
      <defs>
        <radialGradient id="earth-core" cx="0.42" cy="0.35" r="0.72">
          <stop offset="0%" stopColor="#dffbff" />
          <stop offset="28%" stopColor="#47c7ff" />
          <stop offset="70%" stopColor="#1456a3" />
          <stop offset="100%" stopColor="#06182f" />
        </radialGradient>
        <linearGradient id="hq-metal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="45%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="20" fill="url(#earth-core)" />
      <path d="M17 28c4-5 9-6 13-4 2 2 1 5-1 7-3 2-7 1-12-3z" fill="#34d399" opacity="0.9" />
      <path d="M32 38c3-4 8-4 11-1 2 3-2 7-7 7-3 0-5-2-4-6z" fill="#22c55e" opacity="0.88" />
      <path d="M39 18c5 1 8 5 9 10-4 0-8-1-10-5-1-2-1-4 1-5z" fill="#86efac" opacity="0.82" />
      <ellipse cx="32" cy="32" rx="29" ry="10" fill="none" stroke="#b7f0ff" strokeWidth="2.3" opacity="0.78" />
      <ellipse cx="32" cy="32" rx="10" ry="29" fill="none" stroke="#7dd3fc" strokeWidth="1.8" opacity="0.42" transform="rotate(54 32 32)" />
      <path d="M5 30 L14 26 L18 30 L14 35 L5 34 Z" fill="url(#hq-metal)" />
      <path d="M59 30 L50 26 L46 30 L50 35 L59 34 Z" fill="url(#hq-metal)" />
      <path d="M28 3 L36 3 L39 13 L35 18 H29 L25 13 Z" fill="url(#hq-metal)" />
      <path d="M28 61 L36 61 L39 51 L35 46 H29 L25 51 Z" fill="url(#hq-metal)" />
      <circle cx="32" cy="32" r="25" fill="none" stroke="#e0f7ff" strokeWidth="2" opacity="0.78" />
      <circle cx="32" cy="32" r="28" fill="none" stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.72" />
      <path d="M18 15 L46 49 M46 15 L18 49" stroke="#e0f2fe" strokeWidth="1.4" opacity="0.35" />
      <circle cx="32" cy="32" r="4.5" fill="#ffffff" opacity="0.88" />
    </svg>
  )
}

export function MothershipSpawnIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ filter: 'drop-shadow(0 0 4px #f472b6aa)' }}>
      <ellipse cx="24" cy="30" rx="18" ry="10" fill="#3c2948" />
      <ellipse cx="24" cy="24" rx="12" ry="9" fill="#a855f7" opacity="0.92" />
      <ellipse cx="24" cy="23" rx="6" ry="4" fill="#f5d0fe" opacity="0.6" />
      <rect x="8" y="31" width="8" height="4" rx="2" fill="#6b4b7d" />
      <rect x="20" y="34" width="8" height="4" rx="2" fill="#6b4b7d" />
      <rect x="32" y="31" width="8" height="4" rx="2" fill="#6b4b7d" />
    </svg>
  )
}
