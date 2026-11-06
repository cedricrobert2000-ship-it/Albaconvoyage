/* ==========================================================================
   AlbA Convoyages — Fond animé des heros (WebGL)
   Dégradé fluide déformé par du bruit (domain warping) + texture fine
   (lignes diagonales + grain). Couleurs lues depuis les design tokens.
   - Se met en pause hors écran et quand l'onglet est masqué
   - Image fixe si « réduire les animations » est activé
   - Repli automatique sur le dégradé CSS si WebGL est indisponible
   ========================================================================== */
(() => {
  'use strict';
  const hosts = document.querySelectorAll('.hero__bg');
  if (!hosts.length) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const css = getComputedStyle(document.documentElement);
  const hex = (name, fallback) => {
    const v = (css.getPropertyValue(name) || fallback).trim().replace('#', '');
    return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
  };
  // Rampe de couleurs du bas (sombre) vers le haut (lumineux)
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
    uniform vec3 c0; uniform vec3 c1; uniform vec3 c2; uniform vec3 c3; uniform vec3 c4; uniform vec3 c5;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
    }
    float fbm(vec2 p){
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
      return v;
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
      vec2 uv = gl_FragCoord.xy / uRes;          // (0,0) en bas à gauche
      float aspect = uRes.x / uRes.y;
      vec2 p = vec2(uv.x * aspect, uv.y);
      float t = uTime;

      // Déformation fluide (domain warping) à grande échelle : formes douces
      vec2 q = vec2(fbm(p * 0.55 + vec2(0.0, t * 0.05)), fbm(p * 0.55 + vec2(5.2, 1.3) - t * 0.045));
      vec2 r = vec2(fbm(p * 0.7 + 1.6 * q + vec2(1.7, 9.2) + t * 0.035), fbm(p * 0.7 + 1.6 * q + vec2(8.3, 2.8) - t * 0.03));
      float n = fbm(p * 0.6 + 1.8 * r);

      // Halo lumineux en haut à droite, qui dérive et respire lentement
      vec2 light = vec2(aspect * (0.9 + 0.08 * sin(t * 0.18)), 1.12 + 0.06 * cos(t * 0.14));
      float glow = 1.0 - smoothstep(0.0, 1.1, distance(p, light) + (n - 0.5) * 0.35);

      // Dégradé principal vertical (sombre en bas), légèrement ondulé par le bruit
      float v = uv.y * 0.72 + glow * 0.42 + (n - 0.5) * 0.22 - 0.2;
      vec3 col = palette(v);

      // Texture : fines lignes diagonales (comme une trame) + grain
      vec2 px = gl_FragCoord.xy / uDpr;
      float lines = sin((px.x - px.y) * 2.4) * 0.5 + 0.5;
      col *= 1.0 - 0.09 * uTex * lines * smoothstep(0.1, 0.8, v);
      col += (hash(px + fract(t * 7.0)) - 0.5) * 0.045 * uTex;

      // Vignettage bas pour la lisibilité du texte
      col *= mix(0.7, 1.0, smoothstep(0.0, 0.5, uv.y));
      gl_FragColor = vec4(col, 1.0);
    }`;

  hosts.forEach((host) => {
    const canvas = document.createElement('canvas');
    canvas.className = 'hero__canvas';
    canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    if (!gl) return; // repli CSS

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
    const uRes = u('uRes'), uTime = u('uTime'), uDpr = u('uDpr'), uTex = u('uTex');
    ramp.forEach((c, i) => gl.uniform3fv(u('c' + i), c));
    gl.uniform1f(uTex, texture);

    host.appendChild(canvas);
    host.classList.add('has-shader');

    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(host.clientWidth * dpr));
      const h = Math.max(1, Math.round(host.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uDpr, dpr);
    };

    const seed = Math.random() * 40;
    let visible = true, raf = 0;
    const t0 = performance.now();
    const draw = (now) => {
      gl.uniform1f(uTime, seed + ((now - t0) / 1000) * speed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const loop = (now) => { draw(now); raf = requestAnimationFrame(loop); };
    const start = () => { if (!raf && visible && !document.hidden && !reduceMotion) raf = requestAnimationFrame(loop); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    resize();
    draw(performance.now());
    requestAnimationFrame(() => canvas.classList.add('is-ready'));

    if ('ResizeObserver' in window) new ResizeObserver(() => { resize(); draw(performance.now()); }).observe(host);
    else window.addEventListener('resize', () => { resize(); draw(performance.now()); });

    new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(host);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    start();
  });
})();
