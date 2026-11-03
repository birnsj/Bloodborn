/**
 * Readable gothic cultist — Trek-style SVG clarity.
 * Articulated: hips, legs, torso, arms, hood. Feet on y≈500, center x=128.
 * Every clip has obvious body motion (not a robe blob with sleeve wiggle).
 */

const DIRS = ['front', 'frontSide', 'side', 'backSide', 'back'];

const ROBE = '#2a1824';
const ROBE_DK = '#1a1018';
const ROBE_LT = '#3a2434';
const SKIN = '#d4c4b0';
const HOOD = '#120c12';
const GOLD = '#c4a060';
const BOOT = '#0e0a0c';

/**
 * Pose params (pixels / degrees relative to standing rest):
 * hipX, hipY — pelvis
 * torsoRot — lean
 * legL/R: thighDeg, kneeDeg (deg, + opens forward for front view)
 * armL/R: shoulderDeg (deg, + down/out)
 * hoodLift, fallen
 */
function figure(p, dir) {
  if (p.fallen) {
    return `
      <g transform="translate(8,310) rotate(78 120 70)">
        <ellipse cx="120" cy="95" rx="100" ry="42" fill="${ROBE_DK}"/>
        <path d="M35 95 C50 45 90 35 130 40 C170 35 210 55 220 100
                 C180 130 70 135 35 95 Z" fill="${ROBE}"/>
        <ellipse cx="48" cy="72" rx="26" ry="24" fill="${HOOD}"/>
        <ellipse cx="50" cy="76" rx="14" ry="15" fill="${SKIN}"/>
        <ellipse cx="46" cy="74" rx="3" ry="3.5" fill="#1a1010"/>
        <ellipse cx="56" cy="74" rx="3" ry="3.5" fill="#1a1010"/>
      </g>`;
  }

  const side = dir === 'side' || dir === 'backSide' || dir === 'frontSide';
  const back = dir === 'back' || dir === 'backSide';
  const hipX = 128 + (p.hipX ?? 0);
  const hipY = 300 + (p.hipY ?? 0);
  const torsoRot = p.torsoRot ?? 0;

  // Legs: from hip, thigh then shin. Front view: ±x; side view: depth via x squash.
  const leg = (sideSign, thighDeg, kneeDeg, id) => {
    const th = (thighDeg * Math.PI) / 180;
    const kn = (kneeDeg * Math.PI) / 180;
    const thighLen = 95;
    const shinLen = 100;
    const sx = side ? 0.55 : 1;
    const hx = hipX + sideSign * (side ? 6 : 18);
    const hy = hipY + 8;
    const kx = hx + Math.sin(th) * thighLen * sx * sideSign;
    const ky = hy + Math.cos(th) * thighLen;
    const fx = kx + Math.sin(th + kn) * shinLen * sx * sideSign;
    const fy = Math.min(498, ky + Math.cos(th + kn) * shinLen);
    return `
      <g id="${id}">
        <line x1="${hx}" y1="${hy}" x2="${kx}" y2="${ky}" stroke="${ROBE_DK}" stroke-width="28" stroke-linecap="round"/>
        <line x1="${hx}" y1="${hy}" x2="${kx}" y2="${ky}" stroke="${ROBE}" stroke-width="20" stroke-linecap="round"/>
        <line x1="${kx}" y1="${ky}" x2="${fx}" y2="${fy}" stroke="${ROBE_DK}" stroke-width="24" stroke-linecap="round"/>
        <line x1="${kx}" y1="${ky}" x2="${fx}" y2="${fy}" stroke="${ROBE_LT}" stroke-width="16" stroke-linecap="round"/>
        <ellipse cx="${fx}" cy="${Math.min(502, fy + 6)}" rx="${side ? 18 : 22}" ry="10" fill="${BOOT}"/>
      </g>`;
  };

  const arm = (sideSign, shoulderDeg, id) => {
    const sh = (shoulderDeg * Math.PI) / 180;
    const armLen = 88;
    const sx = side ? 0.7 : 1;
    const ax = hipX + sideSign * (side ? 22 : 42);
    const ay = hipY - 110 + (p.hoodLift ?? 0);
    const wx = ax + Math.sin(sh) * armLen * sx * sideSign;
    const wy = ay + Math.cos(sh) * armLen;
    return `
      <g id="${id}">
        <line x1="${ax}" y1="${ay}" x2="${wx}" y2="${wy}" stroke="${ROBE_DK}" stroke-width="22" stroke-linecap="round"/>
        <line x1="${ax}" y1="${ay}" x2="${wx}" y2="${wy}" stroke="${ROBE}" stroke-width="15" stroke-linecap="round"/>
        <ellipse cx="${wx}" cy="${wy}" rx="12" ry="11" fill="${SKIN}"/>
      </g>`;
  };

  const headY = hipY - 175 - (p.hoodLift ?? 0);
  const face = back
    ? `<ellipse cx="${hipX}" cy="${headY}" rx="34" ry="38" fill="${HOOD}"/>`
    : `
      <ellipse cx="${hipX}" cy="${headY}" rx="28" ry="32" fill="${SKIN}"/>
      <ellipse cx="${hipX - 10}" cy="${headY - 2}" rx="4.5" ry="5.5" fill="#1a1010"/>
      <ellipse cx="${hipX + 10}" cy="${headY - 2}" rx="4.5" ry="5.5" fill="#1a1010"/>
      <path d="M${hipX - 10} ${headY + 12} Q${hipX} ${headY + 18} ${hipX + 10} ${headY + 12}"
            fill="none" stroke="#5a4030" stroke-width="2"/>`;

  const weapon =
    p.aiming && !back
      ? `<g>
          <rect x="${hipX + 30}" y="${hipY - 150}" width="70" height="12" rx="2" fill="#3a3a42"
                transform="rotate(-18 ${hipX + 30} ${hipY - 144})"/>
          <rect x="${hipX + 88}" y="${hipY - 158}" width="14" height="10" fill="#222"/>
        </g>`
      : '';

  return `
    <g>
      ${leg(-1, p.thighL ?? 8, p.kneeL ?? 5, 'legL')}
      ${leg(1, p.thighR ?? 8, p.kneeR ?? 5, 'legR')}
      <!-- pelvis / lower robe -->
      <ellipse cx="${hipX}" cy="${hipY}" rx="48" ry="28" fill="${ROBE_DK}"/>
      <path d="M${hipX - 50} ${hipY - 10} L${hipX - 58} ${hipY + 70} L${hipX + 58} ${hipY + 70} L${hipX + 50} ${hipY - 10} Z"
            fill="${ROBE}" opacity="0.85"/>
      <g transform="rotate(${torsoRot} ${hipX} ${hipY - 40})">
        <!-- torso -->
        <path d="M${hipX - 40} ${hipY - 20}
                 C${hipX - 48} ${hipY - 80} ${hipX - 42} ${hipY - 130} ${hipX - 36} ${hipY - 145}
                 L${hipX + 36} ${hipY - 145}
                 C${hipX + 42} ${hipY - 130} ${hipX + 48} ${hipY - 80} ${hipX + 40} ${hipY - 20} Z"
              fill="${ROBE}"/>
        <path d="M${hipX - 28} ${hipY - 30} L${hipX - 32} ${hipY - 130} L${hipX + 32} ${hipY - 130} L${hipX + 28} ${hipY - 30} Z"
              fill="${ROBE_LT}" opacity="0.45"/>
        <circle cx="${hipX}" cy="${hipY - 95}" r="11" fill="#6a5040" stroke="${GOLD}" stroke-width="2.5"/>
        ${arm(-1, p.armL ?? 25, 'armL')}
        ${arm(1, p.armR ?? 25, 'armR')}
        ${weapon}
        <!-- hood -->
        <path d="M${hipX - 42} ${headY + 20}
                 C${hipX - 48} ${headY - 30} ${hipX - 20} ${headY - 55} ${hipX} ${headY - 58}
                 C${hipX + 20} ${headY - 55} ${hipX + 48} ${headY - 30} ${hipX + 42} ${headY + 20}
                 C${hipX + 24} ${headY + 8} ${hipX - 24} ${headY + 8} ${hipX - 42} ${headY + 20} Z"
              fill="${HOOD}"/>
        <path d="M${hipX - 30} ${headY + 8} C${hipX - 20} ${headY - 12} ${hipX + 20} ${headY - 12} ${hipX + 30} ${headY + 8}
                 C${hipX + 18} ${headY + 22} ${hipX - 18} ${headY + 22} ${hipX - 30} ${headY + 8} Z"
              fill="#0a060a"/>
        ${face}
      </g>
    </g>`;
}

function walkPose(frame, frames, run = false) {
  const t = (frame / frames) * Math.PI * 2;
  const amp = run ? 1.45 : 1;
  const s = Math.sin(t) * amp;
  const c = Math.cos(t) * amp;
  return {
    hipX: s * 4,
    hipY: Math.abs(c) * -6 * amp,
    torsoRot: s * 4,
    thighL: 8 + s * 28,
    kneeL: 5 + Math.max(0, -s) * 35,
    thighR: 8 - s * 28,
    kneeR: 5 + Math.max(0, s) * 35,
    armL: 25 - s * 32,
    armR: 25 + s * 32,
    hoodLift: Math.abs(c) * 2,
  };
}

function poseFor(clip, frame, dir) {
  if (clip === 'idle') {
    const b = Math.sin(frame * 0.9);
    return {
      hipY: b * 2,
      torsoRot: b * 1.5,
      thighL: 6,
      kneeL: 4,
      thighR: 6,
      kneeR: 4,
      armL: 22 + b * 3,
      armR: 22 - b * 3,
      hoodLift: (frame % 2) * 1,
    };
  }
  if (clip === 'walk') return walkPose(frame, 6, false);
  if (clip === 'run') return walkPose(frame, 6, true);
  if (clip === 'alert') {
    return {
      hipY: -8,
      torsoRot: 6 + frame * 2,
      thighL: 4,
      kneeL: 8,
      thighR: 10,
      kneeR: 4,
      armL: 15,
      armR: -5 - frame * 12,
      hoodLift: 6,
      aiming: frame >= 1,
    };
  }
  if (clip === 'attack') {
    // wind-up → thrust → hold → recover
    const stages = [
      { armR: -15, torsoRot: -8, hipY: 4, aiming: true },
      { armR: -40, torsoRot: 14, hipY: -6, aiming: true },
      { armR: -28, torsoRot: 10, hipY: -2, aiming: true },
      { armR: 5, torsoRot: 4, hipY: 0, aiming: true },
    ];
    return {
      thighL: 6,
      kneeL: 6,
      thighR: 10,
      kneeR: 4,
      armL: 18,
      hoodLift: 4,
      ...(stages[frame] ?? stages[0]),
    };
  }
  if (clip === 'hit') {
    return {
      hipX: -10 - frame * 6,
      hipY: 12 + frame * 8,
      torsoRot: -16 - frame * 8,
      thighL: 20,
      kneeL: 25,
      thighR: 5,
      kneeR: 10,
      armL: 45,
      armR: 40,
      hoodLift: -4,
    };
  }
  if (clip === 'death') {
    if (frame >= 5) return { fallen: true };
    const t = frame / 4;
    return {
      hipX: t * 30,
      hipY: t * 40,
      torsoRot: t * 55,
      thighL: 15 + t * 20,
      kneeL: 30,
      thighR: 10 + t * 15,
      kneeR: 25,
      armL: 40 + t * 20,
      armR: 10 - t * 30,
      hoodLift: -t * 10,
      fallen: frame >= 5,
    };
  }
  if (clip === 'dead') return { fallen: true };
  return {};
}

function dirNudge(dir) {
  return (
    {
      front: { hipX: 0 },
      frontSide: { hipX: 6, torsoRot: 4 },
      side: { hipX: 10, torsoRot: 8 },
      backSide: { hipX: 4, torsoRot: 3 },
      back: { hipX: 0 },
    }[dir] ?? { hipX: 0 }
  );
}

function dirPose(dir, clip, frame) {
  const base = poseFor(clip, frame, dir);
  const nudge = dirNudge(dir);
  const merged = {
    ...base,
    hipX: (base.hipX ?? 0) + (nudge.hipX ?? 0),
    torsoRot: (base.torsoRot ?? 0) + (nudge.torsoRot ?? 0),
  };
  return figure(merged, dir);
}

export function cultistFrameArt(clip, dir, frame) {
  if (clip === 'death' || clip === 'dead') {
    return dirPose('front', clip, frame);
  }
  return dirPose(dir || 'front', clip, frame);
}

export { DIRS };
