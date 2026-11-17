export type TeamId = 'madrid' | 'barca';

export type LightingMode = 'day' | 'evening';

export type CameraMode = 'third-person' | 'broadcast' | 'wide';

export type Difficulty = 'amateur' | 'pro' | 'world-class';

export type MatchPhase =
  | 'menu'
  | 'playing'
  | 'goal'
  | 'halftime'
  | 'fulltime'
  | 'paused';

export type PlayerRole = 'GK' | 'DEF' | 'MID' | 'FWD';

export interface PlayerRosterEntry {
  id: string;
  name: string;
  number: number;
  role: PlayerRole;
  /** Normalized formation coordinates on attacking half/team side: x in [-1, 0], z in [-1, 1] */
  formationX: number;
  formationZ: number;
  speedRating: number;
  hairColor: number;
  skinTone: number;
}

export interface MatchSettings {
  userTeam: TeamId;
  durationMinutes: number; // Real-world duration for full 90' match (2, 4, 6, 10)
  lighting: LightingMode;
  difficulty: Difficulty;
  cameraMode: CameraMode;
  soundEnabled: boolean;
}

export interface GoalEvent {
  team: TeamId;
  scorerName: string;
  scorerNumber: number;
  minute: number;
}

export interface MatchStats {
  madridShots: number;
  barcaShots: number;
  madridShotsOnTarget: number;
  barcaShotsOnTarget: number;
  madridPasses: number;
  barcaPasses: number;
  madridTackles: number;
  barcaTackles: number;
  madridPossessionTime: number;
  barcaPossessionTime: number;
  goals: GoalEvent[];
}

export interface HudState {
  phase: MatchPhase;
  scoreMadrid: number;
  scoreBarca: number;
  matchSeconds: number; // 0 to 5400 (representing 0' to 90')
  half: 1 | 2;
  activePlayerName: string;
  activePlayerNumber: number;
  activePlayerRole: PlayerRole;
  activePlayerStamina: number; // 0 to 1
  shotCharge: number; // 0 to 1
  cameraMode: CameraMode;
  lastGoal: GoalEvent | null;
  stats: MatchStats;
  ballPossessionTeam: TeamId | null;
  bannerMessage: string | null;
}

export const MADRID_ROSTER: PlayerRosterEntry[] = [
  { id: 'rm-1', name: 'Courtois', number: 1, role: 'GK', formationX: -0.95, formationZ: 0.0, speedRating: 0.85, hairColor: 0x4a3520, skinTone: 0xf1c29b },
  { id: 'rm-2', name: 'Carvajal', number: 2, role: 'DEF', formationX: -0.68, formationZ: 0.65, speedRating: 0.96, hairColor: 0x2d1e12, skinTone: 0xe3b088 },
  { id: 'rm-3', name: 'Militao', number: 3, role: 'DEF', formationX: -0.72, formationZ: 0.22, speedRating: 0.97, hairColor: 0x181412, skinTone: 0x8d5836 },
  { id: 'rm-22', name: 'Rudiger', number: 22, role: 'DEF', formationX: -0.72, formationZ: -0.22, speedRating: 0.98, hairColor: 0x141210, skinTone: 0x683d22 },
  { id: 'rm-23', name: 'Mendy', number: 23, role: 'DEF', formationX: -0.68, formationZ: -0.65, speedRating: 0.98, hairColor: 0x141210, skinTone: 0x5c3620 },
  { id: 'rm-8', name: 'Valverde', number: 8, role: 'MID', formationX: -0.40, formationZ: 0.48, speedRating: 1.02, hairColor: 0x4f3620, skinTone: 0xebc09a },
  { id: 'rm-14', name: 'Tchouameni', number: 14, role: 'MID', formationX: -0.46, formationZ: 0.0, speedRating: 0.95, hairColor: 0x161412, skinTone: 0x734427 },
  { id: 'rm-5', name: 'Bellingham', number: 5, role: 'MID', formationX: -0.35, formationZ: -0.48, speedRating: 1.0, hairColor: 0x1b1613, skinTone: 0xb9825a },
  { id: 'rm-11', name: 'Rodrygo', number: 11, role: 'FWD', formationX: -0.14, formationZ: 0.56, speedRating: 1.03, hairColor: 0x1a1512, skinTone: 0xc9936a },
  { id: 'rm-9', name: 'Mbappe', number: 9, role: 'FWD', formationX: -0.09, formationZ: 0.0, speedRating: 1.08, hairColor: 0x151311, skinTone: 0x996543 },
  { id: 'rm-7', name: 'Vinicius Jr', number: 7, role: 'FWD', formationX: -0.14, formationZ: -0.56, speedRating: 1.07, hairColor: 0x151311, skinTone: 0x7a4b2d },
];

export const BARCA_ROSTER: PlayerRosterEntry[] = [
  { id: 'fcb-1', name: 'Ter Stegen', number: 1, role: 'GK', formationX: -0.95, formationZ: 0.0, speedRating: 0.85, hairColor: 0x8f6b3e, skinTone: 0xf4cab0 },
  { id: 'fcb-23', name: 'Kounde', number: 23, role: 'DEF', formationX: -0.68, formationZ: 0.65, speedRating: 0.98, hairColor: 0x161412, skinTone: 0x855333 },
  { id: 'fcb-4', name: 'Araujo', number: 4, role: 'DEF', formationX: -0.72, formationZ: 0.22, speedRating: 0.97, hairColor: 0x211812, skinTone: 0xd19c74 },
  { id: 'fcb-2', name: 'Cubarsi', number: 2, role: 'DEF', formationX: -0.72, formationZ: -0.22, speedRating: 0.94, hairColor: 0x3b2819, skinTone: 0xf0c29e },
  { id: 'fcb-3', name: 'Balde', number: 3, role: 'DEF', formationX: -0.68, formationZ: -0.65, speedRating: 1.04, hairColor: 0x151311, skinTone: 0x6f4124 },
  { id: 'fcb-8', name: 'Pedri', number: 8, role: 'MID', formationX: -0.38, formationZ: 0.48, speedRating: 0.99, hairColor: 0x2e2014, skinTone: 0xebc09a },
  { id: 'fcb-21', name: 'De Jong', number: 21, role: 'MID', formationX: -0.45, formationZ: 0.0, speedRating: 0.98, hairColor: 0xb59150, skinTone: 0xf4cab0 },
  { id: 'fcb-20', name: 'Dani Olmo', number: 20, role: 'MID', formationX: -0.35, formationZ: -0.48, speedRating: 0.99, hairColor: 0x3a2819, skinTone: 0xefc3a0 },
  { id: 'fcb-19', name: 'Yamal', number: 19, role: 'FWD', formationX: -0.14, formationZ: 0.56, speedRating: 1.05, hairColor: 0x1a1512, skinTone: 0xb9825a },
  { id: 'fcb-9', name: 'Lewandowski', number: 9, role: 'FWD', formationX: -0.09, formationZ: 0.0, speedRating: 1.0, hairColor: 0x332418, skinTone: 0xf2c8a8 },
  { id: 'fcb-11', name: 'Raphinha', number: 11, role: 'FWD', formationX: -0.14, formationZ: -0.56, speedRating: 1.05, hairColor: 0x1c1714, skinTone: 0xc28c62 },
];
