import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  BALL_RADIUS,
  GOAL_DEPTH,
  GOAL_HALF_WIDTH,
  GOAL_HEIGHT,
  GOAL_POST_RADIUS,
  GRAVITY,
  HALF_LENGTH,
  HALF_WIDTH,
} from './constants';
import {
  BARCA_ROSTER,
  CameraMode,
  Difficulty,
  GoalEvent,
  HudState,
  LightingMode,
  MADRID_ROSTER,
  MatchPhase,
  MatchSettings,
  MatchStats,
  PlayerRosterEntry,
  TeamId,
} from '../types/game';
import {
  createContactShadowTexture,
  createFootballTexture,
} from './textures';
import {
  animatePlayerRig,
  createPlayerRig,
  PlayerVisualRig,
} from './playerModel';
import { createStadium, StadiumRig } from './stadium';
import { SoundEngine } from '../audio/SoundEngine';

interface SimPlayer {
  entry: PlayerRosterEntry;
  team: TeamId;
  rig: PlayerVisualRig;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  facingAngle: number;
  stridePhase: number;
  kickTimer: number;
  tackleTimer: number;
  tackleCooldown: number;
  jumpY: number;
  jumpVel: number;
  stamina: number;
  gkDiveDir: number;
  gkDiveTimer: number;
  aiActionCooldown: number;
}

// Pre-allocated scratch math helpers (zero GC in render loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _camDesiredPos = new THREE.Vector3();
const _camDesiredLook = new THREE.Vector3();
const _camForwardXZ = new THREE.Vector3();
const _camRightXZ = new THREE.Vector3();
const _rollAxis = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function createEmptyStats(): MatchStats {
  return {
    madridShots: 0,
    barcaShots: 0,
    madridShotsOnTarget: 0,
    barcaShotsOnTarget: 0,
    madridPasses: 0,
    barcaPasses: 0,
    madridTackles: 0,
    barcaTackles: 0,
    madridPossessionTime: 0,
    barcaPossessionTime: 0,
    goals: [],
  };
}

export class MatchEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private stadium: StadiumRig;
  private sound: SoundEngine;
  private isSoftwareGl: boolean;
  private envRT: THREE.WebGLRenderTarget | null = null;

  private players: SimPlayer[] = [];
  private ballMesh: THREE.Mesh;
  private ballShadow: THREE.Mesh;
  private ballPos = new THREE.Vector3(0, BALL_RADIUS, 0);
  private ballVel = new THREE.Vector3(0, 0, 0);
  private lastTouchPlayer: SimPlayer | null = null;
  private ballOwner: SimPlayer | null = null;
  private ballPickupCooldown = 0;

  private controlledPlayer: SimPlayer | null = null;
  private passTargetPlayer: SimPlayer | null = null;

  private settings: MatchSettings;
  private phase: MatchPhase = 'menu';
  private scoreMadrid = 0;
  private scoreBarca = 0;
  private matchSeconds = 0;
  private half: 1 | 2 = 1;
  private stats: MatchStats = createEmptyStats();
  private lastGoal: GoalEvent | null = null;
  private goalCelebrationTimer = 0;
  private kickoffTeam: TeamId = 'madrid';
  private kickoffWaitTimer = 0;
  private bannerMessage: string | null = null;
  private bannerTimer = 0;

  // Input state
  private keys = new Set<string>();
  private shotCharging = false;
  private shotCharge = 0;

  // Camera state
  private currentCamLook = new THREE.Vector3(0, 0.8, 0);
  private clock = new THREE.Clock();
  private elapsed = 0;
  private frameId = 0;
  private disposed = false;
  private hudTimer = 0;
  private onHudUpdate: (state: HudState) => void;
  private sharedDisposables: Array<{ dispose: () => void }> = [];

  constructor(
    container: HTMLElement,
    initialSettings: MatchSettings,
    sound: SoundEngine,
    onHudUpdate: (state: HudState) => void,
  ) {
    this.container = container;
    this.settings = { ...initialSettings };
    this.sound = sound;
    this.onHudUpdate = onHudUpdate;

    // 1. Software WebGL detection
    this.isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    // 2. Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    // 3. Scene & Camera
    this.scene = new THREE.Scene();
    const aspect = (container.clientWidth || window.innerWidth) / Math.max(1, container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.5, 420);
    this.camera.position.set(0, 26, 46);
    this.camera.lookAt(0, 0, 0);

    // 4. Studio Environment Map (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    pmremGenerator.dispose();

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    // 5. Stadium & Lighting
    this.stadium = createStadium(this.scene, maxAniso, this.isSoftwareGl);
    this.stadium.setLightingMode(this.settings.lighting, this.scene);

    // 6. Football & Shadow
    const shadowTex = createContactShadowTexture();
    const ballTex = createFootballTexture(maxAniso);
    const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 24, 20);
    const ballMat = new THREE.MeshStandardMaterial({
      map: ballTex,
      roughness: 0.36,
      metalness: 0.08,
    });
    this.ballMesh = new THREE.Mesh(ballGeo, ballMat);
    this.ballMesh.castShadow = true;
    this.ballMesh.position.copy(this.ballPos);
    this.scene.add(this.ballMesh);

    const ballShadowGeo = new THREE.PlaneGeometry(0.7, 0.7);
    const ballShadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.6,
    });
    this.ballShadow = new THREE.Mesh(ballShadowGeo, ballShadowMat);
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.ballShadow.position.set(0, 0.025, 0);
    this.scene.add(this.ballShadow);

    this.sharedDisposables.push(shadowTex, ballTex, ballGeo, ballMat, ballShadowGeo, ballShadowMat);

    // 7. Spawn 22 Players (11 Real Madrid vs 11 FC Barcelona)
    const spawnTeam = (roster: PlayerRosterEntry[], team: TeamId) => {
      for (const entry of roster) {
        const rig = createPlayerRig(entry, team, shadowTex, maxAniso);
        this.scene.add(rig.root);
        this.players.push({
          entry,
          team,
          rig,
          pos: new THREE.Vector3(),
          vel: new THREE.Vector3(),
          facingAngle: team === 'madrid' ? Math.PI / 2 : -Math.PI / 2,
          stridePhase: Math.random() * Math.PI * 2,
          kickTimer: 0,
          tackleTimer: 0,
          tackleCooldown: 0,
          jumpY: 0,
          jumpVel: 0,
          stamina: 1,
          gkDiveDir: 0,
          gkDiveTimer: 0,
          aiActionCooldown: 0,
        });
      }
    };
    spawnTeam(MADRID_ROSTER, 'madrid');
    spawnTeam(BARCA_ROSTER, 'barca');

    this.resetPositionsForKickoff('madrid');

    // Pre-warm shaders on hardware GPUs
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Bind events
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);

    this.emitHud();
    this.startLoop();
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
  };

  private handleResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
  };

  /** Attack direction along X axis (+1 = attacking +X right goal, -1 = attacking -X left goal) */
  private getAttackDir(team: TeamId): 1 | -1 {
    // Half 1: Madrid attacks +X, Barca attacks -X. Half 2: swap ends!
    if (this.half === 1) {
      return team === 'madrid' ? 1 : -1;
    }
    return team === 'madrid' ? -1 : 1;
  }

  private getHomeWorldPos(p: SimPlayer, target: THREE.Vector3): THREE.Vector3 {
    const dir = this.getAttackDir(p.team);
    // formationX is in [-1, 0], so -formationX * dir puts them on their own side
    const baseX = p.entry.formationX * -dir * HALF_LENGTH;
    const baseZ = p.entry.formationZ * (HALF_WIDTH * 0.85) * dir;
    return target.set(baseX, 0, baseZ);
  }

  private resetPositionsForKickoff(kickingTeam: TeamId) {
    this.ballPos.set(0, BALL_RADIUS, 0);
    this.ballVel.set(0, 0, 0);
    this.ballOwner = null;
    this.lastTouchPlayer = null;
    this.ballPickupCooldown = 0.25;
    this.kickoffTeam = kickingTeam;

    for (const p of this.players) {
      const home = this.getHomeWorldPos(p, _v1);
      // Keep everyone inside their own half before kickoff
      const dir = this.getAttackDir(p.team);
      if (dir === 1 && home.x > -2) home.x = -2;
      if (dir === -1 && home.x < 2) home.x = 2;

      // Put kicking team's striker right next to center spot
      if (p.team === kickingTeam && p.entry.role === 'FWD' && Math.abs(p.entry.formationZ) < 0.1) {
        home.set(-dir * 1.1, 0, 0);
      }

      p.pos.copy(home);
      p.vel.set(0, 0, 0);
      p.facingAngle = dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      p.kickTimer = 0;
      p.tackleTimer = 0;
      p.tackleCooldown = 0;
      p.jumpY = 0;
      p.jumpVel = 0;
      p.gkDiveDir = 0;
      p.gkDiveTimer = 0;
      p.rig.root.position.copy(p.pos);
      p.rig.root.rotation.y = p.facingAngle;
    }

    // Select user's striker as active controlled player
    const userStrikers = this.players.filter(
      (p) => p.team === this.settings.userTeam && p.entry.role === 'FWD',
    );
    const centerStriker =
      userStrikers.find((p) => Math.abs(p.entry.formationZ) < 0.1) || userStrikers[0];
    this.setControlledPlayer(centerStriker || this.players[0]);
  }

  private setControlledPlayer(player: SimPlayer | null) {
    if (this.controlledPlayer) {
      this.controlledPlayer.rig.indicatorRing.visible = false;
      this.controlledPlayer.rig.aimArrow.visible = false;
    }
    this.controlledPlayer = player;
    if (player && this.phase !== 'menu') {
      player.rig.indicatorRing.visible = true;
      player.rig.aimArrow.visible = true;
    }
  }

  public updateSettings(newSettings: Partial<MatchSettings>) {
    const prevLighting = this.settings.lighting;
    this.settings = { ...this.settings, ...newSettings };

    if (newSettings.lighting && newSettings.lighting !== prevLighting) {
      this.stadium.setLightingMode(newSettings.lighting, this.scene);
    }
    if (newSettings.soundEnabled !== undefined) {
      this.sound.setEnabled(newSettings.soundEnabled);
    }
    this.emitHud();
  }

  public startNewMatch(settings?: MatchSettings) {
    if (settings) {
      this.updateSettings(settings);
    }
    this.sound.unlock();
    this.sound.startCrowdAmbience();
    this.scoreMadrid = 0;
    this.scoreBarca = 0;
    this.matchSeconds = 0;
    this.half = 1;
    this.stats = createEmptyStats();
    this.lastGoal = null;
    this.goalCelebrationTimer = 0;
    this.shotCharging = false;
    this.shotCharge = 0;
    this.phase = 'playing';
    this.kickoffWaitTimer = 0.55;
    this.resetPositionsForKickoff(this.settings.userTeam);
    this.showBanner('KICK-OFF · EL CLASICO', 2.2);
    this.sound.playWhistle('kickoff');
    this.emitHud();
  }

  public startSecondHalf() {
    this.half = 2;
    this.matchSeconds = 2700;
    this.phase = 'playing';
    this.shotCharging = false;
    this.shotCharge = 0;
    const secondKickoff: TeamId =
      this.settings.userTeam === 'madrid' ? 'barca' : 'madrid';
    this.kickoffWaitTimer = 0.55;
    this.resetPositionsForKickoff(secondKickoff);
    this.showBanner('SECOND HALF KICK-OFF', 2.2);
    this.sound.playWhistle('kickoff');
    this.emitHud();
  }

  public pauseMatch() {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.keys.clear();
      this.shotCharging = false;
      this.shotCharge = 0;
      this.emitHud();
    }
  }

  public resumeMatch() {
    if (this.phase === 'paused') {
      this.phase = 'playing';
      this.clock.getDelta();
      this.emitHud();
    }
  }

  public returnToMenu() {
    this.phase = 'menu';
    this.keys.clear();
    this.shotCharging = false;
    this.shotCharge = 0;
    this.sound.stopCrowdAmbience();
    this.setControlledPlayer(null);
    this.resetPositionsForKickoff('madrid');
    this.emitHud();
  }

  public cycleCamera() {
    const order: CameraMode[] = ['third-person', 'broadcast', 'wide'];
    const idx = order.indexOf(this.settings.cameraMode);
    const next = order[(idx + 1) % order.length];
    this.settings.cameraMode = next;
    const labels: Record<CameraMode, string> = {
      'third-person': 'CAMERA: THIRD-PERSON',
      broadcast: 'CAMERA: BROADCAST',
      wide: 'CAMERA: WIDE STADIUM',
    };
    this.showBanner(labels[next], 1.5);
    this.emitHud();
  }

  private showBanner(msg: string, duration = 2.0) {
    this.bannerMessage = msg;
    this.bannerTimer = duration;
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    const code = e.code;

    if (
      ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code) &&
      this.phase === 'playing'
    ) {
      e.preventDefault();
    }

    if (code === 'Escape') {
      if (this.phase === 'playing') this.pauseMatch();
      else if (this.phase === 'paused') this.resumeMatch();
      return;
    }

    if (this.phase !== 'playing') return;

    if (!this.keys.has(code)) {
      this.keys.add(code);

      if (code === 'KeyC') {
        this.cycleCamera();
      } else if (code === 'KeyQ') {
        this.switchControlledPlayer();
      } else if (code === 'KeyE') {
        this.triggerUserPass();
      } else if (code === 'KeyF') {
        this.triggerUserTackle();
      } else if (code === 'Space') {
        if (this.canControlledKickBall()) {
          this.shotCharging = true;
          this.shotCharge = 0.22;
        } else {
          this.triggerUserJump();
        }
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    const code = e.code;
    this.keys.delete(code);

    if (code === 'Space' && this.shotCharging) {
      this.shotCharging = false;
      if (this.phase === 'playing') {
        this.executeUserShot(this.shotCharge);
      }
      this.shotCharge = 0;
    }
  };

  private canControlledKickBall(): boolean {
    if (!this.controlledPlayer) return false;
    if (this.ballOwner === this.controlledPlayer) return true;
    return this.controlledPlayer.pos.distanceTo(this.ballPos) < 2.2;
  }

  private switchControlledPlayer() {
    const userPlayers = this.players.filter(
      (p) => p.team === this.settings.userTeam && p.entry.role !== 'GK',
    );
    if (userPlayers.length === 0) return;

    // Sort by distance to ball
    userPlayers.sort(
      (a, b) => a.pos.distanceToSquared(this.ballPos) - b.pos.distanceToSquared(this.ballPos),
    );

    const pick =
      userPlayers[0] === this.controlledPlayer && userPlayers.length > 1
        ? userPlayers[1]
        : userPlayers[0];
    this.setControlledPlayer(pick);
    this.emitHud();
  }

  private getMovementInputVector(out: THREE.Vector3): THREE.Vector3 {
    let forward = 0;
    let right = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) forward += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) forward -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) right += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) right -= 1;

    out.set(0, 0, 0);
    if (forward === 0 && right === 0) return out;

    // Derive camera horizontal forward & right axes so WASD always feels intuitive
    this.camera.getWorldDirection(_camForwardXZ);
    _camForwardXZ.y = 0;
    if (_camForwardXZ.lengthSq() < 0.001) _camForwardXZ.set(1, 0, 0);
    _camForwardXZ.normalize();

    _camRightXZ.crossVectors(_camForwardXZ, _up).normalize();

    out.addScaledVector(_camForwardXZ, forward).addScaledVector(_camRightXZ, right);
    if (out.lengthSq() > 0.0001) out.normalize();
    return out;
  }

  private findBestPassTarget(passer: SimPlayer, aimDir: THREE.Vector3): SimPlayer | null {
    let best: SimPlayer | null = null;
    let bestScore = -Infinity;

    for (const mate of this.players) {
      if (mate.team !== passer.team || mate === passer) continue;
      _v1.subVectors(mate.pos, passer.pos);
      _v1.y = 0;
      const dist = _v1.length();
      if (dist < 2.0 || dist > 48) continue;
      _v1.divideScalar(dist);

      const dot = _v1.dot(aimDir);
      if (dot < -0.15) continue;
      const score = dot * 2.2 - dist * 0.025 + (mate.entry.role === 'GK' ? -0.6 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = mate;
      }
    }
    return best;
  }

  private triggerUserPass() {
    if (!this.controlledPlayer || !this.canControlledKickBall()) return;
    const passer = this.controlledPlayer;

    const aim = this.getMovementInputVector(_v2);
    if (aim.lengthSq() < 0.01) {
      aim.set(Math.sin(passer.facingAngle), 0, Math.cos(passer.facingAngle));
    }

    const target = this.findBestPassTarget(passer, aim);
    this.executePass(passer, target, aim);

    if (target && target.entry.role !== 'GK') {
      this.setControlledPlayer(target);
    }
  }

  private executePass(passer: SimPlayer, target: SimPlayer | null, fallbackDir: THREE.Vector3) {
    const dir = _v1.copy(fallbackDir);
    let passSpeed = 19;

    if (target) {
      // Lead target slightly based on their velocity
      dir.copy(target.pos).addScaledVector(target.vel, 0.32).sub(this.ballPos);
      dir.y = 0;
      const dist = dir.length();
      if (dist > 0.1) dir.divideScalar(dist);
      passSpeed = THREE.MathUtils.clamp(12 + dist * 0.45, 13, 27);
    }

    passer.facingAngle = Math.atan2(dir.x, dir.z);
    passer.kickTimer = 0.28;
    this.ballOwner = null;
    this.lastTouchPlayer = passer;
    this.ballPickupCooldown = 0.22;

    this.ballVel.set(
      dir.x * passSpeed,
      passSpeed > 21 ? 2.6 : 0.7,
      dir.z * passSpeed,
    );

    if (passer.team === 'madrid') this.stats.madridPasses++;
    else this.stats.barcaPasses++;

    this.sound.playPass();
  }

  private executeUserShot(charge: number) {
    if (!this.controlledPlayer || !this.canControlledKickBall()) return;
    const shooter = this.controlledPlayer;
    const attackDir = this.getAttackDir(shooter.team);
    const goalX = attackDir * HALF_LENGTH;

    // Steer aim laterally with input if held
    const input = this.getMovementInputVector(_v2);
    let targetZ = THREE.MathUtils.clamp(shooter.pos.z * 0.3, -GOAL_HALF_WIDTH * 0.78, GOAL_HALF_WIDTH * 0.78);
    if (Math.abs(input.z) > 0.15) {
      targetZ = THREE.MathUtils.clamp(
        targetZ + input.z * GOAL_HALF_WIDTH * 0.75,
        -GOAL_HALF_WIDTH * 0.88,
        GOAL_HALF_WIDTH * 0.88,
      );
    }

    const dir = _v1.set(goalX - this.ballPos.x, 0, targetZ - this.ballPos.z);
    const dist = dir.length();
    if (dist > 0.01) dir.divideScalar(dist);

    this.executeShot(shooter, dir, charge);
  }

  private executeShot(shooter: SimPlayer, dir: THREE.Vector3, charge: number) {
    const power = THREE.MathUtils.clamp(charge, 0.28, 1.0);
    const speed = 22 + power * 18;
    const loft = 2.8 + power * 5.8;

    shooter.facingAngle = Math.atan2(dir.x, dir.z);
    shooter.kickTimer = 0.3;
    this.ballOwner = null;
    this.lastTouchPlayer = shooter;
    this.ballPickupCooldown = 0.25;

    this.ballVel.set(dir.x * speed, loft, dir.z * speed);

    if (shooter.team === 'madrid') {
      this.stats.madridShots++;
      if (Math.abs(dir.z) < 0.35) this.stats.madridShotsOnTarget++;
    } else {
      this.stats.barcaShots++;
      if (Math.abs(dir.z) < 0.35) this.stats.barcaShotsOnTarget++;
    }

    this.sound.playKick(power);
  }

  private triggerUserJump() {
    if (!this.controlledPlayer) return;
    const p = this.controlledPlayer;
    if (p.jumpY <= 0.02 && p.tackleTimer <= 0) {
      p.jumpVel = 6.4;
    }
  }

  private triggerUserTackle() {
    if (!this.controlledPlayer) return;
    this.executeTackle(this.controlledPlayer);
  }

  private executeTackle(p: SimPlayer) {
    if (p.tackleCooldown > 0 || p.tackleTimer > 0) return;
    p.tackleTimer = 0.36;
    p.tackleCooldown = 0.9;

    const lungeDirX = Math.sin(p.facingAngle);
    const lungeDirZ = Math.cos(p.facingAngle);
    p.vel.set(lungeDirX * 11.5, 0, lungeDirZ * 11.5);

    this.sound.playTackle();

    // Check immediate tackle ball-win radius
    if (p.pos.distanceTo(this.ballPos) < 2.2) {
      if (this.ballOwner && this.ballOwner.team !== p.team) {
        if (p.team === 'madrid') this.stats.madridTackles++;
        else this.stats.barcaTackles++;
        this.ballOwner = p;
        this.lastTouchPlayer = p;
        this.ballPickupCooldown = 0.35;
      } else if (!this.ballOwner) {
        this.ballOwner = p;
        this.lastTouchPlayer = p;
      }
    }
  }

  private startLoop() {
    const tick = () => {
      if (this.disposed) return;
      const dt = Math.min(0.05, this.clock.getDelta());
      this.elapsed += dt;

      this.update(dt);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void) {
    if (this.disposed) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private update(dt: number) {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.bannerMessage = null;
      }
    }

    if (this.phase === 'menu') {
      this.updateMenuShowcase(dt);
      this.stadium.update(this.elapsed, 0.15);
      return;
    }

    if (this.phase === 'paused' || this.phase === 'halftime' || this.phase === 'fulltime') {
      this.stadium.update(this.elapsed, 0.1);
      return;
    }

    if (this.phase === 'goal') {
      this.goalCelebrationTimer -= dt;
      this.updateBallPhysics(dt, true);
      this.updateGoalCelebration(dt);
      this.stadium.update(this.elapsed, 1.0);
      this.updateCamera(dt);

      if (this.goalCelebrationTimer <= 0) {
        this.phase = 'playing';
        const concededTeam: TeamId =
          this.lastGoal?.team === 'madrid' ? 'barca' : 'madrid';
        this.kickoffWaitTimer = 0.5;
        this.resetPositionsForKickoff(concededTeam);
        this.sound.playWhistle('kickoff');
        this.emitHud();
      }
      return;
    }

    // Playing phase
    if (this.kickoffWaitTimer > 0) {
      this.kickoffWaitTimer -= dt;
    }

    if (this.shotCharging) {
      this.shotCharge = Math.min(1.0, this.shotCharge + dt * 1.15);
    }

    // Advance match clock
    const timeScale = 5400 / Math.max(60, this.settings.durationMinutes * 60);
    this.matchSeconds += dt * timeScale;

    if (this.half === 1 && this.matchSeconds >= 2700) {
      this.matchSeconds = 2700;
      this.phase = 'halftime';
      this.sound.playWhistle('halftime');
      this.emitHud();
      return;
    }

    if (this.half === 2 && this.matchSeconds >= 5400) {
      this.matchSeconds = 5400;
      this.phase = 'fulltime';
      this.sound.playWhistle('fulltime');
      this.emitHud();
      return;
    }

    // Possession stats tracking
    if (this.ballOwner) {
      if (this.ballOwner.team === 'madrid') this.stats.madridPossessionTime += dt;
      else this.stats.barcaPossessionTime += dt;
    } else if (this.lastTouchPlayer) {
      if (this.lastTouchPlayer.team === 'madrid') this.stats.madridPossessionTime += dt * 0.5;
      else this.stats.barcaPossessionTime += dt * 0.5;
    }

    // Crowd excitement based on ball proximity to goals
    const nearGoal = Math.max(0, (Math.abs(this.ballPos.x) - 24) / 26);
    this.sound.setCrowdExcitement(nearGoal);
    this.stadium.update(this.elapsed, nearGoal * 0.7);

    // Update pass target indicator
    this.updatePassTargetHint();

    // Update players & AI
    this.updatePlayers(dt);

    // Update ball physics & goal check
    this.updateBallPhysics(dt, false);

    // Smooth camera tracking
    this.updateCamera(dt);

    // Emit HUD at ~15Hz
    this.hudTimer += dt;
    if (this.hudTimer >= 0.065) {
      this.hudTimer = 0;
      this.emitHud();
    }
  }

  private updateMenuShowcase(dt: number) {
    // Scenic rotating stadium orbit camera for Main Menu
    const angle = this.elapsed * 0.14;
    const rad = 54;
    this.camera.position.set(
      Math.cos(angle) * rad,
      21 + Math.sin(this.elapsed * 0.25) * 3,
      Math.sin(angle) * rad * 0.72,
    );
    this.camera.lookAt(0, 2, 0);

    // Gentle warm-up jog animation on pitch
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      const home = this.getHomeWorldPos(p, _v1);
      const wanderX = Math.sin(this.elapsed * 0.7 + i) * 2.2;
      const wanderZ = Math.cos(this.elapsed * 0.6 + i * 1.3) * 2.2;
      p.pos.set(home.x + wanderX, 0, home.z + wanderZ);
      p.rig.root.position.copy(p.pos);
      p.stridePhase += dt * 4.5;
      animatePlayerRig(p.rig, 2.2, 7.5, p.stridePhase, 0, 0, 0, false, p.entry.role === 'GK', 0, this.elapsed);
    }
  }

  private updateGoalCelebration(dt: number) {
    const scoringTeam = this.lastGoal?.team;
    for (const p of this.players) {
      if (p.team === scoringTeam) {
        p.stridePhase += dt * 11;
        // Run toward corner flag cheering
        _v1.set(this.ballPos.x * 0.7, 0, 22).sub(p.pos);
        if (_v1.lengthSq() > 1) {
          _v1.normalize();
          p.pos.addScaledVector(_v1, dt * 4.5);
          p.facingAngle = Math.atan2(_v1.x, _v1.z);
        }
        p.rig.root.position.copy(p.pos);
        p.rig.root.rotation.y = p.facingAngle;
        animatePlayerRig(p.rig, 5, 7, p.stridePhase, 0, 0, 0, true, false, 0, this.elapsed);
      } else {
        animatePlayerRig(p.rig, 0, 7, p.stridePhase, 0, 0, 0, false, p.entry.role === 'GK', 0, this.elapsed);
      }
    }
  }

  private updatePassTargetHint() {
    if (this.passTargetPlayer) {
      this.passTargetPlayer.rig.passTargetRing.visible = false;
      this.passTargetPlayer = null;
    }
    if (!this.controlledPlayer || !this.canControlledKickBall()) return;
    const aim = this.getMovementInputVector(_v2);
    if (aim.lengthSq() < 0.01) {
      aim.set(
        Math.sin(this.controlledPlayer.facingAngle),
        0,
        Math.cos(this.controlledPlayer.facingAngle),
      );
    }
    const target = this.findBestPassTarget(this.controlledPlayer, aim);
    if (target) {
      target.rig.passTargetRing.visible = true;
      this.passTargetPlayer = target;
    }
  }

  private updatePlayers(dt: number) {
    const diffScale: Record<Difficulty, number> = {
      amateur: 0.78,
      pro: 0.96,
      'world-class': 1.12,
    };
    const aiSkill = diffScale[this.settings.difficulty];

    // Identify closest AI defender per team to press the ball
    const closestPressers: Record<TeamId, SimPlayer | null> = { madrid: null, barca: null };
    for (const team of ['madrid', 'barca'] as TeamId[]) {
      let minDist = Infinity;
      for (const p of this.players) {
        if (p.team !== team || p === this.controlledPlayer || p.entry.role === 'GK') continue;
        const d = p.pos.distanceToSquared(this.ballPos);
        if (d < minDist) {
          minDist = d;
          closestPressers[team] = p;
        }
      }
    }

    const possessingTeam: TeamId | null = this.ballOwner?.team ?? this.lastTouchPlayer?.team ?? null;

    for (const p of this.players) {
      if (p.kickTimer > 0) p.kickTimer = Math.max(0, p.kickTimer - dt);
      if (p.tackleCooldown > 0) p.tackleCooldown = Math.max(0, p.tackleCooldown - dt);
      if (p.aiActionCooldown > 0) p.aiActionCooldown = Math.max(0, p.aiActionCooldown - dt);
      if (p.gkDiveTimer > 0) {
        p.gkDiveTimer -= dt;
        if (p.gkDiveTimer <= 0) p.gkDiveDir = 0;
      }

      // Vertical jump physics
      if (p.jumpY > 0 || p.jumpVel > 0) {
        p.jumpY += p.jumpVel * dt;
        p.jumpVel -= GRAVITY * dt;
        if (p.jumpY <= 0) {
          p.jumpY = 0;
          p.jumpVel = 0;
        }
      }

      const maxBaseSpeed = 7.4 * p.entry.speedRating;

      if (p.tackleTimer > 0) {
        p.tackleTimer -= dt;
        p.vel.multiplyScalar(0.94);
        p.pos.addScaledVector(p.vel, dt);
        this.clampPlayerToPitch(p);
      } else if (p === this.controlledPlayer) {
        // USER-CONTROLLED PLAYER
        const moveInput = this.getMovementInputVector(_v2);
        const sprinting =
          (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) &&
          moveInput.lengthSq() > 0.01 &&
          p.stamina > 0.04;

        if (sprinting) {
          p.stamina = Math.max(0, p.stamina - dt * 0.28);
        } else {
          p.stamina = Math.min(1, p.stamina + dt * 0.18);
        }

        const targetSpeed = moveInput.lengthSq() > 0.01
          ? maxBaseSpeed * (sprinting ? 1.36 : 1.0) * (this.ballOwner === p ? 0.92 : 1.0)
          : 0;

        const targetVx = moveInput.x * targetSpeed;
        const targetVz = moveInput.z * targetSpeed;
        const accel = 1 - Math.exp(-13 * dt);
        p.vel.x = THREE.MathUtils.lerp(p.vel.x, targetVx, accel);
        p.vel.z = THREE.MathUtils.lerp(p.vel.z, targetVz, accel);

        p.pos.addScaledVector(p.vel, dt);
        this.clampPlayerToPitch(p);

        if (p.vel.lengthSq() > 0.15) {
          const desiredAngle = Math.atan2(p.vel.x, p.vel.z);
          p.facingAngle = this.lerpAngle(p.facingAngle, desiredAngle, 1 - Math.exp(-14 * dt));
        }
      } else if (p.entry.role === 'GK') {
        this.updateGoalkeeperAI(p, dt, aiSkill);
      } else {
        this.updateOutfieldAI(
          p,
          dt,
          aiSkill,
          closestPressers[p.team] === p,
          possessingTeam,
        );
      }

      // Soft player-vs-player separation
      for (const other of this.players) {
        if (other === p) continue;
        const dx = p.pos.x - other.pos.x;
        const dz = p.pos.z - other.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > 0.0001 && d2 < 0.72) {
          const d = Math.sqrt(d2);
          const push = (0.85 - d) * 0.5;
          p.pos.x += (dx / d) * push;
          p.pos.z += (dz / d) * push;
        }
      }

      const speed = Math.hypot(p.vel.x, p.vel.z);
      if (speed > 0.25) {
        p.stridePhase += dt * (2.2 + speed * 1.15);
      }

      p.rig.root.position.copy(p.pos);
      p.rig.root.rotation.y = p.facingAngle;
      animatePlayerRig(
        p.rig,
        speed,
        maxBaseSpeed,
        p.stridePhase,
        p.kickTimer,
        p.tackleTimer,
        p.jumpY,
        false,
        p.entry.role === 'GK',
        p.gkDiveDir,
        this.elapsed,
      );
    }

    // Auto-switch to nearest user teammate when ball is loose & user is far away
    if (
      !this.ballOwner &&
      this.controlledPlayer &&
      this.controlledPlayer.pos.distanceTo(this.ballPos) > 16
    ) {
      let bestUser: SimPlayer | null = null;
      let bestDist = Infinity;
      for (const p of this.players) {
        if (p.team !== this.settings.userTeam || p.entry.role === 'GK') continue;
        const d = p.pos.distanceTo(this.ballPos);
        if (d < bestDist) {
          bestDist = d;
          bestUser = p;
        }
      }
      if (bestUser && bestDist < this.controlledPlayer.pos.distanceTo(this.ballPos) - 5.5) {
        this.setControlledPlayer(bestUser);
      }
    }
  }

  private updateGoalkeeperAI(gk: SimPlayer, dt: number, aiSkill: number) {
    const attackDir = this.getAttackDir(gk.team);
    const ownGoalX = -attackDir * HALF_LENGTH;

    if (this.ballOwner === gk) {
      // Distribute ball quickly to an open teammate
      if (gk.aiActionCooldown <= 0) {
        const aim = _v2.set(attackDir, 0, (Math.random() - 0.5) * 0.9).normalize();
        const mate = this.findBestPassTarget(gk, aim);
        this.executePass(gk, mate, aim);
        gk.aiActionCooldown = 0.6;
      }
      return;
    }

    // Track ball across goal mouth
    const standX = ownGoalX + attackDir * 1.6;
    const targetZ = THREE.MathUtils.clamp(
      this.ballPos.z * 0.65,
      -GOAL_HALF_WIDTH * 0.84,
      GOAL_HALF_WIDTH * 0.84,
    );

    // Check if an incoming shot is heading toward goal
    const ballMovingTowardGoal = this.ballVel.x * -attackDir > 6.5;
    const distToGoal = Math.abs(this.ballPos.x - ownGoalX);
    if (ballMovingTowardGoal && distToGoal < 16 && gk.gkDiveTimer <= 0) {
      // Predict lateral Z at goal line
      const tToGoal = distToGoal / Math.max(1, Math.abs(this.ballVel.x));
      const predZ = THREE.MathUtils.clamp(
        this.ballPos.z + this.ballVel.z * tToGoal,
        -GOAL_HALF_WIDTH,
        GOAL_HALF_WIDTH,
      );
      const diffZ = predZ - gk.pos.z;
      if (Math.abs(diffZ) > 0.7 && Math.abs(diffZ) < 4.5) {
        gk.gkDiveDir = Math.sign(diffZ) * attackDir;
        gk.gkDiveTimer = 0.45;
        gk.vel.z = Math.sign(diffZ) * (6.2 * aiSkill);
      }
    }

    _v1.set(standX, 0, targetZ).sub(gk.pos);
    const d = _v1.length();
    if (d > 0.1) {
      _v1.divideScalar(d);
      const spd = Math.min(6.2 * aiSkill, d * 5.0);
      gk.vel.x = THREE.MathUtils.lerp(gk.vel.x, _v1.x * spd, 1 - Math.exp(-10 * dt));
      gk.vel.z = THREE.MathUtils.lerp(gk.vel.z, _v1.z * spd, 1 - Math.exp(-10 * dt));
    } else {
      gk.vel.multiplyScalar(0.8);
    }

    gk.pos.addScaledVector(gk.vel, dt);
    gk.facingAngle = attackDir === 1 ? Math.PI / 2 : -Math.PI / 2;
  }

  private updateOutfieldAI(
    p: SimPlayer,
    dt: number,
    aiSkill: number,
    isClosestPresser: boolean,
    possessingTeam: TeamId | null,
  ) {
    const attackDir = this.getAttackDir(p.team);
    const speedMax = 6.9 * p.entry.speedRating * (p.team === this.settings.userTeam ? 1.0 : aiSkill);

    // 1. If this AI player currently HAS the ball
    if (this.ballOwner === p) {
      const oppGoalX = attackDir * HALF_LENGTH;
      const distToGoal = Math.hypot(oppGoalX - p.pos.x, p.pos.z);

      // Shoot if within range
      if (distToGoal < 23 && p.aiActionCooldown <= 0) {
        const aimZ = (Math.random() - 0.5) * GOAL_HALF_WIDTH * 1.5;
        const shotDir = _v1.set(oppGoalX - p.pos.x, 0, aimZ - p.pos.z).normalize();
        const power = THREE.MathUtils.clamp(0.55 + Math.random() * 0.35, 0.5, 0.95);
        this.executeShot(p, shotDir, power);
        p.aiActionCooldown = 1.0;
        return;
      }

      // Check if pressured by opponent within 4.4m -> pass to open teammate
      let underPressure = false;
      for (const opp of this.players) {
        if (opp.team === p.team) continue;
        if (opp.pos.distanceTo(p.pos) < 4.4) {
          underPressure = true;
          break;
        }
      }

      if (underPressure && p.aiActionCooldown <= 0) {
        const forwardAim = _v2.set(attackDir, 0, (Math.random() - 0.5) * 0.8).normalize();
        const mate = this.findBestPassTarget(p, forwardAim);
        if (mate) {
          this.executePass(p, mate, forwardAim);
          p.aiActionCooldown = 0.8;
          return;
        }
      }

      // Dribble toward opponent goal
      _v1.set(oppGoalX - p.pos.x, 0, -p.pos.z * 0.25).normalize();
      p.vel.x = THREE.MathUtils.lerp(p.vel.x, _v1.x * speedMax * 0.88, 1 - Math.exp(-8 * dt));
      p.vel.z = THREE.MathUtils.lerp(p.vel.z, _v1.z * speedMax * 0.88, 1 - Math.exp(-8 * dt));
      p.pos.addScaledVector(p.vel, dt);
      p.facingAngle = Math.atan2(p.vel.x, p.vel.z);
      this.clampPlayerToPitch(p);
      return;
    }

    // 2. If ball is owned by opponent & this player is closest presser -> press/tackle!
    if (isClosestPresser && possessingTeam !== p.team && this.kickoffWaitTimer <= 0) {
      _v1.subVectors(this.ballPos, p.pos);
      _v1.y = 0;
      const dist = _v1.length();
      if (dist > 0.1) _v1.divideScalar(dist);

      p.vel.x = THREE.MathUtils.lerp(p.vel.x, _v1.x * speedMax, 1 - Math.exp(-9 * dt));
      p.vel.z = THREE.MathUtils.lerp(p.vel.z, _v1.z * speedMax, 1 - Math.exp(-9 * dt));
      p.pos.addScaledVector(p.vel, dt);
      p.facingAngle = Math.atan2(_v1.x, _v1.z);
      this.clampPlayerToPitch(p);

      // AI tackle attempt when close
      if (
        dist < 1.9 &&
        this.ballOwner &&
        this.ballOwner.team !== p.team &&
        p.tackleCooldown <= 0 &&
        Math.random() < 0.03 * aiSkill
      ) {
        this.executeTackle(p);
      }
      return;
    }

    // 3. Tactical positioning: push forward when team has ball, compact defense otherwise
    const home = this.getHomeWorldPos(p, _v3);
    const ballShiftX = this.ballPos.x * 0.38;
    const ballShiftZ = this.ballPos.z * 0.24;

    let tacticalX = home.x + ballShiftX;
    let tacticalZ = home.z + ballShiftZ;

    if (possessingTeam === p.team) {
      // Teammates make intelligent attacking runs into open spaces
      const push = p.entry.role === 'FWD' ? 19 : p.entry.role === 'MID' ? 13 : 6;
      tacticalX += attackDir * push;
      // Widen wingers slightly for passing angles
      if (Math.abs(p.entry.formationZ) > 0.4) {
        tacticalZ += Math.sign(p.entry.formationZ) * 4.5 * attackDir;
      }
    } else {
      // Compact defensive shape
      tacticalX -= attackDir * (p.entry.role === 'DEF' ? 5 : 9);
    }

    tacticalX = THREE.MathUtils.clamp(tacticalX, -HALF_LENGTH + 3, HALF_LENGTH - 3);
    tacticalZ = THREE.MathUtils.clamp(tacticalZ, -HALF_WIDTH + 2.5, HALF_WIDTH - 2.5);

    _v1.set(tacticalX - p.pos.x, 0, tacticalZ - p.pos.z);
    const distToSpot = _v1.length();
    if (distToSpot > 0.6) {
      _v1.divideScalar(distToSpot);
      const targetSpd = Math.min(speedMax * 0.85, distToSpot * 2.2);
      p.vel.x = THREE.MathUtils.lerp(p.vel.x, _v1.x * targetSpd, 1 - Math.exp(-7 * dt));
      p.vel.z = THREE.MathUtils.lerp(p.vel.z, _v1.z * targetSpd, 1 - Math.exp(-7 * dt));
      p.facingAngle = this.lerpAngle(p.facingAngle, Math.atan2(p.vel.x, p.vel.z), 1 - Math.exp(-8 * dt));
    } else {
      p.vel.multiplyScalar(0.85);
      // Look toward the ball when stationary
      const toBallAngle = Math.atan2(this.ballPos.x - p.pos.x, this.ballPos.z - p.pos.z);
      p.facingAngle = this.lerpAngle(p.facingAngle, toBallAngle, 1 - Math.exp(-6 * dt));
    }

    p.pos.addScaledVector(p.vel, dt);
    this.clampPlayerToPitch(p);
  }

  private clampPlayerToPitch(p: SimPlayer) {
    p.pos.x = THREE.MathUtils.clamp(p.pos.x, -HALF_LENGTH - 1.5, HALF_LENGTH + 1.5);
    p.pos.z = THREE.MathUtils.clamp(p.pos.z, -HALF_WIDTH - 1.5, HALF_WIDTH + 1.5);
  }

  private updateBallPhysics(dt: number, inGoalCelebration: boolean) {
    if (this.ballPickupCooldown > 0) {
      this.ballPickupCooldown -= dt;
    }

    if (this.ballOwner && !inGoalCelebration) {
      // Dribble ball smoothly just ahead of the carrier's boots
      const fx = Math.sin(this.ballOwner.facingAngle);
      const fz = Math.cos(this.ballOwner.facingAngle);
      const targetX = this.ballOwner.pos.x + fx * 0.68;
      const targetZ = this.ballOwner.pos.z + fz * 0.68;

      const prevX = this.ballPos.x;
      const prevZ = this.ballPos.z;

      this.ballPos.x = THREE.MathUtils.lerp(this.ballPos.x, targetX, 1 - Math.exp(-22 * dt));
      this.ballPos.z = THREE.MathUtils.lerp(this.ballPos.z, targetZ, 1 - Math.exp(-22 * dt));
      this.ballPos.y = BALL_RADIUS;

      this.ballVel.set(
        (this.ballPos.x - prevX) / Math.max(0.001, dt),
        0,
        (this.ballPos.z - prevZ) / Math.max(0.001, dt),
      );

      // Check if an opponent intercepts/wins the ball
      if (this.ballPickupCooldown <= 0) {
        for (const p of this.players) {
          if (p.team === this.ballOwner.team) continue;
          const dist = p.pos.distanceTo(this.ballPos);
          if (dist < 0.85 && p.jumpY < 0.5) {
            this.ballOwner = p;
            this.lastTouchPlayer = p;
            this.ballPickupCooldown = 0.35;
            if (p.team === this.settings.userTeam && p.entry.role !== 'GK') {
              this.setControlledPlayer(p);
            }
            break;
          }
        }
      }
    } else {
      // Free-flight / rolling physics
      this.ballVel.y -= GRAVITY * dt;
      this.ballPos.addScaledVector(this.ballVel, dt);

      // Ground bounce & turf friction
      if (this.ballPos.y <= BALL_RADIUS) {
        this.ballPos.y = BALL_RADIUS;
        if (this.ballVel.y < -1.8) {
          this.ballVel.y = -this.ballVel.y * 0.58;
        } else {
          this.ballVel.y = 0;
        }
        const turfDrag = Math.pow(0.45, dt);
        this.ballVel.x *= turfDrag;
        this.ballVel.z *= turfDrag;
      } else {
        // Aerodynamic drag
        const airDrag = Math.pow(0.86, dt);
        this.ballVel.x *= airDrag;
        this.ballVel.z *= airDrag;
      }

      // Goalpost & crossbar collisions
      this.collideGoalFrame();

      if (!inGoalCelebration) {
        // Check Goal Scored
        if (this.checkGoalScored()) {
          return;
        }

        // Keep ball cleanly on the football field (rebound softly at touchlines/endlines outside goal mouth)
        if (Math.abs(this.ballPos.z) > HALF_WIDTH - BALL_RADIUS) {
          this.ballPos.z = Math.sign(this.ballPos.z) * (HALF_WIDTH - BALL_RADIUS);
          this.ballVel.z *= -0.62;
        }
        if (
          Math.abs(this.ballPos.x) > HALF_LENGTH - BALL_RADIUS &&
          Math.abs(this.ballPos.z) >= GOAL_HALF_WIDTH
        ) {
          this.ballPos.x = Math.sign(this.ballPos.x) * (HALF_LENGTH - BALL_RADIUS);
          this.ballVel.x *= -0.62;
        }

        // Player ball pickup / deflection collision
        if (this.ballPickupCooldown <= 0) {
          for (const p of this.players) {
            const dx = this.ballPos.x - p.pos.x;
            const dz = this.ballPos.z - p.pos.z;
            const horizDist = Math.hypot(dx, dz);
            const reachY = p.entry.role === 'GK' ? 2.15 : 1.7 + p.jumpY;

            if (horizDist < 0.88 && this.ballPos.y < reachY) {
              // GK saves high/fast shot with a parry if diving
              if (p.entry.role === 'GK' && Math.hypot(this.ballVel.x, this.ballVel.z) > 16) {
                const attackDir = this.getAttackDir(p.team);
                this.ballVel.x = attackDir * 10;
                this.ballVel.z = (this.ballPos.z - p.pos.z) * 5 + (Math.random() - 0.5) * 6;
                this.ballVel.y = 3.2;
                this.ballPickupCooldown = 0.25;
                this.lastTouchPlayer = p;
                this.sound.playKick(0.5);
                break;
              }

              // Clean ball control
              this.ballOwner = p;
              this.lastTouchPlayer = p;
              this.ballPickupCooldown = 0.18;
              if (p.team === this.settings.userTeam && p.entry.role !== 'GK') {
                this.setControlledPlayer(p);
              }
              break;
            }
          }
        }
      } else {
        // Confine ball inside goal net during celebration
        const side = Math.sign(this.ballPos.x) || 1;
        this.ballPos.x = THREE.MathUtils.clamp(
          this.ballPos.x,
          side > 0 ? HALF_LENGTH + 0.2 : -(HALF_LENGTH + GOAL_DEPTH - BALL_RADIUS),
          side > 0 ? HALF_LENGTH + GOAL_DEPTH - BALL_RADIUS : -(HALF_LENGTH + 0.2),
        );
        this.ballPos.z = THREE.MathUtils.clamp(
          this.ballPos.z,
          -GOAL_HALF_WIDTH + BALL_RADIUS,
          GOAL_HALF_WIDTH - BALL_RADIUS,
        );
        this.ballVel.multiplyScalar(0.92);
      }
    }

    // Apply ball transform & rolling spin
    this.ballMesh.position.copy(this.ballPos);
    const horizSpeed = Math.hypot(this.ballVel.x, this.ballVel.z);
    if (horizSpeed > 0.05) {
      _rollAxis.set(this.ballVel.z, 0, -this.ballVel.x).normalize();
      const angle = (horizSpeed * dt) / BALL_RADIUS;
      this.ballMesh.rotateOnWorldAxis(_rollAxis, angle);
    }

    this.ballShadow.position.set(this.ballPos.x, 0.025, this.ballPos.z);
    const shadowScale = Math.max(0.45, 1 - this.ballPos.y * 0.12);
    this.ballShadow.scale.setScalar(shadowScale);
  }

  private collideGoalFrame() {
    const minDist = BALL_RADIUS + GOAL_POST_RADIUS;
    for (const side of [-1, 1]) {
      const gx = side * HALF_LENGTH;

      // Vertical posts
      if (this.ballPos.y <= GOAL_HEIGHT + BALL_RADIUS) {
        for (const zSign of [-1, 1]) {
          const pz = zSign * GOAL_HALF_WIDTH;
          const dx = this.ballPos.x - gx;
          const dz = this.ballPos.z - pz;
          const d = Math.hypot(dx, dz);
          if (d > 0.0001 && d < minDist) {
            const nx = dx / d;
            const nz = dz / d;
            this.ballPos.x = gx + nx * minDist;
            this.ballPos.z = pz + nz * minDist;
            const dot = this.ballVel.x * nx + this.ballVel.z * nz;
            if (dot < 0) {
              this.ballVel.x -= 1.75 * dot * nx;
              this.ballVel.z -= 1.75 * dot * nz;
              this.sound.playPostHit();
            }
          }
        }
      }

      // Horizontal crossbar
      if (Math.abs(this.ballPos.z) <= GOAL_HALF_WIDTH + BALL_RADIUS) {
        const dx = this.ballPos.x - gx;
        const dy = this.ballPos.y - GOAL_HEIGHT;
        const d = Math.hypot(dx, dy);
        if (d > 0.0001 && d < minDist) {
          const nx = dx / d;
          const ny = dy / d;
          this.ballPos.x = gx + nx * minDist;
          this.ballPos.y = GOAL_HEIGHT + ny * minDist;
          const dot = this.ballVel.x * nx + this.ballVel.y * ny;
          if (dot < 0) {
            this.ballVel.x -= 1.75 * dot * nx;
            this.ballVel.y -= 1.75 * dot * ny;
            this.sound.playPostHit();
          }
        }
      }
    }
  }

  private checkGoalScored(): boolean {
    if (
      Math.abs(this.ballPos.x) > HALF_LENGTH + BALL_RADIUS * 0.45 &&
      Math.abs(this.ballPos.z) < GOAL_HALF_WIDTH - BALL_RADIUS * 0.25 &&
      this.ballPos.y < GOAL_HEIGHT - BALL_RADIUS * 0.2
    ) {
      const goalSide: -1 | 1 = this.ballPos.x > 0 ? 1 : -1;
      // Which team attacks toward goalSide?
      const madridAttacksRight = this.getAttackDir('madrid') === 1;
      const scoringTeam: TeamId =
        goalSide === 1
          ? madridAttacksRight
            ? 'madrid'
            : 'barca'
          : madridAttacksRight
            ? 'barca'
            : 'madrid';

      if (scoringTeam === 'madrid') this.scoreMadrid++;
      else this.scoreBarca++;

      const scorer =
        this.lastTouchPlayer && this.lastTouchPlayer.team === scoringTeam
          ? this.lastTouchPlayer.entry
          : (scoringTeam === 'madrid' ? MADRID_ROSTER[9] : BARCA_ROSTER[9]);

      const minute = Math.max(1, Math.min(90, Math.ceil(this.matchSeconds / 60)));
      const event: GoalEvent = {
        team: scoringTeam,
        scorerName: scorer.name,
        scorerNumber: scorer.number,
        minute,
      };
      this.lastGoal = event;
      this.stats.goals.push(event);

      this.phase = 'goal';
      this.goalCelebrationTimer = 3.4;
      this.ballOwner = null;
      this.shotCharging = false;
      this.shotCharge = 0;

      this.stadium.triggerGoalRipple(goalSide);
      this.sound.playWhistle('goal');
      this.sound.playGoalCelebration();
      this.emitHud();
      return true;
    }
    return false;
  }

  private updateCamera(dt: number) {
    const mode = this.settings.cameraMode;
    const focus = this.controlledPlayer ? this.controlledPlayer.pos : this.ballPos;
    const userAttackDir = this.getAttackDir(this.settings.userTeam);

    if (this.phase === 'goal') {
      // Dramatic low-angle celebration camera near scorer
      _camDesiredLook.set(this.ballPos.x * 0.75, 1.4, this.ballPos.z * 0.6);
      _camDesiredPos.set(
        this.ballPos.x - Math.sign(this.ballPos.x) * 14,
        4.8,
        this.ballPos.z + 13,
      );
    } else if (mode === 'third-person') {
      // Behind controlled player, angled cleanly toward the attacking goal & ball
      const midX = THREE.MathUtils.lerp(focus.x, this.ballPos.x, 0.42);
      const midZ = THREE.MathUtils.lerp(focus.z, this.ballPos.z, 0.42);
      _camDesiredLook.set(midX + userAttackDir * 5.5, 1.2, midZ);
      _camDesiredPos.set(
        THREE.MathUtils.clamp(midX - userAttackDir * 15.5, -HALF_LENGTH - 12, HALF_LENGTH + 12),
        10.2,
        THREE.MathUtils.clamp(midZ + 11.5, -HALF_WIDTH - 10, HALF_WIDTH + 16),
      );
    } else if (mode === 'broadcast') {
      // Elevated EA FC / TV broadcast side camera tracking the ball
      _camDesiredLook.set(
        THREE.MathUtils.clamp(this.ballPos.x * 0.85, -36, 36),
        0.5,
        THREE.MathUtils.clamp(this.ballPos.z * 0.55, -16, 16),
      );
      _camDesiredPos.set(
        THREE.MathUtils.clamp(this.ballPos.x * 0.72, -32, 32),
        24.5,
        38 + this.ballPos.z * 0.25,
      );
    } else {
      // Wide tactical stadium camera keeping nearly the entire pitch visible
      _camDesiredLook.set(this.ballPos.x * 0.25, 0, this.ballPos.z * 0.2);
      _camDesiredPos.set(this.ballPos.x * 0.18, 40, 56);
    }

    const posDamp = 1 - Math.exp(-5.8 * dt);
    const lookDamp = 1 - Math.exp(-8.5 * dt);
    this.camera.position.lerp(_camDesiredPos, posDamp);
    this.currentCamLook.lerp(_camDesiredLook, lookDamp);
    this.camera.lookAt(this.currentCamLook);
  }

  private lerpAngle(a: number, b: number, t: number): number {
    let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }

  private emitHud() {
    this.onHudUpdate({
      phase: this.phase,
      scoreMadrid: this.scoreMadrid,
      scoreBarca: this.scoreBarca,
      matchSeconds: this.matchSeconds,
      half: this.half,
      activePlayerName: this.controlledPlayer?.entry.name ?? 'Mbappe',
      activePlayerNumber: this.controlledPlayer?.entry.number ?? 9,
      activePlayerRole: this.controlledPlayer?.entry.role ?? 'FWD',
      activePlayerStamina: this.controlledPlayer?.stamina ?? 1,
      shotCharge: this.shotCharge,
      cameraMode: this.settings.cameraMode,
      lastGoal: this.lastGoal,
      stats: { ...this.stats, goals: [...this.stats.goals] },
      ballPossessionTeam: this.ballOwner?.team ?? null,
      bannerMessage: this.bannerMessage,
    });
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);

    this.players.forEach((p) => p.rig.dispose());
    this.stadium.dispose();
    this.sharedDisposables.forEach((d) => d.dispose());
    this.envRT?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
