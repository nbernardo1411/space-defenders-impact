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
        <stop offset="0%" stopColor="#f8fafc" stopOpacity="0.72" />
        <stop offset="34%" stopColor="#94a3b8" stopOpacity="0.68" />
        <stop offset="72%" stopColor="#334155" stopOpacity="0.76" />
        <stop offset="100%" stopColor="#020617" stopOpacity="0" />
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

  const fighterSurfaceDetails = <>
    <path d="M32 6 L32 55" stroke="#07111bcc" strokeWidth="0.9" opacity="0.42" />
    <path d="M24 19 L32 15 L40 19 M22 30 L32 26 L42 30 M24 43 L32 39 L40 43" stroke="#ffffff70" strokeWidth="0.85" fill="none" strokeLinecap="round" opacity="0.58" />
    <path d="M18 34 L27 31 M46 34 L37 31 M18 45 L27 40 M46 45 L37 40" stroke={core} strokeWidth="1.65" strokeLinecap="round" opacity="0.55" />
    <path d="M22 24 L18 29 L20 34 L27 32 M42 24 L46 29 L44 34 L37 32" stroke="#07111b99" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="24" y="34" width="5" height="3" rx="0.7" fill={dark} opacity="0.58" />
    <rect x="35" y="34" width="5" height="3" rx="0.7" fill={dark} opacity="0.58" />
    <rect x="23" y="39" width="6" height="1.6" rx="0.7" fill="#07111bcc" opacity="0.7" />
    <rect x="35" y="39" width="6" height="1.6" rx="0.7" fill="#07111bcc" opacity="0.7" />
    <circle cx="25" cy="25" r="0.9" fill={metal} opacity="0.68" />
    <circle cx="39" cy="25" r="0.9" fill={metal} opacity="0.68" />
    <circle cx="22" cy="45" r="0.85" fill={metal} opacity="0.62" />
    <circle cx="42" cy="45" r="0.85" fill={metal} opacity="0.62" />
    <path d="M28 51 L32 55 L36 51" stroke={core} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.62" />
    <path d="M14 50 L22 46 M50 50 L42 46" stroke="#ffffff55" strokeWidth="0.9" strokeLinecap="round" opacity="0.6" />
  </>

  if (tType === 'spaceEt') {
    const fuseG = `space-et-fuse-${svgId}`
    const wingGL = `space-et-wing-l-${svgId}`
    const wingGR = `space-et-wing-r-${svgId}`
    const tailGL = `space-et-tail-l-${svgId}`
    const tailGR = `space-et-tail-r-${svgId}`
    const canopyG = `space-et-canopy-${svgId}`

    return (
      <svg width={s} height={s} viewBox="0 0 680 766" style={{ filter: 'drop-shadow(0 8px 18px #000b)' }}>
        <defs>
          <linearGradient id={fuseG} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0d141b" />
            <stop offset="24%" stopColor="#334657" />
            <stop offset="50%" stopColor="#b9cbd6" />
            <stop offset="76%" stopColor="#334657" />
            <stop offset="100%" stopColor="#0d141b" />
          </linearGradient>
          <linearGradient id={wingGL} x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7897a9" />
            <stop offset="46%" stopColor="#273944" />
            <stop offset="100%" stopColor="#080d12" />
          </linearGradient>
          <linearGradient id={wingGR} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7897a9" />
            <stop offset="46%" stopColor="#273944" />
            <stop offset="100%" stopColor="#080d12" />
          </linearGradient>
          <linearGradient id={tailGL} x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6f899a" />
            <stop offset="100%" stopColor="#101923" />
          </linearGradient>
          <linearGradient id={tailGR} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6f899a" />
            <stop offset="100%" stopColor="#101923" />
          </linearGradient>
          <linearGradient id={canopyG} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="#a8e8ff" stopOpacity="0.9" />
            <stop offset="48%" stopColor="#1a5577" stopOpacity="0.86" />
            <stop offset="100%" stopColor="#04080c" stopOpacity="0.96" />
          </linearGradient>
        </defs>
        <path
          d="M340 34 L383 148 L404 292 L427 348 L457 324 L472 360 L478 480 L648 575 L646 636 L477 600 L470 663 L545 706 L544 745 L428 721 L390 650 L365 682 L354 746 H326 L315 682 L290 650 L252 721 L136 745 L135 706 L210 663 L203 600 L34 636 L32 575 L202 480 L208 360 L223 324 L253 348 L276 292 L297 148 Z"
          fill="#071014"
          stroke="#c7d2dd"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <path
          d="M340 52 L370 156 L388 304 L407 374 L438 356 L446 382 L450 492 L602 578 L604 610 L452 572 L444 632 L492 704 L444 694 L382 600 L354 650 L348 720 H332 L326 650 L298 600 L236 694 L188 704 L236 632 L228 572 L76 610 L78 578 L230 492 L234 382 L242 356 L273 374 L292 304 L310 156 Z"
          fill={`url(#${fuseG})`}
          opacity="0.9"
        />
        <path d="M340 58 L366 162 L382 302 L362 538 L340 642 L318 538 L298 302 L314 162 Z" fill="#ced9e4" opacity="0.34" />

        <path d="M232 391 L55 575 L64 613 L231 575 L302 450 Z" fill={`url(#${wingGL})`} opacity="0.92" />
        <path d="M448 391 L625 575 L616 613 L449 575 L378 450 Z" fill={`url(#${wingGR})`} opacity="0.92" />
        <path d="M87 588 L236 472 L286 454 L227 554 L86 614 Z" fill="#dce6ec" opacity="0.28" />
        <path d="M593 588 L444 472 L394 454 L453 554 L594 614 Z" fill="#dce6ec" opacity="0.28" />
        <path d="M76 607 L234 548 M604 607 L446 548" stroke="#ecfeff" strokeWidth="6" strokeLinecap="round" opacity="0.72" />

        <path d="M305 620 L248 710 L308 722 L328 663 Z" fill={`url(#${tailGL})`} stroke="#dce6ec" strokeWidth="4" strokeLinejoin="round" />
        <path d="M375 620 L432 710 L372 722 L352 663 Z" fill={`url(#${tailGR})`} stroke="#dce6ec" strokeWidth="4" strokeLinejoin="round" />
        <path d="M258 690 L150 722 L232 742 L312 718 Z" fill="#101923" stroke="#dce6ec" strokeWidth="4" strokeLinejoin="round" opacity="0.95" />
        <path d="M422 690 L530 722 L448 742 L368 718 Z" fill="#101923" stroke="#dce6ec" strokeWidth="4" strokeLinejoin="round" opacity="0.95" />

        <path d="M312 154 C306 198 309 254 340 292 C371 254 374 198 368 154 C358 138 322 138 312 154 Z" fill="#050b0f" stroke="#dce6ec" strokeWidth="5" />
        <path d="M322 162 C318 196 321 238 340 264 C359 238 362 196 358 162 C350 154 330 154 322 162 Z" fill={`url(#${canopyG})`} opacity="0.72" />
        <path d="M330 168 C326 188 327 214 334 230 C335 202 337 180 342 166 Z" fill="#ffffff" opacity="0.1" />

        <path d="M280 360 L318 336 L314 430 L272 456 Z M400 360 L362 336 L366 430 L408 456 Z" fill="#02070a" opacity="0.72" />
        <path d="M318 428 H362 L354 618 L340 688 L326 618 Z" fill="#020617" opacity="0.36" />
        <path d="M340 72 V672 M286 350 H394 M302 488 H378 M320 600 H360" stroke="#0f172a" strokeWidth="4" opacity="0.42" />
        <path d="M312 626 L340 704 L368 626" stroke="#e2e8f0" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.6" />
        <path d="M302 646 H378 L360 708 H320 Z" fill="#02070a" stroke="#dce6ec" strokeWidth="4" strokeLinejoin="round" />
      </svg>
    )
  }

  const shapes: Record<string, React.ReactNode> = {

    // ── SCOUT: X-Wing quad interceptor ── 4 spread wings + 4 laser cannons ──
    fast: <>
      {/* Fuselage spine */}
      <path d="M32 1 L38 15 L39 43 L34 61 H30 L25 43 L26 15 Z" fill="#eef4f8" stroke="#f8fafc" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M32 4 L35 16 L35.5 41 L32 55 L28.5 41 L29 16 Z" fill="#d9e5ee" />
      {/* Forward-port wing — swept back */}
      <path d="M28 22 L18 48 L2 58 L8 39 L25 29 Z" fill="#f8fbff" stroke="#f8fafc" strokeWidth="1.05" strokeLinejoin="round" />
      {/* Forward-stbd wing */}
      <path d="M36 22 L46 48 L62 58 L56 39 L39 29 Z" fill="#f8fbff" stroke="#f8fafc" strokeWidth="1.05" strokeLinejoin="round" />
      {/* Aft-port wing */}
      <path d="M25 34 L12 55 L27 49 L31 37 Z" fill="#cbd8e4" stroke="#e2e8f0" strokeWidth="0.8" strokeLinejoin="round" />
      {/* Aft-stbd wing */}
      <path d="M39 34 L52 55 L37 49 L33 37 Z" fill="#cbd8e4" stroke="#e2e8f0" strokeWidth="0.8" strokeLinejoin="round" />
      {/* Color accent stripes */}
      <path d="M10 41 L25 31 M54 41 L39 31" stroke="#111827" strokeWidth="2.2" strokeLinecap="round" opacity="0.72" />
      <path d="M9 45 L24 34 M55 45 L40 34 M18 55 L28 49 M46 55 L36 49" stroke={core} strokeWidth="2" strokeLinecap="round" opacity="0.9" />
      {/* 4 laser cannon barrels at wing tips */}
      <path d="M27 54 H37 L35 62 H29 Z" fill="#101827" stroke="#dce6ec" strokeWidth="0.8" strokeLinejoin="round" />
      {/* Cockpit canopy */}
      <path d="M29 9 C28 15 29 22 32 25 C35 22 36 15 35 9 C33.5 7.5 30.5 7.5 29 9 Z" fill="#07111a" stroke="#a7f3ff" strokeWidth="0.7" />
      {/* Panel seam */}
      <path d="M30 10 C29.7 14 30.3 18.5 32 21 C33.7 18.5 34.3 14 34 10 Z" fill={glass} opacity="0.58" />
      <path d="M28 31 L32 28 L36 31 M28.5 41 L32 38 L35.5 41" stroke="#475569" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.78" />
      {eng2}
    </>,

    // ── RAIL GUN: SR-71 stealth delta ── ultra-long barrel + swept wings ─────
    xwing: <>
      <path d="M32 1 L38 15 L40 34 L44 55 L36 63 H28 L20 55 L24 34 L26 15 Z" fill="#edf4f7" stroke="#f8fafc" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M32 5 L35.2 16 L36.5 34 L39 52 L34.5 58 H29.5 L25 52 L27.5 34 L28.8 16 Z" fill="#dbe6ee" />
      <path d="M27 29 L5 43 L1 60 L28 53 L31 39 Z" fill="#f8fbff" stroke="#f8fafc" strokeWidth="1" strokeLinejoin="round" />
      <path d="M37 29 L59 43 L63 60 L36 53 L33 39 Z" fill="#f8fbff" stroke="#f8fafc" strokeWidth="1" strokeLinejoin="round" />
      <path d="M25 47 L5 58 L4 64 L29 58 Z" fill="#dce6ec" stroke="#f8fafc" strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M39 47 L59 58 L60 64 L35 58 Z" fill="#dce6ec" stroke="#f8fafc" strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M12 47 L27 36 M52 47 L37 36" stroke="#101827" strokeWidth="2.2" strokeLinecap="round" opacity="0.78" />
      <path d="M12 50 L28 39 M52 50 L36 39 M13 60 L27 55 M51 60 L37 55" stroke={core} strokeWidth="1.8" strokeLinecap="round" opacity="0.9" />
      <path d="M29 8 L35 8 L36.2 17 L34 21 H30 L27.8 17 Z" fill="#0b111a" stroke="#dce6ec" strokeWidth="0.6" />
      <path d="M29 22 C29 28 30.2 32 32 34 C33.8 32 35 28 35 22 C33.6 20 30.4 20 29 22 Z" fill="#101827" />
      <path d="M30.2 22.5 C30.1 26 30.8 29.4 32 31 C33.2 29.4 33.9 26 33.8 22.5 Z" fill="#78f5ff" opacity="0.32" />
      <path d="M28 39 L32 36 L36 39 M28.5 46 H35.5 M29 52 H35" stroke="#475569" strokeWidth="0.95" fill="none" strokeLinecap="round" opacity="0.82" />
      <path d="M32 1 L32 -5" stroke="#f8fafc" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M30 58 H34 L36 63 H28 Z" fill="#0f172a" stroke="#dce6ec" strokeWidth="0.75" strokeLinejoin="round" />
      <ellipse cx="29" cy="59" rx="3.2" ry="4.7" fill={engine} opacity="0.9" />
      <ellipse cx="35" cy="59" rx="3.2" ry="4.7" fill={engine} opacity="0.9" />
    </>,

    sniper: <>
      {/* Narrow spine hull */}
      <path d="M32 0 L38 12 L40 31 L38 55 L34 63 H30 L26 55 L24 31 L26 12 Z" fill="#eef4f8" stroke="#edf2f7" strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M32 4 L35.5 14 L36.8 32 L35 51 L32 58 L29 51 L27.2 32 L28.5 14 Z" fill="#dce6ee" />
      {/* Ultra-long barrel pair extending past nose */}
      <path d="M31 -7 H33 L33 15 H31 Z" fill="#0f172a" />
      <path d="M31.6 -6 H32.4 V14 H31.6 Z" fill="#dce6ec" opacity="0.92" />
      {/* Swept-back delta wings — sharply angled */}
      <path d="M27 24 L18 20 L3 47 L7 54 L23 48 L29 35 Z" fill="#f8fbff" stroke="#edf2f7" strokeWidth="0.85" strokeLinejoin="round" />
      <path d="M37 24 L46 20 L61 47 L57 54 L41 48 L35 35 Z" fill="#f8fbff" stroke="#edf2f7" strokeWidth="0.85" strokeLinejoin="round" />
      {/* Wing color bar near fuselage */}
      <path d="M9 49 L22 42 L27 42 M55 49 L42 42 L37 42" stroke={core} strokeWidth="3" strokeLinecap="square" opacity="0.82" />
      <path d="M12 46 L27 35 M52 46 L37 35" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" opacity="0.58" />
      {/* Scope block on barrel */}
      <path d="M28.5 10 H35.5 L36.5 15 L34 18 H30 L27.5 15 Z" fill="#111827" stroke="#cbd5e1" strokeWidth="0.45" />
      {/* Cockpit */}
      <path d="M29.5 17 C29 22 30 28 32 31 C34 28 35 22 34.5 17 C33 15.5 31 15.5 29.5 17 Z" fill={glass} opacity="0.82" />
      <path d="M28 32 L32 28 L36 32 M28 45 L32 41 L36 45" stroke="#475569" strokeWidth="0.95" fill="none" strokeLinecap="round" opacity="0.78" />
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
      <path d="M32 2 L39 14 L40 45 L35 62 H29 L24 45 L25 14 Z" fill="#aeb8bf" stroke="#f8fafc" strokeWidth="1.05" strokeLinejoin="round" />
      <path d="M32 6 L36 16 L36.5 43 L32 55 L27.5 43 L28 16 Z" fill="#dce4ea" />
      <path d="M25 28 L3 34 L0 45 L27 40 L31 33 Z" fill="#8f9aa4" stroke="#f8fafc" strokeWidth="0.95" strokeLinejoin="round" />
      <path d="M39 28 L61 34 L64 45 L37 40 L33 33 Z" fill="#8f9aa4" stroke="#f8fafc" strokeWidth="0.95" strokeLinejoin="round" />
      <path d="M6 37 L26 33 L25 38 L4 42 Z" fill="#dce4ea" opacity="0.82" />
      <path d="M58 37 L38 33 L39 38 L60 42 Z" fill="#dce4ea" opacity="0.82" />
      <path d="M26 47 L17 59 L27 56 L30 47 Z" fill="#7b8792" stroke="#e2e8f0" strokeWidth="0.75" strokeLinejoin="round" />
      <path d="M38 47 L47 59 L37 56 L34 47 Z" fill="#7b8792" stroke="#e2e8f0" strokeWidth="0.75" strokeLinejoin="round" />
      <ellipse cx="24" cy="43" rx="6" ry="8" fill="#4b5563" stroke="#e2e8f0" strokeWidth="0.75" />
      <ellipse cx="40" cy="43" rx="6" ry="8" fill="#4b5563" stroke="#e2e8f0" strokeWidth="0.75" />
      <ellipse cx="24" cy="43" rx="3.1" ry="4.5" fill="#111827" />
      <ellipse cx="40" cy="43" rx="3.1" ry="4.5" fill="#111827" />
      <path d="M29 9 C28 14 29 21 32 24 C35 21 36 14 35 9 C33.5 8 30.5 8 29 9 Z" fill="#111827" stroke="#dce6ec" strokeWidth="0.5" />
      <path d="M30 10 C29.7 14 30.3 18 32 20 C33.7 18 34.3 14 34 10 Z" fill={glass} opacity="0.56" />
      <path d="M31 0 H33 L33 25 H31 Z" fill="#1f2937" />
      <path d="M30.7 -3 H33.3 V3 H30.7 Z" fill="#94a3b8" />
      <path d="M10 39 L25 34 M54 39 L39 34" stroke="#111827" strokeWidth="2" strokeLinecap="round" opacity="0.58" />
      <path d="M17 56 L25 51 M47 56 L39 51" stroke={core} strokeWidth="2.2" strokeLinecap="round" opacity="0.85" />
      <ellipse cx="29" cy="58" rx="3.4" ry="4.8" fill={engine} opacity="0.88" />
      <ellipse cx="35" cy="58" rx="3.4" ry="4.8" fill={engine} opacity="0.88" />
    </>,

    // ── ROCKET: Swept missile destroyer ── 4 visible pods + warhead tips ────
    rocket: <>
      {/* Black Comet: gunmetal stealth fighter with visible camo panels */}
      <path d="M32 1 L41 13 L45 29 L50 45 L43 59 L35 63 H29 L21 59 L14 45 L19 29 L23 13 Z" fill="#4f5f6d" stroke="#74818c" strokeWidth="0.62" strokeLinejoin="round" />
      <path d="M32 5 L38 15 L41 30 L44 44 L38 55 L32 60 L26 55 L20 44 L23 30 L26 15 Z" fill="#8796a3" opacity="0.76" />
      <path d="M23 25 L3 37 L0 55 L25 51 L31 37 Z" fill="#394956" stroke="#62717d" strokeWidth="0.55" strokeLinejoin="round" />
      <path d="M41 25 L61 37 L64 55 L39 51 L33 37 Z" fill="#394956" stroke="#62717d" strokeWidth="0.55" strokeLinejoin="round" />
      <path d="M7 42 L24 31 L25 43 L4 52 Z" fill="#667582" opacity="0.72" />
      <path d="M57 42 L40 31 L39 43 L60 52 Z" fill="#667582" opacity="0.72" />
      <path d="M18 31 C23 27 28 29 30 34 C25 39 18 39 11 36 Z" fill="#17202a" opacity="0.62" />
      <path d="M46 31 C41 27 36 29 34 34 C39 39 46 39 53 36 Z" fill="#17202a" opacity="0.62" />
      <path d="M24 45 C28 40 36 40 40 45 C37 51 34 55 32 57 C30 55 27 51 24 45 Z" fill="#1f2937" opacity="0.66" />
      <path d="M24 51 L10 62 L28 57 Z" fill="#263441" stroke="#62717d" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M40 51 L54 62 L36 57 Z" fill="#263441" stroke="#62717d" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M28 11 C27 17 28.4 24 32 28 C35.6 24 37 17 36 11 C34 9 30 9 28 11 Z" fill="#07111a" stroke="#6f8490" strokeWidth="0.42" />
      <path d="M29.5 12 C29 16 29.7 21 32 23.5 C34.3 21 35 16 34.5 12 Z" fill={glass} opacity="0.5" />
      <path d="M30 4 L32 -1 L34 4 L33.4 15 H30.6 Z" fill="#b7c3cf" />
      <path d="M24 32 L32 27 L40 32 M23 43 L32 38 L41 43" stroke="#94a3b8" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.58" />
      <path d="M11 50 L25 42 M53 50 L39 42" stroke="#111827" strokeWidth="2" strokeLinecap="round" opacity="0.62" />
      <path d="M28 54 H36 L38 62 H26 Z" fill="#151d27" stroke="#64748b" strokeWidth="0.45" strokeLinejoin="round" />
      <ellipse cx="27" cy="58" rx="3.1" ry="4" fill="#475569" opacity="0.94" />
      <ellipse cx="37" cy="58" rx="3.1" ry="4" fill="#475569" opacity="0.94" />
      <ellipse cx="27" cy="58" rx="1.45" ry="2" fill="#111827" opacity="0.85" />
      <ellipse cx="37" cy="58" rx="1.45" ry="2" fill="#111827" opacity="0.85" />
    </>,

    // ── LASER: Kite/diamond hull ── angular prism emitter, swept fins ────────
    laser: <>
      {/* Diamond kite hull */}
      <path d="M32 0 L46 15 L51 31 L42 54 L32 64 L22 54 L13 31 L18 15 Z" fill={hull} />
      <path d="M32 5 L42 16 L46 30 L39 49 L32 58 L25 49 L18 30 L22 16 Z" fill={paint} opacity="0.94" />
      {/* Long swept-back wing fins */}
      <path d="M22 15 L0 56 L9 64 L24 47 L28 31 Z" fill={hull} />
      <path d="M42 15 L64 56 L55 64 L40 47 L36 31 Z" fill={hull} />
      {/* Wing accent */}
      <path d="M7 51 L20 41 L24 41" stroke={core} strokeWidth="3.5" strokeLinecap="square" />
      <path d="M57 51 L44 41 L40 41" stroke={core} strokeWidth="3.5" strokeLinecap="square" />
      <path d="M10 48 L21 33 L25 36 L18 46 Z" fill="#f8fbff" opacity="0.3" />
      <path d="M54 48 L43 33 L39 36 L46 46 Z" fill="#f8fbff" opacity="0.3" />
      {/* Angular prism emitter at nose tip — NO circles */}
      <path d="M32 -2 L39 10 L35 15 L29 15 L25 10 Z" fill="#c8f6ff" opacity="0.98" />
      <path d="M32 2 L36 10 L33.5 13 L30.5 13 L28 10 Z" fill="#ffffff" opacity="0.96" />
      {/* Energy beam spine */}
      <line x1="32" y1="8" x2="32" y2="49" stroke="#a0f4ff" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
      <line x1="32" y1="16" x2="32" y2="54" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
      <path d="M24 24 L32 16 L40 24" stroke="#67e8f9" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.75" />
      <path d="M27 24 L32 20 L37 24 M26 32 L32 28 L38 32 M27 42 L32 47 L37 42" stroke="#ffffff7a" strokeWidth="1.15" fill="none" strokeLinecap="round" opacity="0.72" />
      <path d="M25 48 H39 L35 56 H29 Z" fill="#0f172a" opacity="0.56" />
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
      <path d="M32 1 L50 25 L64 48 L44 57 L35 64 H29 L20 57 L0 48 L14 25 Z" fill="#0b1118" stroke="#66727d" strokeWidth="0.62" strokeLinejoin="round" />
      <path d="M32 7 L45 27 L55 45 L40 51 L35 58 H29 L24 51 L9 45 L19 27 Z" fill="#2b343c" />
      <path d="M14 25 L32 1 L50 25 L40 33 H24 Z" fill="#3e4a54" stroke="#5b6872" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M2 47 L25 28 L24 51 L20 57 Z" fill="#1b2630" stroke="#3b4650" strokeWidth="0.45" strokeLinejoin="round" />
      <path d="M62 47 L39 28 L40 51 L44 57 Z" fill="#1b2630" stroke="#3b4650" strokeWidth="0.45" strokeLinejoin="round" />
      <path d="M23 50 L32 31 L41 50 L35 58 H29 Z" fill="#111820" />
      <path d="M27 21 H37 L35 34 H29 Z" fill="#07111a" stroke="#64748b" strokeWidth="0.34" />
      <path d="M28 22 H36 L34.4 30 H29.6 Z" fill={glass} opacity="0.3" />
      <path d="M16 34 H26 L23 41 H11 Z M48 34 H38 L41 41 H53 Z" fill="#020617" opacity="0.94" />
      <path d="M32 10 L33.1 54 H30.9 Z" fill={core} opacity="0.78" />
      <path d="M25 37 L32 31 L39 37 M16 44 L29 39 M48 44 L35 39" stroke="#72808c" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.58" />
      <path d="M26 56 L32 63 L38 56" fill="#080c12" stroke="#64748b" strokeWidth="0.36" strokeLinejoin="round" />
      <path d="M21 51 L26 61 M43 51 L38 61" stroke="#26313a" strokeWidth="4" strokeLinecap="round" />
    </>,
  }

  return (
    <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 4px 10px #000a)' }}>
      {defs}
      {shapes[tType] ?? shapes.fast}
      {fighterSurfaceDetails}
    </svg>
  )
}

export function AlienShip({ variant, isBoss, isMiniBoss, isFinalBoss, bossKind, miniBossKind, color, size }: { variant: number; isBoss: boolean; isMiniBoss?: boolean; isFinalBoss: boolean; bossKind?: string; miniBossKind?: string; color: string; size: number }) {
  const s = Math.max(8, size)
  const svgId = useId().replace(/:/g, '')
  const shellGrad = `alien-shell-${svgId}`
  const paintGrad = `alien-paint-${svgId}`
  const eyeGrad = `alien-eye-${svgId}`
  const c = color
  const raceKey = isFinalBoss ? 'final' : miniBossKind ?? bossKind ?? `v${variant % 6}`
  const racePalettes: Record<string, { top: string; mid: string; bottom: string; dark: string; spine: string; eyeA: string; eyeB: string }> = {
    carrier: { top: '#69423b', mid: '#351827', bottom: '#12070d', dark: '#11070a', spine: '#4a1628', eyeA: '#ffe2a8', eyeB: '#f97316' },
    orb: { top: '#6d3d88', mid: '#291846', bottom: '#080615', dark: '#08030f', spine: '#421c66', eyeA: '#f5d0fe', eyeB: '#a855f7' },
    serpent: { top: '#255d68', mid: '#12313d', bottom: '#061018', dark: '#041015', spine: '#10424f', eyeA: '#cffafe', eyeB: '#06b6d4' },
    mantis: { top: '#4e6f22', mid: '#253a11', bottom: '#081103', dark: '#091204', spine: '#365314', eyeA: '#ecfccb', eyeB: '#84cc16' },
    hydra: { top: '#5b317f', mid: '#281447', bottom: '#0c0517', dark: '#090211', spine: '#3b1468', eyeA: '#ede9fe', eyeB: '#8b5cf6' },
    gate: { top: '#2f4057', mid: '#172033', bottom: '#050814', dark: '#02040b', spine: '#263249', eyeA: '#fee2e2', eyeB: '#ef4444' },
    super: { top: '#583044', mid: '#2b1426', bottom: '#100710', dark: '#09040a', spine: '#4a1939', eyeA: '#fef3c7', eyeB: '#f59e0b' },
    final: { top: '#39101f', mid: '#160510', bottom: '#040006', dark: '#030005', spine: '#4c0519', eyeA: '#fff7ed', eyeB: '#fb7185' },
    stalker: { top: '#135e70', mid: '#073544', bottom: '#031016', dark: '#031117', spine: '#084556', eyeA: '#cffafe', eyeB: '#22d3ee' },
    brood: { top: '#6d3589', mid: '#35164a', bottom: '#0f0617', dark: '#09020f', spine: '#4c1d5f', eyeA: '#fae8ff', eyeB: '#d946ef' },
    lancer: { top: '#713044', mid: '#3d1422', bottom: '#12050a', dark: '#0b0306', spine: '#5f162d', eyeA: '#ffe4e6', eyeB: '#f43f5e' },
    v0: { top: '#6b3140', mid: '#371323', bottom: '#10060b', dark: '#0a0306', spine: '#571829', eyeA: '#ffe4e6', eyeB: '#fb7185' },
    v1: { top: '#2e4a77', mid: '#12284f', bottom: '#061020', dark: '#030814', spine: '#1f3a67', eyeA: '#dbeafe', eyeB: '#60a5fa' },
    v2: { top: '#5b3a7e', mid: '#291a4d', bottom: '#0b0618', dark: '#07030f', spine: '#3b2065', eyeA: '#f5d0fe', eyeB: '#c084fc' },
    v3: { top: '#365f4a', mid: '#123326', bottom: '#04100b', dark: '#030d09', spine: '#174231', eyeA: '#dcfce7', eyeB: '#34d399' },
    v4: { top: '#6b4c25', mid: '#33200e', bottom: '#100803', dark: '#0c0502', spine: '#5a3411', eyeA: '#fef3c7', eyeB: '#f59e0b' },
    v5: { top: '#22515b', mid: '#0d2b35', bottom: '#031014', dark: '#02090c', spine: '#164e63', eyeA: '#ccfbf1', eyeB: '#2dd4bf' },
  }
  const race = racePalettes[raceKey] ?? racePalettes[`v${variant % 6}`]
  const shell = `url(#${shellGrad})`
  const paint = `url(#${paintGrad})`
  const eye = `url(#${eyeGrad})`
  const dark = race.dark
  const spine = race.spine

  const defs = (
    <defs>
      <linearGradient id={shellGrad} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={race.top} />
        <stop offset="55%" stopColor={race.mid} />
        <stop offset="100%" stopColor={race.bottom} />
      </linearGradient>
      <linearGradient id={paintGrad} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffe6f8" stopOpacity="0.88" />
        <stop offset="18%" stopColor={c} stopOpacity="0.98" />
        <stop offset="100%" stopColor={c} stopOpacity="0.38" />
      </linearGradient>
      <radialGradient id={eyeGrad} cx="0.5" cy="0.42" r="0.72">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="28%" stopColor={race.eyeA} />
        <stop offset="62%" stopColor={race.eyeB} />
        <stop offset="100%" stopColor={race.eyeB} stopOpacity="0" />
      </radialGradient>
    </defs>
  )

  const alienSurfaceDetails = <>
    <path d="M32 8 L32 56" stroke="#020006aa" strokeWidth="1.05" opacity="0.5" />
    <path d="M18 22 Q26 18 32 23 Q38 18 46 22 M17 34 Q26 30 32 35 Q38 30 47 34 M21 47 Q28 43 32 48 Q36 43 43 47" stroke="#ffffff55" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.48" />
    <path d="M13 28 Q22 31 19 41 M51 28 Q42 31 45 41" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5" />
    <path d="M24 18 L20 25 L24 31 M40 18 L44 25 L40 31 M24 45 L20 52 M40 45 L44 52" stroke="#02000699" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="24" cy="27" r="1.15" fill={c} opacity="0.56" />
    <circle cx="40" cy="27" r="1.15" fill={c} opacity="0.56" />
    <circle cx="27" cy="42" r="0.9" fill="#fff4c7" opacity="0.5" />
    <circle cx="37" cy="42" r="0.9" fill="#fff4c7" opacity="0.5" />
    <path d="M29 13 L32 9 L35 13 M26 53 L32 58 L38 53" stroke={c} strokeWidth="1.45" fill="none" strokeLinecap="round" opacity="0.56" />
    <path d="M9 38 Q17 36 23 39 M55 38 Q47 36 41 39" stroke="#ffffff35" strokeWidth="0.9" fill="none" strokeLinecap="round" />
  </>

  // Mini bosses: persistent alien hunters with distinct silhouettes.
  if (isMiniBoss) {
    if (miniBossKind === 'brood') {
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 5px 14px #000c)' }}>
          {defs}
          <path d="M29 7 C18 11 14 23 17 36 C20 50 30 60 39 57 C49 53 52 40 47 26 C43 14 37 6 29 7 Z" fill={shell} />
          <path d="M30 13 C23 16 21 25 23 35 C25 45 31 52 37 50 C44 47 45 38 42 28 C39 19 35 12 30 13 Z" fill={paint} opacity="0.82" />
          <path d="M18 27 C9 23 4 16 3 7 M21 42 C11 44 6 52 5 61 M45 26 C54 20 58 13 60 5 M45 43 C55 45 59 53 61 61" stroke={spine} strokeWidth="4.6" fill="none" strokeLinecap="round" />
          <path d="M18 27 C10 23 6 17 5 9 M21 42 C13 44 9 51 8 59 M45 26 C53 21 56 14 58 7 M45 43 C53 46 56 53 58 59" stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.72" />
          <ellipse cx="33" cy="28" rx="10" ry="8" fill={dark} opacity="0.82" />
          <circle cx="33" cy="28" r="5.8" fill={eye} opacity="0.8" />
          <circle cx="33" cy="28" r="2.5" fill="#fff" opacity="0.92" />
          <circle cx="24" cy="39" r="3.7" fill={c} opacity="0.5" />
          <circle cx="39" cy="42" r="4.3" fill={c} opacity="0.46" />
          <path d="M25 17 C30 20 35 20 40 17 M23 47 C30 53 38 53 43 45" stroke="#ffffff66" strokeWidth="1.15" fill="none" strokeLinecap="round" />
          <path d="M17 33 C11 35 7 39 5 44 M49 34 C55 36 58 40 60 45" stroke={c} strokeWidth="1.7" fill="none" strokeLinecap="round" opacity="0.55" />
          {alienSurfaceDetails}
        </svg>
      )
    }

    if (miniBossKind === 'lancer') {
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 5px 14px #000c)' }}>
          {defs}
          <path d="M32 1 L38 12 L36 38 L32 62 L28 38 L26 12 Z" fill={shell} />
          <path d="M32 7 L35 15 L34 36 L32 49 L30 36 L29 15 Z" fill={paint} opacity="0.9" />
          <path d="M26 18 L10 6 L6 24 L20 31 Z M38 18 L54 6 L58 24 L44 31 Z" fill={spine} />
          <path d="M21 32 L6 43 L10 55 L28 43 Z M43 32 L58 43 L54 55 L36 43 Z" fill={dark} />
          <path d="M12 10 L2 5 L7 17 M52 10 L62 5 L57 17 M10 53 L2 61 L17 57 M54 53 L62 61 L47 57" stroke={c} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.78" />
          <path d="M29 15 C27 22 29 31 32 36 C35 31 37 22 35 15 Z" fill={eye} opacity="0.78" />
          <path d="M32 0 L37 13 H27 Z" fill={c} opacity="0.86" />
          <path d="M18 24 C26 31 27 39 22 49 M46 24 C38 31 37 39 42 49" stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.64" />
          <path d="M21 25 L32 18 L43 25 M23 43 L32 55 L41 43" stroke="#ffffff66" strokeWidth="1.1" fill="none" strokeLinecap="round" />
          {alienSurfaceDetails}
        </svg>
      )
    }

    return (
      <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 5px 14px #000c)' }}>
        {defs}
        <path d="M32 6 C43 7 50 15 51 28 C52 42 43 55 32 59 C21 55 12 42 13 28 C14 15 21 7 32 6 Z" fill={shell} />
        <path d="M32 13 C39 14 44 21 44 31 C44 41 39 49 32 52 C25 49 20 41 20 31 C20 21 25 14 32 13 Z" fill={paint} opacity="0.82" />
        <path d="M19 20 C9 15 5 10 3 3 M45 20 C55 15 59 10 61 3 M17 39 C7 41 3 48 2 58 M47 39 C57 41 61 48 62 58" stroke={spine} strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M20 20 C12 17 8 11 6 5 M44 20 C52 17 56 11 58 5 M18 39 C10 42 7 48 6 56 M46 39 C54 42 57 48 58 56" stroke={c} strokeWidth="1.9" fill="none" strokeLinecap="round" opacity="0.72" />
        <ellipse cx="32" cy="29" rx="9" ry="7" fill={eye} opacity="0.82" />
        <circle cx="32" cy="29" r="3" fill="#fff" opacity="0.9" />
        <path d="M23 51 Q29 43 32 56 Q35 43 41 51" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.72" />
        <path d="M22 22 L32 15 L42 22 M21 42 L32 48 L43 42" stroke="#ffffff66" strokeWidth="1.15" fill="none" strokeLinecap="round" />
        <path d="M27 34 L21 38 M37 34 L43 38" stroke={dark} strokeWidth="2.3" strokeLinecap="round" />
        {alienSurfaceDetails}
      </svg>
    )
  }

  // Final boss: biomechanical star fortress.
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
        <path d="M11 23 C20 20 25 25 27 31 C23 29 18 29 12 32 Z M53 23 C44 20 39 25 37 31 C41 29 46 29 52 32 Z" fill="#00000055" />
        <path d="M13 43 C20 38 25 39 29 43 L25 49 L14 56 Z M51 43 C44 38 39 39 35 43 L39 49 L50 56 Z" fill={spine} />
        <path d="M32 1 L35 15 H29 Z M63 21 L50 26 L48 20 Z M63 43 L49 39 L47 44 Z M32 63 L29 49 H35 Z M1 43 L17 39 L16 45 Z M1 21 L16 20 L14 27 Z" fill={c} opacity="0.68" />
        <path d="M8 28 Q19 31 14 42 M56 28 Q45 31 50 42 M20 7 Q25 18 17 26 M44 7 Q39 18 47 26" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.58" />
        <path d="M17 18 C5 23 5 37 17 45 M47 18 C59 23 59 37 47 45" stroke="#020006" strokeWidth="5.6" fill="none" strokeLinecap="round" opacity="0.55" />
        <path d="M17 18 C6 25 8 35 17 45 M47 18 C58 25 56 35 47 45" stroke={c} strokeWidth="2.1" fill="none" strokeLinecap="round" opacity="0.7" />
        <path d="M24 25 L32 15 L40 25 L36 34 L44 44 L32 39 L20 44 L28 34 Z" fill="#06020c" opacity="0.62" />
        <path d="M24 25 L32 15 L40 25 M22 43 L32 39 L42 43" stroke="#ffffff66" strokeWidth="1.15" fill="none" strokeLinecap="round" />
        {alienSurfaceDetails}
      </svg>
    )
  }

  // ── BOSS: Alien assault carrier — wide crescent + 3 gun batteries ────────
  if (isBoss) {
    if (bossKind === 'orb') {
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 6px 14px #000a)' }}>
          {defs}
          <path d="M29 4 C43 5 52 17 50 31 C48 47 39 58 27 60 C17 57 12 46 15 32 C17 18 20 8 29 4 Z" fill={shell} />
          <path d="M30 11 C39 12 45 20 43 31 C42 43 35 51 27 52 C21 49 18 41 20 32 C22 21 24 14 30 11 Z" fill={paint} opacity="0.78" />
          <path d="M18 24 C9 17 6 9 7 2 M46 24 C56 17 60 9 59 2 M17 41 C8 45 5 54 6 62 M43 43 C52 49 55 56 56 62" stroke={spine} strokeWidth="5.4" fill="none" strokeLinecap="round" />
          <path d="M18 24 C11 18 9 10 10 4 M46 24 C54 18 57 10 56 4 M17 41 C10 45 8 53 9 60 M43 43 C50 49 52 56 53 60" stroke={c} strokeWidth="1.9" fill="none" strokeLinecap="round" opacity="0.72" />
          <path d="M22 30 C25 21 35 19 41 27 C39 37 30 42 22 36 Z" fill={dark} opacity="0.82" />
          <ellipse cx="31" cy="30" rx="8.5" ry="6.5" fill={eye} opacity="0.82" />
          <circle cx="31" cy="30" r="3.1" fill="#fff" />
          <path d="M26 13 C29 19 38 20 43 16 M21 47 C27 53 35 51 41 44" stroke="#ffffff66" strokeWidth="1.25" fill="none" strokeLinecap="round" />
          <path d="M12 30 C6 33 4 38 3 44 M52 31 C59 35 61 41 60 48" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.58" />
          {alienSurfaceDetails}
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
          <path d="M14 24 Q25 33 18 43 M50 24 Q39 33 46 43 M23 42 Q32 50 41 42" stroke={c} strokeWidth="2.1" fill="none" strokeLinecap="round" opacity="0.72" />
          <path d="M25 14 L32 9 L39 14 M25 28 L32 34 L39 28 M24 43 L32 38 L40 43" stroke="#ffffff55" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <path d="M11 10 L4 2 L7 16 M53 10 L60 2 L57 16 M9 55 L2 62 L15 57 M55 55 L62 62 L49 57" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.58" />
          {alienSurfaceDetails}
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
          <path d="M8 7 L2 1 L4 14 M56 7 L62 1 L60 14 M2 54 L10 45 M62 54 L54 45" stroke={c} strokeWidth="2.1" strokeLinecap="round" opacity="0.72" />
          <path d="M16 27 L28 33 M48 27 L36 33 M23 43 L32 54 L41 43" stroke="#00000066" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M27 18 L32 12 L37 18 M28 35 L32 39 L36 35" stroke="#ffffff5e" strokeWidth="1.25" fill="none" strokeLinecap="round" />
          <path d="M20 35 Q12 42 9 55 M44 35 Q52 42 55 55" stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.54" />
          {alienSurfaceDetails}
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
          <path d="M13 31 Q4 36 3 50 M32 34 Q27 43 32 58 Q37 43 32 34 M51 31 Q60 36 61 50" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7" />
          <path d="M17 17 L12 7 L23 14 M32 16 L32 4 M47 17 L52 7 L41 14" stroke="#00000066" strokeWidth="3" strokeLinecap="round" />
          <path d="M18 28 L25 34 M32 28 L32 38 M46 28 L39 34" stroke="#ffffff66" strokeWidth="1.15" strokeLinecap="round" />
          <path d="M8 38 L2 44 L5 48 M56 38 L62 44 L59 48" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.62" />
          {alienSurfaceDetails}
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
          <path d="M8 9 L2 2 L5 18 M56 9 L62 2 L59 18 M8 55 L2 62 L5 46 M56 55 L62 62 L59 46" stroke={c} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.7" />
          <path d="M14 20 H50 M14 44 H50 M18 15 L25 28 M46 15 L39 28 M18 49 L25 36 M46 49 L39 36" stroke="#00000066" strokeWidth="3" strokeLinecap="round" />
          <path d="M22 25 L32 17 L42 25 M22 39 L32 47 L42 39" stroke="#ffffff55" strokeWidth="1.25" fill="none" strokeLinecap="round" />
          <path d="M9 31 H2 M55 31 H62" stroke={c} strokeWidth="3" strokeLinecap="round" opacity="0.78" />
          {alienSurfaceDetails}
        </svg>
      )
    }

    if (bossKind === 'super') {
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 6px 14px #000a)' }}>
          {defs}
          <path d="M32 2 L43 10 L48 24 L61 30 L50 39 L47 54 L32 62 L17 54 L14 39 L3 30 L16 24 L21 10 Z" fill={shell} />
          <path d="M32 9 L39 15 L42 26 L50 31 L42 36 L39 48 L32 54 L25 48 L22 36 L14 31 L22 26 L25 15 Z" fill={paint} opacity="0.82" />
          <path d="M16 23 L3 10 L7 28 M48 23 L61 10 L57 28 M15 40 L2 53 L20 50 M49 40 L62 53 L44 50" stroke={spine} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M16 23 L6 12 L9 27 M48 23 L58 12 L55 27 M15 40 L5 51 L19 48 M49 40 L59 51 L45 48" stroke={c} strokeWidth="1.9" fill="none" strokeLinecap="round" opacity="0.72" />
          <path d="M24 25 L32 15 L40 25 L37 37 L44 45 L32 42 L20 45 L27 37 Z" fill={dark} opacity="0.74" />
          <ellipse cx="32" cy="29" rx="8.5" ry="6.5" fill={eye} opacity="0.82" />
          <circle cx="32" cy="29" r="3.2" fill="#fff" opacity="0.94" />
          <path d="M21 18 L32 10 L43 18 M18 37 L32 48 L46 37" stroke="#ffffff66" strokeWidth="1.3" fill="none" strokeLinecap="round" />
          <path d="M7 31 H17 M47 31 H57 M32 2 V13 M32 51 V62" stroke={c} strokeWidth="2.4" strokeLinecap="round" opacity="0.62" />
          {alienSurfaceDetails}
        </svg>
      )
    }

    return (
      <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 6px 14px #000a)' }}>
        {defs}
        <path d="M32 4 C43 5 52 15 54 28 C56 43 47 55 32 60 C17 55 8 43 10 28 C12 15 21 5 32 4 Z" fill={shell} />
        <path d="M32 10 C40 11 47 18 49 29 C50 39 43 49 32 53 C21 49 14 39 15 29 C17 18 24 11 32 10 Z" fill={paint} opacity="0.84" />
        <path d="M15 23 L2 13 L3 31 L14 36 Z M49 23 L62 13 L61 31 L50 36 Z" fill={spine} />
        <path d="M18 39 L5 52 L15 58 L28 48 Z M46 39 L59 52 L49 58 L36 48 Z" fill={spine} />
        <path d="M15 24 C7 20 4 13 5 5 M49 24 C57 20 60 13 59 5 M18 40 C9 43 6 51 7 60 M46 40 C55 43 58 51 57 60" stroke={c} strokeWidth="2.1" fill="none" strokeLinecap="round" opacity="0.72" />
        <path d="M25 14 L32 2 L39 14 L35 20 H29 Z" fill={spine} />
        <path d="M28 15 L32 7 L36 15" stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.86" />
        <path d="M20 28 C22 20 29 17 36 19 C43 22 46 30 43 38 C39 47 26 47 21 39 C18 35 18 31 20 28 Z" fill={dark} opacity="0.78" />
        <ellipse cx="32" cy="31" rx="9.5" ry="7" fill={eye} opacity="0.82" />
        <circle cx="32" cy="31" r="3.4" fill="#fff" opacity="0.94" />
        <path d="M17 19 L8 9 M47 19 L56 9 M17 50 L8 60 M47 50 L56 60" stroke={spine} strokeWidth="3.4" strokeLinecap="round" opacity="0.9" />
        <path d="M16 33 C23 29 28 31 31 36 M48 33 C41 29 36 31 33 36" stroke="#00000066" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M20 21 L32 13 L44 21 M20 44 L32 52 L44 44" stroke="#ffffff66" strokeWidth="1.25" fill="none" strokeLinecap="round" />
        <circle cx="16" cy="20" r="2.4" fill={c} opacity="0.68" />
        <circle cx="48" cy="20" r="2.4" fill={c} opacity="0.68" />
        <circle cx="18" cy="49" r="2.2" fill={c} opacity="0.54" />
        <circle cx="46" cy="49" r="2.2" fill={c} opacity="0.54" />
        {alienSurfaceDetails}
      </svg>
    )
  }

  switch (variant % 6) {
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
          <path d="M14 25 Q24 29 20 37 M50 25 Q40 29 44 37" stroke="#00000066" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M14 15 L4 5 M50 15 L60 5 M12 49 L2 61 M52 49 L62 61" stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.68" />
          <path d="M22 26 L32 22 L42 26 M22 40 L32 44 L42 40" stroke="#ffffff55" strokeWidth="1.1" fill="none" strokeLinecap="round" />
          {alienSurfaceDetails}
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
          <path d="M8 39 L1 53 L13 45 M56 39 L63 53 L51 45" fill={dark} />
          <path d="M9 15 Q23 21 24 34 M55 15 Q41 21 40 34" stroke="#00000066" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M15 19 L5 13 M49 19 L59 13 M22 42 L14 53 M42 42 L50 53" stroke={c} strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
          {alienSurfaceDetails}
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
          <path d="M13 29 Q22 34 15 45 M51 29 Q42 34 49 45" stroke="#00000066" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M10 12 L3 5 M54 12 L61 5 M8 47 L2 58 M56 47 L62 58" stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.66" />
          <path d="M23 24 L32 18 L41 24 M24 42 L32 48 L40 42" stroke="#ffffff55" strokeWidth="1.1" fill="none" strokeLinecap="round" />
          {alienSurfaceDetails}
        </svg>
      )

    // ── Variant 3: Spider cruiser — oval body, 4 weapon tentacle appendages ─
    case 3:
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
          <path d="M19 20 Q29 28 22 42 M45 20 Q35 28 42 42" stroke="#00000066" strokeWidth="2.8" fill="none" strokeLinecap="round" />
          <path d="M10 12 L2 4 M54 12 L62 4 M10 52 L2 60 M54 52 L62 60" stroke={c} strokeWidth="1.9" strokeLinecap="round" opacity="0.72" />
          <path d="M25 25 L32 20 L39 25 M25 39 L32 44 L39 39" stroke="#ffffff55" strokeWidth="1.05" fill="none" strokeLinecap="round" />
          {alienSurfaceDetails}
        </svg>
      )

    // Variant 4: Chitin ravager, tusked beast-swarm silhouette.
    case 4:
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 4px 10px #000a)' }}>
          {defs}
          <path d="M32 7 C45 9 54 20 53 34 C52 48 43 56 32 58 C21 56 12 48 11 34 C10 20 19 9 32 7 Z" fill={shell} />
          <path d="M32 14 C41 16 47 23 46 34 C45 43 39 50 32 51 C25 50 19 43 18 34 C17 23 23 16 32 14 Z" fill={paint} opacity="0.84" />
          <path d="M18 24 L3 17 L6 31 L18 32 Z M46 24 L61 17 L58 31 L46 32 Z M17 43 L4 52 L13 58 L25 48 Z M47 43 L60 52 L51 58 L39 48 Z" fill={spine} />
          <path d="M24 18 L19 6 L28 14 M40 18 L45 6 L36 14 M23 48 L16 62 M41 48 L48 62" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.72" />
          <ellipse cx="32" cy="30" rx="8" ry="6" fill={eye} opacity="0.74" />
          <circle cx="29" cy="30" r="1.8" fill="#fff" opacity="0.92" />
          <circle cx="35" cy="30" r="1.8" fill="#fff" opacity="0.92" />
          <path d="M24 39 Q32 44 40 39 M20 27 Q26 33 20 41 M44 27 Q38 33 44 41" stroke={dark} strokeWidth="2.7" fill="none" strokeLinecap="round" />
          <path d="M22 22 L32 15 L42 22 M21 43 L32 50 L43 43" stroke="#ffffff55" strokeWidth="1.1" fill="none" strokeLinecap="round" />
          {alienSurfaceDetails}
        </svg>
      )

    // Variant 5: Jelly spore, translucent cephalopod with dangling tendrils.
    default:
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 4px 10px #000a)' }}>
          {defs}
          <path d="M32 8 C45 8 54 18 53 31 C52 42 43 48 32 48 C21 48 12 42 11 31 C10 18 19 8 32 8 Z" fill={shell} opacity="0.92" />
          <path d="M32 14 C41 14 47 21 47 30 C47 38 40 43 32 43 C24 43 17 38 17 30 C17 21 23 14 32 14 Z" fill={paint} opacity="0.72" />
          <ellipse cx="32" cy="28" rx="9" ry="6.5" fill={eye} opacity="0.78" />
          <circle cx="32" cy="28" r="3" fill="#fff" opacity="0.9" />
          <path d="M20 44 C15 50 17 56 11 61 M27 46 C24 53 27 58 23 62 M37 46 C40 53 37 58 41 62 M44 44 C49 50 47 56 53 61" stroke={c} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.72" />
          <path d="M13 29 C7 25 4 18 5 10 M51 29 C57 25 60 18 59 10" stroke={spine} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.86" />
          <path d="M14 29 C9 25 7 18 8 11 M50 29 C55 25 57 18 56 11" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.58" />
          <path d="M18 25 Q27 20 32 23 Q37 20 46 25 M20 37 Q28 41 32 39 Q36 41 44 37" stroke="#ffffff66" strokeWidth="1.1" fill="none" strokeLinecap="round" />
          <circle cx="23" cy="36" r="2.2" fill={c} opacity="0.42" />
          <circle cx="41" cy="36" r="2.2" fill={c} opacity="0.42" />
          {alienSurfaceDetails}
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
