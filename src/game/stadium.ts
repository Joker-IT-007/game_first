import * as THREE from 'three';
import {
  GOAL_DEPTH,
  GOAL_HALF_WIDTH,
  GOAL_HEIGHT,
  GOAL_POST_RADIUS,
  HALF_LENGTH,
  HALF_WIDTH,
  PITCH_LENGTH,
  PITCH_WIDTH,
} from './constants';
import {
  createAdBoardTexture,
  createGoalNetTexture,
  createPitchTexture,
} from './textures';
import { LightingMode } from '../types/game';

export interface StadiumRig {
  group: THREE.Group;
  setLightingMode: (mode: LightingMode, scene: THREE.Scene) => void;
  update: (elapsed: number, excitement: number) => void;
  triggerGoalRipple: (side: -1 | 1) => void;
  dispose: () => void;
}

export function createStadium(
  scene: THREE.Scene,
  maxAnisotropy: number,
  isSoftwareGl: boolean,
): StadiumRig {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  // 1. Extended exterior ground plane so stadium sits naturally on earth
  const exteriorGeo = new THREE.CircleGeometry(320, 48);
  const exteriorMat = new THREE.MeshStandardMaterial({
    color: 0x101d16,
    roughness: 0.96,
    metalness: 0.0,
  });
  const exteriorGround = new THREE.Mesh(exteriorGeo, exteriorMat);
  exteriorGround.rotation.x = -Math.PI / 2;
  exteriorGround.position.y = -0.08;
  exteriorGround.receiveShadow = true;
  group.add(exteriorGround);
  disposables.push(exteriorGeo, exteriorMat);

  // Inner technical track / stadium floor apron
  const apronGeo = new THREE.PlaneGeometry(PITCH_LENGTH + 26, PITCH_WIDTH + 24);
  const apronMat = new THREE.MeshStandardMaterial({
    color: 0x164227,
    roughness: 0.9,
    metalness: 0.02,
  });
  const apron = new THREE.Mesh(apronGeo, apronMat);
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.02;
  apron.receiveShadow = true;
  group.add(apron);
  disposables.push(apronGeo, apronMat);

  // 2. Main Pitch Surface with high-res FIFA markings
  const pitchTex = createPitchTexture(maxAnisotropy);
  // Match canvas pad ratio (2048 x 1312, padX=80 -> 1888 field, padY=64 -> 1184 field)
  const pitchGeo = new THREE.PlaneGeometry(
    PITCH_LENGTH * (2048 / 1888),
    PITCH_WIDTH * (1312 / 1184),
  );
  const pitchMat = new THREE.MeshStandardMaterial({
    map: pitchTex,
    roughness: 0.88,
    metalness: 0.02,
  });
  const pitch = new THREE.Mesh(pitchGeo, pitchMat);
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.y = 0.0;
  pitch.receiveShadow = true;
  group.add(pitch);
  disposables.push(pitchTex, pitchGeo, pitchMat);

  // 3. Perimeter LED Advertising Boards
  const adTex = createAdBoardTexture(maxAnisotropy);
  const adMat = new THREE.MeshStandardMaterial({
    map: adTex,
    emissiveMap: adTex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.35,
    roughness: 0.4,
    metalness: 0.1,
  });
  disposables.push(adTex, adMat);

  const boardHeight = 1.15;
  const sideBoardGeo = new THREE.BoxGeometry(PITCH_LENGTH + 6, boardHeight, 0.28);
  const endBoardGeo = new THREE.BoxGeometry(0.28, boardHeight, PITCH_WIDTH + 6);
  disposables.push(sideBoardGeo, endBoardGeo);

  const northBoard = new THREE.Mesh(sideBoardGeo, adMat);
  northBoard.position.set(0, boardHeight / 2, -(HALF_WIDTH + 4.2));
  const southBoard = new THREE.Mesh(sideBoardGeo, adMat);
  southBoard.position.set(0, boardHeight / 2, HALF_WIDTH + 4.2);
  const westBoard = new THREE.Mesh(endBoardGeo, adMat);
  westBoard.position.set(-(HALF_LENGTH + 4.5), boardHeight / 2, 0);
  const eastBoard = new THREE.Mesh(endBoardGeo, adMat);
  eastBoard.position.set(HALF_LENGTH + 4.5, boardHeight / 2, 0);
  group.add(northBoard, southBoard, westBoard, eastBoard);

  // 4. Team Dugouts / Benches on North Touchline
  const dugoutGeo = new THREE.BoxGeometry(10, 1.9, 2.2);
  const dugoutMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.5,
    metalness: 0.4,
  });
  const dugoutGlassMat = new THREE.MeshStandardMaterial({
    color: 0x93c5fd,
    roughness: 0.15,
    metalness: 0.2,
    transparent: true,
    opacity: 0.45,
  });
  const leftDugout = new THREE.Mesh(dugoutGeo, dugoutMat);
  leftDugout.position.set(-14, 0.95, -(HALF_WIDTH + 6.2));
  const rightDugout = new THREE.Mesh(dugoutGeo, dugoutMat);
  rightDugout.position.set(14, 0.95, -(HALF_WIDTH + 6.2));
  group.add(leftDugout, rightDugout);
  disposables.push(dugoutGeo, dugoutMat, dugoutGlassMat);

  // 5. Goals (Left x = -HALF_LENGTH, Right x = +HALF_LENGTH)
  const postMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.25,
    metalness: 0.65,
  });
  const netTex = createGoalNetTexture();
  const netMat = new THREE.MeshStandardMaterial({
    map: netTex,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    depthWrite: false,
    roughness: 0.9,
  });
  disposables.push(postMat, netTex, netMat);

  const postGeo = new THREE.CylinderGeometry(
    GOAL_POST_RADIUS,
    GOAL_POST_RADIUS,
    GOAL_HEIGHT,
    14,
  );
  const crossbarGeo = new THREE.CylinderGeometry(
    GOAL_POST_RADIUS,
    GOAL_POST_RADIUS,
    GOAL_HALF_WIDTH * 2 + GOAL_POST_RADIUS * 2,
    14,
  );
  const supportGeo = new THREE.CylinderGeometry(0.05, 0.05, GOAL_DEPTH, 10);
  const backNetGeo = new THREE.PlaneGeometry(GOAL_HALF_WIDTH * 2, GOAL_HEIGHT, 10, 6);
  const sideNetGeo = new THREE.PlaneGeometry(GOAL_DEPTH, GOAL_HEIGHT, 4, 6);
  const topNetGeo = new THREE.PlaneGeometry(GOAL_HALF_WIDTH * 2, GOAL_DEPTH, 10, 4);
  disposables.push(postGeo, crossbarGeo, supportGeo, backNetGeo, sideNetGeo, topNetGeo);

  const goalNets: { side: -1 | 1; backMesh: THREE.Mesh; ripple: number }[] = [];

  for (const side of [-1, 1] as const) {
    const goalGroup = new THREE.Group();
    const xLine = side * HALF_LENGTH;
    const xBack = xLine + side * GOAL_DEPTH;

    const leftPost = new THREE.Mesh(postGeo, postMat);
    leftPost.position.set(xLine, GOAL_HEIGHT / 2, -GOAL_HALF_WIDTH);
    leftPost.castShadow = true;

    const rightPost = new THREE.Mesh(postGeo, postMat);
    rightPost.position.set(xLine, GOAL_HEIGHT / 2, GOAL_HALF_WIDTH);
    rightPost.castShadow = true;

    const crossbar = new THREE.Mesh(crossbarGeo, postMat);
    crossbar.rotation.x = Math.PI / 2;
    crossbar.position.set(xLine, GOAL_HEIGHT, 0);
    crossbar.castShadow = true;

    // Ground & top back stanchions
    for (const zSign of [-1, 1]) {
      const zPos = zSign * GOAL_HALF_WIDTH;
      const topSupport = new THREE.Mesh(supportGeo, postMat);
      topSupport.rotation.z = Math.PI / 2;
      topSupport.position.set((xLine + xBack) / 2, GOAL_HEIGHT, zPos);

      const bottomSupport = new THREE.Mesh(supportGeo, postMat);
      bottomSupport.rotation.z = Math.PI / 2;
      bottomSupport.position.set((xLine + xBack) / 2, 0.05, zPos);

      const backCornerPost = new THREE.Mesh(postGeo, postMat);
      backCornerPost.scale.set(0.6, 1, 0.6);
      backCornerPost.position.set(xBack, GOAL_HEIGHT / 2, zPos);

      const sideNet = new THREE.Mesh(sideNetGeo, netMat);
      sideNet.position.set((xLine + xBack) / 2, GOAL_HEIGHT / 2, zPos);

      goalGroup.add(topSupport, bottomSupport, backCornerPost, sideNet);
    }

    const backBar = new THREE.Mesh(crossbarGeo, postMat);
    backBar.scale.set(0.6, 1, 0.6);
    backBar.rotation.x = Math.PI / 2;
    backBar.position.set(xBack, 0.05, 0);

    const backNet = new THREE.Mesh(backNetGeo, netMat);
    backNet.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2;
    backNet.position.set(xBack, GOAL_HEIGHT / 2, 0);

    const topNet = new THREE.Mesh(topNetGeo, netMat);
    topNet.rotation.x = Math.PI / 2;
    topNet.rotation.z = Math.PI / 2;
    topNet.position.set((xLine + xBack) / 2, GOAL_HEIGHT, 0);

    goalGroup.add(leftPost, rightPost, crossbar, backBar, backNet, topNet);
    group.add(goalGroup);
    goalNets.push({ side, backMesh: backNet, ripple: 0 });
  }

  // 6. Corner Flags (x4)
  const flagPoleGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.55, 8);
  const flagPoleMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
  const flagClothGeo = new THREE.PlaneGeometry(0.5, 0.35, 4, 1);
  flagClothGeo.translate(0.25, 0, 0);
  const flagClothMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    side: THREE.DoubleSide,
    roughness: 0.7,
  });
  disposables.push(flagPoleGeo, flagPoleMat, flagClothGeo, flagClothMat);

  const cornerFlags: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pole = new THREE.Mesh(flagPoleGeo, flagPoleMat);
      pole.position.set(sx * HALF_LENGTH, 0.775, sz * HALF_WIDTH);
      pole.castShadow = true;

      const cloth = new THREE.Mesh(flagClothGeo, flagClothMat);
      cloth.position.set(sx * HALF_LENGTH, 1.35, sz * HALF_WIDTH);
      group.add(pole, cloth);
      cornerFlags.push(cloth);
    }
  }

  // 7. Multi-Tiered Stadium Grandstands & Cantilever Roof
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x263142,
    roughness: 0.85,
    metalness: 0.1,
  });
  const tierDarkMat = new THREE.MeshStandardMaterial({
    color: 0x131b2b,
    roughness: 0.88,
    metalness: 0.08,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.35,
    metalness: 0.72,
  });
  const fasciaGoldMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    emissive: 0x7c6216,
    emissiveIntensity: 0.25,
    roughness: 0.35,
    metalness: 0.75,
  });
  const rimLedMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });
  disposables.push(concreteMat, tierDarkMat, roofMat, fasciaGoldMat, rimLedMat);

  // Build 4 stands (North, South, West, East) with lower bowl, upper bowl, roof, and corner towers
  const buildStand = (
    length: number,
    distFromCenter: number,
    rotY: number,
  ) => {
    const stand = new THREE.Group();
    stand.rotation.y = rotY;

    // Stepped lower seating bowl (5 risers)
    for (let step = 0; step < 5; step++) {
      const stepDepth = 3.2;
      const stepH = 1.5;
      const riserGeo = new THREE.BoxGeometry(length, stepH + step * 1.1, stepDepth);
      const riser = new THREE.Mesh(riserGeo, step % 2 === 0 ? concreteMat : tierDarkMat);
      riser.position.set(0, (stepH + step * 1.1) / 2, -(distFromCenter + step * 2.8));
      riser.receiveShadow = true;
      stand.add(riser);
      disposables.push(riserGeo);
    }

    // Mid-tier fascia LED ribbon
    const ribbonGeo = new THREE.BoxGeometry(length, 0.7, 0.4);
    const ribbon = new THREE.Mesh(ribbonGeo, rimLedMat);
    ribbon.position.set(0, 7.6, -(distFromCenter + 12.2));
    stand.add(ribbon);
    disposables.push(ribbonGeo);

    // Upper bowl (5 risers)
    for (let step = 0; step < 5; step++) {
      const stepDepth = 3.2;
      const baseY = 8.0 + step * 1.5;
      const riserGeo = new THREE.BoxGeometry(length, 2.0, stepDepth);
      const riser = new THREE.Mesh(riserGeo, step % 2 === 0 ? tierDarkMat : concreteMat);
      riser.position.set(0, baseY, -(distFromCenter + 13.5 + step * 2.6));
      stand.add(riser);
      disposables.push(riserGeo);
    }

    // Outer stadium facade wall
    const wallGeo = new THREE.BoxGeometry(length + 4, 21, 2.2);
    const wall = new THREE.Mesh(wallGeo, concreteMat);
    wall.position.set(0, 10.5, -(distFromCenter + 26.5));
    stand.add(wall);
    disposables.push(wallGeo);

    // Sweeping Cantilever Roof Canopy
    const canopyGeo = new THREE.BoxGeometry(length + 6, 1.1, 24);
    const canopy = new THREE.Mesh(canopyGeo, roofMat);
    canopy.position.set(0, 21.8, -(distFromCenter + 14.5));
    canopy.rotation.x = 0.08;
    stand.add(canopy);
    disposables.push(canopyGeo);

    // Gold structural fascia along roof edge
    const trimGeo = new THREE.BoxGeometry(length + 6, 0.65, 0.6);
    const trim = new THREE.Mesh(trimGeo, fasciaGoldMat);
    trim.position.set(0, 20.8, -(distFromCenter + 2.6));
    stand.add(trim);
    disposables.push(trimGeo);

    group.add(stand);
  };

  buildStand(PITCH_LENGTH + 18, HALF_WIDTH + 9.5, 0); // North
  buildStand(PITCH_LENGTH + 18, HALF_WIDTH + 9.5, Math.PI); // South
  buildStand(PITCH_WIDTH + 18, HALF_LENGTH + 9.5, Math.PI / 2); // West
  buildStand(PITCH_WIDTH + 18, HALF_LENGTH + 9.5, -Math.PI / 2); // East

  // 8. 4 Corner Floodlight Towers
  const pylonMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.45,
    metalness: 0.75,
  });
  const floodPanelMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe0f2fe,
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });
  const pylonGeo = new THREE.CylinderGeometry(1.1, 1.7, 34, 10);
  const floodHeadGeo = new THREE.BoxGeometry(7.5, 3.6, 1.2);
  disposables.push(pylonMat, floodPanelMat, pylonGeo, floodHeadGeo);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const tx = sx * (HALF_LENGTH + 19);
      const tz = sz * (HALF_WIDTH + 19);
      const tower = new THREE.Group();
      tower.position.set(tx, 0, tz);

      const pylon = new THREE.Mesh(pylonGeo, pylonMat);
      pylon.position.y = 17;

      const head = new THREE.Mesh(floodHeadGeo, floodPanelMat);
      head.position.set(0, 33.5, 0);
      head.lookAt(0, 0, 0);

      tower.add(pylon, head);
      group.add(tower);
    }
  }

  // 9. Animated Spectators via InstancedMesh (~2,400 fans in Madrid & Barca colors)
  const specGeo = new THREE.BoxGeometry(0.62, 1.15, 0.52);
  const specMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.85,
  });
  disposables.push(specGeo, specMat);

  interface SpectatorMeta {
    x: number;
    y: number;
    z: number;
    phase: number;
    rotY: number;
    scaleY: number;
  }
  const specPositions: SpectatorMeta[] = [];

  const addStandSpectators = (
    length: number,
    distFromCenter: number,
    rotY: number,
    homeBias: 'madrid' | 'barca' | 'mixed',
  ) => {
    const dummyVec = new THREE.Vector3();
    for (let tier = 0; tier < 2; tier++) {
      const rows = 4;
      for (let r = 0; r < rows; r++) {
        const y = tier === 0 ? 1.8 + r * 1.15 : 8.9 + r * 1.5;
        const localZ = -(distFromCenter + (tier === 0 ? r * 2.8 : 13.5 + r * 2.6));
        const stepX = 2.05;
        for (let lx = -length / 2 + 3; lx <= length / 2 - 3; lx += stepX) {
          if (Math.random() < 0.08) continue; // realistic small aisles/gaps
          dummyVec.set(lx, y, localZ).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
          specPositions.push({
            x: dummyVec.x + (Math.random() - 0.5) * 0.35,
            y: dummyVec.y,
            z: dummyVec.z + (Math.random() - 0.5) * 0.35,
            phase: Math.random() * Math.PI * 2 + (homeBias === 'madrid' ? 0 : 1),
            rotY,
            scaleY: 0.88 + Math.random() * 0.24,
          });
        }
      }
    }
  };

  addStandSpectators(PITCH_LENGTH + 14, HALF_WIDTH + 9.5, 0, 'mixed');
  addStandSpectators(PITCH_LENGTH + 14, HALF_WIDTH + 9.5, Math.PI, 'mixed');
  addStandSpectators(PITCH_WIDTH + 14, HALF_LENGTH + 9.5, Math.PI / 2, 'madrid');
  addStandSpectators(PITCH_WIDTH + 14, HALF_LENGTH + 9.5, -Math.PI / 2, 'barca');

  const spectators = new THREE.InstancedMesh(specGeo, specMat, specPositions.length);
  const specColor = new THREE.Color();
  const dummy = new THREE.Object3D();

  const palette = [
    0xf8fafc, // Real Madrid white
    0xf1f5f9,
    0xd4af37, // Royal gold
    0x004d98, // Barca blue
    0xa50044, // Barca garnet
    0x334155, // Neutral dark
    0x94a3b8,
  ];

  specPositions.forEach((sp, i) => {
    dummy.position.set(sp.x, sp.y, sp.z);
    dummy.rotation.set(0, sp.rotY, 0);
    dummy.scale.set(1, sp.scaleY, 1);
    dummy.updateMatrix();
    spectators.setMatrixAt(i, dummy.matrix);

    const colHex = palette[Math.floor(Math.random() * palette.length)];
    specColor.setHex(colHex);
    spectators.setColorAt(i, specColor);
  });
  spectators.instanceMatrix.needsUpdate = true;
  if (spectators.instanceColor) spectators.instanceColor.needsUpdate = true;
  spectators.computeBoundingSphere();
  spectators.frustumCulled = false;
  group.add(spectators);

  // 10. Stadium 3-Point Lighting Rig (Day / Evening)
  const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e3a24, 0.85);
  group.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff4e0, 2.2);
  keyLight.position.set(48, 68, 36);
  keyLight.castShadow = !isSoftwareGl;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 10;
  keyLight.shadow.camera.far = 190;
  const d = 66;
  keyLight.shadow.camera.left = -d;
  keyLight.shadow.camera.right = d;
  keyLight.shadow.camera.top = d;
  keyLight.shadow.camera.bottom = -d;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.03;
  group.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xbfe0ff, 0.8);
  fillLight.position.set(-45, 42, -38);
  group.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xe0f2fe, 0.55);
  rimLight.position.set(0, 32, -62);
  group.add(rimLight);

  scene.add(group);

  const setLightingMode = (mode: LightingMode, targetScene: THREE.Scene) => {
    if (mode === 'day') {
      const skyColor = new THREE.Color(0x6ba6e0);
      targetScene.background = skyColor;
      targetScene.fog = new THREE.FogExp2(0x7fb4e8, 0.0032);

      hemiLight.color.setHex(0xbae6fd);
      hemiLight.groundColor.setHex(0x1f4d2a);
      hemiLight.intensity = 1.05;

      keyLight.color.setHex(0xfff3db);
      keyLight.intensity = 2.45;
      keyLight.position.set(52, 72, 34);

      fillLight.color.setHex(0x93c5fd);
      fillLight.intensity = 0.85;

      rimLight.intensity = 0.45;
      floodPanelMat.emissiveIntensity = 0.35;
      rimLedMat.emissiveIntensity = 0.45;
    } else {
      const nightColor = new THREE.Color(0x091020);
      targetScene.background = nightColor;
      targetScene.fog = new THREE.FogExp2(0x0a1326, 0.0038);

      hemiLight.color.setHex(0x4f75a8);
      hemiLight.groundColor.setHex(0x0e2416);
      hemiLight.intensity = 0.72;

      keyLight.color.setHex(0xeef6ff);
      keyLight.intensity = 2.35;
      keyLight.position.set(42, 64, 44);

      fillLight.color.setHex(0x93c5fd);
      fillLight.intensity = 1.05;

      rimLight.color.setHex(0xfef3c7);
      rimLight.intensity = 0.8;
      floodPanelMat.emissiveIntensity = 2.2;
      rimLedMat.emissiveIntensity = 1.25;
    }
  };

  let specFrameAccum = 0;

  const update = (elapsed: number, excitement: number) => {
    // Wind flutter on corner flags
    cornerFlags.forEach((flag, idx) => {
      flag.rotation.y = Math.sin(elapsed * 4.5 + idx) * 0.26;
    });

    // Goal net ripple decay
    goalNets.forEach((gn) => {
      if (gn.ripple > 0.001) {
        gn.ripple *= 0.92;
        const bulge = Math.sin(elapsed * 22) * gn.ripple * 0.45;
        gn.backMesh.position.x = gn.side * (HALF_LENGTH + GOAL_DEPTH) + gn.side * Math.abs(bulge);
      }
    });

    // Update animated spectators (throttled slightly for 60fps CPU budget)
    specFrameAccum++;
    if (specFrameAccum % 2 === 0) {
      const waveAmp = 0.08 + excitement * 0.38;
      const waveFreq = 3.2 + excitement * 7.5;
      for (let i = 0; i < specPositions.length; i++) {
        const sp = specPositions[i];
        const hop = Math.max(0, Math.sin(elapsed * waveFreq + sp.phase)) * waveAmp;
        dummy.position.set(sp.x, sp.y + hop, sp.z);
        dummy.rotation.set(0, sp.rotY, 0);
        dummy.scale.set(1, sp.scaleY, 1);
        dummy.updateMatrix();
        spectators.setMatrixAt(i, dummy.matrix);
      }
      spectators.instanceMatrix.needsUpdate = true;
    }
  };

  const triggerGoalRipple = (side: -1 | 1) => {
    const net = goalNets.find((g) => g.side === side);
    if (net) net.ripple = 1.0;
  };

  const dispose = () => {
    disposables.forEach((d) => d.dispose());
    scene.remove(group);
  };

  return {
    group,
    setLightingMode,
    update,
    triggerGoalRipple,
    dispose,
  };
}
