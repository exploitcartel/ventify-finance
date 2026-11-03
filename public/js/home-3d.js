// Ventify Finance - hero 3D visual: a "Wall Street" style floating bar chart
// with up/down coloring and an animated ticker line, rendered with three.js.
// Purely decorative; fails silently if three.js didn't load or the canvas
// isn't on the page, so it never breaks the rest of the homepage.
(function () {
  if (typeof THREE === "undefined") return;
  const canvas = document.getElementById("home-3d-canvas");
  if (!canvas) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 2.0, 14.5);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const group = new THREE.Group();
  scene.add(group);

  // ---------- Bars, colored like a trading screen: green up, red down,
  // gold for the opening bar. ----------
  const GREEN = 0x27c281, RED = 0xe3524d, GOLD = 0xe8b94d;
  const heights = [3.0, 4.9, 3.5, 6.8, 4.2, 6.0, 2.7];
  const barCount = heights.length;
  const spacing = 1.3;
  const startX = -((barCount - 1) * spacing) / 2;
  const baseY = -1.6;

  const bars = [];
  const topPoints = [];
  for (let i = 0; i < barCount; i++) {
    const h = heights[i];
    const color = i === 0 ? GOLD : (h >= heights[i - 1] ? GREEN : RED);
    const geo = new THREE.BoxGeometry(0.85, h, 0.85);
    const mat = new THREE.MeshStandardMaterial({
      color, roughness: 0.3, metalness: 0.2,
      emissive: new THREE.Color(color), emissiveIntensity: 0.22,
    });
    const bar = new THREE.Mesh(geo, mat);
    const x = startX + i * spacing;
    bar.position.set(x, baseY + h / 2, 0);
    group.add(bar);
    bars.push({ mesh: bar, base: bar.position.y, phase: i * 0.6 });
    topPoints.push(new THREE.Vector3(x, baseY + h + 0.18, 0.5));
  }

  // Thin glowing cap on each bar top for a bit of sparkle.
  bars.forEach((b, i) => {
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.89, 0.06, 0.89),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })
    );
    cap.position.copy(b.mesh.position);
    cap.position.y += heights[i] / 2 + 0.02;
    group.add(cap);
    b.cap = cap;
  });

  // ---------- Trend line across the bar tops, like a combo bar+line chart ----------
  const TICKER_Z = 0.55; // just in front of the bars' front face
  const TICKER_LIFT = 0.28; // how far above each bar top the line sits

  function barX(i) { return startX + i * spacing; }
  function barTopY(i) { return bars[i].mesh.position.y + heights[i] / 2 + TICKER_LIFT; }

  const tickerGeo = new THREE.BufferGeometry();
  const tickerPositions = new Float32Array(barCount * 3);
  tickerGeo.setAttribute("position", new THREE.BufferAttribute(tickerPositions, 3));
  const tickerMat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95 });
  const tickerLine = new THREE.Line(tickerGeo, tickerMat);
  group.add(tickerLine);

  function updateTicker() {
    const arr = tickerGeo.attributes.position.array;
    for (let i = 0; i < barCount; i++) {
      arr[i * 3] = barX(i);
      arr[i * 3 + 1] = barTopY(i);
      arr[i * 3 + 2] = TICKER_Z;
    }
    tickerGeo.attributes.position.needsUpdate = true;
  }
  updateTicker();

  // A bead over every bar top, so the line reads as a chart even at a glance.
  const beadMat = new THREE.MeshBasicMaterial({ color: 0xffe08a });
  const beads = [];
  for (let i = 0; i < barCount; i++) {
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), beadMat);
    group.add(bead);
    beads.push(bead);
  }
  function updateBeads() {
    beads.forEach((bead, i) => bead.position.set(barX(i), barTopY(i), TICKER_Z));
  }
  updateBeads();

  // A glow dot that travels along the line, bar top to bar top.
  const tickerDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffe08a })
  );
  group.add(tickerDot);
  function updateDot(t) {
    const progress = (t * 0.3) % (barCount - 1);
    const i0 = Math.floor(progress);
    const i1 = Math.min(i0 + 1, barCount - 1);
    const frac = progress - i0;
    const x = barX(i0) + (barX(i1) - barX(i0)) * frac;
    const y = barTopY(i0) + (barTopY(i1) - barTopY(i0)) * frac;
    tickerDot.position.set(x, y, TICKER_Z);
  }
  updateDot(0);

  // Faint base grid for a trading-floor feel.
  const grid = new THREE.GridHelper(barCount * spacing + 2.6, 10, 0x6fb6e8, 0x3f7fb0);
  grid.position.y = baseY - 0.9;
  grid.material.transparent = true;
  grid.material.opacity = 0.18;
  group.add(grid);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 0.95);
  key.position.set(4, 6, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fd4ff, 0.5);
  rim.position.set(-5, 2, -4);
  scene.add(rim);

  group.rotation.y = -0.35;
  group.rotation.x = 0.08;

  function resize() {
    const w = canvas.clientWidth || canvas.parentElement.clientWidth;
    const h = canvas.clientHeight || canvas.parentElement.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  let raf = null;
  const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function animate(t) {
    const time = t * 0.001;
    if (!prefersReducedMotion) {
      group.rotation.y = -0.35 + Math.sin(time * 0.25) * 0.25;
      bars.forEach((b) => {
        const y = b.base + Math.sin(time * 0.55 + b.phase) * 0.45;
        b.mesh.position.y = y;
        b.cap.position.y = y + b.mesh.geometry.parameters.height / 2 + 0.02;
      });
      updateTicker();
      updateBeads();
      updateDot(time);
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(animate);
  }

  resize();
  window.addEventListener("resize", resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas.parentElement);
  raf = requestAnimationFrame(animate);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && raf) { cancelAnimationFrame(raf); raf = null; }
    else if (!document.hidden && !raf) { raf = requestAnimationFrame(animate); }
  });
})();
