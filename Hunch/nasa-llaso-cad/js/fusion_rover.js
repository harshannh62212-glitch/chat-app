/**
 * NASA HUNCH LLASO — Ageis-V1 Autonomous Lunar AMR Rover 3D Assembly
 * Engineering CAD Digital Twin matching template orthographic views:
 * - Monocoque Polymaker Black PETG chassis with embossed "Ageis" side flanks
 * - 6-wheel chevron locomotion with deep-dish rims & brass M3 lug nuts
 * - 3 transverse axle tubes underneath with central chassis mounting clamps
 * - 6 vertical wheel drop yokes, 6 Traxxas-style shocks, 6 Greartisan 12V 100RPM 37mm motors
 * - Front deck articulated robotic arm with spherical shoulder & 2-prong claw
 * - Perception mast with spinning EC Buying YDLIDAR X2L 360° & two Arducam OV5647 cameras
 * - Front face rectangular stereo perception aperture & round sensor port
 * - Recessed cargo hopper bed with standardized NASA HUNCH container
 * - Full internal avionics bay (GOLDENMATE 12V LiFePO4, Pi 5, Arduino Uno R3,
 *   Buck converter, Cytron MDD10A, 4x 3007 cooling fans in a front-to-rear duct).
 */
(function (global) {
  var MESH_BASE = 'meshes/fusion_rover/';

  // Procedural Texture Generators
  function createPetgTexture() {
    var cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
    var c = cv.getContext('2d');
    c.fillStyle = '#141720'; c.fillRect(0, 0, 512, 512);
    // 0.2mm FDM layer lines
    for (var y = 0; y < 512; y += 3) {
      var s = 22 + Math.sin(y * 1.8) * 4 + (Math.random() - 0.5) * 4;
      c.fillStyle = 'rgb(' + Math.round(s) + ',' + Math.round(s + 1) + ',' + Math.round(s + 4) + ')';
      c.fillRect(0, y, 512, 1.8);
    }
    // Carbon/PETG 45-degree diagonal infill weave
    c.strokeStyle = 'rgba(255,255,255,0.04)'; c.lineWidth = 1.0;
    for (var d = -512; d < 1024; d += 8) {
      c.beginPath(); c.moveTo(d, 0); c.lineTo(d + 512, 512); c.stroke();
    }
    var tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 3);
    return tex;
  }

  function createNitinolMeshTexture() {
    var cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
    var c = cv.getContext('2d');
    
    // Background - dark translucent void behind wire weave
    c.fillStyle = '#231e18'; c.fillRect(0, 0, 512, 512);

    // NASA Glenn Superelastic Nitinol / Coiled Spring Chainmail Interlocking Links
    // Woven coiled spring wire grid (gold-bronze titanium sheen)
    c.lineWidth = 2.2;
    for (var y = 0; y < 512; y += 8) {
      for (var x = 0; x < 512; x += 8) {
        var offset = (Math.floor(y / 8) % 2 === 0) ? 4 : 0;
        var cx = (x + offset) % 512;
        
        // Coiled wire loop ring highlight
        c.strokeStyle = '#c29b68';
        c.beginPath();
        c.arc(cx, y, 4.5, 0, Math.PI * 2);
        c.stroke();

        // Shaded wire loop underside (depth & specular contrast)
        c.strokeStyle = '#61482b';
        c.lineWidth = 1.2;
        c.beginPath();
        c.arc(cx + 1, y + 1, 3.2, 0, Math.PI);
        c.stroke();
        c.lineWidth = 2.2;
      }
    }

    // Diagonal interlocking coil spring strands (giving distinct 3D woven spring mesh look)
    c.strokeStyle = 'rgba(235, 195, 138, 0.45)';
    c.lineWidth = 1.5;
    for (var d = -512; d < 1024; d += 16) {
      c.beginPath(); c.moveTo(d, 0); c.lineTo(d + 512, 512); c.stroke();
    }
    for (var d2 = -512; d2 < 1024; d2 += 16) {
      c.beginPath(); c.moveTo(d2, 512); c.lineTo(d2 + 512, 0); c.stroke();
    }

    var tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    return tex;
  }

  function createGoldenmateTexture() {
    var cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
    var c = cv.getContext('2d');
    c.fillStyle = '#0f172a'; c.fillRect(0, 0, 512, 256);
    var grad = c.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, '#0284c7'); grad.addColorStop(0.5, '#06b6d4'); grad.addColorStop(1, '#f59e0b');
    c.fillStyle = grad; c.fillRect(0, 0, 512, 48);
    c.fillStyle = '#ffffff'; c.font = 'bold 28px sans-serif';
    c.fillText('GOLDENMATE', 18, 35);
    c.font = 'bold 20px monospace';
    c.fillText('12V 10Ah • 128Wh • LiFePO4', 18, 90);
    c.fillStyle = '#94a3b8'; c.font = '13px sans-serif';
    c.fillText('Deep Cycle • Built-in Smart BMS • IP67', 18, 120);
    c.fillText('Continuous Discharge: 10A (Peak 20A)', 18, 142);
    c.fillText('Charge Voltage: 14.4V - 14.6V', 18, 164);
    c.strokeStyle = '#334155'; c.strokeRect(18, 185, 160, 22);
    c.fillStyle = '#22c55e';
    for (var seg = 0; seg < 4; seg++) c.fillRect(22 + seg * 31, 189, 27, 14);
    c.fillStyle = '#e2e8f0'; c.font = 'bold 12px sans-serif';
    c.fillText('BMS STATE: 82% CHARGED', 190, 201);
    var tex = new THREE.CanvasTexture(cv);
    return tex;
  }

  function createArduinoTexture() {
    var cv = document.createElement('canvas'); cv.width = 512; cv.height = 384;
    var c = cv.getContext('2d');
    c.fillStyle = '#008784'; c.fillRect(0, 0, 512, 384);
    c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 2.0;
    c.strokeRect(12, 12, 488, 360);
    c.fillStyle = '#ffffff'; c.font = 'bold 26px sans-serif';
    c.fillText('ARDUINO', 28, 48);
    c.font = 'bold 16px sans-serif';
    c.fillText('UNO REV3 [A000066]', 28, 72);
    c.font = '12px monospace';
    c.fillText('ATmega328P • 16MHz • PWM MOTOR CONTROLLER', 28, 96);
    c.fillStyle = '#1e293b'; c.fillRect(180, 140, 200, 60);
    c.fillStyle = '#64748b';
    for (var p = 0; p < 14; p++) {
      c.fillRect(190 + p * 13, 134, 6, 6);
      c.fillRect(190 + p * 13, 200, 6, 6);
    }
    c.fillStyle = '#cbd5e1'; c.font = 'bold 11px monospace';
    c.fillText('ATMEGA328P-PU', 230, 175);
    var tex = new THREE.CanvasTexture(cv);
    return tex;
  }

  function createPi5Texture() {
    var cv = document.createElement('canvas'); cv.width = 512; cv.height = 384;
    var c = cv.getContext('2d');
    c.fillStyle = '#15803d'; c.fillRect(0, 0, 512, 384);
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 1.5;
    c.strokeRect(8, 8, 496, 368);
    c.fillStyle = '#ffffff'; c.font = 'bold 24px sans-serif';
    c.fillText('Raspberry Pi 5', 24, 42);
    c.font = 'bold 14px monospace';
    c.fillText('Broadcom BCM2712 Quad Cortex-A76 @ 2.4GHz', 24, 66);
    c.font = '12px sans-serif';
    c.fillText('SANOOV Active Cooler Equipped • 4GB LPDDR4X', 24, 88);
    c.fillStyle = '#0f172a'; c.fillRect(190, 130, 110, 110);
    c.fillStyle = '#94a3b8'; c.font = 'bold 10px monospace';
    c.fillText('BCM2712', 220, 185);
    c.fillStyle = '#1e293b'; c.fillRect(320, 145, 80, 80);
    c.fillStyle = '#cbd5e1'; c.fillText('4GB RAM', 335, 190);
    var tex = new THREE.CanvasTexture(cv);
    return tex;
  }

  function createBuckTexture() {
    var cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    var c = cv.getContext('2d');
    c.fillStyle = '#334155'; c.fillRect(0, 0, 256, 128);
    c.fillStyle = '#0f172a'; c.fillRect(10, 10, 236, 108);
    c.fillStyle = '#f59e0b'; c.font = 'bold 16px sans-serif';
    c.fillText('YRDZXG BUCK STEP-DOWN', 20, 36);
    c.fillStyle = '#e2e8f0'; c.font = '12px monospace';
    c.fillText('IN: DC 12V/24V (8V-40V)', 20, 62);
    c.fillText('OUT: DC 5V 5A (25W MAX)', 20, 82);
    c.fillStyle = '#22c55e'; c.fillText('SYNC RECTIFICATION • 96%', 20, 102);
    var tex = new THREE.CanvasTexture(cv);
    return tex;
  }

  function initFusionRover(opts) {
    opts = opts || {};
    var roverGroup = opts.roverGroup;
    var hide = opts.hide || [];
    var wheelGroups = opts.wheelGroups || [];
    var wheels = opts.wheels || [];

    // Hide old objects
    hide.forEach(function (o) {
      if (o) o.visible = false;
    });
    if (opts.cargoBayGroup) opts.cargoBayGroup.visible = false;
    if (opts.armBase) opts.armBase.visible = false;
    if (opts.mastGroup) opts.mastGroup.visible = false;

    var root = new THREE.Group();
    root.name = 'aegisRoverAssembly';
    if (roverGroup) {
      roverGroup.add(root);
    }

    // Textures & Materials
    var petgTex = (typeof global.createPetgTex === 'function') ? global.createPetgTex(true) : createPetgTexture();
    var wheelTex = createNitinolMeshTexture();
    var batTex = (typeof global.createGoldenmateBatTex === 'function') ? global.createGoldenmateBatTex() : createGoldenmateTexture();
    var unoTex = (typeof global.createArduinoUnoTex === 'function') ? global.createArduinoUnoTex() : createArduinoTexture();
    var piTex = (typeof global.createPi5BoardTex === 'function') ? global.createPi5BoardTex() : createPi5Texture();
    var buckTex = (typeof global.createBuckConverterTex === 'function') ? global.createBuckConverterTex() : createBuckTexture();

    var matChassis = new THREE.MeshStandardMaterial({
      color: 0x222630,
      map: petgTex,
      roughness: 0.35,
      metalness: 0.65 // Anodized Aerospace Al-Li 2195 / Carbon-PEEK
    });
    var matChassisTrim = new THREE.MeshStandardMaterial({
      color: 0x1e2430,
      roughness: 0.30,
      metalness: 0.70
    });
    var matAlloy = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.20,
      metalness: 0.92
    });
    var matDarkAlloy = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.30,
      metalness: 0.85
    });
    var matArtemisBlue = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.22,
      metalness: 0.90
    });
    var matBrass = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.22,
      metalness: 0.94
    });
    var matGoldFoil = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.25,
      metalness: 0.92
    });
    // Authentic NASA Glenn Superelastic Nitinol Shape Memory Alloy (SMA) Coiled Spring-Mesh Tire
    var matTire = new THREE.MeshStandardMaterial({
      color: 0xd4a373, // Warm metallic bronze/titanium Nitinol sheen exactly matching NASA reference
      map: wheelTex,
      roughness: 0.38,
      metalness: 0.82
    });
    // Precision CNC Anodized Red Beadlock Clamp Ring (Matching NASA Glenn tire test rig reference)
    var matBeadlock = new THREE.MeshStandardMaterial({
      color: 0xdc2626, // Crimson Anodized CNC Aerospace 7075-T6 Beadlock Ring
      roughness: 0.22,
      metalness: 0.90
    });
    // 5-Spoke CNC Billet Aluminum Hub Carrier Standoffs (Matching NASA Glenn reference)
    var matWheelCenter = new THREE.MeshStandardMaterial({
      color: 0xdc2626, // Matching Crimson Red Spoke Center
      roughness: 0.25,
      metalness: 0.88
    });
    var matTitaniumMesh = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.30,
      metalness: 0.85
    });
    // Viton Hermetic Dust Gasket Seal Material (Aerospace Grade High-Fluorine Fluorocarbon Elastomer)
    var matDustSeal = new THREE.MeshStandardMaterial({
      color: 0x1f232b, // Dark charcoal / vulcanized black aerospace seal
      roughness: 0.85,
      metalness: 0.10
    });
    // Thermal Radiator Ceramic Optical Solar Reflector (OSR) coating
    var matRadiator = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.12,
      metalness: 0.95
    });
    var matLens = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.8,
      roughness: 0.05,
      metalness: 0.95
    });
    var matAmber = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.9,
      roughness: 0.28
    });
    var matGreenLed = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 2.0,
      roughness: 0.18
    });
    var matWireRed = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.42 });
    var matWireBlk = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.48 });

    var fanRotors = [];
    var headlights = [];

    // =========================================================================
    // 1. LOWER MONOCOQUE CHASSIS TUB & UNDERBODY SKID (Template Images 1, 2, 3, 5)
    // =========================================================================
    // Space-Hardened Lower Monocoque Tub (Hermetically Sealed Monocoque)
    var lowerTub = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, 0.14, 0.52),
      matChassis
    );
    lowerTub.position.set(0, 0.13, 0);
    lowerTub.castShadow = true; lowerTub.receiveShadow = true;
    root.add(lowerTub);

    // Continuous Hermetic Perimeter Seal Flange (Viton O-Ring Interface between Lower Tub & Upper Deck)
    var hermeticSealFlange = new THREE.Mesh(
      new THREE.BoxGeometry(0.866, 0.012, 0.526),
      matDustSeal
    );
    hermeticSealFlange.position.set(0, 0.198, 0);
    root.add(hermeticSealFlange);

    // Continuous Underbody Micrometeorite & Regolith Whipple Shield (Titanium-Kevlar Underbelly Pan)
    var bellyWhippleShield = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 0.008, 0.50),
      matAlloy
    );
    bellyWhippleShield.position.set(0, 0.054, 0);
    bellyWhippleShield.castShadow = true;
    root.add(bellyWhippleShield);

    // Front & Rear Underbody Approach Skid Plates (Seamless Angled Deflector Skids)
    var frontSkid = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.016, 0.48), matAlloy);
    frontSkid.position.set(0.42, 0.065, 0); frontSkid.rotation.z = 0.36;
    root.add(frontSkid);
    var rearSkid = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.016, 0.48), matAlloy);
    rearSkid.position.set(-0.42, 0.065, 0); rearSkid.rotation.z = -0.36;
    root.add(rearSkid);

    // Perimeter Captive Aerospace Titanium Fasteners with O-Ring Washers (Replacing open brass inserts)
    for (var bx = -0.36; bx <= 0.37; bx += 0.145) {
      [-0.245, 0.245].forEach(function (bz) {
        var boss = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.012, 0.02, 10), matChassisTrim);
        boss.position.set(bx, 0.20, bz);
        // Hermetic Viton Sealing Washer
        var sealWasher = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 10), matDustSeal);
        sealWasher.position.set(bx, 0.208, bz);
        // NAS-spec High-Strength Titanium Socket Head Bolt
        var insert = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.022, 10), matAlloy);
        insert.position.set(bx, 0.211, bz);
        root.add(boss, sealWasher, insert);
      });
    }

    // =========================================================================
    // 2. EMBOSSED "Ageis" NAMEPLATES ON BOTH SIDE FLANKS (Matching Template Image 1)
    // Placed at y = 0.21, perfectly above wheel tops and clearly visible!
    // =========================================================================
    function create3DLetter(char, mat) {
      var g = new THREE.Group();
      var w = 0.042, h = 0.054, t = 0.008, d = 0.007;
      function b(bw, bh, bd, x, y, z) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
        m.position.set(x, y, z);
        m.castShadow = true;
        g.add(m);
        return m;
      }
      if (char === 'A') {
        b(t, h, d, -w / 2 + t / 2, 0, 0);
        b(t, h, d, w / 2 - t / 2, 0, 0);
        b(w, t, d, 0, h / 2 - t / 2, 0);
        b(w - t, t, d, 0, -0.004, 0);
      } else if (char === 'E') {
        b(t, h, d, -w / 2 + t / 2, 0, 0);
        b(w, t, d, 0, h / 2 - t / 2, 0);
        b(w * 0.75, t, d, -w * 0.125, 0, 0);
        b(w, t, d, 0, -h / 2 + t / 2, 0);
      } else if (char === 'G') {
        b(t, h, d, -w / 2 + t / 2, 0, 0);
        b(w, t, d, 0, h / 2 - t / 2, 0);
        b(w, t, d, 0, -h / 2 + t / 2, 0);
        b(t, h * 0.5, d, w / 2 - t / 2, -h * 0.25 + t / 2, 0);
        b(w * 0.5, t, d, w * 0.25, 0, 0);
      } else if (char === 'I') {
        b(t * 1.2, h, d, 0, 0, 0);
        b(w * 0.8, t, d, 0, h / 2 - t / 2, 0);
        b(w * 0.8, t, d, 0, -h / 2 + t / 2, 0);
      } else if (char === 'S') {
        b(w, t, d, 0, h / 2 - t / 2, 0);
        b(t, h * 0.5, d, -w / 2 + t / 2, h * 0.25 - t / 2, 0);
        b(w, t, d, 0, 0, 0);
        b(t, h * 0.5, d, w / 2 - t / 2, -h * 0.25 + t / 2, 0);
        b(w, t, d, 0, -h / 2 + t / 2, 0);
      }
      return g;
    }

    var matAegisLetter = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.45,
      roughness: 0.15,
      metalness: 0.92
    });
    var matBadgeBack = new THREE.MeshStandardMaterial({
      color: 0x090c12,
      roughness: 0.35,
      metalness: 0.70
    });

    [-1, 1].forEach(function (sideSign) {
      var badgeGroup = new THREE.Group();
      badgeGroup.position.set(0, 0.210, sideSign * 0.264);
      if (sideSign < 0) badgeGroup.rotation.y = Math.PI;

      // Inset plaque plate
      var plaque = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.082, 0.006), matBadgeBack);
      plaque.receiveShadow = true;
      badgeGroup.add(plaque);

      // Artemis blue border frame
      var frameTop = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.005, 0.008), matArtemisBlue);
      frameTop.position.set(0, 0.040, 0.002);
      var frameBot = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.005, 0.008), matArtemisBlue);
      frameBot.position.set(0, -0.040, 0.002);
      badgeGroup.add(frameTop, frameBot);

      // 5 Raised 3D Letters: A - G - E - I - S
      var letters = ['A', 'G', 'E', 'I', 'S'];
      var spacing = 0.068;
      for (var li = 0; li < letters.length; li++) {
        var letterMesh = create3DLetter(letters[li], matAegisLetter);
        letterMesh.position.set(-0.136 + li * spacing, 0, 0.004);
        badgeGroup.add(letterMesh);
      }
      root.add(badgeGroup);
    });

    // =========================================================================
    // 3. 3 TRANSVERSE AXLE TUBES WITH CENTRAL CHASSIS CLAMPS (Matching Template Image 5)
    // =========================================================================
    var axleXPositions = [0.38, 0.00, -0.38];
    axleXPositions.forEach(function (ax) {
      var transverseTube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 0.68, 20),
        matAlloy
      );
      transverseTube.rotation.x = Math.PI / 2;
      transverseTube.position.set(ax, 0.080, 0);
      transverseTube.castShadow = true;
      root.add(transverseTube);

      // Heavy CNC-machined central mounting collar clamp (Template Image 5)
      var centerClamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.046, 0.036, 0.048),
        matDarkAlloy
      );
      centerClamp.position.set(ax, 0.084, 0);
      centerClamp.castShadow = true;
      root.add(centerClamp);

      // 2 Brass M4 clamping bolts
      [-0.015, 0.015].forEach(function (cz) {
        var clampBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.040, 8), matBrass);
        clampBolt.position.set(ax, 0.086, cz);
        root.add(clampBolt);
      });
    });

    // =========================================================================
    // 4. VERTICAL WHEEL DROP YOKES & 6x GREARTISAN 37mm MOTORS (Matching Template Images 1, 3, 5)
    // =========================================================================
    var wheelDefs = [
      { id: 'FL', x: 0.38, z: 0.34 },
      { id: 'ML', x: 0.00, z: 0.34 },
      { id: 'BL', x: -0.38, z: 0.34 },
      { id: 'FR', x: 0.38, z: -0.34 },
      { id: 'MR', x: 0.00, z: -0.34 },
      { id: 'BR', x: -0.38, z: -0.34 }
    ];

    wheels.length = 0;
    wheelGroups.length = 0;

    wheelDefs.forEach(function (wd, idx) {
      var sideSign = wd.z > 0 ? 1 : -1;
      var wg = new THREE.Group();
      wg.position.set(wd.x, 0.09, wd.z);

      // Vertical Drop Yoke Bracket (Template Images 1, 3, 5)
      var yoke = new THREE.Group();
      var verticalStrut = new THREE.Mesh(
        new THREE.BoxGeometry(0.036, 0.110, 0.026),
        matChassisTrim
      );
      verticalStrut.position.set(0, 0.052, -sideSign * 0.016);
      verticalStrut.castShadow = true;
      yoke.add(verticalStrut);

      // Greartisan 37 mm motor clamp with Hermetic Environmental Canister
      var motorClamp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.023, 0.023, 0.030, 18),
        matDarkAlloy
      );
      motorClamp.rotation.x = Math.PI / 2;
      motorClamp.position.set(0, 0, -sideSign * 0.054);
      yoke.add(motorClamp);

      // High-Strength Titanium Fastener
      var clampBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.044, 8), matAlloy);
      clampBolt.position.set(0.020, 0.020, -sideSign * 0.054);
      yoke.add(clampBolt);

      // Hermetically Sealed Planetary Gearbox Canister (IP68 / Vacuum Rated with Dry Lubricant)
      var gearbox = new THREE.Mesh(
        new THREE.CylinderGeometry(0.019, 0.019, 0.034, 20),
        matAlloy
      );
      gearbox.rotation.x = Math.PI / 2;
      gearbox.position.set(0, 0, -sideSign * 0.048);
      gearbox.castShadow = true;
      yoke.add(gearbox);

      // Fully Sealed Brushless DC Motor Body (Vacuum Enclosure with Gold MLI Trim)
      var motorCan = new THREE.Mesh(
        new THREE.CylinderGeometry(0.019, 0.019, 0.048, 20),
        matDarkAlloy
      );
      motorCan.rotation.x = Math.PI / 2;
      motorCan.position.set(0, 0, -sideSign * 0.092);
      motorCan.castShadow = true;
      yoke.add(motorCan);

      // Motor Thermal MLI Boot Wrap (Prevents extreme cryogenic freezing at South Pole)
      var motorMliWrap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0195, 0.0195, 0.040, 16),
        matGoldFoil
      );
      motorMliWrap.rotation.x = Math.PI / 2;
      motorMliWrap.position.set(0, 0, -sideSign * 0.092);
      yoke.add(motorMliWrap);

      // Sealed Braided Stainless-Steel Harness Conduits (Potted Regolith-Proof Feedthrough)
      var wireConduit = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.095, 8), matAlloy);
      wireConduit.position.set(0, 0.046, -sideSign * 0.096);
      yoke.add(wireConduit);

      // Ferrofluidic Magnetic Regolith Rotary Exclusion Seal Ring
      var ferrofluidSeal = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.008, 16), matDustSeal);
      ferrofluidSeal.rotation.x = Math.PI / 2;
      ferrofluidSeal.position.set(0, 0, -sideSign * 0.030);
      yoke.add(ferrofluidSeal);

      // Titanium D-Shaft Hex Drive Coupler with Labyrinth Deflector Shield
      var hexCoupler = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.022, 6), matAlloy);
      hexCoupler.rotation.x = Math.PI / 2;
      hexCoupler.position.set(0, 0, -sideSign * 0.022);
      yoke.add(hexCoupler);

      wg.add(yoke);

      // Lower shock eye on the axle. The damper itself is parented to the chassis.
      var lowerEye = new THREE.Object3D();
      lowerEye.name = 'axle-eye-' + wd.id;
      lowerEye.position.set(0, 0, -sideSign * 0.02);
      wg.add(lowerEye);

      // =========================================================================
      // NASA GLENN RESEARCH CENTER SUPERELASTIC NITINOL SPRING-MESH TIRE
      // Modeled directly after NASA's Shape Memory Alloy (SMA) Tire Reference:
      // 1. Bulging toroidal Nitinol coiled wire mesh carcass (elastic compliance)
      // 2. Anodized crimson-red outer beadlock clamp ring with perimeter hardware
      // 3. Anodized red 5-spoke star center hub with 5 horizontal standoff studs
      // 4. Low-profile titanium chevron sand-paddles riveted onto the crown
      // 5. Sealed inner motor-drive planetary hub interface
      // =========================================================================
      var spinAxle = new THREE.Group();
      spinAxle.rotation.x = Math.PI / 2; // rotates Y-axis tire to roll along Z
      var roller = new THREE.Group();
      spinAxle.add(roller);

      // -----------------------------------------------------------------------
      // NASA GLENN SMA SPRING-MESH TIRE — corrected orientation
      // CylinderGeometry stands along Y by default.
      // spinAxle.rotation.x = PI/2 → tire rolls with axle along world-Z ✓
      // -----------------------------------------------------------------------

      // 1. Primary Nitinol Spring-Mesh Tire Carcass (cylinder stands upright in Y then rotated)
      var tire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.108, 0.108, 0.090, 36),
        matTire
      );
      tire.castShadow = true; tire.receiveShadow = true;
      roller.add(tire);
      tire.userData.roll = roller;

      // 2. Three Toroidal Nitinol Coil Ring Accents (evenly spaced across the tread face)
      [-0.028, 0, 0.028].forEach(function(ry) {
        var ringAccent = new THREE.Mesh(
          new THREE.TorusGeometry(0.108, 0.007, 12, 40),
          matTire
        );
        ringAccent.rotation.x = Math.PI / 2; // torus in XZ plane → ring around cylinder axis
        ringAccent.position.y = ry;
        roller.add(ringAccent);
      });

      // 3. Outer beadlock face offset — in spinAxle local space, Y is the axle direction
      //    outer face toward world = sideSign > 0 → positive Y in spinAxle after rotation
      var faceY = sideSign > 0 ? 0.048 : -0.048;

      // NASA Glenn Crimson Anodized Outer Beadlock Ring
      var redBeadlockRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.088, 0.007, 12, 36),
        matBeadlock
      );
      redBeadlockRing.rotation.x = Math.PI / 2;
      redBeadlockRing.position.y = faceY;
      roller.add(redBeadlockRing);

      // 16 Miniature Perimeter Fasteners on Beadlock Ring
      for (var pfi = 0; pfi < 16; pfi++) {
        var pfAng = (pfi / 16) * Math.PI * 2;
        var boltHead = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0022, 0.0022, 0.005, 6),
          matAlloy
        );
        // bolts face axially — along Y in spinAxle space
        boltHead.position.set(
          Math.cos(pfAng) * 0.088,
          faceY + (sideSign > 0 ? 0.006 : -0.006),
          Math.sin(pfAng) * 0.088
        );
        roller.add(boltHead);
      }

      // 4. Anodized Red 5-Spoke Star Hub
      var hubY = sideSign > 0 ? 0.018 : -0.018;
      var starHub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.026, 0.014, 16),
        matWheelCenter
      );
      starHub.position.y = hubY;
      roller.add(starHub);

      for (var si = 0; si < 5; si++) {
        var sAng = (si / 5) * Math.PI * 2;
        // Star spoke — lies in XZ plane of spinAxle (=wheel face plane after rotation)
        var spoke = new THREE.Mesh(
          new THREE.BoxGeometry(0.010, 0.042, 0.010),
          matWheelCenter
        );
        spoke.position.set(Math.cos(sAng) * 0.032, hubY, Math.sin(sAng) * 0.032);
        spoke.rotation.y = sAng;
        roller.add(spoke);

        // Silver standoff stud from spoke tip to beadlock ring
        var standoffStud = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0035, 0.0035, 0.028, 10),
          matAlloy
        );
        standoffStud.position.set(
          Math.cos(sAng) * 0.058,
          (faceY + hubY) * 0.5,
          Math.sin(sAng) * 0.058
        );
        roller.add(standoffStud);

        // Acorn hex nut on outer beadlock face
        var studNut = new THREE.Mesh(
          new THREE.CylinderGeometry(0.005, 0.005, 0.008, 6),
          matAlloy
        );
        studNut.position.set(
          Math.cos(sAng) * 0.058,
          faceY + (sideSign > 0 ? 0.007 : -0.007),
          Math.sin(sAng) * 0.058
        );
        roller.add(studNut);
      }

      // 5. Central Hub Drive Nut with 5 Wheel Lugs
      for (var wli = 0; wli < 5; wli++) {
        var wlAng = (wli / 5) * Math.PI * 2;
        var centerLug = new THREE.Mesh(
          new THREE.CylinderGeometry(0.003, 0.003, 0.016, 6),
          matAlloy
        );
        centerLug.position.set(
          Math.cos(wlAng) * 0.015,
          hubY + (sideSign > 0 ? 0.006 : -0.006),
          Math.sin(wlAng) * 0.015
        );
        roller.add(centerLug);
      }

      var centerDriveNut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.009, 0.009, 0.016, 6),
        matDarkAlloy
      );
      centerDriveNut.position.y = hubY + (sideSign > 0 ? 0.007 : -0.007);
      roller.add(centerDriveNut);

      // Inner Drive Mount Coupling (inner wheel face side)
      var innerDriveMount = new THREE.Mesh(
        new THREE.CylinderGeometry(0.048, 0.054, 0.020, 24),
        matDarkAlloy
      );
      innerDriveMount.position.y = -faceY * 0.85;
      roller.add(innerDriveMount);

      // 6. 16 Chevron Regolith Cleats on tread — in spinAxle space, X is radial
      var numCleats = 16;
      for (var ci = 0; ci < numCleats; ci++) {
        var cAng = (ci / numCleats) * Math.PI * 2;
        var cleatGroup = new THREE.Group();
        cleatGroup.rotation.y = cAng;

        var cleatL = new THREE.Mesh(
          new THREE.BoxGeometry(0.010, 0.012, 0.034),
          matAlloy
        );
        cleatL.position.set(0.108, 0, 0.016);
        cleatL.rotation.y = 0.26;

        var cleatR = new THREE.Mesh(
          new THREE.BoxGeometry(0.010, 0.012, 0.034),
          matAlloy
        );
        cleatR.position.set(0.108, 0, -0.016);
        cleatR.rotation.y = -0.26;

        cleatGroup.add(cleatL, cleatR);
        roller.add(cleatGroup);
      }

      wg.add(spinAxle);

      // -----------------------------------------------------------------------
      // SEALED BRUSHLESS MOTOR CANISTER — mounted inboard under each wheel hub
      // Positioned on the inner face of the wheel, between hub and chassis
      // -----------------------------------------------------------------------
      var motorBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.024, 0.065, 20),
        matDarkAlloy
      );
      motorBody.rotation.x = Math.PI / 2;
      motorBody.position.set(0, 0.006, -sideSign * 0.068); // inner face, below hub center
      motorBody.castShadow = true;
      wg.add(motorBody);

      // Gold MLI thermal boot wrap around motor can
      var motorMliWrap2 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0245, 0.0245, 0.046, 16),
        matGoldFoil
      );
      motorMliWrap2.rotation.x = Math.PI / 2;
      motorMliWrap2.position.set(0, 0.006, -sideSign * 0.068);
      wg.add(motorMliWrap2);

      // Hermetic planetary gearbox snout (between motor and drive mount)
      var gearSnout = new THREE.Mesh(
        new THREE.CylinderGeometry(0.020, 0.020, 0.028, 18),
        matAlloy
      );
      gearSnout.rotation.x = Math.PI / 2;
      gearSnout.position.set(0, 0.006, -sideSign * 0.033);
      wg.add(gearSnout);

      // Ferrofluidic Regolith Exclusion Seal Ring at axle exit
      var ferroSeal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.017, 0.017, 0.008, 16),
        matDustSeal
      );
      ferroSeal.rotation.x = Math.PI / 2;
      ferroSeal.position.set(0, 0.006, -sideSign * 0.017);
      wg.add(ferroSeal);

      root.add(wg);

      wheels.push(tire);
      wheelGroups.push({
        group: wg,
        tire: tire,
        lowerEye: lowerEye,
        id: wd.id,
        localPos: new THREE.Vector3(wd.x, 0.09, wd.z),
        baseZ: wd.z
      });
    });

    // Six dampers, eye-to-eye 90 mm at ride height. Upper eye is fixed on the tub.
    var shockLinks = [];
    wheelGroups.forEach(function (wgData) {
      var lx = wgData.localPos.x;
      var lz = wgData.localPos.z;
      var sideSign = lz >= 0 ? 1 : -1;
      var upperEye = new THREE.Object3D();
      upperEye.position.set(lx, 0.18, lz - sideSign * 0.02);
      root.add(upperEye);
      var shock = new THREE.Group();
      shock.name = 'shock-' + wgData.id;
      var eyeTop = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0022, 6, 12), matAlloy);
      eyeTop.position.y = 0.045;
      var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0032, 0.09, 8), matAlloy);
      var damper = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.05, 14), matDarkAlloy);
      damper.position.y = -0.01;
      // Hermetic Dust-Exclusion Flexible Accordion Bellows Boot (Abrasive Regolith Barrier)
      var dustBoot = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.038, 12), matDustSeal);
      dustBoot.position.y = 0.022;
      var eyeBot = new THREE.Mesh(new THREE.TorusGeometry(0.007, 0.002, 6, 12), matDarkAlloy);
      eyeBot.position.y = -0.045;
      shock.add(eyeTop, shaft, dustBoot, damper, eyeBot);
      var coils = [];
      for (var sc = 0; sc < 6; sc++) {
        var coil = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.0018, 5, 12), matAlloy);
        coil.rotation.x = Math.PI / 2;
        coil.position.y = -0.028 + sc * 0.008;
        shock.add(coil);
        coils.push(coil);
      }
      root.add(shock);
      shockLinks.push({
        shock: shock,
        upper: upperEye,
        lower: wgData.lowerEye,
        rest: 0.09,
        coils: coils
      });
    });
    global.shockLinks = shockLinks;

    // =========================================================================
    // 5. INTERNAL AVIONICS BAY (VISIBLE IN EXPLODED VIEW)
    // =========================================================================
    var internalsGroup = new THREE.Group();
    internalsGroup.position.set(0, 0.14, 0); // Lowered for CoG: electronics inside lower chassis tub
    root.add(internalsGroup);

    // Gold Kapton Thermal MLI Deck Tray
    var tray = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.010, 0.44), matGoldFoil);
    tray.position.set(0, 0, 0);
    internalsGroup.add(tray);

    // Straight duct, front (+X) to rear. Intake air hits the boards first.
    // Battery sits low on the centerline, aft of the boards, under that stream.
    var bom = global.NASA_RoverBOM;
    var batSpec = bom ? bom.byId('battery') : null;
    var piSpec = bom ? bom.byId('pi5') : null;
    var unoSpec = bom ? bom.byId('uno') : null;
    var buckSpec = bom ? bom.byId('buck') : null;
    var drvSpec = bom ? bom.byId('driver') : null;
    var fanSpec = bom ? bom.byId('fan') : null;

    // (A) GOLDENMATE 12V 10Ah — 151 × 94 × 65 mm, low and centered
    var batGroup = new THREE.Group();
    batGroup.position.set(-0.06, 0.047, 0);
    internalsGroup.add(batGroup);
    var batMesh = new THREE.Mesh(
      new THREE.BoxGeometry(batSpec ? batSpec.size[0] : 0.151, batSpec ? batSpec.size[1] : 0.094, batSpec ? batSpec.size[2] : 0.065),
      new THREE.MeshStandardMaterial({ map: batTex, roughness: 0.35, metalness: 0.20 })
    );
    batMesh.castShadow = true;
    batGroup.add(batMesh);
    var posPost = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.012, 10), matWireRed);
    posPost.position.set(0.05, 0.050, 0.016);
    var negPost = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.012, 10), matWireBlk);
    negPost.position.set(0.05, 0.050, -0.016);
    var batStrap = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.100, 0.070), matDarkAlloy);
    batGroup.add(posPost, negPost, batStrap);

    // (B) Pi 5 + kit active cooler, first in the intake stream
    var piGroup = new THREE.Group();
    piGroup.position.set(0.18, 0.020, -0.05);
    internalsGroup.add(piGroup);
    var piPcb = new THREE.Mesh(
      new THREE.BoxGeometry(piSpec ? piSpec.size[0] : 0.090, 0.006, piSpec ? piSpec.size[2] : 0.062),
      new THREE.MeshStandardMaterial({ map: piTex, roughness: 0.38, metalness: 0.30 })
    );
    piGroup.add(piPcb);
    var coolerSink = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.016, 0.040), matAlloy);
    coolerSink.position.set(-0.008, 0.014, 0);
    piGroup.add(coolerSink);
    var piBlower = new THREE.Group();
    piBlower.position.set(0.012, 0.018, 0);
    var piRotor = new THREE.Group();
    piRotor.userData.spin = 'y';
    for (var pf = 0; pf < 7; pf++) {
      var pBlade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.003, 0.002), matDarkAlloy);
      var pAng = (pf / 7) * Math.PI * 2;
      pBlade.position.set(Math.cos(pAng) * 0.008, 0.002, Math.sin(pAng) * 0.008);
      pBlade.rotation.y = pAng;
      piRotor.add(pBlade);
    }
    piBlower.add(piRotor);
    piGroup.add(piBlower);
    var usbPorts = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.012, 0.014), matArtemisBlue);
    usbPorts.position.set(0.040, 0.010, -0.016);
    piGroup.add(usbPorts);

    // (C) Arduino Uno REV3, beside the Pi in the same stream
    var unoGroup = new THREE.Group();
    unoGroup.position.set(0.16, 0.012, 0.07);
    internalsGroup.add(unoGroup);
    var unoMesh = new THREE.Mesh(
      new THREE.BoxGeometry(unoSpec ? unoSpec.size[0] : 0.0686, unoSpec ? unoSpec.size[1] : 0.015, unoSpec ? unoSpec.size[2] : 0.0534),
      new THREE.MeshStandardMaterial({ map: unoTex, roughness: 0.35, metalness: 0.25 })
    );
    unoGroup.add(unoMesh);
    var usbBPort = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.010, 0.012), matAlloy);
    usbBPort.position.set(-0.028, 0.008, -0.012);
    var barrelJack = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.010, 0.010), matDarkAlloy);
    barrelJack.position.set(-0.028, 0.008, 0.012);
    var unoLed = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.003, 0.004), matGreenLed);
    unoLed.position.set(-0.004, 0.008, -0.006);
    unoGroup.add(usbBPort, barrelJack, unoLed);

    // (D) Buck converter, downstream of the boards
    var buckGroup = new THREE.Group();
    buckGroup.position.set(0.05, 0.014, 0.10);
    internalsGroup.add(buckGroup);
    var buckMesh = new THREE.Mesh(
      new THREE.BoxGeometry(buckSpec ? buckSpec.size[0] : 0.066, buckSpec ? buckSpec.size[1] : 0.018, buckSpec ? buckSpec.size[2] : 0.036),
      new THREE.MeshStandardMaterial({ map: buckTex, roughness: 0.35, metalness: 0.70 })
    );
    buckGroup.add(buckMesh);
    for (var bf = -1; bf <= 1; bf++) {
      var bFin = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.003, 0.038), matAlloy);
      bFin.position.y = 0.012 + bf * 0.004;
      buckGroup.add(bFin);
    }

    // (E) Motor driver, still in the duct, ahead of the battery
    var cytronGroup = new THREE.Group();
    cytronGroup.position.set(0.04, 0.012, -0.11);
    internalsGroup.add(cytronGroup);
    var cytronPcb = new THREE.Mesh(
      new THREE.BoxGeometry(drvSpec ? drvSpec.size[0] : 0.095, 0.005, drvSpec ? drvSpec.size[2] : 0.065),
      matArtemisBlue
    );
    var cytronSink = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.014, 0.036), matDarkAlloy);
    cytronSink.position.y = 0.010;
    cytronGroup.add(cytronPcb, cytronSink);

    // =========================================================================
    // SPACE-GRADE THERMAL CONTROL SYSTEM (TCS) — VACUUM HEAT-PIPE RADIATORS
    // Replaces terrestrial open-air vents with hermetic loop heat pipes (LHP)
    // and side-mounted deployable/bimetallic thermal louvers & cold plates.
    // =========================================================================
    // Solid Aluminum-Silicon Cold-Plate Deck Heat Bus
    var coldPlateBus = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.008, 0.40), matAlloy);
    coldPlateBus.position.set(0.12, 0.006, 0);
    internalsGroup.add(coldPlateBus);

    // Loop Heat Pipe (LHP) Ammonia/Methanol Transfer Lines to Side Radiators
    [-0.18, 0.18].forEach(function (pipeZ) {
      var lhpLine = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.36, 12), matBrass);
      lhpLine.rotation.z = Math.PI / 2;
      lhpLine.position.set(0.12, 0.016, pipeZ);
      internalsGroup.add(lhpLine);
    });

    // Dual External Surface Thermal Radiators (Optical Solar Reflector OSR Quartz Panels)
    [-1, 1].forEach(function (sideSign) {
      var radGroup = new THREE.Group();
      radGroup.position.set(0.12, 0.170, sideSign * 0.264);

      // Radiator Baseplate (High-Emissivity Ceramic Coating)
      var radPanel = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.082, 0.008), matRadiator);
      radGroup.add(radPanel);

      // Passive Bimetallic Thermal Louver Slats (Modulate heat radiation to deep space)
      for (var lvi = 0; lvi < 8; lvi++) {
        var louverBlade = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.070, 0.002), matAlloy);
        louverBlade.position.set(-0.12 + lvi * 0.034, 0, 0.006);
        louverBlade.rotation.y = 0.25; // angled open towards deep space
        radGroup.add(louverBlade);
      }

      // Hermetic Flange Seal around Radiator Housing
      var radGasket = new THREE.Mesh(new THREE.BoxGeometry(0.328, 0.090, 0.004), matDustSeal);
      radGasket.position.set(0, 0, -0.004);
      radGroup.add(radGasket);

      root.add(radGroup);
    });

    // Internal Closed-Loop Avionics Circulation Impeller (Hermetic Gas Heat Exchanger)
    var fRotor = new THREE.Group();
    fRotor.userData.spin = 'y';
    for (var fb = 0; fb < 6; fb++) {
      var blade = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.003, 0.002), matAlloy);
      var bAng = (fb / 6) * Math.PI * 2;
      blade.position.set(Math.cos(bAng) * 0.008, 0.002, Math.sin(bAng) * 0.008);
      blade.rotation.y = bAng;
      fRotor.add(blade);
    }
    fanRotors.push(fRotor);
    fanRotors.push(piRotor);

    // =========================================================================
    // 6. TWO CHAMBERS — avionics lid lifts; cargo bay stays on the chassis
    // =========================================================================
    var upperShellGroup = new THREE.Group();
    root.add(upperShellGroup);

    // Avionics lid only. Shell-open lifts this group, not the cargo.
    var avionicsLid = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.028, 0.50),
      matChassis
    );
    avionicsLid.position.set(0.20, 0.255, 0);
    avionicsLid.castShadow = true;
    upperShellGroup.add(avionicsLid);
    // Continuous Hermetic Bulkhead Barrier & Compression Seal
    var bulkhead = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.16, 0.50), matDarkAlloy);
    bulkhead.position.set(0.0, 0.20, 0);
    var bulkheadSeal = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.164, 0.504), matDustSeal);
    bulkheadSeal.position.set(0.0, 0.20, 0);
    root.add(bulkheadSeal, bulkhead);

    // =========================================================================
    // ACTIVE COG LINEAR TRIM SLIDE (±20cm Ball-Screw Travel Stage)
    // Adjusts cargo mass over center axle to prevent 1/6g pitch-over and maintain
    // equal traction across all 6 wheels.
    // =========================================================================
    var cogTrimStage = new THREE.Group();
    cogTrimStage.position.set(0, 0.198, 0);
    root.add(cogTrimStage);

    // Dual Linear Hardened Steel Guide Rails & Central Ball-Screw
    [-0.18, 0.18].forEach(function (rz) {
      var guideRail = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.44, 16), matAlloy);
      guideRail.rotation.z = Math.PI / 2;
      guideRail.position.set(-0.20, 0, rz);
      cogTrimStage.add(guideRail);
    });
    var ballScrew = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.42, 16), matBrass);
    ballScrew.rotation.z = Math.PI / 2;
    ballScrew.position.set(-0.20, 0, 0);
    var cogTrimMotor = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.040, 16), matDarkAlloy);
    cogTrimMotor.rotation.z = Math.PI / 2;
    cogTrimMotor.position.set(0.02, 0, 0);
    cogTrimStage.add(ballScrew, cogTrimMotor);

    // Cargo Bed / Payload Pallet Carrier (Traverses along X-axis via CoG trim)
    var cargoBayGroup = new THREE.Group();
    cargoBayGroup.position.set(-0.22, 0.208, 0);
    root.add(cargoBayGroup);

    // Hardened Titanium Floor with Integrated Thermal Blanket Base
    var bayFloor = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.012, 0.44), matDarkAlloy);
    bayFloor.receiveShadow = true;
    cargoBayGroup.add(bayFloor);

    // POWERED BI-DIRECTIONAL ROLLER BED (Automated Handoff from Container Dust-Lock)
    var rollerCount = 7;
    for (var ri = 0; ri < rollerCount; ri++) {
      var rollerX = -0.16 + (ri / (rollerCount - 1)) * 0.32;
      var roller = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.41, 16), matAlloy);
      roller.rotation.x = Math.PI / 2;
      roller.position.set(rollerX, 0.010, 0);
      cargoBayGroup.add(roller);
      // Roller End Bearings
      [-0.208, 0.208].forEach(function (bz) {
        var bearing = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.006, 12), matArtemisBlue);
        bearing.rotation.x = Math.PI / 2;
        bearing.position.set(rollerX, 0.010, bz);
        cargoBayGroup.add(bearing);
      });
    }

    // 4 Corner Electromechanical ISO Twist-Locks (Clamp Lockers/Pallets in 1/6g)
    [
      { x: -0.17, z: -0.19 }, { x: 0.17, z: -0.19 },
      { x: -0.17, z: 0.19 },  { x: 0.17, z: 0.19 }
    ].forEach(function (lockPos) {
      var lockBase = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.028, 0.024), matDarkAlloy);
      lockBase.position.set(lockPos.x, 0.018, lockPos.z);
      var twistLug = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.012, 0.016), matBrass);
      twistLug.position.set(lockPos.x, 0.034, lockPos.z);
      twistLug.rotation.y = 0.78; // engaged 45-deg locking position
      cargoBayGroup.add(lockBase, twistLug);
    });

    // Aft Docking Alignment Collar & Dust Seal Latch (Mates to 3m Container Pass-Through Gate)
    var dockCollar = new THREE.Group();
    dockCollar.position.set(-0.205, 0.014, 0);
    var dockFrame = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.034, 0.44), matArtemisBlue);
    var dockMagneticGasket = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.030, 0.43), matDustSeal);
    dockMagneticGasket.position.set(-0.011, 0, 0);
    dockCollar.add(dockFrame, dockMagneticGasket);
    // 2 Conical Docking Guide Pins
    [-0.17, 0.17].forEach(function (pz) {
      var guidePin = new THREE.Mesh(new THREE.ConeGeometry(0.010, 0.026, 16), matAlloy);
      guidePin.rotation.z = Math.PI / 2;
      guidePin.position.set(-0.022, 0, pz);
      dockCollar.add(guidePin);
    });
    cargoBayGroup.add(dockCollar);

    // Beveled Cargo Bay Flank Retaining Walls
    var wallL = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.16, 0.016), matChassis);
    wallL.position.set(0, 0.08, 0.212);
    var wallR = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.16, 0.016), matChassis);
    wallR.position.set(0, 0.08, -0.212);
    var wallFront = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.16, 0.44), matChassis);
    wallFront.position.set(0.192, 0.08, 0);

    // AFT WALL — closes the open aft face of the cargo bay (docking port side)
    // The docking collar mates here; this wall has a central rectangular cut-out
    // sized to the docking collar opening. For the static model, represented as
    // two side pillars flanking the collar opening.
    var aftPillarL = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.16, 0.10), matChassis);
    aftPillarL.position.set(-0.196, 0.08, 0.165);
    var aftPillarR = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.16, 0.10), matChassis);
    aftPillarR.position.set(-0.196, 0.08, -0.165);
    var aftHeaderBeam = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.028, 0.44), matChassis);
    aftHeaderBeam.position.set(-0.196, 0.148, 0); // top beam above collar opening
    var aftSillBeam = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.020, 0.44), matChassis);
    aftSillBeam.position.set(-0.196, -0.002, 0); // bottom sill
    cargoBayGroup.add(wallL, wallR, wallFront, aftPillarL, aftPillarR, aftHeaderBeam, aftSillBeam);

    // =========================================================================
    // BI-FOLD TRAVEL HATCH — Regolith-Exclusion Cargo Bay Lid
    // Two panel halves slide/fold outward in Z. When closed (travel mode) they
    // cover the full top aperture and seal against a center Viton compression strip.
    // Geometry shown in CLOSED (travel-ready) position.
    // =========================================================================
    var hatchPanelMat = new THREE.MeshStandardMaterial({
      color: 0x1e2430,
      roughness: 0.28,
      metalness: 0.75
    });

    // Panel half +Z (left when looking aft)
    var hatchPanelPos = new THREE.Mesh(
      new THREE.BoxGeometry(0.385, 0.010, 0.205),
      hatchPanelMat
    );
    hatchPanelPos.position.set(0, 0.165, 0.106); // sits on top of walls
    hatchPanelPos.castShadow = true;
    cargoBayGroup.add(hatchPanelPos);

    // Panel half -Z (right when looking aft)
    var hatchPanelNeg = new THREE.Mesh(
      new THREE.BoxGeometry(0.385, 0.010, 0.205),
      hatchPanelMat
    );
    hatchPanelNeg.position.set(0, 0.165, -0.106);
    hatchPanelNeg.castShadow = true;
    cargoBayGroup.add(hatchPanelNeg);

    // Center Viton Compression Seal Strip (between the two panels, dark charcoal)
    var centerSealStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.385, 0.012, 0.008),
      matDustSeal
    );
    centerSealStrip.position.set(0, 0.164, 0); // between panel edges
    cargoBayGroup.add(centerSealStrip);

    // Perimeter Viton Seal Gasket — inner lip of each panel edge against walls
    // Port wall inner seal
    var sealPort = new THREE.Mesh(new THREE.BoxGeometry(0.385, 0.006, 0.006), matDustSeal);
    sealPort.position.set(0, 0.161, 0.203);
    cargoBayGroup.add(sealPort);
    // Starboard wall inner seal
    var sealStbd = new THREE.Mesh(new THREE.BoxGeometry(0.385, 0.006, 0.006), matDustSeal);
    sealStbd.position.set(0, 0.161, -0.203);
    cargoBayGroup.add(sealStbd);

    // Central Twist-Latch Bar (locks two panels closed during transit)
    var latchBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.060, 0.010, 0.018),
      matAlloy
    );
    latchBar.position.set(0, 0.172, 0);
    cargoBayGroup.add(latchBar);

    // Actuator Handle Recesses (4 positions — 2 per panel, for gloved EVA hand actuation)
    var hatchLatchHandles = [];
    [-0.14, 0.14].forEach(function(hx) {
      [0.095, -0.095].forEach(function(hz) {
        var latchHandle = new THREE.Mesh(
          new THREE.BoxGeometry(0.040, 0.014, 0.014),
          matBrass
        );
        latchHandle.position.set(hx, 0.168, hz);
        cargoBayGroup.add(latchHandle);
        hatchLatchHandles.push(latchHandle);
      });
    });

    var hatchClosedZ = { pos: 0.106, neg: -0.106 };
    var hatchOpenZ = { pos: 0.26, neg: -0.26 };
    window.cargoBayHatch = {
      panelPos: hatchPanelPos,
      panelNeg: hatchPanelNeg,
      seal: centerSealStrip,
      latchBar: latchBar,
      sealPort: sealPort,
      sealStbd: sealStbd,
      handles: hatchLatchHandles,
      closedZ: hatchClosedZ,
      openZ: hatchOpenZ
    };
    window.cargoBayHatchOpen = 0;
    window.setCargoBayHatch = function (open01) {
      var o = Math.max(0, Math.min(1, open01));
      window.cargoBayHatchOpen = o;
      var h = window.cargoBayHatch;
      if (!h || !h.panelPos) return;
      h.panelPos.position.z = hatchClosedZ.pos + (hatchOpenZ.pos - hatchClosedZ.pos) * o;
      h.panelNeg.position.z = hatchClosedZ.neg + (hatchOpenZ.neg - hatchClosedZ.neg) * o;
      var sealed = o < 0.04;
      if (h.seal) h.seal.visible = sealed;
      if (h.latchBar) h.latchBar.visible = sealed;
      if (h.sealPort) h.sealPort.visible = o < 0.35;
      if (h.sealStbd) h.sealStbd.visible = o < 0.35;
      if (h.handles) {
        for (var hi = 0; hi < h.handles.length; hi++) h.handles[hi].visible = sealed;
      }
    };
    window.setCargoBayHatch(0);

    window.roverHopperContainer = null;
    window.cargoBaySlots = [];
    var podSpec = (global.NASA_RoverBOM && global.NASA_RoverBOM.pod) || null;
    var podH = podSpec ? podSpec.heightM : 0.152;
    var floorTop = 0.020;
    [-0.088, 0.088].forEach(function (zSlot) {
      var slot = new THREE.Object3D();
      slot.position.set(0, floorTop + podH * 0.5, zSlot);
      cargoBayGroup.add(slot);
      var tieA = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.008, 0.012), matBrass);
      tieA.position.set(0, podH * 0.5 + 0.01, 0.07);
      var tieB = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.008, 0.012), matBrass);
      tieB.position.set(0, podH * 0.5 + 0.01, -0.07);
      tieA.visible = false;
      tieB.visible = false;
      slot.add(tieA, tieB);
      slot.userData.ties = [tieA, tieB];
      window.cargoBaySlots.push(slot);
    });

    // =========================================================================
    // 7. ARM — two straight links, same lengths solveArm uses (0.26 m, 0.24 m)
    // =========================================================================
    var L1 = 0.26;
    var L2 = 0.24;
    var armBase = new THREE.Group();
    armBase.position.set(0.18, 0.30, 0.18);
    root.add(armBase);

    var baseTurret = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.03, 16), matDarkAlloy);
    baseTurret.position.y = 0.015;
    armBase.add(baseTurret);

    var shoulder = new THREE.Group();
    shoulder.position.set(0, 0.04, 0);
    armBase.add(shoulder);

    var upperArmLink = new THREE.Mesh(new THREE.BoxGeometry(L1, 0.028, 0.028), matChassisTrim);
    upperArmLink.position.set(L1 * 0.5, 0, 0);
    upperArmLink.castShadow = true;
    shoulder.add(upperArmLink);

    var elbow = new THREE.Group();
    elbow.position.set(L1, 0, 0);
    shoulder.add(elbow);
    var elbowPin = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.036, 12), matBrass);
    elbowPin.rotation.x = Math.PI / 2;
    elbow.add(elbowPin);

    var foreArm = new THREE.Mesh(new THREE.BoxGeometry(L2, 0.024, 0.024), matChassisTrim);
    foreArm.position.set(L2 * 0.5, 0, 0);
    foreArm.castShadow = true;
    elbow.add(foreArm);

    var wrist = new THREE.Group();
    wrist.position.set(L2, 0, 0);
    elbow.add(wrist);
    var gripperCrossbar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.016, 0.02), matAlloy);
    wrist.add(gripperCrossbar);

    var fingerL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.01), matAlloy);
    fingerL.position.set(0.03, 0, 0.055);
    var padL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.008, 0.004), matDarkAlloy);
    padL.position.set(0, 0, -0.007);
    fingerL.add(padL);
    var fingerR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.01), matAlloy);
    fingerR.position.set(0.03, 0, -0.055);
    var padR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.008, 0.004), matDarkAlloy);
    padR.position.set(0, 0, 0.007);
    fingerR.add(padR);
    wrist.add(fingerL, fingerR);

    var tip = new THREE.Object3D();
    tip.position.set(0.03, 0, 0);
    wrist.add(tip);

    // =========================================================================
    // 8. PERCEPTION MAST WITH SPINNING EC BUYING YDLIDAR X2L 360° (Images 1, 2, 3, 4)
    // =========================================================================
    var mastGroup = new THREE.Group();
    mastGroup.position.set(0.28, 0.26, -0.14);
    root.add(mastGroup);

    // Black Anodized Mast Column
    var mastPole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.25, 20), matDarkAlloy);
    mastPole.position.set(0, 0.125, 0);
    mastPole.castShadow = true;
    mastGroup.add(mastPole);

    // Royal Blue Anodized Accent Ring
    var mastRing = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.012, 20), matArtemisBlue);
    mastRing.position.set(0, 0.21, 0);
    mastGroup.add(mastRing);

    // Mast Top Sensor Platform with Gold MLI Trim
    var mastHead = new THREE.Mesh(new THREE.CylinderGeometry(0.050, 0.054, 0.018, 24), matDarkAlloy);
    mastHead.position.set(0, 0.255, 0);
    var mastMli = new THREE.Mesh(new THREE.CylinderGeometry(0.051, 0.051, 0.008, 24), matGoldFoil);
    mastMli.position.set(0, 0.250, 0);
    mastGroup.add(mastHead, mastMli);

    // Hermetically Enclosed YDLIDAR 360° Laser Range Scanner with Sealed Protective Dome
    var lidarHead = new THREE.Group();
    lidarHead.position.set(0, 0.285, 0);
    mastGroup.add(lidarHead);

    var lidarPuck = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.044, 0.038, 24), matDarkAlloy);
    lidarPuck.castShadow = true;
    lidarHead.add(lidarPuck);

    // Rotary Dust-Wiper Lip Seal Ring at Base of Scanner
    var wiperRing = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.003, 8, 24), matDustSeal);
    wiperRing.rotation.x = Math.PI / 2;
    wiperRing.position.set(0, -0.018, 0);
    lidarHead.add(wiperRing);

    // Dual Laser Emitter & Receiver Lenses inside Hermetic Optical Window
    [-0.014, 0.014].forEach(function (lz) {
      var lOptic = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.014, 16), matLens);
      lOptic.rotation.z = Math.PI / 2;
      lOptic.position.set(0.038, 0, lz);
      lidarHead.add(lOptic);
    });

    // Space-Hardened Long-Wave Infrared (LWIR) Stereo Thermal + Optical Navigation Enclosure
    // Enables autonomous obstacle mapping inside Permanently Shadowed Regions (PSRs)
    [-0.018, 0.018].forEach(function (cz, ci) {
      var navCam = new THREE.Group();
      navCam.position.set(0.046, 0.23, cz);
      var camHousing = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 0.016), matDarkAlloy);
      var thermalGermaniumLens = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.014, 14), matAmber);
      thermalGermaniumLens.rotation.z = Math.PI / 2;
      thermalGermaniumLens.position.x = 0.012;
      var opticalSapphireLens = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.016, 12), matLens);
      opticalSapphireLens.rotation.z = Math.PI / 2;
      opticalSapphireLens.position.set(0.012, 0.007, 0);
      var camSealGasket = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.030, 0.003), matDustSeal);
      camSealGasket.position.x = -0.007;
      navCam.add(camHousing, thermalGermaniumLens, opticalSapphireLens, camSealGasket);
      mastGroup.add(navCam);
      if (ci === 0 && global.piCamera) {
        navCam.add(global.piCamera);
        global.piCamera.position.set(0.04, 0.01, 0);
        global.piCamera.rotation.set(-0.16, -Math.PI / 2, 0);
      }
    });

    // RFID & Ultra-Wideband (UWB) Cargo Tracking Interrogator Gate Antenna (Mission 6, 8, 18)
    var rfidInterrogator = new THREE.Group();
    rfidInterrogator.position.set(-0.02, 0.25, 0.05);
    var rfidDome = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.028, 16), matArtemisBlue);
    var rfidBase = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.006, 0.036), matDarkAlloy);
    rfidInterrogator.add(rfidDome, rfidBase);
    mastGroup.add(rfidInterrogator);

    // =========================================================================
    // 9. FRONT FACE PERCEPTION APERTURES & HEADLIGHTS (Hermetically Sealed Optics)
    // =========================================================================
    var rectAperture = new THREE.Group();
    rectAperture.position.set(0.432, 0.138, 0.10);
    var rectFrame = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.045, 0.095), matDarkAlloy);
    var rectSeal = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.047, 0.097), matDustSeal);
    var rectGlass = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.035, 0.082), matLens);
    rectAperture.add(rectSeal, rectFrame, rectGlass);
    root.add(rectAperture);

    var circAperture = new THREE.Group();
    circAperture.position.set(0.432, 0.138, -0.10);
    var circFrame = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.014, 16), matDarkAlloy);
    circFrame.rotation.z = Math.PI / 2;
    var circSeal = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.006, 16), matDustSeal);
    circSeal.rotation.z = Math.PI / 2;
    circSeal.position.x = -0.004;
    var circMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.016, 16), matAlloy);
    circMesh.rotation.z = Math.PI / 2;
    circAperture.add(circSeal, circFrame, circMesh);
    root.add(circAperture);

    // Front Push Bumper & Dual Recovery Tow Shackles
    var frontBumper = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 0.58), matAlloy);
    frontBumper.position.set(0.445, 0.115, 0);
    frontBumper.castShadow = true;
    root.add(frontBumper);

    [-0.18, 0.18].forEach(function (shz) {
      var shackle = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 8, 16), matAmber);
      shackle.rotation.y = Math.PI / 2;
      shackle.position.set(0.470, 0.115, shz);
      root.add(shackle);
    });

    // Dual Forward High-Intensity LED Headlights
    [-0.21, 0.21].forEach(function (hz) {
      var hlBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.024, 16), matDarkAlloy);
      hlBezel.rotation.z = Math.PI / 2;
      hlBezel.position.set(0.438, 0.145, hz);
      var hlEmitter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.026, 16),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffeedd, emissiveIntensity: 2.0 })
      );
      hlEmitter.rotation.z = Math.PI / 2;
      hlEmitter.position.set(0.440, 0.145, hz);
      root.add(hlBezel, hlEmitter);

      var spot = new THREE.SpotLight(0xffeedd, 2.5, 25, Math.PI / 5, 0.4, 1.5);
      spot.position.set(0.46, 0.15, hz);
      var spotTarget = new THREE.Object3D();
      spotTarget.position.set(5.0, -0.4, hz);
      root.add(spotTarget);
      spot.target = spotTarget;
      root.add(spot);
      headlights.push(spot);
    });

    // Rear 5-Segment BMS State-of-Charge LED Bar & Sealed EVA E-Stop Button
    for (var lb = 0; lb < 5; lb++) {
      var ledSeg = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.008, 0.026), matGreenLed);
      ledSeg.position.set(-0.38, 0.28, -0.08 + lb * 0.04);
      upperShellGroup.add(ledSeg);
    }
    // Hermetic Flexible Silicone Bellows Boot over E-Stop with Titanium Retaining Ring
    var eStopBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.008, 16), matDarkAlloy);
    eStopBezel.position.set(-0.36, 0.278, 0.16);
    var eStopSeal = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.003, 8, 16), matDustSeal);
    eStopSeal.rotation.x = Math.PI / 2;
    eStopSeal.position.set(-0.36, 0.282, 0.16);
    var eStopBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.016, 0.020, 16), matWireRed);
    eStopBtn.position.set(-0.36, 0.292, 0.16);
    upperShellGroup.add(eStopBezel, eStopSeal, eStopBtn);

    // =========================================================================
    // EXPOSE HANDLES TO SIMULATOR RUNTIME & PHYSICS
    // =========================================================================
    global.lidarHead = lidarHead;
    global.fanRotors = fanRotors;
    global.upperShellGroup = upperShellGroup;
    global.internalsGroup = internalsGroup;
    global.headlights = headlights;
    global.cargoBayGroup = cargoBayGroup;
    window.cargoBayGroup = cargoBayGroup;
    window.roverArm = {
      base: armBase,
      shoulder: shoulder,
      elbow: elbow,
      wrist: wrist,
      gripper: wrist,
      fingerL: fingerL,
      fingerR: fingerR,
      tip: tip,
      L1: L1,
      L2: L2
    };

    return Promise.resolve(root);
  }

  global.NASA_FusionRover = {
    init: initFusionRover,
    loadManifest: function () {
      return Promise.resolve({
        roverRadius: 0.35,
        modelCenter: { x: 0, y: 0, z: 0 }
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
