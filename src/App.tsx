import { useState, useEffect, useCallback, useRef } from 'react';
import { FlightCanvas } from './components/FlightCanvas';
import { FlightHUD } from './components/FlightHUD';
import { FlightControls, FlightTelemetry, CameraViewMode } from './types';
import { flightAudio } from './audio/flightAudio';
import { Plane } from 'lucide-react';

export default function App() {
  const [controls, setControls] = useState<FlightControls>({
    up: false,
    down: false,
    left: false,
    right: false,
    throttleUp: false,
    throttleDown: false,
  });

  const [telemetry, setTelemetry] = useState<FlightTelemetry>({
    speed: 45,
    altitude: 15,
    pitch: 0,
    roll: 0,
    heading: 0,
    throttle: 60,
    verticalSpeed: 0,
    gForce: 1.0,
    isLanded: true,
    isCrashed: false,
    ringsCollected: 0,
    totalRings: 12,
  });

  const [viewMode, setViewMode] = useState<CameraViewMode>('chase');
  const [invertPitch, setInvertPitch] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [resetTrigger, setResetTrigger] = useState<number>(0);
  const [startAirborne, setStartAirborne] = useState<boolean>(false);
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);

  // Audio start trigger on initial user gesture
  const startAudioOnGesture = useCallback(() => {
    if (!hasInteracted) {
      flightAudio.init();
      setHasInteracted(true);
    }
  }, [hasInteracted]);

  // Keep a ref for the latest viewMode for cycle key 'V'
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;

  const handleControlChange = useCallback((key: keyof FlightControls, active: boolean) => {
    startAudioOnGesture();
    setControls((prev) => (prev[key] === active ? prev : { ...prev, [key]: active }));
  }, [startAudioOnGesture]);

  const handleReset = useCallback((airborne: boolean = false) => {
    setStartAirborne(airborne);
    setResetTrigger((prev) => prev + 1);
  }, []);

  const toggleMute = useCallback(() => {
    startAudioOnGesture();
    const muted = flightAudio.toggleMute();
    setIsMuted(muted);
  }, [startAudioOnGesture]);

  const toggleInvertPitch = useCallback(() => {
    setInvertPitch((prev) => !prev);
  }, []);

  // Keyboard Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      startAudioOnGesture();

      // Prevent scrolling from arrow keys and spacebar
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        // UP ARROW / W: Climb (Pitch Up into the sky)
        case 'ArrowUp':
        case 'w':
        case 'W':
          setControls((prev) => ({ ...prev, up: true }));
          break;

        // DOWN ARROW / S: Dive (Pitch Down toward ground)
        case 'ArrowDown':
        case 's':
        case 'S':
          setControls((prev) => ({ ...prev, down: true }));
          break;

        // LEFT ARROW / A: Turn & Bank Left
        case 'ArrowLeft':
        case 'a':
        case 'A':
          setControls((prev) => ({ ...prev, left: true }));
          break;

        // RIGHT ARROW / D: Turn & Bank Right
        case 'ArrowRight':
        case 'd':
        case 'D':
          setControls((prev) => ({ ...prev, right: true }));
          break;

        // THROTTLE BOOST: Space or Shift
        case ' ':
        case 'Shift':
          setControls((prev) => ({ ...prev, throttleUp: true }));
          break;

        // THROTTLE CUT: Control, Alt or X
        case 'Control':
        case 'x':
        case 'X':
          setControls((prev) => ({ ...prev, throttleDown: true }));
          break;

        // RESET: R key
        case 'r':
        case 'R':
          handleReset(false);
          break;

        // MUTE AUDIO: M key
        case 'm':
        case 'M':
          toggleMute();
          break;

        // INVERT PITCH: I key
        case 'i':
        case 'I':
          toggleInvertPitch();
          break;

        // CYCLE CAMERA: V key
        case 'v':
        case 'V': {
          const modes: CameraViewMode[] = ['chase', 'cockpit', 'wing', 'flyby'];
          const nextIdx = (modes.indexOf(viewModeRef.current) + 1) % modes.length;
          setViewMode(modes[nextIdx]);
          break;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          setControls((prev) => ({ ...prev, up: false }));
          break;

        case 'ArrowDown':
        case 's':
        case 'S':
          setControls((prev) => ({ ...prev, down: false }));
          break;

        case 'ArrowLeft':
        case 'a':
        case 'A':
          setControls((prev) => ({ ...prev, left: false }));
          break;

        case 'ArrowRight':
        case 'd':
        case 'D':
          setControls((prev) => ({ ...prev, right: false }));
          break;

        case ' ':
        case 'Shift':
          setControls((prev) => ({ ...prev, throttleUp: false }));
          break;

        case 'Control':
        case 'x':
        case 'X':
          setControls((prev) => ({ ...prev, throttleDown: false }));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleReset, toggleMute, toggleInvertPitch, startAudioOnGesture]);

  return (
    <main 
      id="airplane-simulator-app"
      className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans"
      onClick={startAudioOnGesture}
    >
      {/* 3D WebGL Flight Simulation Canvas */}
      <FlightCanvas
        controls={controls}
        invertPitch={invertPitch}
        viewMode={viewMode}
        onTelemetryUpdate={setTelemetry}
        onReset={handleReset}
        resetTrigger={resetTrigger}
        startAirborne={startAirborne}
      />

      {/* Flight HUD and Instrumentation Overlay */}
      <FlightHUD
        telemetry={telemetry}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        invertPitch={invertPitch}
        onToggleInvertPitch={toggleInvertPitch}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        onReset={handleReset}
        controls={controls}
        onControlChange={handleControlChange}
      />

      {/* Initial quick start prompt card if user has not interacted yet */}
      {!hasInteracted && (
        <div 
          id="onboarding-guide-overlay"
          className="absolute inset-0 pointer-events-none flex items-center justify-center bg-slate-950/40 backdrop-blur-[2px] transition-opacity duration-300"
        >
          <div className="bg-slate-900/90 border border-slate-700/80 p-6 rounded-2xl shadow-2xl max-w-sm text-center text-white pointer-events-auto flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
              <Plane className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-sans">Airplane Simulator</h2>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Use your <strong className="text-sky-300">Up, Down, Left, Right</strong> arrow keys or the on-screen controls to fly.
              </p>
            </div>

            <div className="w-full bg-slate-800/80 rounded-xl p-3 text-xs text-left flex flex-col gap-2 font-mono">
              <div className="flex justify-between items-center text-slate-200">
                <span className="font-semibold text-sky-400">▲ Up Key / W</span>
                <span>Climb (Pitch Up)</span>
              </div>
              <div className="flex justify-between items-center text-slate-200">
                <span className="font-semibold text-sky-400">▼ Down Key / S</span>
                <span>Dive (Pitch Down)</span>
              </div>
              <div className="flex justify-between items-center text-slate-200">
                <span className="font-semibold text-sky-400">◀ Left Key / A</span>
                <span>Turn Left</span>
              </div>
              <div className="flex justify-between items-center text-slate-200">
                <span className="font-semibold text-sky-400">▶ Right Key / D</span>
                <span>Turn Right</span>
              </div>
              <div className="flex justify-between items-center text-slate-300 border-t border-slate-700/60 pt-1.5 mt-0.5">
                <span className="font-semibold text-slate-400">Spacebar</span>
                <span>Boost Throttle</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="font-semibold text-slate-400">V Key</span>
                <span>Change Camera</span>
              </div>
            </div>

            <button
              id="start-flight-btn"
              onClick={startAudioOnGesture}
              className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
            >
              Start Flight (Press Any Key)
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
