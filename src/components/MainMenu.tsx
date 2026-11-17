import React, { useState } from 'react';
import {
  Play,
  Users,
  Sliders,
  HelpCircle,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  X,
  Check,
} from 'lucide-react';
import {
  BARCA_ROSTER,
  CameraMode,
  Difficulty,
  MADRID_ROSTER,
  MatchSettings,
  TeamId,
} from '../types/game';
import { TeamCrest } from './TeamCrest';

interface MainMenuProps {
  settings: MatchSettings;
  onUpdateSettings: (partial: Partial<MatchSettings>) => void;
  onPlayMatch: () => void;
}

type MenuModal = 'none' | 'teams' | 'settings' | 'howto';

export const MainMenu: React.FC<MainMenuProps> = ({
  settings,
  onUpdateSettings,
  onPlayMatch,
}) => {
  const [modal, setModal] = useState<MenuModal>('none');

  const selectedTeamName =
    settings.userTeam === 'madrid' ? 'Real Madrid' : 'FC Barcelona';
  const opponentTeamName =
    settings.userTeam === 'madrid' ? 'FC Barcelona' : 'Real Madrid';

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between pointer-events-none">
      {/* Contrast Scrim over live 3D rotating stadium */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(7,11,20,0.92) 0%, rgba(7,11,20,0.68) 46%, rgba(7,11,20,0.22) 100%)',
        }}
      />

      {/* Top Navigation / Fixture Header */}
      <header className="relative z-10 flex items-center justify-between px-8 pt-7 pointer-events-auto">
        <div className="flex items-center gap-4">
          <span className="font-display text-2xl font-extrabold tracking-wider text-white uppercase whitespace-nowrap">
            EL CLASICO
          </span>
          <span className="text-slate-500" aria-hidden="true">·</span>
          <span className="text-xs font-medium tracking-widest text-slate-300 uppercase whitespace-nowrap">
            Matchday Edition
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              onUpdateSettings({
                lighting: settings.lighting === 'day' ? 'evening' : 'day',
              })
            }
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0d1424]/90 border border-white/15 text-xs font-semibold text-slate-200 hover:bg-[#172138] transition-colors cursor-pointer whitespace-nowrap"
          >
            {settings.lighting === 'day' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Day Kickoff</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-sky-400" />
                <span>Evening Floodlights</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateSettings({ soundEnabled: !settings.soundEnabled })
            }
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0d1424]/90 border border-white/15 text-xs font-semibold text-slate-200 hover:bg-[#172138] transition-colors cursor-pointer whitespace-nowrap"
            aria-label={settings.soundEnabled ? 'Mute Audio' : 'Enable Audio'}
          >
            {settings.soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </div>
      </header>

      {/* Main Hero & Menu Actions */}
      <main className="relative z-10 flex-1 flex items-center px-8 lg:px-14">
        <div className="w-full max-w-xl space-y-8 pointer-events-auto">
          {/* Matchup Banner */}
          <div className="space-y-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <TeamCrest team="madrid" size={54} />
                <div>
                  <div className="font-display text-xl font-bold tracking-wide text-white uppercase">
                    Real Madrid
                  </div>
                  <div className="text-xs text-slate-400">
                    {settings.userTeam === 'madrid' ? 'Your Club' : 'AI Opponent'}
                  </div>
                </div>
              </div>

              <div className="font-display text-2xl font-extrabold text-amber-400 tracking-widest">
                VS
              </div>

              <div className="flex items-center gap-3">
                <TeamCrest team="barca" size={54} />
                <div>
                  <div className="font-display text-xl font-bold tracking-wide text-white uppercase">
                    FC Barcelona
                  </div>
                  <div className="text-xs text-slate-400">
                    {settings.userTeam === 'barca' ? 'Your Club' : 'AI Opponent'}
                  </div>
                </div>
              </div>
            </div>

            <h1 className="font-display text-5xl sm:text-6xl font-extrabold tracking-tight text-white leading-[0.95] uppercase">
              El Clasico 3D
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-md leading-relaxed">
              Take control of <span className="text-white font-semibold">{selectedTeamName}</span> against{' '}
              <span className="text-white font-semibold">{opponentTeamName}</span> in a full 11v11 stadium clash with live physics, tactical AI, and broadcast cameras.
            </p>
          </div>

          {/* Primary Menu Buttons */}
          <div className="flex flex-col gap-3 max-w-sm">
            <button
              type="button"
              onClick={onPlayMatch}
              className="group flex items-center justify-between px-6 py-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display text-2xl font-extrabold tracking-wide uppercase transition-transform active:scale-[0.99] cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <span className="flex items-center gap-3">
                <Play className="w-5 h-5 fill-slate-950" />
                Play Match
              </span>
              <span className="text-xs font-sans font-bold tracking-wider uppercase opacity-80">
                90&apos; · {settings.durationMinutes}m
              </span>
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setModal('teams')}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0e1628]/90 hover:bg-[#192642] border border-white/15 text-sm font-semibold text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                <Users className="w-4 h-4 text-sky-400" />
                <span>Team Selection</span>
              </button>

              <button
                type="button"
                onClick={() => setModal('settings')}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0e1628]/90 hover:bg-[#192642] border border-white/15 text-sm font-semibold text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>Settings</span>
              </button>

              <button
                type="button"
                onClick={() => setModal('howto')}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0e1628]/90 hover:bg-[#192642] border border-white/15 text-sm font-semibold text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                <HelpCircle className="w-4 h-4 text-emerald-400" />
                <span>How to Play</span>
              </button>
            </div>
          </div>

          {/* Quiet Match Configuration Summary */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span>Formation: 4-3-3</span>
            <span aria-hidden="true">·</span>
            <span>Difficulty: {settings.difficulty.replace('-', ' ')}</span>
            <span aria-hidden="true">·</span>
            <span>Camera: {settings.cameraMode}</span>
          </div>
        </div>
      </main>

      {/* Bottom Quiet Controls Hint */}
      <footer className="relative z-10 px-8 pb-6 flex items-center justify-between text-xs text-slate-400 pointer-events-none">
        <span>WASD Move · SHIFT Sprint · SPACE Shoot / Jump · E Pass · Q Switch · F Tackle · C Camera</span>
      </footer>

      {/* MODAL: Team Selection */}
      {modal === 'teams' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#060911]/85 p-6 pointer-events-auto">
          <div className="w-full max-w-3xl rounded-2xl bg-[#0d1424] border border-white/15 p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="font-display text-3xl font-extrabold uppercase tracking-wide text-white">
                  Team Selection
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Choose which club you will command on the pitch (11v11 · 4-3-3)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModal('none')}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer"
                aria-label="Close Team Selection"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {(['madrid', 'barca'] as TeamId[]).map((tid) => {
                const isSelected = settings.userTeam === tid;
                const roster = tid === 'madrid' ? MADRID_ROSTER : BARCA_ROSTER;
                const title = tid === 'madrid' ? 'Real Madrid' : 'FC Barcelona';
                const kitDesc =
                  tid === 'madrid'
                    ? 'Home White & Gold Kit · GK Teal'
                    : 'Blaugrana Stripes Kit · GK Gold';
                return (
                  <button
                    key={tid}
                    type="button"
                    onClick={() => onUpdateSettings({ userTeam: tid })}
                    className={`text-left rounded-xl p-5 border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#172542] border-amber-400'
                        : 'bg-[#0a101d] border-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3.5">
                        <TeamCrest team={tid} size={48} />
                        <div>
                          <div className="font-display text-2xl font-bold uppercase text-white">
                            {title}
                          </div>
                          <div className="text-xs text-slate-400">{kitDesc}</div>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="flex items-center gap-1 text-xs font-bold text-amber-400 uppercase">
                          <Check className="w-4 h-4" /> Selected
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-300 border-t border-white/10 pt-3">
                      {roster.map((p) => (
                        <div key={p.id} className="flex items-center justify-between py-0.5">
                          <span className="truncate">
                            <span className="font-mono-tabular text-slate-500 mr-1.5">
                              #{p.number}
                            </span>
                            {p.name}
                          </span>
                          <span className="text-[11px] text-slate-500 font-semibold">
                            {p.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModal('none')}
                className="px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-semibold text-white cursor-pointer"
              >
                Confirm Club
              </button>
              <button
                type="button"
                onClick={() => {
                  setModal('none');
                  onPlayMatch();
                }}
                className="px-6 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-sm font-bold text-slate-950 cursor-pointer"
              >
                Kick Off Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Settings */}
      {modal === 'settings' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#060911]/85 p-6 pointer-events-auto">
          <div className="w-full max-w-lg rounded-2xl bg-[#0d1424] border border-white/15 p-6 sm:p-7 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="font-display text-3xl font-extrabold uppercase tracking-wide text-white">
                Match Settings
              </h2>
              <button
                type="button"
                onClick={() => setModal('none')}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer"
                aria-label="Close Settings"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Match Duration */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  90-Minute Match Duration (Real Time)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[2, 4, 6, 10].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => onUpdateSettings({ durationMinutes: mins })}
                      className={`py-2.5 rounded-lg text-sm font-semibold border cursor-pointer transition-colors ${
                        settings.durationMinutes === mins
                          ? 'bg-amber-400 text-slate-950 border-amber-400 font-bold'
                          : 'bg-[#0a101d] text-slate-300 border-white/10 hover:border-white/30'
                      }`}
                    >
                      {mins} Min
                    </button>
                  ))}
                </div>
              </div>

              {/* Stadium Lighting */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Stadium Lighting
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['day', 'evening'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onUpdateSettings({ lighting: mode })}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border cursor-pointer transition-colors ${
                        settings.lighting === mode
                          ? 'bg-amber-400 text-slate-950 border-amber-400 font-bold'
                          : 'bg-[#0a101d] text-slate-300 border-white/10 hover:border-white/30'
                      }`}
                    >
                      {mode === 'day' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                      <span>{mode === 'day' ? 'Daylight Sun' : 'Evening Floodlights'}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Difficulty */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  AI Difficulty
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['amateur', 'pro', 'world-class'] as Difficulty[]).map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => onUpdateSettings({ difficulty: diff })}
                      className={`py-2.5 rounded-lg text-sm font-semibold capitalize border cursor-pointer transition-colors ${
                        settings.difficulty === diff
                          ? 'bg-amber-400 text-slate-950 border-amber-400 font-bold'
                          : 'bg-[#0a101d] text-slate-300 border-white/10 hover:border-white/30'
                      }`}
                    >
                      {diff.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Camera Mode */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Default Camera Angle
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['third-person', 'broadcast', 'wide'] as CameraMode[]).map((cam) => (
                    <button
                      key={cam}
                      type="button"
                      onClick={() => onUpdateSettings({ cameraMode: cam })}
                      className={`py-2.5 rounded-lg text-sm font-semibold capitalize border cursor-pointer transition-colors ${
                        settings.cameraMode === cam
                          ? 'bg-amber-400 text-slate-950 border-amber-400 font-bold'
                          : 'bg-[#0a101d] text-slate-300 border-white/10 hover:border-white/30'
                      }`}
                    >
                      {cam.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sound */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="text-sm font-medium text-slate-200">
                  Stadium Crowd & Match Audio
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ soundEnabled: !settings.soundEnabled })
                  }
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase cursor-pointer ${
                    settings.soundEnabled
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {settings.soundEnabled ? 'Enabled' : 'Muted'}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setModal('none')}
                className="px-6 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-sm font-bold text-slate-950 cursor-pointer"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: How to Play */}
      {modal === 'howto' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#060911]/85 p-6 pointer-events-auto">
          <div className="w-full max-w-xl rounded-2xl bg-[#0d1424] border border-white/15 p-6 sm:p-7 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="font-display text-3xl font-extrabold uppercase tracking-wide text-white">
                How to Play
              </h2>
              <button
                type="button"
                onClick={() => setModal('none')}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer"
                aria-label="Close How to Play"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                { key: 'W A S D', desc: 'Move player smoothly in camera view' },
                { key: 'SHIFT', desc: 'Sprint burst (uses player stamina)' },
                { key: 'SPACE', desc: 'Hold & release to Shoot (or Jump off-ball)' },
                { key: 'E', desc: 'Pass to highlighted open teammate' },
                { key: 'Q', desc: 'Switch to teammate closest to ball' },
                { key: 'F', desc: 'Slide Tackle to dispossess opponent' },
                { key: 'C', desc: 'Cycle Camera (3rd-Person / Broadcast / Wide)' },
                { key: 'ESC', desc: 'Pause match & adjust settings' },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[#0a101d] border border-white/10"
                >
                  <kbd className="px-2.5 py-1.5 rounded-md bg-slate-800 border border-white/15 font-mono-tabular text-xs font-bold text-amber-300 shrink-0">
                    {item.key}
                  </kbd>
                  <span className="text-xs text-slate-300 leading-snug">{item.desc}</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Tip: Aim your passes and shots using W/A/S/D. A green ring marks your pass target teammate, and holding SPACE charges shot power for top-corner strikes!
            </p>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setModal('none')}
                className="px-6 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-sm font-bold text-slate-950 cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
