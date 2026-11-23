// Tidewood Isle — renderer, sky, sun & moon, water, day/night cycle, point-light pool.
'use strict';
(function () {
  const W = G.W, D = G.D;
  G.time = 8;                 // hour of day, 0-24
  G.day = 1;
  G.HOURS_PER_SEC = 24 / (18 * 60);   // one full day = 18 real minutes

  // keyframes: [hour, sky colour, sun colour, sun intensity, ambient intensity]
  const KEYS = [
    [0, 0x1b2545, 0x9db2ff, 0.22, 0.38],
    [4.5, 0x262e58, 0x9db2ff, 0.22, 0.39],
    [6, 0xf7a98a, 0xffc9a0, 0.36, 0.48],
    [7.5, 0xa6dcf5, 0xfff1d6, 0.56, 0.6],
    [10, 0x9bd8f5, 0xfff8ea, 0.5, 0.6],
    [12.5, 0x8fd3f4, 0xfffaf0, 0.44, 0.6],          // the sun is overhead at midday, so it needs less strength
    [15, 0x95d5f3, 0xfff6e2, 0.48, 0.6],
    [16.5, 0x9ad4f2, 0xfff1d6, 0.55, 0.61],
    [17.6, 0xb4d6ec, 0xffe2b4, 0.6, 0.62],          // a long golden hour before the sun goes down
    [18.5, 0xff9f7a, 0xffb07a, 0.52, 0.57],
    [19.6, 0x4a4a82, 0x9aa6ff, 0.24, 0.42],
    [21, 0x1f284c, 0x9db2ff, 0.22, 0.38],
    [24, 0x1b2545, 0x9db2ff, 0.22, 0.38],
  ];
  const cA = new THREE.Color(), cB = new THREE.Color();

  G.isNight = () => G.time < 5.5 || G.time >= 19.5;

  // "Simpler graphics" for slower computers: no shadows, no soft-focus lens, lower resolution.
  G.simple = false;
  G.setSimple = function (on) {
    G.simple = !!on;
    try { localStorage.setItem('tidewood-simple', on ? '1' : '0'); } catch (e) { /* ignore */ }
    document.body.classList.toggle('nolens', G.simple);
    if (G.sun) G.sun.castShadow = !G.simple;
    if (G.renderer) {
      G.renderer.shadowMap.needsUpdate = true;
      G.renderer.setPixelRatio(G.simple ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      G.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  };

  G.initEnv = function () {
    const renderer = G.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.id = 'game-canvas';
    document.getElementById('stage').appendChild(renderer.domElement);

    const scene = G.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8fd3f4);
    scene.fog = new THREE.Fog(0x8fd3f4, 70, 190);

    G.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);

    // gradient sky: pale and warm at the horizon, deeper overhead
    G.skyUniforms = { top: { value: new THREE.Color(0x6fb6ee) }, horizon: { value: new THREE.Color(0xcdeaf8) } };
    G.skyDome = new THREE.Mesh(new THREE.SphereGeometry(520, 24, 12), new THREE.ShaderMaterial({
      uniforms: G.skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vDir; void main(){ float h = clamp(vDir.y * 1.25 + 0.04, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(h, 0.62)), 1.0); }',
    }));
    G.skyDome.renderOrder = -20; G.skyDome.frustumCulled = false;
    scene.add(G.skyDome);

    G.hemi = new THREE.HemisphereLight(0xfff6ea, 0xf0d6b0, 0.85);
    scene.add(G.hemi);
    const sun = G.sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -42; sc.right = 42; sc.top = 42; sc.bottom = -42; sc.near = 1; sc.far = 220;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.04;
    scene.add(sun); scene.add(sun.target);

    // sun & moon discs
    const disc = (color, size) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(size, 24), new THREE.MeshBasicMaterial({ color, fog: false, depthWrite: false }));
      m.renderOrder = -10; scene.add(m); return m;
    };
    G.sunGlow = disc(0xfff0b8, 38); G.sunGlow.material.transparent = true; G.sunGlow.material.opacity = 0.2; G.sunGlow.renderOrder = -12;
    G.sunDisc = disc(0xfff3c4, 16);
    G.moonDisc = disc(0xf2f5ff, 11);

    // stars
    const starGeo = new THREE.BufferGeometry();
    const sp = [];
    const rnd = G.makeRng(99);
    for (let i = 0; i < 500; i++) {
      const a = rnd() * Math.PI * 2, e = Math.asin(rnd() * 0.95 + 0.03), r = 420;
      sp.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    G.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    G.stars.renderOrder = -11;
    scene.add(G.stars);

    // clouds: soft white puffs made of a few overlapping rounded lumps
    G.clouds = new THREE.Group();
    const cmat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false, depthWrite: false });
    G.cloudMat = cmat;
    for (let i = 0; i < 20; i++) {
      const g = new THREE.Group();
      const w = 16 + rnd() * 14;
      g.add(new THREE.Mesh(new THREE.BoxGeometry(w, 4, w * 0.6), cmat));
      const lumps = 3 + ((rnd() * 3) | 0);
      for (let k = 0; k < lumps; k++) {
        const s2 = 5 + rnd() * 6;
        const b = new THREE.Mesh(new THREE.BoxGeometry(s2 * 1.5, s2 * 0.8, s2 * 1.1), cmat);
        b.position.set((rnd() - 0.5) * w * 0.8, 2 + rnd() * 2, (rnd() - 0.5) * w * 0.3);
        g.add(b);
      }
      g.position.set(rnd() * 560 - 200, 70 + rnd() * 26, rnd() * 560 - 200);
      g.userData.speed = 0.5 + rnd() * 0.7;
      G.clouds.add(g);
    }
    G.clouds.renderOrder = -8;
    scene.add(G.clouds);

    // point-light pool for lamps, torches and campfires
    G.pointLights = [];
    for (let i = 0; i < 5; i++) {
      const pl = new THREE.PointLight(0xffb060, 0, 13, 1.6);
      scene.add(pl);
      G.pointLights.push(pl);
    }
    G.lightSources = new Map();   // "x,y,z" -> {x,y,z,color}
    try { if (localStorage.getItem('tidewood-simple') === '1') G.setSimple(true); } catch (e) { /* ignore */ }
  };

  // Water surface: colour comes from a per-block depth map so shallows glow turquoise.
  G.buildWater = function () {
    const canvas = G.waterCanvas || (G.waterCanvas = document.createElement('canvas'));
    canvas.width = W; canvas.height = D;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(W, D);
    const shallow = [156, 236, 228], deep = [82, 170, 230];
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      let top = G.SEA - 1;
      while (top >= 0 && !G.OPAQUE[G.getBlock(x, top, z)]) top--;
      const depth = G.SEA - 1 - top;                 // 0 = land right under the surface
      const t = G.clamp(depth / 7, 0, 1);
      const i = (z * W + x) * 4;
      img.data[i] = G.lerp(shallow[0], deep[0], t);
      img.data[i + 1] = G.lerp(shallow[1], deep[1], t);
      img.data[i + 2] = G.lerp(shallow[2], deep[2], t);
      img.data[i + 3] = depth <= 0 ? 150 : G.lerp(150, 225, t);
      if (depth === 1) { img.data[i] = 226; img.data[i + 1] = 250; img.data[i + 2] = 246; img.data[i + 3] = 170; }  // foam line
    }
    ctx.putImageData(img, 0, 0);
    if (!G.water) {
      const tex = new THREE.CanvasTexture(canvas);
      tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
      tex.flipY = false;
      const geo = new THREE.PlaneGeometry(W * 5, D * 5, 1, 1);
      geo.rotateX(-Math.PI / 2);
      const uv = geo.attributes.uv;
      const p = geo.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + W * 2.5 - W * 2) / W, (p.getZ(i) + D * 2.5 - D * 2) / D);
      const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false });
      G.water = new THREE.Mesh(geo, mat);
      G.water.position.set(W / 2, G.WATER_Y, D / 2);
      G.water.renderOrder = 2;
      G.scene.add(G.water);
      G.waterTex = tex;
      // a drifting layer of little glints on top of the water
      const sc = document.createElement('canvas'); sc.width = sc.height = 128;
      const sx = sc.getContext('2d'); const srnd = G.makeRng(77);
      sx.fillStyle = '#fff';
      for (let i = 0; i < 30; i++) {
        const x = (srnd() * 120) | 0, y = (srnd() * 120) | 0, r = 1 + ((srnd() * 2) | 0);
        sx.globalAlpha = 0.5 + srnd() * 0.5;
        sx.fillRect(x - r, y, r * 2 + 1, 1); sx.fillRect(x, y - r, 1, r * 2 + 1);
      }
      const stex = new THREE.CanvasTexture(sc);
      stex.wrapS = stex.wrapT = THREE.RepeatWrapping; stex.repeat.set(W * 5 / 14, D * 5 / 14);
      stex.magFilter = THREE.NearestFilter;
      const sgeo = new THREE.PlaneGeometry(W * 5, D * 5, 1, 1); sgeo.rotateX(-Math.PI / 2);
      G.waterGlints = new THREE.Mesh(sgeo, new THREE.MeshBasicMaterial({ map: stex, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }));
      G.waterGlints.position.set(W / 2, G.WATER_Y + 0.02, D / 2);
      G.waterGlints.renderOrder = 3;
      G.scene.add(G.waterGlints);
    } else G.waterTex.needsUpdate = true;
  };

  function sample(time) {
    let a = KEYS[0], b = KEYS[KEYS.length - 1];
    for (let i = 0; i < KEYS.length - 1; i++) if (time >= KEYS[i][0] && time <= KEYS[i + 1][0]) { a = KEYS[i]; b = KEYS[i + 1]; break; }
    const t = b[0] === a[0] ? 0 : (time - a[0]) / (b[0] - a[0]);
    return { a, b, t };
  }

  G.updateEnv = function (dt, focus) {
    const { a, b, t } = sample(G.time);
    cA.setHex(a[1]); cB.setHex(b[1]); cA.lerp(cB, t);
    G.scene.background.copy(cA);
    G.scene.fog.color.copy(cA);
    cA.setHex(a[2]); cB.setHex(b[2]); cA.lerp(cB, t);
    G.sun.color.copy(cA);
    G.sun.intensity = G.lerp(a[3], b[3], t);
    G.hemi.intensity = G.lerp(a[4], b[4], t);
    const night = G.clamp(1 - (G.hemi.intensity - 0.38) / 0.2, 0, 1);
    G.nightAmount = night;
    // rain clouds grey the sky and soften the sun
    const wet = G.weather ? G.weather.amount : 0;
    if (wet > 0.01) {
      cB.setHex(night > 0.5 ? 0x2a3350 : 0xa9b9c6);
      G.scene.background.lerp(cB, wet * 0.75);
      G.scene.fog.color.copy(G.scene.background);
      G.sun.intensity *= 1 - wet * 0.5;
    }
    G.scene.fog.near = 70 - wet * 35; G.scene.fog.far = 190 - wet * 70;
    // sky gradient derived from the base sky colour: lighter, warmer horizon and a deeper zenith
    const base = G.scene.background;
    G.skyUniforms.top.value.copy(base).multiplyScalar(0.84).lerp(cB.setHex(night > 0.5 ? 0x141c3a : 0x4f9fe6), night > 0.5 ? 0.45 : 0.3 * (1 - wet));
    G.skyUniforms.horizon.value.copy(base).lerp(cB.setHex(night > 0.5 ? 0x3a4674 : 0xfff3e0), night > 0.5 ? 0.35 : 0.42);
    base.copy(G.skyUniforms.horizon.value);
    G.scene.fog.color.copy(base);
    G.skyDome.position.copy(G.camera.position);
    G.hemi.color.setHex(0xfff6ea).lerp(cB.setHex(0x9fb4ff), night * 0.8);
    G.hemi.groundColor.setHex(0xf0d6b0).lerp(cB.setHex(0x3a456e), night);
    G.stars.material.opacity = night * 0.9;
    G.cloudMat.color.setHex(0xffffff).lerp(cB.setHex(0x55608a), night * 0.85).lerp(G.scene.background, 0.12);
    G.cloudMat.opacity = 0.9 - wet * 0.15;

    // sun travels east -> west; the moon takes over at night
    const dayT = (G.time - 6) / 13;                   // 0 at 06:00, 1 at 19:00
    const isDay = dayT >= 0 && dayT <= 1;
    const ang = isDay ? dayT * Math.PI : ((G.time < 6 ? G.time + 24 : G.time) - 19) / 11 * Math.PI;
    const dir = cA2.set(Math.cos(ang) * 0.9, Math.max(0.22, Math.sin(ang)) , 0.45).normalize();
    G.sun.position.set(focus.x + dir.x * 90, focus.y + dir.y * 90, focus.z + dir.z * 90);
    G.sun.target.position.set(focus.x, focus.y, focus.z);

    const cam = G.camera.position;
    const sAng = dayT * Math.PI;
    G.sunDisc.position.set(cam.x + Math.cos(sAng) * 380, cam.y + Math.sin(sAng) * 300 - 20, cam.z + 160);
    G.sunDisc.lookAt(cam);
    G.sunGlow.position.copy(G.sunDisc.position); G.sunGlow.lookAt(cam); G.sunGlow.visible = Math.sin(sAng) > -0.15 && dayT > -0.2 && dayT < 1.2;
    G.sunDisc.visible = Math.sin(sAng) > -0.15 && dayT > -0.2 && dayT < 1.2;
    const mAng = ((G.time < 6 ? G.time + 24 : G.time) - 18.5) / 12 * Math.PI;
    G.moonDisc.position.set(cam.x + Math.cos(mAng) * 380, cam.y + Math.sin(mAng) * 300 - 20, cam.z - 120);
    G.moonDisc.lookAt(cam);
    G.moonDisc.visible = night > 0.2 && Math.sin(mAng) > -0.1;
    G.stars.position.copy(cam);

    for (const c of G.clouds.children) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 380) c.position.x = -220;
    }

    // water gently breathes
    if (G.timeUniform) G.timeUniform.value = performance.now() * 0.001;
    if (G.water) G.water.position.y = G.WATER_Y + Math.sin(performance.now() * 0.0011) * 0.045;
    if (G.waterGlints) {
      const tt = performance.now() * 0.001;
      G.waterGlints.position.y = G.water.position.y + 0.015;
      G.waterGlints.material.map.offset.set(tt * 0.012, Math.sin(tt * 0.35) * 0.03 + tt * 0.004);
      G.waterGlints.material.opacity = (0.3 + 0.2 * Math.sin(tt * 1.7)) * (1 - night * 0.6) * (1 - wet * 0.7);
    }

    // assign the pooled point lights to the nearest light sources
    const list = [];
    for (const s of G.lightSources.values()) {
      const d = (s.x - focus.x) ** 2 + (s.y - focus.y) ** 2 + (s.z - focus.z) ** 2;
      if (d < 40 * 40) list.push([d, s]);
    }
    list.sort((p, q) => p[0] - q[0]);
    const flick = 0.92 + Math.sin(performance.now() * 0.013) * 0.05 + Math.sin(performance.now() * 0.031) * 0.03;
    for (let i = 0; i < G.pointLights.length; i++) {
      const pl = G.pointLights[i];
      if (i < list.length) {
        const s = list[i][1];
        pl.position.set(s.x + 0.5, s.y + (s.h || 0.9), s.z + 0.5);
        pl.color.setHex(s.color);
        pl.intensity = (0.35 + night * 1.25) * (s.flicker ? flick : 1) * (s.power || 1);
      } else pl.intensity = 0;
    }
  };
  const cA2 = new THREE.Vector3();

  // Called when a block changes so lamps/torches/campfires register as lights.
  G.refreshLightAt = function (x, y, z) {
    const key = x + ',' + y + ',' + z;
    const def = G.getDef(x, y, z);
    const meta = G.getMeta(x, y, z);
    let color = 0;
    if (def) color = def.light || ((meta & 4) && def.lightOn) || 0;
    if (color) G.lightSources.set(key, { x, y, z, color, flicker: !!(def.flame || def.lightOn), h: def.flame || def.flameH || 0.9, power: def.lightOn ? 1.25 : (def.lightPower || 1) });
    else G.lightSources.delete(key);
  };
  G.scanLights = function () {
    G.lightSources.clear();
    const blocks = G.world.blocks;
    for (let i = 0; i < blocks.length; i++) {
      const def = G.BLOCKS[blocks[i]];
      if (def && (def.light || def.lightOn)) {
        const x = i % W, z = ((i / W) | 0) % D, y = (i / (W * D)) | 0;
        G.refreshLightAt(x, y, z);
      }
    }
  };
})();
