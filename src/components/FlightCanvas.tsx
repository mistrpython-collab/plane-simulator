import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { FlightControls, FlightTelemetry, CameraViewMode, RingWaypoint } from '../types';
import { flightAudio } from '../audio/flightAudio';

interface FlightCanvasProps {
  controls: FlightControls;
  invertPitch: boolean;
  viewMode: CameraViewMode;
  onTelemetryUpdate: (telemetry: FlightTelemetry) => void;
  onReset: (airborne?: boolean) => void;
  resetTrigger: number;
  startAirborne?: boolean;
}

export const FlightCanvas: React.FC<FlightCanvasProps> = ({
  controls,
  invertPitch,
  viewMode,
  onTelemetryUpdate,
  resetTrigger,
  startAirborne = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef(controls);
  controlsRef.current = controls;

  const invertPitchRef = useRef(invertPitch);
  invertPitchRef.current = invertPitch;

  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- SCENE SETUP ---
    const scene = new THREE.Scene();
    const skyColor = 0x60a5fa; // Day sky blue
    const fogColor = 0xbfdbfe;
    scene.background = new THREE.Color(skyColor);
    scene.fog = new THREE.FogExp2(fogColor, 0.00035);

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.5,
      12000
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // --- LIGHTING ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.4);
    sunLight.position.set(500, 1200, 400);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 4000;
    const shadowDist = 600;
    sunLight.shadow.camera.left = -shadowDist;
    sunLight.shadow.camera.right = shadowDist;
    sunLight.shadow.camera.top = shadowDist;
    sunLight.shadow.camera.bottom = -shadowDist;
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x166534, 0.5);
    scene.add(hemiLight);

    // --- TERRAIN & ENVIRONMENT ---
    // Ocean
    const oceanGeo = new THREE.PlaneGeometry(24000, 24000, 64, 64);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.2,
      metalness: 0.6,
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = 0;
    ocean.receiveShadow = true;
    scene.add(ocean);

    // Main Island
    const islandGeo = new THREE.ConeGeometry(1800, 180, 48);
    const islandMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      roughness: 0.9,
      flatShading: true,
    });
    const island = new THREE.Mesh(islandGeo, islandMat);
    island.position.set(0, 0, 0);
    island.scale.set(1.4, 0.2, 2.5);
    island.receiveShadow = true;
    scene.add(island);

    // Mountains surrounding the area for scenic navigation
    const mountainColors = [0x15803d, 0x166534, 0x475569, 0x334155];
    const mountainPeaks: { x: number; z: number; r: number; h: number }[] = [];
    const mountainGroup = new THREE.Group();

    const mountainPositions = [
      { x: 1200, z: -1500, r: 600, h: 420 },
      { x: -1400, z: -2000, r: 750, h: 580 },
      { x: 1800, z: 800, r: 500, h: 360 },
      { x: -1900, z: 1200, r: 700, h: 490 },
      { x: 2800, z: -800, r: 900, h: 680 },
      { x: -2800, z: -600, r: 850, h: 640 },
    ];

    mountainPositions.forEach((m, idx) => {
      mountainPeaks.push(m);
      const mGeo = new THREE.ConeGeometry(m.r, m.h, 12);
      const mMat = new THREE.MeshStandardMaterial({
        color: mountainColors[idx % mountainColors.length],
        roughness: 0.95,
        flatShading: true,
      });
      const peak = new THREE.Mesh(mGeo, mMat);
      peak.position.set(m.x, m.h / 2 - 10, m.z);
      peak.castShadow = true;
      peak.receiveShadow = true;
      mountainGroup.add(peak);

      // Snow cap for tall mountains
      if (m.h > 450) {
        const snowGeo = new THREE.ConeGeometry(m.r * 0.32, m.h * 0.32, 12);
        const snowMat = new THREE.MeshStandardMaterial({
          color: 0xf8fafc,
          roughness: 0.5,
          flatShading: true,
        });
        const snow = new THREE.Mesh(snowGeo, snowMat);
        snow.position.set(m.x, m.h - (m.h * 0.32) / 2 - 10, m.z);
        mountainGroup.add(snow);
      }
    });
    scene.add(mountainGroup);

    // Runway
    const runwayGroup = new THREE.Group();
    const runwayWidth = 70;
    const runwayLength = 1400;
    const runwayGeo = new THREE.PlaneGeometry(runwayWidth, runwayLength);
    const runwayMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.85,
    });
    const runway = new THREE.Mesh(runwayGeo, runwayMat);
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(0, 1.2, 0);
    runway.receiveShadow = true;
    runwayGroup.add(runway);

    // Runway Centerline dashes
    const dashCount = 28;
    const dashGeo = new THREE.PlaneGeometry(3, 24);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < dashCount; i++) {
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.rotation.x = -Math.PI / 2;
      const zPos = -runwayLength / 2 + (i + 0.5) * (runwayLength / dashCount);
      dash.position.set(0, 1.3, zPos);
      runwayGroup.add(dash);
    }

    // Runway Threshold Markings (Green and Red approach lights)
    const lightGeo = new THREE.CylinderGeometry(0.8, 0.8, 2, 8);
    const greenLightMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const redLightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const whiteLightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i <= 20; i++) {
        const lZ = -runwayLength / 2 + (i / 20) * runwayLength;
        const lMesh = new THREE.Mesh(lightGeo, whiteLightMat);
        lMesh.position.set(side * (runwayWidth / 2 + 2), 2, lZ);
        runwayGroup.add(lMesh);
      }
      // Threshold start
      const tStart = new THREE.Mesh(lightGeo, greenLightMat);
      tStart.position.set(side * (runwayWidth / 2 - 4), 2, runwayLength / 2);
      runwayGroup.add(tStart);

      // Threshold end
      const tEnd = new THREE.Mesh(lightGeo, redLightMat);
      tEnd.position.set(side * (runwayWidth / 2 - 4), 2, -runwayLength / 2);
      runwayGroup.add(tEnd);
    }

    // Air Traffic Control Tower & Hangar
    const towerBaseGeo = new THREE.CylinderGeometry(8, 11, 60, 12);
    const towerBaseMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7 });
    const towerBase = new THREE.Mesh(towerBaseGeo, towerBaseMat);
    towerBase.position.set(runwayWidth / 2 + 50, 30, 100);
    towerBase.castShadow = true;
    runwayGroup.add(towerBase);

    const towerCabGeo = new THREE.CylinderGeometry(14, 11, 14, 12);
    const towerCabMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });
    const towerCab = new THREE.Mesh(towerCabGeo, towerCabMat);
    towerCab.position.set(runwayWidth / 2 + 50, 65, 100);
    runwayGroup.add(towerCab);

    // Hangar
    const hangarGeo = new THREE.BoxGeometry(60, 25, 80);
    const hangarMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6 });
    const hangar = new THREE.Mesh(hangarGeo, hangarMat);
    hangar.position.set(runwayWidth / 2 + 70, 12.5, -100);
    hangar.castShadow = true;
    runwayGroup.add(hangar);

    scene.add(runwayGroup);

    // --- CLOUDS ---
    const cloudsGroup = new THREE.Group();
    const cloudGeo = new THREE.DodecahedronGeometry(25, 1);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      flatShading: true,
      transparent: true,
      opacity: 0.88,
    });

    for (let c = 0; c < 36; c++) {
      const cloudCluster = new THREE.Group();
      const numPuffs = 4 + Math.floor(Math.random() * 4);
      for (let p = 0; p < numPuffs; p++) {
        const puff = new THREE.Mesh(cloudGeo, cloudMat);
        puff.position.set(
          (Math.random() - 0.5) * 60,
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 60
        );
        const s = 0.8 + Math.random() * 0.9;
        puff.scale.set(s, s * 0.6, s);
        cloudCluster.add(puff);
      }
      const angle = (c / 36) * Math.PI * 2;
      const dist = 800 + Math.random() * 2600;
      cloudCluster.position.set(
        Math.cos(angle) * dist,
        280 + Math.random() * 320,
        Math.sin(angle) * dist
      );
      cloudsGroup.add(cloudCluster);
    }
    scene.add(cloudsGroup);

    // --- AERO RINGS WAYPOINTS ---
    const ringWaypoints: RingWaypoint[] = [
      { id: 1, x: 0, y: 80, z: -700, radius: 24, passed: false },
      { id: 2, x: 120, y: 140, z: -1200, radius: 26, passed: false },
      { id: 3, x: 450, y: 220, z: -1600, radius: 26, passed: false },
      { id: 4, x: 900, y: 300, z: -1400, radius: 28, passed: false },
      { id: 5, x: 1200, y: 350, z: -700, radius: 28, passed: false },
      { id: 6, x: 1100, y: 320, z: 200, radius: 28, passed: false },
      { id: 7, x: 600, y: 260, z: 900, radius: 26, passed: false },
      { id: 8, x: -100, y: 220, z: 1200, radius: 26, passed: false },
      { id: 9, x: -800, y: 260, z: 900, radius: 26, passed: false },
      { id: 10, x: -1100, y: 240, z: 0, radius: 26, passed: false },
      { id: 11, x: -800, y: 160, z: -800, radius: 24, passed: false },
      { id: 12, x: -300, y: 100, z: -500, radius: 24, passed: false },
    ];

    const ringMeshes: { mesh: THREE.Mesh; ringData: RingWaypoint }[] = [];
    const ringGroup = new THREE.Group();

    ringWaypoints.forEach((rw) => {
      const rGeo = new THREE.TorusGeometry(rw.radius, 1.8, 12, 32);
      const rMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b, // Warm gold
        emissive: 0xd97706,
        emissiveIntensity: 0.7,
        roughness: 0.3,
        metalness: 0.8,
      });
      const rMesh = new THREE.Mesh(rGeo, rMat);
      rMesh.position.set(rw.x, rw.y, rw.z);
      rMesh.castShadow = true;
      ringGroup.add(rMesh);
      ringMeshes.push({ mesh: rMesh, ringData: rw });
    });
    scene.add(ringGroup);

    // --- AIRPLANE 3D MODEL ---
    const airplane = new THREE.Group();

    // Fuselage
    const fuselageGeo = new THREE.CylinderGeometry(2.2, 1.6, 26, 16);
    fuselageGeo.rotateX(Math.PI / 2);
    const planeWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.35,
      metalness: 0.2,
    });
    const fuselage = new THREE.Mesh(fuselageGeo, planeWhiteMat);
    fuselage.castShadow = true;
    airplane.add(fuselage);

    // Nose Cone
    const noseGeo = new THREE.ConeGeometry(2.2, 5, 16);
    noseGeo.rotateX(-Math.PI / 2);
    const planeRedMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.4,
    });
    const nose = new THREE.Mesh(noseGeo, planeRedMat);
    nose.position.set(0, 0, -15.5);
    nose.castShadow = true;
    airplane.add(nose);

    // Cockpit Glass
    const cockpitGeo = new THREE.SphereGeometry(2.3, 16, 16);
    const cockpitMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.85,
    });
    const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
    cockpit.position.set(0, 1.3, -4);
    cockpit.scale.set(0.7, 0.6, 2.0);
    airplane.add(cockpit);

    // Wings
    const wingGeo = new THREE.BoxGeometry(38, 0.4, 4.5);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.4,
    });
    const wings = new THREE.Mesh(wingGeo, wingMat);
    wings.position.set(0, 0.2, -1.5);
    wings.castShadow = true;
    airplane.add(wings);

    // Wingtips (Aviation red/blue accents)
    const wingtipLeftGeo = new THREE.BoxGeometry(0.8, 1.8, 4.5);
    const wingtipLeft = new THREE.Mesh(wingtipLeftGeo, planeRedMat);
    wingtipLeft.position.set(-19, 0.8, -1.5);
    airplane.add(wingtipLeft);

    const wingtipRight = new THREE.Mesh(wingtipLeftGeo, planeRedMat);
    wingtipRight.position.set(19, 0.8, -1.5);
    airplane.add(wingtipRight);

    // Horizontal Stabilizer & Elevators
    const hStabGeo = new THREE.BoxGeometry(11, 0.3, 3);
    const hStab = new THREE.Mesh(hStabGeo, wingMat);
    hStab.position.set(0, 0.4, 11);
    hStab.castShadow = true;
    airplane.add(hStab);

    // Elevators (tilts visibly with pitch controls)
    const elevatorGeo = new THREE.BoxGeometry(10.8, 0.25, 1.4);
    const elevator = new THREE.Mesh(elevatorGeo, planeRedMat);
    elevator.position.set(0, 0.4, 12.8);
    airplane.add(elevator);

    // Vertical Stabilizer (Fin & Rudder)
    const vStabGeo = new THREE.BoxGeometry(0.4, 6, 4.5);
    const vStab = new THREE.Mesh(vStabGeo, planeRedMat);
    vStab.position.set(0, 3.4, 10.5);
    vStab.castShadow = true;
    airplane.add(vStab);

    // Rudder (tilts with yaw)
    const rudderGeo = new THREE.BoxGeometry(0.35, 5.5, 1.8);
    const rudder = new THREE.Mesh(rudderGeo, planeWhiteMat);
    rudder.position.set(0, 3.4, 13);
    airplane.add(rudder);

    // Propeller Hub & Blades
    const propHubGeo = new THREE.SphereGeometry(0.9, 12, 12);
    const propHubMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
    const propHub = new THREE.Mesh(propHubGeo, propHubMat);
    propHub.position.set(0, 0, -18.2);

    const propBladeGeo = new THREE.BoxGeometry(0.2, 6.2, 0.7);
    const propBladeMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
    const propBlade1 = new THREE.Mesh(propBladeGeo, propBladeMat);
    const propBlade2 = propBlade1.clone();
    propBlade2.rotation.z = Math.PI / 2;
    propHub.add(propBlade1);
    propHub.add(propBlade2);
    airplane.add(propHub);

    // Landing Gear
    const gearMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
    const strutMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });

    // Nose gear
    const nStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.5), strutMat);
    nStrut.position.set(0, -2, -10);
    const nWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.5, 12), gearMat);
    nWheel.rotation.z = Math.PI / 2;
    nWheel.position.set(0, -3.2, -10);
    airplane.add(nStrut);
    airplane.add(nWheel);

    // Main gear Left & Right
    const lStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.8), strutMat);
    lStrut.position.set(-3.5, -2, 0);
    const lWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.6, 12), gearMat);
    lWheel.rotation.z = Math.PI / 2;
    lWheel.position.set(-3.5, -3.4, 0);
    airplane.add(lStrut);
    airplane.add(lWheel);

    const rStrut = lStrut.clone();
    rStrut.position.set(3.5, -2, 0);
    const rWheel = lWheel.clone();
    rWheel.position.set(3.5, -3.4, 0);
    airplane.add(rStrut);
    airplane.add(rWheel);

    // Wingtip Trail Ribbons (Condensation trails when turning hard)
    const trailMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.65,
    });
    const trailLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.3, 14, 6), trailMat);
    trailLeft.rotation.x = Math.PI / 2;
    trailLeft.position.set(-19, 0.8, 6);
    trailLeft.visible = false;
    airplane.add(trailLeft);

    const trailRight = trailLeft.clone();
    trailRight.position.set(19, 0.8, 6);
    airplane.add(trailRight);

    scene.add(airplane);

    // Initial Aircraft State
    // Placed facing down the runway ready for takeoff or airborne
    const resetAircraft = (isAirborneMode: boolean = false) => {
      if (isAirborneMode) {
        airplane.position.set(0, 160, -350);
        airplane.rotation.set(0, 0, 0); // facing north towards the rings (-Z)
        physics.speed = 80;
        physics.throttle = 75;
      } else {
        // Starting on runway threshold facing north down the runway towards the rings (-Z)!
        airplane.position.set(0, 4.6, 500);
        airplane.rotation.set(0, 0, 0);
        physics.speed = 45; // Ready rolling speed so Up key immediately takes off!
        physics.throttle = 60;
      }
      physics.pitch = 0;
      physics.roll = 0;
      physics.yaw = 0; // 0 radians = Facing -Z (North down the runway towards Ring 1!)
      physics.pitchVel = 0;
      physics.rollVel = 0;
      physics.yawVel = 0;
      physics.verticalSpeed = 0;
      physics.isLanded = !isAirborneMode;
      physics.isCrashed = false;
      physics.ringsCollected = 0;
      ringMeshes.forEach((r) => {
        r.ringData.passed = false;
        (r.mesh.material as THREE.MeshStandardMaterial).color.setHex(0xf59e0b);
        (r.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0xd97706);
      });
    };

    const physics = {
      speed: startAirborne ? 80 : 45,
      throttle: startAirborne ? 75 : 60,
      pitch: 0,
      roll: 0,
      yaw: 0,
      pitchVel: 0,
      rollVel: 0,
      yawVel: 0,
      verticalSpeed: 0,
      gForce: 1.0,
      isLanded: !startAirborne,
      isCrashed: false,
      ringsCollected: 0,
    };

    resetAircraft(startAirborne);

    // Camera targets
    const cameraIdealOffset = new THREE.Vector3();
    const cameraIdealLookat = new THREE.Vector3();

    // --- ANIMATION & PHYSICS LOOP ---
    let lastTime = performance.now();
    let animId: number;

    const animate = (currentTime: number) => {
      animId = requestAnimationFrame(animate);

      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      const ctrl = controlsRef.current;
      const inv = invertPitchRef.current;

      // Propeller spin
      const propSpeed = (physics.throttle / 100) * 45 + (physics.speed / 100) * 20;
      propHub.rotation.z += propSpeed * dt;

      if (!physics.isCrashed) {
        // --- THROTTLE HANDLING ---
        if (ctrl.throttleUp) {
          physics.throttle = Math.min(100, physics.throttle + 30 * dt);
        } else if (ctrl.throttleDown) {
          physics.throttle = Math.max(0, physics.throttle - 30 * dt);
        }

        // Target speed calculation
        // Top speed ~140 kts, cruise ~75 kts, stall speed ~25 kts
        const maxSpeed = 145;
        const targetSpeed = (physics.throttle / 100) * maxSpeed;

        // Acceleration and drag
        const accelRate = targetSpeed > physics.speed ? 22 : 28;
        physics.speed = THREE.MathUtils.lerp(physics.speed, targetSpeed, accelRate * dt * 0.1);

        // --- PITCH CONTROLS (UP / DOWN) ---
        // Intuitive mode (default):
        // Up Arrow / W -> Climb (Pitch Up, nose moves up towards the sky)
        // Down Arrow / S -> Dive (Pitch Down, nose moves down towards the ground)
        // If invertPitch is true (Aviation stick mode):
        // Up Arrow -> Dive, Down Arrow -> Climb
        let pitchInput = 0;
        if (ctrl.up) pitchInput += 1;
        if (ctrl.down) pitchInput -= 1;
        if (inv) pitchInput = -pitchInput;

        // --- STEERING & BANKING (LEFT / RIGHT) ---
        // Left Arrow / A -> Steer and bank LEFT
        // Right Arrow / D -> Steer and bank RIGHT
        let steerInput = 0;
        if (ctrl.left) steerInput += 1;   // +1 = Turn Left
        if (ctrl.right) steerInput -= 1;  // -1 = Turn Right

        // Control surface visuals
        elevator.rotation.x = -pitchInput * 0.42; // Elevator deflects up when climbing
        rudder.rotation.y = steerInput * 0.42;     // Rudder swings into the turn

        // Control authority: responsive control even at lower runway speeds
        const controlAuthority = Math.min(1.0, Math.max(0.45, physics.speed / 45));

        // Pitch dynamics
        const pitchRate = 1.35 * controlAuthority;
        physics.pitchVel = THREE.MathUtils.lerp(physics.pitchVel, pitchInput * pitchRate, 8 * dt);
        physics.pitch += physics.pitchVel * dt;

        // Aerodynamic auto-leveling pitch when hands off up/down
        if (pitchInput === 0) {
          physics.pitch = THREE.MathUtils.lerp(physics.pitch, 0, 0.9 * dt);
        }
        // Limit pitch to prevent inverted upside down disorientation (-70° to +70°)
        physics.pitch = Math.max(-Math.PI * 0.40, Math.min(Math.PI * 0.40, physics.pitch));

        // Steering (Yaw) dynamics:
        // When turning LEFT (steerInput = +1), yaw increases, turning towards -X (West/Left)
        // When turning RIGHT (steerInput = -1), yaw decreases, turning towards +X (East/Right)
        const yawRate = 1.65 * controlAuthority;
        physics.yawVel = THREE.MathUtils.lerp(physics.yawVel, steerInput * yawRate, 8 * dt);
        physics.yaw += physics.yawVel * dt;

        // Banking (Roll) dynamics:
        // Bank left when turning left (roll > 0), bank right when turning right (roll < 0)
        // Auto-returns smoothly to horizontal wings when keys released
        const targetRoll = steerInput * 0.58; // ~33 degrees bank
        physics.roll = THREE.MathUtils.lerp(physics.roll, targetRoll, 7 * dt);
        physics.rollVel = (targetRoll - physics.roll);

        // Aerodynamic lift & takeoff
        const minTakeoffSpeed = 28;
        const isAirborne = airplane.position.y > 4.7 || (physics.speed > minTakeoffSpeed && physics.pitch > 0.03);

        if (isAirborne) {
          physics.isLanded = false;
        }

        // Forward vector in world space
        const euler = new THREE.Euler(physics.pitch, physics.yaw, physics.roll, 'YXZ');
        airplane.quaternion.setFromEuler(euler);

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(airplane.quaternion);

        // Calculate climb and lift component
        const climbComponent = forward.y * physics.speed;
        let liftDeficit = 0;
        if (physics.speed < minTakeoffSpeed && isAirborne) {
          liftDeficit = (minTakeoffSpeed - physics.speed) * 0.6;
        }

        const moveSpeed = physics.speed * 0.75; // Scale to world units
        airplane.position.addScaledVector(forward, moveSpeed * dt);
        airplane.position.y -= liftDeficit * dt;

        // Keep wheels above ground plane
        if (airplane.position.y < 4.6) {
          airplane.position.y = 4.6;
        }

        physics.verticalSpeed = (climbComponent - liftDeficit) * 60; // ft/min

        // G-force calculation
        const baseG = 1.0;
        const turnG = Math.abs(steerInput) * 0.6 + (1.0 / Math.max(0.3, Math.cos(physics.roll)) - 1.0) * 0.4;
        const pitchG = physics.pitchVel * 1.0;
        physics.gForce = THREE.MathUtils.lerp(physics.gForce, baseG + turnG + pitchG, 5 * dt);

        // Wingtip trails when turning or pulling Gs
        const showTrails = Math.abs(physics.roll) > 0.45 || Math.abs(physics.pitchVel) > 0.7;
        trailLeft.visible = showTrails;
        trailRight.visible = showTrails;

        // --- GROUND & WATER COLLISION / LANDING ---
        const groundThreshold = 4.65;
        if (airplane.position.y <= groundThreshold) {
          airplane.position.y = 4.6;

          // Check if on runway
          const onRunwayX = Math.abs(airplane.position.x) < runwayWidth / 2 + 6;
          const onRunwayZ = Math.abs(airplane.position.z) < runwayLength / 2 + 60;

          if (onRunwayX && onRunwayZ) {
            // Landing / Rolling on runway tarmac
            const isGentleTouchdown = Math.abs(physics.verticalSpeed) < 550 && Math.abs(physics.roll) < 0.45;
            if (isGentleTouchdown) {
              if (!physics.isLanded && physics.speed > 5) {
                flightAudio.playLandingThud();
                physics.isLanded = true;
              }
              // Level out wings on wheels
              if (!ctrl.up) {
                physics.pitch = THREE.MathUtils.lerp(physics.pitch, 0, 8 * dt);
              }
              physics.roll = THREE.MathUtils.lerp(physics.roll, 0, 10 * dt);
            } else {
              physics.isCrashed = true;
            }
          } else {
            // Off-runway landing
            if (physics.speed > 35) {
              physics.isCrashed = true;
            } else {
              physics.isLanded = true;
            }
          }
        }

        // Check mountain collisions
        for (const m of mountainPeaks) {
          const dx = airplane.position.x - m.x;
          const dz = airplane.position.z - m.z;
          const distToCenter = Math.sqrt(dx * dx + dz * dz);
          if (distToCenter < m.r) {
            const mountainHeightAtPos = m.h * (1 - distToCenter / m.r);
            if (airplane.position.y < mountainHeightAtPos) {
              physics.isCrashed = true;
              break;
            }
          }
        }

        // --- RINGS WAYPOINTS CHECK ---
        ringMeshes.forEach((rm) => {
          if (!rm.ringData.passed) {
            const dist = airplane.position.distanceTo(rm.mesh.position);
            if (dist < rm.ringData.radius + 6) {
              rm.ringData.passed = true;
              physics.ringsCollected += 1;
              (rm.mesh.material as THREE.MeshStandardMaterial).color.setHex(0x22c55e); // Green
              (rm.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x16a34a);
              flightAudio.playRingChime();
            }
          }
          // Subtle ring oscillation/rotation
          rm.mesh.rotation.y += 0.4 * dt;
        });

        // Update audio engine synthesizer
        const normSpeed = Math.min(1.0, physics.speed / 140);
        const normThrottle = physics.throttle / 100;
        flightAudio.updateEngine(normSpeed, normThrottle);
      }

      // --- CAMERA PLACEMENT ---
      const mode = viewModeRef.current;
      if (mode === 'cockpit') {
        // Cockpit camera inside canopy looking straight forward through windshield
        const cockpitOffset = new THREE.Vector3(0, 1.4, -3.2).applyQuaternion(airplane.quaternion);
        camera.position.copy(airplane.position).add(cockpitOffset);

        const lookTarget = new THREE.Vector3(0, 1.2, -100).applyQuaternion(airplane.quaternion);
        camera.lookAt(airplane.position.clone().add(lookTarget));
      } else if (mode === 'wing') {
        // Wing cam looking toward cockpit
        const wingOffset = new THREE.Vector3(-18, 2, 2).applyQuaternion(airplane.quaternion);
        camera.position.copy(airplane.position).add(wingOffset);
        camera.lookAt(airplane.position);
      } else if (mode === 'flyby') {
        // Fixed side perspective
        const flybyOffset = new THREE.Vector3(35, 8, 30).applyQuaternion(airplane.quaternion);
        camera.position.copy(airplane.position).add(flybyOffset);
        camera.lookAt(airplane.position);
      } else {
        // 'chase' Third-person chase camera
        cameraIdealOffset.set(0, 9, 32).applyQuaternion(airplane.quaternion);
        const targetCamPos = airplane.position.clone().add(cameraIdealOffset);

        // Smooth camera follow
        camera.position.lerp(targetCamPos, Math.min(1.0, 10 * dt));

        cameraIdealLookat.set(0, 2.5, -20).applyQuaternion(airplane.quaternion);
        const targetLookat = airplane.position.clone().add(cameraIdealLookat);
        camera.lookAt(targetLookat);
      }

      // Keep directional sun following near the aircraft for shadow fidelity
      sunLight.position.set(
        airplane.position.x + 400,
        airplane.position.y + 800,
        airplane.position.z + 300
      );
      sunLight.target = airplane;

      // Update telemetry state to React HUD
      const headingDeg = (THREE.MathUtils.radToDeg(-physics.yaw) + 360) % 360;
      const pitchDeg = THREE.MathUtils.radToDeg(physics.pitch);
      const rollDeg = THREE.MathUtils.radToDeg(physics.roll);

      onTelemetryUpdate({
        speed: Math.round(physics.speed),
        altitude: Math.round(airplane.position.y * 3.28), // convert to feet
        pitch: Math.round(pitchDeg),
        roll: Math.round(rollDeg),
        heading: Math.round(headingDeg),
        throttle: Math.round(physics.throttle),
        verticalSpeed: Math.round(physics.verticalSpeed),
        gForce: Math.round(physics.gForce * 10) / 10,
        isLanded: physics.isLanded,
        isCrashed: physics.isCrashed,
        ringsCollected: physics.ringsCollected,
        totalRings: ringWaypoints.length,
      });

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [resetTrigger]);

  return (
    <div
      id="flight-canvas-container"
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
    />
  );
};
