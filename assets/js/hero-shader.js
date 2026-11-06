/* ==========================================================================
   AlbA Convoyages — Fond animé (WebGL)
   Grandes formes de dégradé lisses qui glissent lentement, halo lumineux qui
   dérive, voile de lumière qui balaie la surface, réaction douce à la souris,
   texture (trame diagonale + grain). Couleurs lues depuis les design tokens.

   Utilisation : <div class="hero__bg"> ou <div class="shader-bg"> dans un
   conteneur positionné. Options (attributs data-*) :
     data-shader-light="0.92,1.1"  position du halo (0–1, origine en bas à gauche)
     data-shader-level="0"         éclaircit (+) ou assombrit (–) l'ensemble
     data-shader-vignette="0.7"    assombrissement du bas (1 = aucun)
     data-shader-flat="0"          aplatit le dégradé vertical (0 → 1)

   - Démarré après le chargement de la page, 30 images/s, pause hors écran
   - Image fixe sans carte graphique ou si « réduire les animations »
   - Repli automatique sur le dégradé CSS si WebGL est indisponible
   ========================================================================== */
(() => {
  'use strict';
  const hosts = document.querySelectorAll('.hero__bg, .shader-bg');
  if (!hosts.length) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  const css = getComputedStyle(document.documentElement);
  const hex = (name, fallback) => {
    const v = (css.getPropertyValue(name) || fallback).trim().replace('#', '');
    return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
  };
  const ramp = [
    hex('--shader-c0', '#020b1c'),
    hex('--shader-c1', '#062b66'),
    hex('--shader-c2', '#0d409b'),
    hex('--shader-c3', '#005eff'),
    hex('--shader-c4', '#1fa8ff'),
    hex('--shader-c5', '#5fe3ff'),
  ];
  const speed = parseFloat(css.getPropertyValue('--shader-speed')) || 1;
  const texture = parseFloat(css.getPropertyValue('--shader-texture')) || 1;

  const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
  const FRAG = `
    precision highp float;
    uniform vec2 uRes; uniform float uTime; uniform float uDpr; uniform float uTex;
    uniform vec2 uLight; uniform float uLevel; uniform float uVignette; uniform float uFlat;
    uniform vec2 uMouse; uniform float uMouseAmt;
    uniform vec3 c0; uniform vec3 c1; uniform vec3 c2; uniform vec3 c3; uniform vec3 c4; uniform vec3 c5;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
    }
    vec3 palette(float t){
      t = clamp(t, 0.0, 1.0);
      if (t < 0.22) return mix(c0, c1, t / 0.22);
      if (t < 0.45) return mix(c1, c2, (t - 0.22) / 0.23);
      if (t < 0.68) return mix(c2, c3, (t - 0.45) / 0.23);
      if (t < 0.86) return mix(c3, c4, (t - 0.68) / 0.18);
      return mix(c4, c5, (t - 0.86) / 0.14);
    }
    void main(){
      vec2 uv = gl_FragCoord.xy / uRes;
      float aspect = uRes.x / uRes.y;
      vec2 p = vec2(uv.x * aspect, uv.y);
      float t = uTime;

      // 1. Matière fluide : formes de dégradé larges et douces qui glissent lentement
      // Grandes formes lisses (une seule octave de bruit : pas d'effet fumée)
      vec2 q = vec2(noise(p * 0.85 + vec2(t * 0.08, -t * 0.05)), noise(p * 0.85 + vec2(4.1, 2.7) - t * 0.06));
      float n = noise(p * 0.75 + 1.1 * q + vec2(t * 0.05, t * 0.02));
      n = smoothstep(0.05, 0.95, n);

      // 2. Halo principal qui orbite lentement + attiré par la souris
      vec2 lp = vec2(uLight.x * aspect, uLight.y);
      lp += vec2(0.16 * sin(t * 0.23) * aspect * 0.5, 0.1 * cos(t * 0.19));
      lp = mix(lp, vec2(uMouse.x * aspect, uMouse.y), uMouseAmt * 0.35);
      float glow = 1.0 - smoothstep(0.0, 1.15, distance(p, lp) + (n - 0.5) * 0.5);

      // 3. Voile de lumière diagonal qui balaie la surface
      float sweep = uv.x * 0.55 + uv.y * 0.9 - 0.95 - 0.35 * sin(t * 0.21) + (n - 0.5) * 0.6;
      float band = exp(-sweep * sweep * 9.0);

      // 4. Composition
      float vert = mix(uv.y, 0.5, uFlat);
      float v = vert * 0.66 + glow * 0.46 + band * 0.16 + (n - 0.5) * 0.34 - 0.2 + uLevel;
      vec3 col = palette(v);
      col += band * 0.05 * vec3(0.6, 0.85, 1.0);

      // 5. Texture statique (trame diagonale + grain) posée sur le dégradé qui bouge
      vec2 px = gl_FragCoord.xy / uDpr;
      float lines = sin((px.x - px.y) * 2.4) * 0.5 + 0.5;
      col *= 1.0 - 0.1 * uTex * lines * smoothstep(0.08, 0.8, v);
      col += (hash(floor(px)) - 0.5) * 0.05 * uTex;   // grain fixe (ne bouge pas)

      // 6. Assombrissement du bas pour la lisibilité
      col *= mix(uVignette, 1.0, smoothstep(0.0, 0.55, uv.y));
      gl_FragColor = vec4(col, 1.0);
    }`;

  const init = (host) => {
    const canvas = document.createElement('canvas');
    canvas.className = 'hero__canvas';
    canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return;

    // Sans carte graphique (rendu logiciel) ou en mode économie de données : image fixe
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    const software = /swiftshader|llvmpipe|software|softpipe/i.test(renderer);
    const saveData = navigator.connection && navigator.connection.saveData;
    const animate = !reduceMotion && !software && !saveData;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = (n) => gl.getUniformLocation(prog, n);
    const uRes = u('uRes'), uTime = u('uTime'), uDpr = u('uDpr'), uMouse = u('uMouse'), uMouseAmt = u('uMouseAmt');
    ramp.forEach((c, i) => gl.uniform3fv(u('c' + i), c));
    gl.uniform1f(u('uTex'), texture);
    const [lx, ly] = (host.dataset.shaderLight || '0.92,1.1').split(',').map(Number);
    gl.uniform2f(u('uLight'), lx, ly);
    gl.uniform1f(u('uLevel'), parseFloat(host.dataset.shaderLevel || '0'));
    gl.uniform1f(u('uVignette'), parseFloat(host.dataset.shaderVignette || '0.7'));
    gl.uniform1f(u('uFlat'), parseFloat(host.dataset.shaderFlat || '0'));

    host.appendChild(canvas);
    host.classList.add('has-shader');

    let dpr = 1;
    const resize = () => {
      dpr = animate ? Math.min(window.devicePixelRatio || 1, 1.5) : 1;
      const w = Math.max(1, Math.round(host.clientWidth * dpr));
      const h = Math.max(1, Math.round(host.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uDpr, dpr);
    };

    // Souris : position lissée, influence qui monte au survol et retombe ensuite
    const mouse = { x: lx, y: ly, tx: lx, ty: ly, amt: 0, tamt: 0 };
    if (finePointer && animate) {
      const zone = host.parentElement;
      zone.addEventListener('pointermove', (e) => {
        const r = host.getBoundingClientRect();
        mouse.tx = (e.clientX - r.left) / r.width;
        mouse.ty = 1 - (e.clientY - r.top) / r.height;
        mouse.tamt = 1;
      });
      zone.addEventListener('pointerleave', () => { mouse.tamt = 0; });
    }

    const seed = Math.random() * 40;
    let visible = true, raf = 0;
    const t0 = performance.now();
    const draw = (now) => {
      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;
      mouse.amt += (mouse.tamt - mouse.amt) * 0.03;
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uMouseAmt, mouse.amt);
      gl.uniform1f(uTime, seed + ((now - t0) / 1000) * speed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    let last = 0;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 32) return; // ~30 images/s : largement suffisant pour un mouvement lent
      last = now;
      draw(now);
    };
    const start = () => { if (!raf && visible && !document.hidden && animate) raf = requestAnimationFrame(loop); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    // Première image dessinée seulement quand le bloc arrive à l'écran
    let drawn = false;
    const firstFrame = () => {
      if (drawn) return;
      drawn = true;
      resize();
      draw(performance.now());
      requestAnimationFrame(() => canvas.classList.add('is-ready'));
    };
    const redraw = () => { if (drawn) { resize(); draw(performance.now()); } };

    if ('ResizeObserver' in window) new ResizeObserver(redraw).observe(host);
    else window.addEventListener('resize', redraw);

    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) { firstFrame(); start(); } else stop();
    }).observe(host);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  };

  // Démarrage différé : la page s'affiche d'abord (dégradé CSS de secours),
  // puis l'animation prend le relais en fondu quand le navigateur est libre.
  const boot = () => {
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
    idle(() => hosts.forEach(init), { timeout: 2000 });
  };
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot, { once: true });
})();
