export interface FlightControls {
  up: boolean;          // Up arrow / W -> Climb (Pitch Up)
  down: boolean;        // Down arrow / S -> Dive (Pitch Down)
  left: boolean;        // Left arrow / A -> Turn & Bank Left
  right: boolean;       // Right arrow / D -> Turn & Bank Right
  throttleUp: boolean;  // Space / Shift -> Boost power
  throttleDown: boolean;// Ctrl / X -> Cut power
}

export interface FlightTelemetry {
  speed: number;        // knots
  altitude: number;     // feet
  pitch: number;        // degrees (-90 to 90)
  roll: number;         // degrees (-180 to 180)
  heading: number;      // degrees (0 to 360)
  throttle: number;     // 0 to 100%
  verticalSpeed: number;// ft/min
  gForce: number;       // G
  isLanded: boolean;
  isCrashed: boolean;
  ringsCollected: number;
  totalRings: number;
}

export interface RingWaypoint {
  id: number;
  x: number;
  y: number;
  z: number;
  radius: number;
  passed: boolean;
}

export type CameraViewMode = 'chase' | 'cockpit' | 'flyby' | 'wing';
