// NASA HUNCH 2026–2027 // LLASO Project 2
// Ageis-V1 External Cargo Transport System (ECTS)
// Engineering CAD Viewer & Mission Simulation Engine

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // --- 1. THREE.JS CAD INSPECTION VIEWER ---
  const canvas = document.getElementById('rover-canvas');
  if (canvas && window.THREE) {
    initCADViewer(canvas);
  }

  function initCADViewer(canvasEl) {
    const container = canvasEl.parentElement;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d101a);
    scene.fog = new THREE.FogExp2(0x0d101a, 0.025);

    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(10, 6.5, 11);

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasEl,
      antialias: true,
      alpha: false
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Controls
    const controls = new THREE.OrbitControls(camera, canvasEl);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 + 0.02;
    controls.minDistance = 4;
    controls.maxDistance = 28;
    controls.target.set(0, 1.2, 0);

    // Balanced Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(12, 20, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.5);
    fillLight.position.set(-12, 10, -10);
    scene.add(fillLight);

    // Studio Inspection Floor Plate
    const floorGeo = new THREE.CylinderGeometry(14, 14, 0.2, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x141824,
      roughness: 0.85,
      metalness: 0.15
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    scene.add(floor);

    // Subtle CAD Alignment Grid
    const grid = new THREE.GridHelper(26, 26, 0x334155, 0x1e293b);
    grid.position.y = 0.01;
    scene.add(grid);

    // Assembly Root & Groups
    const assembly = new THREE.Group();
    scene.add(assembly);

    const chassisGroup = new THREE.Group();
    const suspensionGroup = new THREE.Group();
    const cargoGroup = new THREE.Group();
    const mastGroup = new THREE.Group();
    assembly.add(chassisGroup);
    assembly.add(suspensionGroup);
    assembly.add(cargoGroup);
    assembly.add(mastGroup);

    // Realistic Engineering Materials
    const materials = {
      carbonChassis: new THREE.MeshStandardMaterial({
        color: 0x1e2638,
        roughness: 0.35,
        metalness: 0.6
      }),
      titaniumBumper: new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.25,
        metalness: 0.85
      }),
      treadWheel: new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.45,
        metalness: 0.8
      }),
      wheelHub: new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.3,
        metalness: 0.7
      }),
      cargoEnclosure: new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.3,
        metalness: 0.3
      }),
      accentBlue: new THREE.MeshStandardMaterial({
        color: 0x0b3d91,
        roughness: 0.4,
        metalness: 0.5
      }),
      sensorOptics: new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.1,
        metalness: 0.9
      }),
      amberStatus: new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.3,
        metalness: 0.2
      })
    };

    const inspectableMeshes = [];

    // --- 1. CHASSIS (Monocoque composite frame) ---
    const mainChassisGeo = new THREE.BoxGeometry(4.5, 0.65, 2.6);
    const mainChassis = new THREE.Mesh(mainChassisGeo, materials.carbonChassis);
    mainChassis.position.y = 1.3;
    mainChassis.castShadow = true;
    mainChassis.receiveShadow = true;
    chassisGroup.add(mainChassis);
    inspectableMeshes.push(mainChassis);

    // Front/Rear Titanium Push Bumpers
    const bumperGeo = new THREE.BoxGeometry(0.4, 0.5, 2.7);
    const frontBumper = new THREE.Mesh(bumperGeo, materials.titaniumBumper);
    frontBumper.position.set(2.35, 1.3, 0);
    frontBumper.castShadow = true;
    const rearBumper = new THREE.Mesh(bumperGeo, materials.titaniumBumper);
    rearBumper.position.set(-2.35, 1.3, 0);
    rearBumper.castShadow = true;
    chassisGroup.add(frontBumper, rearBumper);
    inspectableMeshes.push(frontBumper, rearBumper);

    // Underbody Regolith Deflector Skid Plate
    const skidGeo = new THREE.BoxGeometry(4.3, 0.1, 2.4);
    const skidPlate = new THREE.Mesh(skidGeo, materials.titaniumBumper);
    skidPlate.position.y = 0.95;
    skidPlate.castShadow = true;
    chassisGroup.add(skidPlate);
    inspectableMeshes.push(skidPlate);

    // --- 2. SUSPENSION & ROCKER-BOGIE LOCOMOTION (6 Wheels) ---
    const wheelPositions = [
      { x: 2.0, z: 1.75 },  // Front L
      { x: 0.0, z: 1.85 },  // Mid L
      { x: -2.0, z: 1.75 }, // Rear L
      { x: 2.0, z: -1.75 }, // Front R
      { x: 0.0, z: -1.85 }, // Mid R
      { x: -2.0, z: -1.75 } // Rear R
    ];

    wheelPositions.forEach(pos => {
      const wheelAssembly = new THREE.Group();
      wheelAssembly.position.set(pos.x, 0.7, pos.z);

      // Compliant mesh tire
      const tireGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.5, 32);
      tireGeo.rotateZ(Math.PI / 2);
      const tire = new THREE.Mesh(tireGeo, materials.treadWheel);
      tire.castShadow = true;
      tire.receiveShadow = true;
      wheelAssembly.add(tire);
      inspectableMeshes.push(tire);

      // Hub & BLDC motor housing
      const hubGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.52, 24);
      hubGeo.rotateZ(Math.PI / 2);
      const hub = new THREE.Mesh(hubGeo, materials.wheelHub);
      wheelAssembly.add(hub);
      inspectableMeshes.push(hub);

      // Suspension Arm / Linkage
      const linkGeo = new THREE.BoxGeometry(0.12, 0.65, 0.12);
      const link = new THREE.Mesh(linkGeo, materials.titaniumBumper);
      const zDir = pos.z > 0 ? -1 : 1;
      link.position.set(0, 0.35, zDir * 0.22);
      link.rotation.x = zDir * 0.28;
      link.castShadow = true;
      wheelAssembly.add(link);
      inspectableMeshes.push(link);

      suspensionGroup.add(wheelAssembly);
    });

    // --- 3. CARGO BED & STANDARDIZED PAYLOAD CONTAINER ---
    // Roll-bed guide deck
    const bedGeo = new THREE.BoxGeometry(3.5, 0.15, 2.1);
    const cargoBed = new THREE.Mesh(bedGeo, materials.titaniumBumper);
    cargoBed.position.set(-0.3, 1.7, 0);
    cargoBed.castShadow = true;
    cargoGroup.add(cargoBed);
    inspectableMeshes.push(cargoBed);

    // Guide Rails
    const railGeo = new THREE.BoxGeometry(3.5, 0.25, 0.08);
    const railL = new THREE.Mesh(railGeo, materials.carbonChassis);
    railL.position.set(-0.3, 1.85, 1.05);
    const railR = new THREE.Mesh(railGeo, materials.carbonChassis);
    railR.position.set(-0.3, 1.85, -1.05);
    cargoGroup.add(railL, railR);
    inspectableMeshes.push(railL, railR);

    // Standard NASA HUNCH Lunar Cargo Canister
    const containerGeo = new THREE.BoxGeometry(2.5, 1.25, 1.85);
    const container = new THREE.Mesh(containerGeo, materials.cargoEnclosure);
    container.position.set(-0.3, 2.4, 0);
    container.castShadow = true;
    container.receiveShadow = true;
    cargoGroup.add(container);
    inspectableMeshes.push(container);

    // NASA HUNCH Identification Stripe
    const bandGeo = new THREE.BoxGeometry(2.52, 0.25, 1.87);
    const band = new THREE.Mesh(bandGeo, materials.accentBlue);
    band.position.set(-0.3, 2.4, 0);
    cargoGroup.add(band);
    inspectableMeshes.push(band);

    // Cargo Retention Locking Clamp
    const clampGeo = new THREE.BoxGeometry(0.18, 0.35, 1.95);
    const clampF = new THREE.Mesh(clampGeo, materials.amberStatus);
    clampF.position.set(1.0, 2.25, 0);
    const clampR = new THREE.Mesh(clampGeo, materials.amberStatus);
    clampR.position.set(-1.6, 2.25, 0);
    cargoGroup.add(clampF, clampR);
    inspectableMeshes.push(clampF, clampR);

    // --- 4. PERCEPTION MAST & COMMUNICATIONS ---
    const mastPillarGeo = new THREE.CylinderGeometry(0.07, 0.09, 1.5, 16);
    const mastPillar = new THREE.Mesh(mastPillarGeo, materials.titaniumBumper);
    mastPillar.position.set(1.65, 2.35, 0);
    mastPillar.castShadow = true;
    mastGroup.add(mastPillar);
    inspectableMeshes.push(mastPillar);

    // Sensor Gimbal Head
    const headGeo = new THREE.BoxGeometry(0.35, 0.28, 0.65);
    const sensorHead = new THREE.Mesh(headGeo, materials.carbonChassis);
    sensorHead.position.set(1.65, 3.1, 0);
    sensorHead.castShadow = true;
    mastGroup.add(sensorHead);
    inspectableMeshes.push(sensorHead);

    // Stereo Navigation Cameras
    const camGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.12, 16);
    camGeo.rotateZ(Math.PI / 2);
    const camL = new THREE.Mesh(camGeo, materials.sensorOptics);
    camL.position.set(1.85, 3.1, 0.2);
    const camR = new THREE.Mesh(camGeo, materials.sensorOptics);
    camR.position.set(1.85, 3.1, -0.2);
    mastGroup.add(camL, camR);
    inspectableMeshes.push(camL, camR);

    // Flash LIDAR Turret (Rotates on Z axis)
    const lidarPuckGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.2, 24);
    const lidarPuck = new THREE.Mesh(lidarPuckGeo, materials.carbonChassis);
    lidarPuck.position.set(1.65, 3.35, 0);
    mastGroup.add(lidarPuck);
    inspectableMeshes.push(lidarPuck);

    // High Gain Antenna (Lunar-to-Gateway Downlink)
    const dishGeo = new THREE.SphereGeometry(0.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.5);
    const dish = new THREE.Mesh(dishGeo, materials.titaniumBumper);
    dish.position.set(-1.75, 2.75, -0.85);
    dish.rotation.x = -Math.PI / 3;
    dish.rotation.z = Math.PI / 5;
    dish.castShadow = true;
    mastGroup.add(dish);
    inspectableMeshes.push(dish);

    // --- CAD VIEWPORT CONTROLS ---
    let isWireframe = false;
    let isExploded = false;

    const btnWireframe = document.getElementById('btn-wireframe');
    const btnExplode = document.getElementById('btn-explode');
    const btnResetCam = document.getElementById('btn-reset-cam');

    // Camera Preset Buttons
    document.querySelectorAll('.cam-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view === 'iso') {
          camera.position.set(10, 6.5, 11);
          controls.target.set(0, 1.2, 0);
        } else if (view === 'top') {
          camera.position.set(0, 15, 0.01);
          controls.target.set(0, 1.2, 0);
        } else if (view === 'side') {
          camera.position.set(0, 2.5, 14);
          controls.target.set(0, 1.2, 0);
        } else if (view === 'front') {
          camera.position.set(14, 2.5, 0);
          controls.target.set(0, 1.2, 0);
        }
        controls.update();
      });
    });

    if (btnWireframe) {
      btnWireframe.addEventListener('click', () => {
        isWireframe = !isWireframe;
        inspectableMeshes.forEach(mesh => {
          if (mesh.material) {
            mesh.material.wireframe = isWireframe;
          }
        });
        btnWireframe.textContent = isWireframe ? 'Wireframe: ON' : 'Wireframe: OFF';
        btnWireframe.classList.toggle('text-blue-400', isWireframe);
      });
    }

    if (btnExplode) {
      btnExplode.addEventListener('click', () => {
        isExploded = !isExploded;
        btnExplode.textContent = isExploded ? 'Assembly: Exploded' : 'Assembly: Nominal';
        btnExplode.classList.toggle('text-blue-400', isExploded);
      });
    }

    if (btnResetCam) {
      btnResetCam.addEventListener('click', () => {
        camera.position.set(10, 6.5, 11);
        controls.target.set(0, 1.2, 0);
        controls.update();
      });
    }

    // Subsystem Engineering Dossier
    const subsystemData = {
      chassis: {
        title: 'Chassis & Structural Frame',
        lead: 'Ahrav & Sacheth // Assembly Lead & 3D Design Lead',
        desc: 'Carbon-composite monocoque enclosure with integrated 7075-T6 aluminum truss members. Houses primary avionics, cryo-insulated battery bus, and lower regolith skid plate rated for high-velocity particle deflection.'
      },
      locomotion: {
        title: 'Rocker-Bogie Suspension & Hub Drives',
        lead: 'Ahrav & Harshan // Assembly Lead & Co-Designer',
        desc: 'Passive 6-wheel articulated rocker-bogie architecture with non-pneumatic titanium compliant spring tires. Equipped with sealed cycloidal brushless hub motors delivering 180 Nm torque per wheel with zero dust intrusion.'
      },
      cargobay: {
        title: 'Cargo Transfer Roll-Bed & Latching',
        lead: 'Sacheth & Ahrav // 3D Design Lead & Assembly Lead',
        desc: 'Dual-channel low-friction roller bed with automated electromagnetic latching mechanisms designed to lock standard 500 kg NASA HUNCH lunar stowage containers under ±15° incline maneuvers.'
      },
      avionics: {
        title: 'Perception, Autonomy & Downlink Mast',
        lead: 'Harshan & Ahrav // AI Lead & AI Training Lead',
        desc: 'High-speed solid-state flash LIDAR and dual stereoscopic cameras driving edge neural SLAM for 3D terrain reconstruction, real-time boulder avoidance, and 1.28s Earth-Moon telemetry communications.'
      }
    };

    const subBtns = document.querySelectorAll('.subsystem-select-btn');
    const subTitle = document.getElementById('cad-subsystem-title');
    const subLead = document.getElementById('cad-subsystem-lead');
    const subDesc = document.getElementById('cad-subsystem-desc');

    subBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const subKey = btn.dataset.subsystem;
        subBtns.forEach(b => {
          b.className = 'subsystem-select-btn px-3 py-2 text-left rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent transition-colors';
        });
        btn.className = 'subsystem-select-btn px-3 py-2 text-left rounded-lg text-xs font-medium text-white bg-slate-800 border border-slate-700 transition-colors';

        if (subsystemData[subKey]) {
          subTitle.textContent = subsystemData[subKey].title;
          subLead.textContent = subsystemData[subKey].lead;
          subDesc.textContent = subsystemData[subKey].desc;
        }

        if (subKey === 'chassis') controls.target.set(0, 1.2, 0);
        if (subKey === 'locomotion') controls.target.set(0, 0.7, 1.2);
        if (subKey === 'cargobay') controls.target.set(-0.3, 2.2, 0);
        if (subKey === 'avionics') controls.target.set(1.65, 3.1, 0);
        controls.update();
      });
    });

    // Window Resize
    window.addEventListener('resize', () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    });

    // Render Loop
    let clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (lidarPuck) {
        lidarPuck.rotation.y += 2.2 * delta;
      }

      // Smooth Exploded Animation
      const targetCargoY = isExploded ? 1.5 : 0;
      const targetMastY = isExploded ? 0.7 : 0;
      const targetMastX = isExploded ? 0.5 : 0;

      cargoGroup.position.y += (targetCargoY - cargoGroup.position.y) * 0.08;
      mastGroup.position.y += (targetMastY - mastGroup.position.y) * 0.08;
      mastGroup.position.x += (targetMastX - mastGroup.position.x) * 0.08;

      controls.update();
      renderer.render(scene, camera);
    }

    animate();
  }

  // --- 2. LUNAR SURFACE ROUTE SIMULATION ---
  const simToggleBtn = document.getElementById('btn-sim-toggle');
  const simResetBtn = document.getElementById('btn-sim-reset');
  const simMarker = document.getElementById('rover-sim-marker');
  const simProgressBar = document.getElementById('sim-progress-bar');
  const simDistText = document.getElementById('sim-dist-text');
  const simPctText = document.getElementById('sim-pct-text');
  const metricSpeed = document.getElementById('metric-speed');
  const metricSlope = document.getElementById('metric-slope');
  const metricEta = document.getElementById('metric-eta');

  let isSimRunning = false;
  let simProgress = 0;
  let simAnimId = null;
  const TOTAL_DISTANCE = 850;

  const startX = 60, startY = 170;
  const midX = 360, midY = 145;
  const endX = 740, endY = 140;

  const updateSimUI = () => {
    const currentMeters = Math.round(simProgress * TOTAL_DISTANCE);
    const pct = Math.round(simProgress * 100);

    if (simProgressBar) simProgressBar.style.width = `${pct}%`;
    if (simDistText) simDistText.textContent = `${currentMeters} m`;
    if (simPctText) simPctText.textContent = `${pct}%`;

    let currX, currY;
    if (simProgress <= 0.5) {
      const t = simProgress * 2;
      currX = startX + (midX - startX) * t;
      currY = startY + (midY - startY) * t - Math.sin(t * Math.PI) * 20;
    } else {
      const t = (simProgress - 0.5) * 2;
      currX = midX + (endX - midX) * t;
      currY = midY + (endY - midY) * t + Math.sin(t * Math.PI) * 10;
    }

    if (simMarker) {
      simMarker.setAttribute('transform', `translate(${currX}, ${currY})`);
    }

    if (simProgress === 0) {
      if (metricSpeed) metricSpeed.textContent = '0.0 km/h';
      if (metricSlope) metricSlope.textContent = '+1.8°';
      if (metricEta) metricEta.textContent = '--:--';
    } else if (simProgress < 0.98) {
      const speed = (5.2 + Math.sin(simProgress * 15) * 0.6).toFixed(1);
      if (metricSpeed) metricSpeed.textContent = `${speed} km/h`;

      if (simProgress > 0.3 && simProgress < 0.45) {
        if (metricSlope) metricSlope.textContent = '+6.4° (Crater Margin)';
      } else {
        if (metricSlope) metricSlope.textContent = '+2.1°';
      }

      const remainingSecs = Math.max(0, Math.round((1 - simProgress) * 580));
      const mins = Math.floor(remainingSecs / 60);
      const secs = remainingSecs % 60;
      if (metricEta) metricEta.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    } else {
      if (metricSpeed) metricSpeed.textContent = '0.0 km/h (Docked)';
      if (metricSlope) metricSlope.textContent = '0.0°';
      if (metricEta) metricEta.textContent = '00:00';
    }
  };

  const simStep = () => {
    if (!isSimRunning) return;
    simProgress += 0.002;
    if (simProgress >= 1) {
      simProgress = 1;
      isSimRunning = false;
      if (simToggleBtn) simToggleBtn.textContent = 'Transit Complete';
    }
    updateSimUI();
    if (isSimRunning) {
      simAnimId = requestAnimationFrame(simStep);
    }
  };

  if (simToggleBtn) {
    simToggleBtn.addEventListener('click', () => {
      if (simProgress >= 1) simProgress = 0;
      isSimRunning = !isSimRunning;
      simToggleBtn.textContent = isSimRunning ? 'Pause Simulation' : 'Resume Simulation';
      if (isSimRunning) simStep();
      else cancelAnimationFrame(simAnimId);
    });
  }

  if (simResetBtn) {
    simResetBtn.addEventListener('click', () => {
      isSimRunning = false;
      simProgress = 0;
      cancelAnimationFrame(simAnimId);
      if (simToggleBtn) simToggleBtn.textContent = 'Start Simulation';
      updateSimUI();
    });
  }

  // --- 3. PAYLOAD MASS & ENERGY CALCULATOR ---
  const cargoCheckboxes = document.querySelectorAll('.cargo-checkbox');
  const calcMassEarth = document.getElementById('calc-mass-earth');
  const calcWeightLunar = document.getElementById('calc-weight-lunar');
  const calcCapacityPct = document.getElementById('calc-capacity-pct');
  const calcCapacityBar = document.getElementById('calc-capacity-bar');
  const calcCogOffset = document.getElementById('calc-cog-offset');
  const calcPowerEst = document.getElementById('calc-power-est');

  const updateCalculator = () => {
    let totalEarthKg = 0;
    let totalEnergyKwh = 0;
    let count = 0;

    cargoCheckboxes.forEach(cb => {
      if (cb.checked) {
        totalEarthKg += parseFloat(cb.dataset.mass || 0);
        totalEnergyKwh += parseFloat(cb.dataset.power || 0);
        count++;
      }
    });

    const lunarGravity = 1.622; // m/s^2
    const lunarWeightN = (totalEarthKg * lunarGravity).toFixed(1);
    const lunarMassKg = (totalEarthKg / 6).toFixed(1);
    const maxCapacity = 500;
    const capacityPct = Math.min(100, (totalEarthKg / maxCapacity) * 100).toFixed(1);

    if (calcMassEarth) calcMassEarth.textContent = `${totalEarthKg.toFixed(1)} kg`;
    if (calcWeightLunar) calcWeightLunar.textContent = `${lunarMassKg} kg (${lunarWeightN} N)`;
    if (calcCapacityPct) calcCapacityPct.textContent = `${capacityPct}%`;
    if (calcCapacityBar) calcCapacityBar.style.width = `${capacityPct}%`;
    if (calcPowerEst) calcPowerEst.textContent = `${(totalEnergyKwh + 1.2).toFixed(1)} kWh`;

    if (calcCogOffset) {
      if (totalEarthKg > maxCapacity) {
        calcCogOffset.textContent = 'Exceeds Structural Envelope';
        calcCogOffset.className = 'font-mono text-sm text-red-400 font-semibold';
      } else if (totalEarthKg === 0) {
        calcCogOffset.textContent = 'Neutral (0.0 cm)';
        calcCogOffset.className = 'font-mono text-sm text-slate-400';
      } else {
        calcCogOffset.textContent = `+${(0.6 + count * 0.4).toFixed(1)} cm (Within Margin)`;
        calcCogOffset.className = 'font-mono text-sm text-emerald-400 font-medium';
      }
    }
  };

  cargoCheckboxes.forEach(cb => cb.addEventListener('change', updateCalculator));
  updateCalculator();

  // Mode Selection
  document.querySelectorAll('.mode-switch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-switch-btn').forEach(b => {
        b.className = 'mode-switch-btn px-2.5 py-1 text-xs font-medium rounded text-slate-400 hover:text-white transition-colors';
      });
      btn.className = 'mode-switch-btn px-2.5 py-1 text-xs font-medium rounded bg-blue-600 text-white transition-colors';
    });
  });

});
