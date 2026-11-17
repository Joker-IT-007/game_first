import React, { useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { HudState, MatchSettings } from '../types/game';
import { TeamCrest } from './TeamCrest';

interface MatchHUDProps {
  hud: HudState;
  settings: MatchSettings;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onQuitToMenu: () => void;
  onStartSecondHalf: () => void;
  onCycleCamera: () => void;
  onUpdateSettings: (partial: Partial<MatchSettings>) => void;
}

function formatMatchClock(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const MatchHUD: React.FC<MatchHUDProps> = ({
  hud,
  settings,
  onPause,
  onResume,
  onRestart,
  onQuitToMenu,
  onStartSecondHalf,
  onCycleCamera,
  onUpdateSettings,
}) => {
  const [controlsCollapsed, setControlsCollapsed] = useState(false);

  const totalPoss =
    hud.stats.madridPossessionTime + hud.stats.barcaPossessionTime;
  const madridPossPct =
    totalPoss > 0.1
      ? Math.round((hud.stats.madridPossessionTime / totalPoss) * 100)
      : 50;
  const barcaPossPct = 100 - madridPossPct;

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-5">
      {/* TOP ROW: Broadcast Scorebug (Top-Left) + Quick Actions (Top-Right) */}
      <div className="flex items-start justify-between gap-4">
        {/* Broadcast Scoreboard */}
        <div className="pointer-events-auto flex items-stretch rounded-xl overflow-hidden bg-[#0a101d]/92 border border-white/15 shadow-xl">
          {/* Half & Clock */}
          <div className="flex flex-col items-center justify-center px-3.5 py-2 bg-[#111a2e] border-r border-white/10">
            <span className="text-[10px] font-bold tracking-wider uppercase text-amber-400">
              {hud.half === 1 ? '1ST HALF' : '2ND HALF'}
            </span>
            <span className="font-mono-tabular text-base font-bold text-white leading-tight">
              {formatMatchClock(hud.matchSeconds)}
            </span>
          </div>

          {/* Real Madrid */}
          <div className="flex items-center gap-2.5 px-3.5 py-2 bg-[#f8fafc] text-slate-950">
            <TeamCrest team="madrid" size={26} />
            <span className="font-display text-lg font-extrabold tracking-wide">
              RMA
            </span>
          </div>

          {/* Score */}
          <div className="flex items-center gap-2 px-4 py-2 bg-[#070b14] text-white font-display text-2xl font-extrabold tabular-nums">
            <span>{hud.scoreMadrid}</span>
            <span className="text-slate-500 text-lg">-</span>
            <span>{hud.scoreBarca}</span>
          </div>

          {/* FC Barcelona */}
          <div className="flex items-center gap-2.5 px-3.5 py-2 bg-gradient-to-r from-[#004d98] to-[#a50044] text-white">
            <span className="font-display text-lg font-extrabold tracking-wide">
              FCB
            </span>
            <TeamCrest team="barca" size={26} />
          </div>
        </div>

        {/* Top-Right Quick Controls */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onCycleCamera}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0a101d]/90 hover:bg-[#16213a] border border-white/15 text-xs font-semibold text-slate-200 cursor-pointer whitespace-nowrap"
            title="Switch Camera (C)"
          >
            <Camera className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline capitalize">
              {hud.cameraMode.replace('-', ' ')}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateSettings({
                lighting: settings.lighting === 'day' ? 'evening' : 'day',
              })
            }
            className="p-2 rounded-lg bg-[#0a101d]/90 hover:bg-[#16213a] border border-white/15 text-slate-200 cursor-pointer"
            title="Toggle Day / Evening Lighting"
            aria-label="Toggle Lighting"
          >
            {settings.lighting === 'day' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-sky-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateSettings({ soundEnabled: !settings.soundEnabled })
            }
            className="p-2 rounded-lg bg-[#0a101d]/90 hover:bg-[#16213a] border border-white/15 text-slate-200 cursor-pointer"
            title="Toggle Audio"
            aria-label="Toggle Audio"
          >
            {settings.soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
          </button>

          <button
            type="button"
            onClick={onPause}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0a101d]/90 hover:bg-[#16213a] border border-white/15 text-xs font-semibold text-white cursor-pointer"
            title="Pause Match (ESC)"
          >
            <Pause className="w-3.5 h-3.5" />
            <span>Pause</span>
          </button>
        </div>
      </div>

      {/* CENTER BANNER (Kickoff / Camera / Goal) */}
      <div className="flex flex-col items-center justify-center pointer-events-none">
        {hud.phase === 'goal' && hud.lastGoal && (
          <div className="px-10 py-6 rounded-2xl bg-[#080d18]/94 border-2 border-amber-400 text-center shadow-2xl">
            <div className="font-display text-5xl sm:text-6xl font-extrabold tracking-wider text-amber-400 uppercase leading-none">
              GOAL!
            </div>
            <div className="mt-2 flex items-center justify-center gap-3">
              <TeamCrest team={hud.lastGoal.team} size={34} />
              <span className="font-display text-2xl sm:text-3xl font-bold uppercase text-white">
                {hud.lastGoal.team === 'madrid' ? 'Real Madrid' : 'FC Barcelona'}
              </span>
            </div>
            <div className="mt-1.5 text-sm font-semibold text-slate-300 tabular-nums">
              #{hud.lastGoal.scorerNumber} {hud.lastGoal.scorerName} · {hud.lastGoal.minute}&apos;
            </div>
          </div>
        )}

        {hud.phase === 'playing' && hud.bannerMessage && (
          <div className="px-6 py-2.5 rounded-xl bg-[#080d18]/90 border border-white/15 font-display text-xl font-bold tracking-wider uppercase text-white shadow-lg">
            {hud.bannerMessage}
          </div>
        )}
      </div>

      {/* BOTTOM ROW: Active Player Card (Left) + Collapsible Controls Dock (Center) */}
      <div className="flex items-end justify-between gap-4">
        {/* Active Controlled Player + Stamina + Shot Power */}
        <div className="w-60 rounded-xl bg-[#0a101d]/92 border border-white/15 p-3.5 space-y-2 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono-tabular text-xs font-bold px-1.5 py-0.5 rounded bg-amber-400 text-slate-950">
                #{hud.activePlayerNumber}
              </span>
              <span className="font-display text-xl font-bold uppercase tracking-wide text-white truncate">
                {hud.activePlayerName}
              </span>
            </div>
            <span className="text-[11px] font-bold text-slate-400">
              {hud.activePlayerRole}
            </span>
          </div>

          {/* Stamina Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <span>Stamina</span>
              <span className="tabular-nums">
                {Math.round(hud.activePlayerStamina * 100)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-75"
                style={{ width: `${Math.round(hud.activePlayerStamina * 100)}%` }}
              />
            </div>
          </div>

          {/* Shot Power Meter */}
          {hud.shotCharge > 0.01 && (
            <div className="space-y-1 pt-0.5">
              <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                <span>Shot Power</span>
                <span className="tabular-nums">
                  {Math.round(hud.shotCharge * 100)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-rose-500"
                  style={{ width: `${Math.round(hud.shotCharge * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Bottom Controls Dock */}
        <div className="pointer-events-auto hidden md:flex flex-col items-center">
          <button
            type="button"
            onClick={() => setControlsCollapsed((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-t-lg bg-[#0a101d]/90 border border-b-0 border-white/15 text-[11px] font-semibold text-slate-300 hover:text-white cursor-pointer"
          >
            {controlsCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Show Controls</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Hide Controls</span>
              </>
            )}
          </button>

          {!controlsCollapsed && (
            <div className="flex items-center gap-4 px-5 py-2.5 rounded-xl bg-[#0a101d]/92 border border-white/15 text-xs text-slate-300 shadow-xl">
              {[
                ['WASD', 'Move'],
                ['SHIFT', 'Sprint'],
                ['SPACE', 'Shoot / Jump'],
                ['E', 'Pass'],
                ['Q', 'Switch'],
                ['F', 'Tackle'],
                ['C', 'Camera'],
              ].map(([k, label]) => (
                <div key={k} className="flex items-center gap-1.5 whitespace-nowrap">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-white/15 font-mono-tabular text-[11px] font-bold text-amber-300">
                    {k}
                  </kbd>
                  <span className="text-slate-300">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hidden md:block w-32" />
      </div>

      {/* OVERLAY: PAUSE MENU */}
      {hud.phase === 'paused' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#060911]/85 p-6 pointer-events-auto">
          <div className="w-full max-w-md rounded-2xl bg-[#0d1424] border border-white/15 p-7 space-y-5 shadow-2xl">
            <h2 className="font-display text-4xl font-extrabold uppercase tracking-wide text-white text-center">
              Match Paused
            </h2>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onResume}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm uppercase tracking-wide cursor-pointer"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                Resume Match
              </button>

              <button
                type="button"
                onClick={onRestart}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Restart Match
              </button>

              <button
                type="button"
                onClick={onQuitToMenu}
                className="py-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-semibold text-sm cursor-pointer"
              >
                Quit to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY: HALF-TIME / FULL-TIME */}
      {(hud.phase === 'halftime' || hud.phase === 'fulltime') && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#060911]/88 p-6 pointer-events-auto">
          <div className="w-full max-w-xl rounded-2xl bg-[#0d1424] border border-white/15 p-7 space-y-6 shadow-2xl">
            <div className="text-center space-y-1">
              <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
                {hud.phase === 'halftime' ? '45 Minutes Played' : '90 Minutes · Final Whistle'}
              </div>
              <h2 className="font-display text-4xl font-extrabold uppercase tracking-wide text-white">
                {hud.phase === 'halftime' ? 'Half-Time' : 'Full-Time Result'}
              </h2>
            </div>

            {/* Score Banner */}
            <div className="flex items-center justify-between px-6 py-4 rounded-xl bg-[#080d18] border border-white/10">
              <div className="flex items-center gap-3">
                <TeamCrest team="madrid" size={44} />
                <span className="font-display text-2xl font-bold uppercase text-white">
                  Real Madrid
                </span>
              </div>

              <div className="font-display text-4xl font-extrabold tabular-nums text-white">
                {hud.scoreMadrid} <span className="text-slate-600">-</span> {hud.scoreBarca}
              </div>

              <div className="flex items-center gap-3">
                <span className="font-display text-2xl font-bold uppercase text-white">
                  FC Barcelona
                </span>
                <TeamCrest team="barca" size={44} />
              </div>
            </div>

            {/* Match Statistics */}
            <div className="space-y-2.5 text-sm">
              {[
                ['Possession', `${madridPossPct}%`, `${barcaPossPct}%`],
                ['Shots', String(hud.stats.madridShots), String(hud.stats.barcaShots)],
                [
                  'Shots on Target',
                  String(hud.stats.madridShotsOnTarget),
                  String(hud.stats.barcaShotsOnTarget),
                ],
                ['Passes Completed', String(hud.stats.madridPasses), String(hud.stats.barcaPasses)],
                ['Tackles Won', String(hud.stats.madridTackles), String(hud.stats.barcaTackles)],
              ].map(([label, leftVal, rightVal]) => (
                <div
                  key={label}
                  className="grid grid-cols-3 items-center py-1.5 border-b border-white/10 text-xs sm:text-sm"
                >
                  <span className="font-mono-tabular font-bold text-white text-left">
                    {leftVal}
                  </span>
                  <span className="text-slate-400 text-center font-medium">
                    {label}
                  </span>
                  <span className="font-mono-tabular font-bold text-white text-right">
                    {rightVal}
                  </span>
                </div>
              ))}
            </div>

            {/* Goalscorers Timeline */}
            {hud.stats.goals.length > 0 && (
              <div className="text-xs text-slate-300 space-y-1 bg-[#080d18] rounded-xl p-3 border border-white/10 max-h-28 overflow-y-auto">
                <div className="font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Goals
                </div>
                {hud.stats.goals.map((g, idx) => (
                  <div key={idx} className="flex justify-between tabular-nums">
                    <span>
                      {g.team === 'madrid' ? 'Real Madrid' : 'FC Barcelona'} · #{g.scorerNumber}{' '}
                      {g.scorerName}
                    </span>
                    <span className="text-amber-400 font-bold">{g.minute}&apos;</span>
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-1">
              {hud.phase === 'halftime' ? (
                <button
                  type="button"
                  onClick={onStartSecondHalf}
                  className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display text-xl font-extrabold uppercase tracking-wide cursor-pointer"
                >
                  Start Second Half
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onQuitToMenu}
                    className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-semibold text-white cursor-pointer"
                  >
                    Main Menu
                  </button>
                  <button
                    type="button"
                    onClick={onRestart}
                    className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-sm font-bold text-slate-950 cursor-pointer"
                  >
                    Play Rematch
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
