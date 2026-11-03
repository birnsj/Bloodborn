/**
 * Readable Doom-style FP shotgun (Trek SVG clarity).
 * Lower-right cluster in 512 cell; grip pivot (368, 480) → anchor [0.72, 0.94].
 * Every clip has obvious pose change — not micro-tilt of the same drawing.
 */

const GRIP_X = 368;
const GRIP_Y = 480;

function root(v, body) {
  const { dx = 0, dy = 0, tilt = 0 } = v;
  return `
    <g transform="translate(${dx},${dy}) rotate(${tilt} ${GRIP_X} ${GRIP_Y})">
      ${body}
    </g>`;
}

function hands(forendY = 420) {
  return `
      <!-- sleeve from BR -->
      <path d="M430 508 L360 440 L320 460 L350 508 Z" fill="#0a0806"/>
      <path d="M410 508 L355 450 L325 468 L348 508 Z" fill="#1a1410"/>
      <!-- skin wrist -->
      <path d="M300 455 C285 470 295 500 325 508 L395 508 L385 470 C360 450 320 448 300 455 Z"
            fill="#c4a070"/>
      <path d="M310 465 C305 485 320 500 345 503 L375 498 C365 480 335 470 315 470 Z" fill="#a88860"/>
      <!-- glove under forend -->
      <ellipse cx="305" cy="${forendY}" rx="44" ry="30" fill="#0a0a0a"/>
      <ellipse cx="310" cy="${forendY - 6}" rx="34" ry="22" fill="#1c1c1c"/>
      <ellipse cx="288" cy="${forendY - 10}" rx="10" ry="12" fill="#2a2a2a"/>
      <ellipse cx="305" cy="${forendY - 14}" rx="10" ry="12" fill="#2a2a2a"/>
      <ellipse cx="322" cy="${forendY - 12}" rx="9" ry="11" fill="#2a2a2a"/>
      <ellipse cx="336" cy="${forendY - 4}" rx="9" ry="10" fill="#222"/>
      <ellipse cx="272" cy="${forendY + 6}" rx="11" ry="14" transform="rotate(-28 272 ${forendY + 6})" fill="#111"/>
`;
}

let _gid = 0;

function shotgun(v = {}) {
  const {
    kick = 0,
    slide = 0,
    flash = false,
    pump = 0,
    forendY = 420,
    hideGun = false,
  } = v;
  if (hideGun) return hands(forendY);

  const gid = `gt${_gid++}`;
  // Barrel tip rest ≈ (248, 188); moves with kick/slide
  return `
      <g transform="translate(${slide},${-kick})">
        <defs>
          <linearGradient id="${gid}" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#050505"/>
            <stop offset="45%" stop-color="#2c2c2c"/>
            <stop offset="100%" stop-color="#5a5a5a"/>
          </linearGradient>
        </defs>

        <!-- stock / near body (thick, readable) -->
        <path d="M295 395 L285 465 L325 508 L405 508 L425 450 L410 395 Z" fill="#080808"/>
        <path d="M305 405 L298 455 L335 495 L395 495 L415 445 L400 405 Z" fill="#1c1c1c"/>
        <path d="M312 395 L318 365 L398 365 L408 395 Z" fill="#121212"/>
        <path d="M322 390 L328 372 L390 372 L396 390 Z" fill="#333"/>

        <!-- grip -->
        <path d="M348 470 L338 508 L390 508 L395 470 Z" fill="#050505"/>
        <path d="M354 476 L346 500 L382 500 L386 476 Z" fill="#242424"/>

        <!-- receiver block -->
        <path d="M278 325 L268 400 L415 400 L402 325 Z" fill="url(#${gid})"/>
        <path d="M268 400 L278 325 L258 338 L248 405 Z" fill="#000"/>
        <path d="M415 400 L402 325 L428 338 L432 408 Z" fill="#050505"/>
        <rect x="318" y="348" width="68" height="28" rx="4" fill="#050505"/>
        <rect x="322" y="352" width="60" height="20" rx="3" fill="#333"/>
        <rect x="392" y="356" width="18" height="10" rx="1" fill="#4a4a4a"/>

        <!-- barrel / forend into scene (upper-left of cluster) -->
        <g transform="translate(0,${-pump})">
          <path d="M295 325 L220 175 L290 162 L398 325 Z" fill="url(#${gid})"/>
          <path d="M295 325 L220 175 L205 188 L258 335 Z" fill="#000"/>
          <path d="M398 325 L290 162 L305 155 L415 318 Z" fill="#050505"/>
          <!-- ribs -->
          <g stroke="#ddd" stroke-width="2.5" opacity="0.55" fill="none">
            <line x1="292" y1="310" x2="380" y2="308"/>
            <line x1="284" y1="292" x2="372" y2="288"/>
            <line x1="275" y1="274" x2="362" y2="268"/>
            <line x1="266" y1="256" x2="350" y2="248"/>
            <line x1="256" y1="238" x2="338" y2="228"/>
            <line x1="248" y1="220" x2="326" y2="208"/>
            <line x1="240" y1="202" x2="314" y2="188"/>
            <line x1="234" y1="188" x2="304" y2="172"/>
          </g>
          <path d="M332 318 L268 185 L276 182 L340 314 Z" fill="#aaa" opacity="0.35"/>
          <!-- mag tube -->
          <path d="M290 325 L238 195 L258 188 L308 322 Z" fill="#0a0a0a"/>
        </g>

        <!-- sights (fixed to receiver) -->
        <circle cx="342" cy="322" r="12" fill="none" stroke="#0a0a0a" stroke-width="6"/>
        <circle cx="342" cy="322" r="12" fill="none" stroke="#777" stroke-width="2"/>
        <circle cx="342" cy="322" r="4" fill="#050505"/>
        <rect x="236" y="168" width="11" height="18" fill="#111"/>
        <rect x="232" y="164" width="19" height="7" rx="1" fill="#444"/>

        <!-- muzzle -->
        <ellipse cx="248" cy="172" rx="26" ry="13" transform="rotate(-14 248 172)" fill="#000"/>
        <ellipse cx="250" cy="170" rx="17" ry="8" transform="rotate(-14 250 170)" fill="#2a2a2a"/>
        <ellipse cx="251" cy="168" rx="8" ry="3.5" transform="rotate(-14 251 168)" fill="#000"/>

        ${
          flash
            ? `<g transform="translate(248,170)">
          <circle r="42" fill="#ff6600" opacity="0.4"/>
          <circle r="28" fill="#ffaa22"/>
          <circle r="14" fill="#fff6d0"/>
          <path d="M0 -44 L10 -10 L0 -16 L-10 -10 Z" fill="#ffe060"/>
          <path d="M0 44 L10 10 L0 16 L-10 10 Z" fill="#ffe060"/>
          <path d="M-44 0 L-10 10 L-16 0 L-10 -10 Z" fill="#ffd040"/>
          <path d="M44 0 L10 10 L16 0 L10 -10 Z" fill="#ffd040"/>
        </g>`
            : ''
        }
      </g>
      ${hands(forendY)}
`;
}

export function weaponFrameArt(clip, frame) {
  const variants = {
    idle: [
      { kick: 0, slide: 0, tilt: 0, forendY: 418 },
      { kick: 3, slide: 0, tilt: 0.4, forendY: 416 },
      { kick: 0, slide: 2, tilt: -0.3, forendY: 419 },
      { kick: 3, slide: 0, tilt: 0.3, forendY: 417 },
    ],
    walk: [
      { kick: 2, slide: -14, tilt: -3.5, forendY: 422 },
      { kick: 10, slide: 8, tilt: 2.5, forendY: 412 },
      { kick: 2, slide: 14, tilt: 3.5, forendY: 422 },
      { kick: 10, slide: -8, tilt: -2.5, forendY: 412 },
    ],
    fire: [
      { kick: 4, slide: 0, tilt: -1, flash: true, forendY: 415 },
      { kick: 28, slide: -4, tilt: -4, forendY: 400 },
      { kick: 16, slide: -2, tilt: -2, forendY: 408 },
      { kick: 4, slide: 0, tilt: 0, forendY: 416 },
    ],
    recoil: [
      { kick: 24, slide: -3, tilt: -3.5, forendY: 402 },
      { kick: 14, slide: -1, tilt: -1.5, forendY: 410 },
      { kick: 5, slide: 0, tilt: -0.4, forendY: 416 },
      { kick: 0, slide: 0, tilt: 0, forendY: 418 },
    ],
    reload: [
      { kick: 4, slide: -6, tilt: 6, pump: 0, forendY: 430 },
      { kick: 8, slide: -12, tilt: 10, pump: 18, forendY: 445 },
      { kick: 10, slide: -10, tilt: 8, pump: 36, forendY: 455 },
      { kick: 8, slide: -6, tilt: 5, pump: 18, forendY: 440 },
      { kick: 3, slide: -2, tilt: 2, pump: 0, forendY: 425 },
      { kick: 0, slide: 0, tilt: 0, pump: 0, forendY: 418 },
    ],
    equip: [
      { kick: 0, slide: 0, tilt: 4, dy: 95, forendY: 430 },
      { kick: 0, slide: 0, tilt: 2, dy: 48, forendY: 424 },
      { kick: 0, slide: 0, tilt: 0.8, dy: 16, forendY: 420 },
      { kick: 0, slide: 0, tilt: 0, dy: 0, forendY: 418 },
    ],
    lower: [
      { kick: 0, slide: 0, tilt: 0, dy: 0, forendY: 418 },
      { kick: 0, slide: 0, tilt: 3, dy: 36, forendY: 424 },
      { kick: 0, slide: 0, tilt: 6, dy: 72, forendY: 432 },
      { kick: 0, slide: 0, tilt: 8, dy: 110, forendY: 440 },
    ],
    muzzle: [{}, {}],
  };

  if (clip === 'muzzle') {
    const s = 0.9 + frame * 0.3;
    return `
      <g transform="translate(256,256) scale(${s})">
        <circle r="44" fill="#ffaa22" opacity="0.95"/>
        <circle r="20" fill="#fff5d0"/>
        <path d="M0 -54 L11 -9 L0 -18 L-11 -9 Z" fill="#ffe060"/>
        <path d="M0 54 L11 9 L0 18 L-11 9 Z" fill="#ffe060"/>
        <path d="M-54 0 L-9 11 L-18 0 L-9 -11 Z" fill="#ffd040"/>
        <path d="M54 0 L9 11 L18 0 L9 -11 Z" fill="#ffd040"/>
      </g>`;
  }

  const pose = (variants[clip] ?? variants.idle)[frame] ?? variants.idle[0];
  const dy = pose.dy ?? 0;
  return root({ ...pose, dy: 0 }, `<g transform="translate(0,${dy})">${shotgun(pose)}</g>`);
}
