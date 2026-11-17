import { useCallback, useEffect, useRef, useState } from 'react';
import { SoundEngine } from './audio/SoundEngine';
import { MainMenu } from './components/MainMenu';
import { MatchHUD } from './components/MatchHUD';
import { MatchEngine } from './game/MatchEngine';
import { HudState, MatchSettings } from './types/game';

const DEFAULT_SETTINGS: MatchSettings = {
  userTeam: 'madrid',
  durationMinutes: 4,
  lighting: 'evening',
  difficulty: 'pro',
  cameraMode: 'third-person',
  soundEnabled: true,
};

const INITIAL_HUD: HudState = {
  phase: 'menu',
  scoreMadrid: 0,
  scoreBarca: 0,
  matchSeconds: 0,
  half: 1,
  activePlayerName: 'Mbappe',
  activePlayerNumber: 9,
  activePlayerRole: 'FWD',
  activePlayerStamina: 1,
  shotCharge: 0,
  cameraMode: 'third-person',
  lastGoal: null,
  stats: {
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
  },
  ballPossessionTeam: null,
  bannerMessage: null,
};

export default function App() {
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<MatchEngine | null>(null);
  const soundRef = useRef<SoundEngine | null>(null);

  const [settings, setSettings] = useState<MatchSettings>(DEFAULT_SETTINGS);
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [webglError, setWebglError] = useState<string | null>(null);

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    try {
      const sound = new SoundEngine();
      soundRef.current = sound;

      const engine = new MatchEngine(container, DEFAULT_SETTINGS, sound, (nextHud) => {
        setHud(nextHud);
      });
      engineRef.current = engine;
    } catch (err) {
      console.error('Failed to initialize 3D stadium engine:', err);
      setWebglError('WebGL 3D context could not be initialized on this browser.');
    }

    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
      soundRef.current?.dispose();
      soundRef.current = null;
    };
  }, []);

  const handleUpdateSettings = useCallback((partial: Partial<MatchSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      engineRef.current?.updateSettings(partial);
      return next;
    });
  }, []);

  const handlePlayMatch = useCallback(() => {
    engineRef.current?.startNewMatch(settings);
  }, [settings]);

  const handlePause = useCallback(() => {
    engineRef.current?.pauseMatch();
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.resumeMatch();
  }, []);

  const handleRestart = useCallback(() => {
    engineRef.current?.startNewMatch(settings);
  }, [settings]);

  const handleQuitToMenu = useCallback(() => {
    engineRef.current?.returnToMenu();
  }, []);

  const handleStartSecondHalf = useCallback(() => {
    engineRef.current?.startSecondHalf();
  }, []);

  const handleCycleCamera = useCallback(() => {
    engineRef.current?.cycleCamera();
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#070b14]">
      {/* Dedicated Isolated WebGL Viewport Container */}
      <div
        ref={canvasContainerRef}
        className="absolute inset-0 w-full h-full"
        aria-label="3D El Clasico Football Stadium"
      />

      {webglError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070b14] p-6">
          <div className="max-w-md rounded-2xl bg-[#0d1424] border border-white/15 p-6 text-center space-y-3">
            <h2 className="font-display text-2xl font-bold uppercase text-white">
              3D Graphics Unavailable
            </h2>
            <p className="text-sm text-slate-300">{webglError}</p>
          </div>
        </div>
      )}

      {!webglError && hud.phase === 'menu' && (
        <MainMenu
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onPlayMatch={handlePlayMatch}
        />
      )}

      {!webglError && hud.phase !== 'menu' && (
        <MatchHUD
          hud={hud}
          settings={settings}
          onPause={handlePause}
          onResume={handleResume}
          onRestart={handleRestart}
          onQuitToMenu={handleQuitToMenu}
          onStartSecondHalf={handleStartSecondHalf}
          onCycleCamera={handleCycleCamera}
          onUpdateSettings={handleUpdateSettings}
        />
      )}
    </div>
  );
}
