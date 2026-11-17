import * as THREE from 'three';
import {
  CENTER_CIRCLE_RADIUS,
  GOAL_AREA_DEPTH,
  GOAL_AREA_HALF_WIDTH,
  PENALTY_AREA_DEPTH,
  PENALTY_AREA_HALF_WIDTH,
  PENALTY_SPOT_DIST,
  PITCH_LENGTH,
  PITCH_WIDTH,
} from './constants';
import { TeamId } from '../types/game';

export function createPitchTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 2048;
  const h = 1312;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Base emerald grass
  ctx.fillStyle = '#1f6e36';
  ctx.fillRect(0, 0, w, h);

  // Mowed vertical turf stripes (18 stripes across pitch length)
  const stripeCount = 18;
  const padX = 80;
  const padY = 64;
  const fieldW = w - padX * 2;
  const fieldH = h - padY * 2;
  const stripeW = fieldW / stripeCount;

  // Outer grass apron subtle darker shade
  ctx.fillStyle = '#18592b';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < stripeCount; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#22783b' : '#1b6430';
    ctx.fillRect(padX + i * stripeW, padY, stripeW + 1, fieldH);
  }

  // Subtle organic turf grain
  const grainCanvas = document.createElement('canvas');
  grainCanvas.width = 128;
  grainCanvas.height = 128;
  const gCtx = grainCanvas.getContext('2d')!;
  const imgData = gCtx.createImageData(128, 128);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const v = 115 + Math.random() * 45;
    imgData.data[i] = v;
    imgData.data[i + 1] = v + 12;
    imgData.data[i + 2] = v;
    imgData.data[i + 3] = 22;
  }
  gCtx.putImageData(imgData, 0, 0);
  const pattern = ctx.createPattern(grainCanvas, 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
  }

  // Convert world meters to canvas pixels
  const pxPerMeterX = fieldW / PITCH_LENGTH;
  const pxPerMeterZ = fieldH / PITCH_WIDTH;
  const toX = (xWorld: number) => padX + (xWorld + PITCH_LENGTH / 2) * pxPerMeterX;
  const toY = (zWorld: number) => padY + (zWorld + PITCH_WIDTH / 2) * pxPerMeterZ;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.lineWidth = 4.5;

  // Touchlines and goal lines
  ctx.strokeRect(padX, padY, fieldW, fieldH);

  // Halfway line
  ctx.beginPath();
  ctx.moveTo(toX(0), padY);
  ctx.lineTo(toX(0), padY + fieldH);
  ctx.stroke();

  // Center circle & spot
  ctx.beginPath();
  ctx.ellipse(
    toX(0),
    toY(0),
    CENTER_CIRCLE_RADIUS * pxPerMeterX,
    CENTER_CIRCLE_RADIUS * pxPerMeterZ,
    0,
    0,
    Math.PI * 2,
  );
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(toX(0), toY(0), 6, 0, Math.PI * 2);
  ctx.fill();

  // Left and Right Penalty Areas, Goal Areas, Penalty Spots & Arcs
  for (const side of [-1, 1]) {
    const goalLineX = side * (PITCH_LENGTH / 2);
    const penBoxX = goalLineX - side * PENALTY_AREA_DEPTH;
    const minX = Math.min(goalLineX, penBoxX);
    const maxX = Math.max(goalLineX, penBoxX);

    ctx.strokeRect(
      toX(minX),
      toY(-PENALTY_AREA_HALF_WIDTH),
      (maxX - minX) * pxPerMeterX,
      PENALTY_AREA_HALF_WIDTH * 2 * pxPerMeterZ,
    );

    const gBoxX = goalLineX - side * GOAL_AREA_DEPTH;
    const gMinX = Math.min(goalLineX, gBoxX);
    const gMaxX = Math.max(goalLineX, gBoxX);

    ctx.strokeRect(
      toX(gMinX),
      toY(-GOAL_AREA_HALF_WIDTH),
      (gMaxX - gMinX) * pxPerMeterX,
      GOAL_AREA_HALF_WIDTH * 2 * pxPerMeterZ,
    );

    const spotX = goalLineX - side * PENALTY_SPOT_DIST;
    ctx.beginPath();
    ctx.arc(toX(spotX), toY(0), 5, 0, Math.PI * 2);
    ctx.fill();

    // Penalty Arc
    const arcRadiusX = CENTER_CIRCLE_RADIUS * pxPerMeterX;
    const arcRadiusZ = CENTER_CIRCLE_RADIUS * pxPerMeterZ;
    const dx = PENALTY_AREA_DEPTH - PENALTY_SPOT_DIST;
    const angle = Math.acos(dx / CENTER_CIRCLE_RADIUS);
    ctx.beginPath();
    if (side === -1) {
      ctx.ellipse(toX(spotX), toY(0), arcRadiusX, arcRadiusZ, 0, -angle, angle);
    } else {
      ctx.ellipse(toX(spotX), toY(0), arcRadiusX, arcRadiusZ, 0, Math.PI - angle, Math.PI + angle);
    }
    ctx.stroke();
  }

  // Corner arcs
  const cornerR = 1.4 * pxPerMeterX;
  const corners = [
    { x: padX, y: padY, s: 0, e: Math.PI / 2 },
    { x: padX + fieldW, y: padY, s: Math.PI / 2, e: Math.PI },
    { x: padX + fieldW, y: padY + fieldH, s: Math.PI, e: Math.PI * 1.5 },
    { x: padX, y: padY + fieldH, s: Math.PI * 1.5, e: Math.PI * 2 },
  ];
  for (const c of corners) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, cornerR, c.s, c.e);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function createFootballTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, size, size);

  // Subtle hexagonal panel grid & dark pentagons for classic match ball silhouette
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;

  const cols = 6;
  const rows = 4;
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const cx = (c / cols) * size + (r % 2 === 0 ? 0 : size / (cols * 2));
      const cy = (r / rows) * size;
      const rad = 26;
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const ang = (k / 5) * Math.PI * 2 - Math.PI / 2;
        const px = cx + Math.cos(ang) * rad;
        const py = cy + Math.sin(ang) * rad;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = (r + c) % 2 === 0 ? '#0f172a' : '#1d4ed8';
      ctx.fill();
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function createJerseyTexture(
  team: TeamId,
  isGK: boolean,
  playerNumber: number,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const w = 256;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  if (isGK) {
    if (team === 'madrid') {
      ctx.fillStyle = '#0d9488'; // Vivid teal goalkeeper kit
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#115e59';
      ctx.fillRect(0, 0, w, 34);
    } else {
      ctx.fillStyle = '#eab308'; // Vivid gold/amber goalkeeper kit
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, w, 34);
    }
  } else if (team === 'madrid') {
    // Crisp white kit with royal gold & navy accents
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);

    // Subtle diagonal fabric weave
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
    ctx.lineWidth = 2;
    for (let i = -h; i < w + h; i += 14) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h, h);
      ctx.stroke();
    }

    // Collar & gold trim
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, 24);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(0, 22, w, 6);

    // Side navy stripe
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 0, 12, h);
    ctx.fillRect(w - 12, 0, 12, h);
  } else {
    // FC Barcelona Blaugrana vertical stripes
    const stripes = 6;
    const stripeW = w / stripes;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#004d98' : '#a50044';
      ctx.fillRect(i * stripeW, 0, stripeW + 1, h);
    }

    // Gold/yellow collar trim
    ctx.fillStyle = '#071b3d';
    ctx.fillRect(0, 0, w, 24);
    ctx.fillStyle = '#edbb00';
    ctx.fillRect(0, 22, w, 6);
  }

  // Front crest emblem
  ctx.fillStyle = team === 'madrid' && !isGK ? '#d4af37' : '#fbbf24';
  ctx.beginPath();
  ctx.arc(w * 0.28, h * 0.34, 12, 0, Math.PI * 2);
  ctx.fill();

  // Back number (rendered on back face of box UV or centered)
  ctx.fillStyle = isGK ? '#0f172a' : team === 'madrid' ? '#0f172a' : '#fbbf24';
  ctx.font = 'bold 74px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(playerNumber), w * 0.5, h * 0.56);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function createAdBoardTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const panels = [
    { bg: '#0f172a', accent: '#d4af37', text: 'EL CLASICO' },
    { bg: '#004d98', accent: '#edbb00', text: 'FC BARCELONA' },
    { bg: '#f8fafc', accent: '#1e3a8a', text: 'REAL MADRID', darkText: true },
    { bg: '#a50044', accent: '#ffffff', text: 'PRIMERA DIVISION' },
  ];

  const pw = w / panels.length;
  panels.forEach((p, idx) => {
    const x = idx * pw;
    ctx.fillStyle = p.bg;
    ctx.fillRect(x, 0, pw, h);
    ctx.fillStyle = p.accent;
    ctx.fillRect(x, 0, pw, 10);
    ctx.fillRect(x, h - 10, pw, 10);

    ctx.fillStyle = p.darkText ? '#0f172a' : '#ffffff';
    ctx.font = 'bold 34px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.text, x + pw / 2, h / 2);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(3, 1);
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function createGoalNetTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(241, 245, 249, 0.85)';
  ctx.lineWidth = 4;

  const step = 16;
  for (let i = 0; i <= size; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 4);
  texture.needsUpdate = true;
  return texture;
}
