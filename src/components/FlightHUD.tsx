import React from 'react';
import { FlightTelemetry, CameraViewMode, FlightControls } from '../types';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface FlightHUDProps {
  telemetry: FlightTelemetry;
  viewMode: CameraViewMode;
  onViewModeChange: (mode: CameraViewMode) => void;
  invertPitch: boolean;
  onToggleInvertPitch: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onReset: (airborne?: boolean) => void;
  controls?: FlightControls;
  onControlChange?: (key: keyof FlightControls, active: boolean) => void;
}

export const FlightHUD: React.FC<FlightHUDProps> = ({
  telemetry,
  onReset,
}) => {
  return (
    <div id="flight-hud-root" className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 select-none font-mono">
      
      {/* Top spacer (clean view) */}
      <div className="w-full h-2 pointer-events-none" />

      {/* CENTER / BOTTOM NOTIFICATIONS ONLY (Crash Overlay) */}
      <div className="relative flex items-center justify-center w-full pointer-events-none">
        {/* Crash / Landing Overlay Notification */}
        {telemetry.isCrashed && (
          <div className="pointer-events-auto bg-rose-950/90 backdrop-blur-md border border-rose-500 rounded-2xl p-5 shadow-2xl flex flex-col items-center text-center gap-3 animate-in fade-in zoom-in duration-200">
            <AlertTriangle className="w-10 h-10 text-rose-400" />
            <div>
              <h3 className="text-xl font-bold text-white font-sans">Aircraft Impact Detected</h3>
              <p className="text-xs text-rose-200 mt-1">Press R or choose an option below to fly again</p>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                id="hud-crash-reset-runway"
                onClick={() => onReset(false)}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-md"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Runway</span>
              </button>
              <button
                id="hud-crash-reset-air"
                onClick={() => onReset(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-bold rounded-xl border border-slate-700 transition-colors cursor-pointer shadow-md"
              >
                Airborne
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Clean bottom spacer */}
      <div className="h-2 w-full pointer-events-none" />

    </div>
  );
};
