import * as THREE from 'three';
import { PlayerRosterEntry, TeamId } from '../types/game';
import { createJerseyTexture } from './textures';

export interface PlayerVisualRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  head: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  indicatorRing: THREE.Mesh;
  aimArrow: THREE.Mesh;
  passTargetRing: THREE.Mesh;
  shadowMesh: THREE.Mesh;
  dispose: () => void;
}

// Shared static geometries for all 22 players to minimize GPU memory & draw overhead
let sharedGeo: {
  head: THREE.SphereGeometry;
  hair: THREE.SphereGeometry;
  torso: THREE.BoxGeometry;
  shorts: THREE.BoxGeometry;
  arm: THREE.CapsuleGeometry;
  thigh: THREE.CapsuleGeometry;
  sock: THREE.CylinderGeometry;
  boot: THREE.BoxGeometry;
  ring: THREE.RingGeometry;
  arrow: THREE.ConeGeometry;
  shadow: THREE.PlaneGeometry;
} | null = null;

function getSharedGeometries() {
  if (sharedGeo) return sharedGeo;
  sharedGeo = {
    head: new THREE.SphereGeometry(0.155, 16, 14),
    hair: new THREE.SphereGeometry(0.162, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
    torso: new THREE.BoxGeometry(0.46, 0.54, 0.25),
    shorts: new THREE.BoxGeometry(0.44, 0.22, 0.24),
    arm: new THREE.CapsuleGeometry(0.062, 0.34, 4, 8),
    thigh: new THREE.CapsuleGeometry(0.078, 0.24, 4, 8),
    sock: new THREE.CylinderGeometry(0.062, 0.052, 0.34, 10),
    boot: new THREE.BoxGeometry(0.12, 0.09, 0.24),
    ring: new THREE.RingGeometry(0.42, 0.54, 28),
    arrow: new THREE.ConeGeometry(0.16, 0.28, 3),
    shadow: new THREE.PlaneGeometry(1.1, 1.1),
  };
  return sharedGeo;
}

export function createPlayerRig(
  entry: PlayerRosterEntry,
  team: TeamId,
  shadowTexture: THREE.Texture,
  maxAnisotropy: number,
): PlayerVisualRig {
  const geo = getSharedGeometries();
  const isGK = entry.role === 'GK';

  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const jerseyTex = createJerseyTexture(team, isGK, entry.number, maxAnisotropy);
  const jerseyMat = new THREE.MeshStandardMaterial({
    map: jerseyTex,
    roughness: 0.78,
    metalness: 0.05,
  });

  const shortsColor = isGK
    ? team === 'madrid'
      ? 0x0f766e
      : 0x1e293b
    : team === 'madrid'
      ? 0xf1f5f9
      : 0x003377;

  const shortsMat = new THREE.MeshStandardMaterial({
    color: shortsColor,
    roughness: 0.82,
    metalness: 0.04,
  });

  const sockColor = isGK
    ? team === 'madrid'
      ? 0x0d9488
      : 0xeab308
    : team === 'madrid'
      ? 0xf8fafc
      : 0x004d98;

  const sockMat = new THREE.MeshStandardMaterial({
    color: sockColor,
    roughness: 0.85,
  });

  const skinMat = new THREE.MeshStandardMaterial({
    color: entry.skinTone,
    roughness: 0.65,
    metalness: 0.02,
  });

  const hairMat = new THREE.MeshStandardMaterial({
    color: entry.hairColor,
    roughness: 0.9,
  });

  const bootMat = new THREE.MeshStandardMaterial({
    color: team === 'madrid' ? 0x111827 : 0xdc2626,
    roughness: 0.38,
    metalness: 0.25,
  });

  // Torso centered at y = 1.08
  const torso = new THREE.Mesh(geo.torso, jerseyMat);
  torso.position.y = 1.08;
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyGroup.add(torso);

  // Shorts at y = 0.74
  const shorts = new THREE.Mesh(geo.shorts, shortsMat);
  shorts.position.y = 0.74;
  shorts.castShadow = true;
  bodyGroup.add(shorts);

  // Head + Hair at y = 1.52
  const head = new THREE.Group();
  head.position.y = 1.52;
  const headSphere = new THREE.Mesh(geo.head, skinMat);
  headSphere.castShadow = true;
  const hairCap = new THREE.Mesh(geo.hair, hairMat);
  hairCap.position.y = 0.02;
  hairCap.rotation.x = -0.18;
  head.add(headSphere, hairCap);
  bodyGroup.add(head);

  // Arms (pivoted at shoulders y = 1.30)
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.29, 1.30, 0);
  const leftSleeve = new THREE.Mesh(geo.arm, skinMat);
  leftSleeve.position.y = -0.20;
  leftSleeve.castShadow = true;
  leftArmPivot.add(leftSleeve);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.29, 1.30, 0);
  const rightSleeve = new THREE.Mesh(geo.arm, skinMat);
  rightSleeve.position.y = -0.20;
  rightSleeve.castShadow = true;
  rightArmPivot.add(rightSleeve);

  // GK gloves
  if (isGK) {
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
    const lGlove = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.09), gloveMat);
    lGlove.position.y = -0.44;
    const rGlove = lGlove.clone();
    leftArmPivot.add(lGlove);
    rightArmPivot.add(rGlove);
  }

  bodyGroup.add(leftArmPivot, rightArmPivot);

  // Legs (pivoted at hips y = 0.68)
  const buildLeg = (xOffset: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(xOffset, 0.68, 0);

    const thigh = new THREE.Mesh(geo.thigh, skinMat);
    thigh.position.y = -0.18;
    thigh.castShadow = true;

    const sock = new THREE.Mesh(geo.sock, sockMat);
    sock.position.y = -0.45;
    sock.castShadow = true;

    const boot = new THREE.Mesh(geo.boot, bootMat);
    boot.position.set(0, -0.635, 0.045);
    boot.castShadow = true;

    pivot.add(thigh, sock, boot);
    return pivot;
  };

  const leftLegPivot = buildLeg(-0.12);
  const rightLegPivot = buildLeg(0.12);
  bodyGroup.add(leftLegPivot, rightLegPivot);

  // Contact Shadow disc on ground
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0.65,
  });
  const shadowMesh = new THREE.Mesh(geo.shadow, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.025;
  root.add(shadowMesh);

  // Active controlled player tactical ring
  const ringMat = new THREE.MeshBasicMaterial({
    color: team === 'madrid' ? 0xfbbf24 : 0x38bdf8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const indicatorRing = new THREE.Mesh(geo.ring, ringMat);
  indicatorRing.rotation.x = -Math.PI / 2;
  indicatorRing.position.y = 0.035;
  indicatorRing.visible = false;
  root.add(indicatorRing);

  // Facing / aim triangle pointer on ring
  const arrowMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const aimArrow = new THREE.Mesh(geo.arrow, arrowMat);
  aimArrow.rotation.x = Math.PI / 2;
  aimArrow.position.set(0, 0.045, 0.72);
  aimArrow.visible = false;
  root.add(aimArrow);

  // Pass target highlight ring
  const passRingMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });
  const passTargetRing = new THREE.Mesh(geo.ring, passRingMat);
  passTargetRing.rotation.x = -Math.PI / 2;
  passTargetRing.position.y = 0.032;
  passTargetRing.scale.setScalar(0.86);
  passTargetRing.visible = false;
  root.add(passTargetRing);

  return {
    root,
    bodyGroup,
    head,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    indicatorRing,
    aimArrow,
    passTargetRing,
    shadowMesh,
    dispose: () => {
      jerseyTex.dispose();
      jerseyMat.dispose();
      shortsMat.dispose();
      sockMat.dispose();
      skinMat.dispose();
      hairMat.dispose();
      bootMat.dispose();
      shadowMat.dispose();
      ringMat.dispose();
      arrowMat.dispose();
      passRingMat.dispose();
    },
  };
}

export function animatePlayerRig(
  rig: PlayerVisualRig,
  speed: number,
  maxSpeed: number,
  stridePhase: number,
  kickTimer: number,
  tackleTimer: number,
  jumpHeight: number,
  celebrating: boolean,
  isGK: boolean,
  gkDiveDir: number,
  elapsed: number,
) {
  rig.bodyGroup.position.y = jumpHeight;

  if (tackleTimer > 0) {
    // Low sliding tackle pose
    rig.bodyGroup.rotation.x = -1.15;
    rig.bodyGroup.position.y = 0.25;
    rig.rightLegPivot.rotation.x = -0.85;
    rig.leftLegPivot.rotation.x = 0.5;
    rig.leftArmPivot.rotation.x = 0.7;
    rig.rightArmPivot.rotation.x = -0.4;
    return;
  }

  if (celebrating) {
    // Victory sprint & arms raised
    const hop = Math.abs(Math.sin(elapsed * 8)) * 0.28;
    rig.bodyGroup.position.y = hop;
    rig.bodyGroup.rotation.x = 0.05;
    rig.leftArmPivot.rotation.z = 2.4;
    rig.rightArmPivot.rotation.z = -2.4;
    rig.leftArmPivot.rotation.x = Math.sin(elapsed * 10) * 0.2;
    rig.rightArmPivot.rotation.x = -Math.sin(elapsed * 10) * 0.2;
    rig.leftLegPivot.rotation.x = Math.sin(stridePhase) * 0.6;
    rig.rightLegPivot.rotation.x = -Math.sin(stridePhase) * 0.6;
    return;
  }

  rig.leftArmPivot.rotation.z = 0.08;
  rig.rightArmPivot.rotation.z = -0.08;

  if (isGK && Math.abs(gkDiveDir) > 0.05) {
    rig.bodyGroup.rotation.z = gkDiveDir * 1.15;
    rig.bodyGroup.position.y = 0.45;
    rig.leftArmPivot.rotation.z = 2.6;
    rig.rightArmPivot.rotation.z = -2.6;
    return;
  }
  rig.bodyGroup.rotation.z = 0;

  const speedNorm = Math.min(1.2, speed / Math.max(0.1, maxSpeed));

  if (kickTimer > 0) {
    // Dynamic shooting/passing follow-through
    const swing = Math.sin((kickTimer / 0.28) * Math.PI);
    rig.rightLegPivot.rotation.x = -swing * 1.25;
    rig.leftLegPivot.rotation.x = swing * 0.35;
    rig.leftArmPivot.rotation.x = -swing * 0.8;
    rig.rightArmPivot.rotation.x = swing * 0.6;
    rig.bodyGroup.rotation.x = 0.14;
    return;
  }

  if (speedNorm > 0.08) {
    const legAmp = 0.35 + speedNorm * 0.55;
    const armAmp = 0.3 + speedNorm * 0.45;
    rig.leftLegPivot.rotation.x = Math.sin(stridePhase) * legAmp;
    rig.rightLegPivot.rotation.x = -Math.sin(stridePhase) * legAmp;
    rig.leftArmPivot.rotation.x = -Math.sin(stridePhase) * armAmp;
    rig.rightArmPivot.rotation.x = Math.sin(stridePhase) * armAmp;
    // Slight athletic forward lean proportional to sprint
    rig.bodyGroup.rotation.x = speedNorm * 0.16;
    rig.bodyGroup.position.y += Math.abs(Math.sin(stridePhase)) * 0.055 * speedNorm;
  } else {
    // Ready athletic idle breathing
    const breath = Math.sin(elapsed * 2.6) * 0.02;
    rig.bodyGroup.rotation.x = isGK ? 0.18 : 0.04;
    rig.leftLegPivot.rotation.x = breath;
    rig.rightLegPivot.rotation.x = -breath;
    rig.leftArmPivot.rotation.x = isGK ? -0.45 : breath * 1.5;
    rig.rightArmPivot.rotation.x = isGK ? -0.45 : -breath * 1.5;
  }
}
