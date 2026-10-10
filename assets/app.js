/* DeadFile — Coming Soon
   - Three.js "encrypted data stream" background
   - Logo 3D tilt + periodic glitch
   - Text scramble / decrypt effects */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var COLORS = { bg: 0x050b18, gold: 0xf6c234, green: 0x1fd17f, slate: 0x4a5d80, slateLight: 0x6f84a8 };

  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Pointer tracking (shared) ---------- */
  var pointer = { x: 0, y: 0 };
  window.addEventListener("pointermove", function (e) {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  /* ---------- Glitch bus: logo + 3D scene glitch together ---------- */
  var glitchListeners = [];
  function triggerGlitch() {
    glitchListeners.forEach(function (fn) { fn(); });
  }

  /* ---------- Logo: settle after intro, tilt, periodic glitch ---------- */
  var logo = document.getElementById("logo");
  var tilt = document.getElementById("logoTilt");

  if (logo) {
    var settle = function () { logo.classList.add("ready"); };
    if (reduceMotion) settle();
    else setTimeout(settle, 2050); // 0.35s delay + 1.6s intro

    glitchListeners.push(function () {
      if (!logo.classList.contains("ready")) return;
      logo.classList.remove("glitching");
      void logo.offsetWidth; // restart animation
      logo.classList.add("glitching");
      setTimeout(function () { logo.classList.remove("glitching"); }, 450);
    });
  }

  if (tilt && !reduceMotion) {
    var rx = 0, ry = 0;
    var t0 = performance.now();
    (function loop(now) {
      var t = (now - t0) / 1000;
      var tx = -pointer.y * 12;
      var ty = pointer.x * 16;
      rx += (tx - rx) * 0.06;
      ry += (ty - ry) * 0.06;
      var float = Math.sin(t * 1.1) * 6;
      var drift = Math.sin(t * 0.5) * 3;
      tilt.style.transform =
        "translateY(" + float.toFixed(2) + "px) rotateX(" + (rx + drift).toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg)";
      requestAnimationFrame(loop);
    })(t0);
  }

  if (!reduceMotion) {
    (function schedule() {
      setTimeout(function () { triggerGlitch(); schedule(); }, 4200 + Math.random() * 4200);
    })();
  }

  /* ---------- Text scramble / decrypt ---------- */
  var GLYPHS = "ABCDEF0123456789#$%&*+=/<>[]{}";

  function scramble(el, delayMs, durationMs) {
    var finalText = el.textContent;
    if (reduceMotion) return;
    var start = null;
    var len = finalText.length;
    // Each character resolves at a staggered moment
    var resolveAt = [];
    for (var i = 0; i < len; i++) resolveAt.push((i / len) * 0.7 + Math.random() * 0.3);

    function frame(now) {
      if (start === null) start = now;
      var p = Math.min((now - start) / durationMs, 1);
      var out = "";
      for (var i = 0; i < len; i++) {
        var c = finalText[i];
        if (c === " " || p >= resolveAt[i]) out += c;
        else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = finalText;
    }

    el.textContent = finalText.replace(/\S/g, function () { return GLYPHS[(Math.random() * GLYPHS.length) | 0]; });
    setTimeout(function () { requestAnimationFrame(frame); }, delayMs);
  }

  document.querySelectorAll("[data-scramble]").forEach(function (el) {
    var d = parseFloat(getComputedStyle(el).animationDelay) || 0;
    scramble(el, d * 1000, el.classList.contains("wordmark") ? 1400 : 1100);
  });

  /* ---------- "What we see" ciphertext ticker ---------- */
  var cipher = document.getElementById("cipher");
  if (cipher && !reduceMotion) {
    var HEX = "0123456789abcdef";
    var block = function () {
      var s = "";
      for (var i = 0; i < 4; i++) s += HEX[(Math.random() * 16) | 0];
      return s;
    };
    setInterval(function () {
      var parts = [];
      for (var i = 0; i < 6; i++) parts.push(block());
      cipher.textContent = parts.join("·");
    }, 90);
  }

  /* ---------- Three.js background ---------- */
  function initScene() {
    if (typeof THREE === "undefined") return;
    var canvas = document.getElementById("bg");
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch (err) {
      return; // CSS gradient background remains
    }

    var isSmall = window.innerWidth < 700;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.setClearColor(COLORS.bg, 0);

    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(COLORS.bg, 0.04);

    var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 0.6, 8);

    /* Soft round sprite for particles */
    var spriteCanvas = document.createElement("canvas");
    spriteCanvas.width = spriteCanvas.height = 64;
    var sctx = spriteCanvas.getContext("2d");
    var grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.25, "rgba(255,255,255,0.8)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 64, 64);
    var sprite = new THREE.CanvasTexture(spriteCanvas);

    /* Data stream particles flowing toward the camera */
    var N = isSmall ? 900 : 2000;
    var Z_NEAR = 8, Z_FAR = -60, SPAN = Z_NEAR - Z_FAR;
    var positions = new Float32Array(N * 3);
    var colors = new Float32Array(N * 3);
    var speeds = new Float32Array(N);
    var palette = [
      new THREE.Color(COLORS.gold),
      new THREE.Color(COLORS.green),
      new THREE.Color(COLORS.slateLight),
      new THREE.Color(COLORS.slateLight),
      new THREE.Color(0xcfd8ea)
    ];
    for (var i = 0; i < N; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 26;
      positions[i * 3 + 2] = Z_FAR + Math.random() * SPAN;
      var c = palette[(Math.random() * palette.length) | 0];
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      speeds[i] = 1.2 + Math.random() * 2.8;
    }
    var pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    pGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    var pMat = new THREE.PointsMaterial({
      size: 0.14,
      map: sprite,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    var particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    /* Scrolling grid floor */
    var grid = new THREE.GridHelper(140, 70, COLORS.green, COLORS.slate);
    grid.material.transparent = true;
    grid.material.opacity = 0.22;
    grid.position.y = -4.5;
    scene.add(grid);
    var GRID_CELL = 140 / 70;

    /* Vault-dial rings far behind the content */
    var vault = new THREE.Group();
    vault.position.set(0, 0.5, -16);
    var ringDefs = [
      { r: 7.5, color: COLORS.gold, opacity: 0.35, tilt: [0.2, 0, 0] },
      { r: 9.2, color: COLORS.green, opacity: 0.22, tilt: [-0.35, 0.3, 0] },
      { r: 11.2, color: COLORS.slateLight, opacity: 0.25, tilt: [0.1, -0.4, 0] }
    ];
    var rings = ringDefs.map(function (d) {
      var m = new THREE.Mesh(
        new THREE.TorusGeometry(d.r, 0.025, 8, 220),
        new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: d.opacity })
      );
      m.rotation.set(d.tilt[0], d.tilt[1], d.tilt[2]);
      m.userData.baseOpacity = d.opacity;
      vault.add(m);
      return m;
    });
    // Bolts around the inner ring, like the vault door in the logo
    var boltGeo = new THREE.SphereGeometry(0.09, 10, 10);
    var boltMat = new THREE.MeshBasicMaterial({ color: COLORS.gold, transparent: true, opacity: 0.8 });
    for (var b = 0; b < 12; b++) {
      var a = (b / 12) * Math.PI * 2;
      var bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.position.set(Math.cos(a) * 7.5, Math.sin(a) * 7.5, 0);
      rings[0].add(bolt);
    }
    scene.add(vault);

    /* Floating wireframe "files" — sealed shards drifting at the edges */
    var shapes = [];
    var shapeGeos = [
      new THREE.IcosahedronGeometry(0.7, 0),
      new THREE.OctahedronGeometry(0.65, 0),
      new THREE.BoxGeometry(0.8, 1.0, 0.12),   // a document
      new THREE.TetrahedronGeometry(0.6, 0),
      new THREE.BoxGeometry(0.9, 0.9, 0.9)
    ];
    var shapeCount = isSmall ? 5 : 9;
    for (var s = 0; s < shapeCount; s++) {
      var geo = shapeGeos[s % shapeGeos.length];
      var col = [COLORS.green, COLORS.gold, COLORS.slateLight][s % 3];
      var line = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.45 })
      );
      var side = s % 2 === 0 ? -1 : 1;
      line.position.set(side * (5 + Math.random() * 9), (Math.random() - 0.5) * 8, -4 - Math.random() * 16);
      line.userData = {
        spin: new THREE.Vector3(Math.random() * 0.4, Math.random() * 0.5, Math.random() * 0.3),
        baseY: line.position.y,
        phase: Math.random() * Math.PI * 2
      };
      scene.add(line);
      shapes.push(line);
    }

    /* Glitch response */
    var glitchUntil = 0;
    var clock = new THREE.Clock();
    glitchListeners.push(function () { glitchUntil = clock.getElapsedTime() + 0.28; });

    function onResize() {
      var w = window.innerWidth, h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    window.addEventListener("resize", onResize);

    var camX = 0, camY = 0.6;

    function render() {
      var dt = Math.min(clock.getDelta(), 0.05);
      var t = clock.getElapsedTime();
      var glitching = t < glitchUntil;

      // Particles stream toward the viewer
      var pos = pGeo.attributes.position.array;
      for (var i = 0; i < N; i++) {
        var zi = i * 3 + 2;
        pos[zi] += speeds[i] * dt;
        if (pos[zi] > Z_NEAR) pos[zi] -= SPAN;
      }
      pGeo.attributes.position.needsUpdate = true;

      grid.position.z = (t * 1.6) % GRID_CELL;

      vault.rotation.z = t * 0.05;
      rings[0].rotation.z = t * 0.12;
      rings[1].rotation.z = -t * 0.08;
      rings[1].rotation.x = -0.35 + Math.sin(t * 0.3) * 0.15;
      rings[2].rotation.y = -0.4 + Math.sin(t * 0.2) * 0.2;

      shapes.forEach(function (m) {
        var u = m.userData;
        m.rotation.x += u.spin.x * dt;
        m.rotation.y += u.spin.y * dt;
        m.rotation.z += u.spin.z * dt;
        m.position.y = u.baseY + Math.sin(t * 0.6 + u.phase) * 0.4;
      });

      // Camera parallax
      camX += (pointer.x * 1.4 - camX) * 0.04;
      camY += (0.6 - pointer.y * 0.8 - camY) * 0.04;
      camera.position.x = camX + (glitching ? (Math.random() - 0.5) * 0.35 : 0);
      camera.position.y = camY + (glitching ? (Math.random() - 0.5) * 0.2 : 0);
      camera.lookAt(0, 0, -10);

      rings.forEach(function (r) {
        r.material.opacity = glitching ? Math.random() * 0.9 : r.userData.baseOpacity;
      });
      pMat.size = glitching ? 0.22 : 0.14;

      renderer.render(scene, camera);
      if (!reduceMotion) requestAnimationFrame(render);
    }
    render();
  }

  initScene();
})();
