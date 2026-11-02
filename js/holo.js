// Norivex — holographic NT hero (Three.js)
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

const canvas = document.getElementById('holo');
const hero = document.getElementById('hero');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = matchMedia('(hover: none)').matches;
const small = Math.min(innerWidth, innerHeight) < 700;
const covers = Array.from(document.querySelectorAll('[data-cover]'));
const reform = document.querySelector('[data-reform]');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !small && !/capture/.test(location.search), alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  document.documentElement.classList.add('no-webgl');
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.35 : 1.6));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
camera.position.set(0, 0.2, 11);

const root = new THREE.Group();   // follows layout (x offset)
const rig = new THREE.Group();    // pointer / gyro / scroll rotation
const mono = new THREE.Group();   // the monogram itself
scene.add(root); root.add(rig); rig.add(mono);

/* ---------- NT monogram outline, traced from the Norivex logo (px, y down) ---------- */
const S = 1 / 150, CX = 378, CY = 274;
const P = (x, y) => new THREE.Vector2((x - CX) * S, -(y - CY) * S);
const N_PTS = [[18,8],[165,8],[598,493],[598,540],[495,540],[128,128],[128,540],[18,540]];
const T_PTS = [[262,8],[738,8],[738,115],[598,115],[598,425],[488,302],[488,115],[365,115]];
const shapeOf = pts => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => { const v = P(x, y); i ? s.lineTo(v.x, v.y) : s.moveTo(v.x, v.y); }); s.closePath(); return s; };
const DEPTH = 0.62;
const extrude = { depth: DEPTH, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.035, bevelSegments: 2, curveSegments: 1 };
const gN = new THREE.ExtrudeGeometry(shapeOf(N_PTS), extrude); gN.translate(0, 0, -DEPTH / 2);
const gT = new THREE.ExtrudeGeometry(shapeOf(T_PTS), extrude); gT.translate(0, 0, -DEPTH / 2 - 0.12);

/* ---------- holographic surface shader ---------- */
const U = {
  uTime: { value: 0 }, uReveal: { value: reduce ? 3 : -2.2 }, uGlitch: { value: 0 }, uScroll: { value: 0 }, uFade: { value: 1 },
};
const holoVert = `
  uniform float uTime; uniform float uGlitch;
  varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vL;
  float h(float n){ return fract(sin(n)*43758.5453); }
  void main(){
    vec3 p = position;
    float band = floor(p.y*9.0 + floor(uTime*7.0));
    p.x += (h(band)-0.5) * 0.28 * uGlitch * step(0.72, h(band+3.1));
    vL = p;
    vec4 w = modelMatrix * vec4(p,1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - w.xyz);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const holoFrag = `
  uniform float uTime; uniform float uReveal; uniform vec3 uTint; uniform float uDeep; uniform float uFade;
  varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vL;
  vec3 pal(float t){ return vec3(0.46,0.56,0.9) + vec3(0.42,0.36,0.22)*cos(6.2831*(vec3(1.0,1.0,1.0)*t + vec3(0.0,0.18,0.36))); }
  void main(){
    float y = vL.y;
    if (y > uReveal) discard;
    vec3 n = normalize(vN);
    float fr = pow(1.0 - abs(dot(n, normalize(vV))), 2.2);
    float face = abs(n.z);
    vec3 irid = pal(fr*1.35 + vW.y*0.18 + vW.x*0.08 + uTime*0.06);
    vec3 base = mix(uTint, irid, 0.32 + fr*0.55);
    base = mix(base, base*0.55, uDeep*face);
    float scan = 0.5 + 0.5*sin(vW.y*95.0 - uTime*5.0);
    float sweep = smoothstep(0.14, 0.0, abs(fract(vW.y*0.16 - uTime*0.22) - 0.5));
    vec3 col = base*(0.62 + 0.38*scan) + vec3(0.55,0.75,1.0)*fr*0.9 + vec3(0.6,0.8,1.0)*sweep*0.35;
    float edge = smoothstep(0.08, 0.0, uReveal - y);
    col += vec3(0.7,0.9,1.0)*edge*2.2;
    float a = clamp(0.30 + face*0.12 + fr*0.85 + edge, 0.0, 1.0) * (0.78 + 0.22*scan);
    gl_FragColor = vec4(col, a*uFade);
  }`;
const mat = (tint, deep) => new THREE.ShaderMaterial({
  uniforms: { ...U, uTint: { value: new THREE.Color(tint) }, uDeep: { value: deep } },
  vertexShader: holoVert, fragmentShader: holoFrag, transparent: true, depthWrite: false, side: THREE.DoubleSide,
});
const meshN = new THREE.Mesh(gN, mat(0x2f63ff, 0.0));
const meshT = new THREE.Mesh(gT, mat(0x1a2f63, 0.35));
mono.add(meshN, meshT);

// glowing wire edges
const edgeMat = new THREE.ShaderMaterial({
  uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `varying vec3 vL; void main(){ vL=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
  fragmentShader: `uniform float uTime; uniform float uReveal; uniform float uFade; varying vec3 vL;
    void main(){ if (vL.y > uReveal + 0.6) discard; float f = 0.55 + 0.45*sin(uTime*2.0 + vL.y*3.0 + vL.x*2.0);
      gl_FragColor = vec4(vec3(0.55,0.78,1.0)*f*uFade, 0.85*uFade); }`,
});
mono.add(new THREE.LineSegments(new THREE.EdgesGeometry(gN, 30), edgeMat));
mono.add(new THREE.LineSegments(new THREE.EdgesGeometry(gT, 30), edgeMat));

/* ---------- particle hologram: points sampled inside the monogram ---------- */
const inPoly = (x, y, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const COUNT = reduce ? 1400 : (small ? 2600 : 6500);
const pos = new Float32Array(COUNT * 3), start = new Float32Array(COUNT * 3), rnd = new Float32Array(COUNT * 4);
for (let i = 0; i < COUNT; i++) {
  let x, y, ok = false;
  while (!ok) { x = Math.random() * 740; y = Math.random() * 545; ok = inPoly(x, y, N_PTS) || inPoly(x, y, T_PTS); }
  const v = P(x, y);
  const shell = Math.random() < 0.55; // surface vs volume
  pos[i*3] = v.x; pos[i*3+1] = v.y; pos[i*3+2] = shell ? (Math.random() < 0.5 ? -1 : 1) * DEPTH * 0.55 : (Math.random() - 0.5) * DEPTH;
  const r = 6 + Math.random() * 7, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
  start[i*3] = r * Math.sin(ph) * Math.cos(th); start[i*3+1] = r * Math.cos(ph) * 0.6; start[i*3+2] = r * Math.sin(ph) * Math.sin(th) - 2;
  rnd[i*4] = Math.random(); rnd[i*4+1] = Math.random(); rnd[i*4+2] = Math.random(); rnd[i*4+3] = Math.random();
}
const pg = new THREE.BufferGeometry();
pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
pg.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
pg.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 4));
const PU = { uTime: U.uTime, uForm: { value: reduce ? 1 : 0 }, uScatter: { value: 0 }, uPR: { value: renderer.getPixelRatio() }, uSize: { value: small ? 48 : 44 }, uMouse: { value: new THREE.Vector3(9, 9, 0) } };
const pts = new THREE.Points(pg, new THREE.ShaderMaterial({
  uniforms: PU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `
    uniform float uTime, uForm, uScatter, uPR, uSize; uniform vec3 uMouse;
    attribute vec3 aStart; attribute vec4 aRnd; varying float vA; varying vec3 vC;
    void main(){
      float d = aRnd.x*0.45;
      float f = clamp((uForm - d)/(1.0-0.45), 0.0, 1.0);
      f = f*f*(3.0-2.0*f);
      vec3 p = mix(aStart, position, f);
      // breathing drift
      p += 0.025*vec3(sin(uTime*1.3 + aRnd.y*30.0), cos(uTime*1.1 + aRnd.z*30.0), sin(uTime*0.9+aRnd.w*30.0));
      // scroll explosion: fly outward along a swirl
      vec3 dir = normalize(position + vec3((aRnd.y-0.5)*2.0, (aRnd.z-0.5)*2.0, 1.2 + aRnd.w*2.0));
      p += dir * uScatter * (3.0 + aRnd.x*9.0);
      // pointer repulsion (in local space)
      vec3 dm = p - uMouse; float dl = length(dm.xy);
      p.xy += normalize(dm.xy + 1e-4) * smoothstep(1.1, 0.0, dl) * 0.55;
      vec4 mv = modelViewMatrix * vec4(p,1.0);
      gl_Position = projectionMatrix * mv;
      float tw = 0.55 + 0.45*sin(uTime*(2.0+aRnd.w*3.0) + aRnd.y*40.0);
      gl_PointSize = uSize * uPR * (0.35 + aRnd.z*0.75) * (0.7 + 0.3*tw) / -mv.z;
      vA = (0.45 + 0.75*tw) * (1.0 - uScatter*0.6);
      vC = mix(vec3(0.20,0.42,1.0), vec3(0.62,0.86,1.0), aRnd.w);
      vC = mix(vC, vec3(1.0), step(0.93, aRnd.x)*0.7);
    }`,
  fragmentShader: `varying float vA; varying vec3 vC;
    void main(){ vec2 c = gl_PointCoord-0.5; float d = length(c); float a = smoothstep(0.5, 0.0, d); a*=a;
      gl_FragColor = vec4(vC, a*vA); }`,
}));
mono.add(pts);

/* ---------- aura + orbiting data rings ---------- */
const aura = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), new THREE.ShaderMaterial({
  uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
  fragmentShader: `uniform float uTime; uniform float uReveal; uniform float uFade; varying vec2 vUv;
    void main(){ float d = length(vUv-0.5)*2.0; float g = pow(max(1.0-d,0.0), 2.4);
      float on = smoothstep(-2.2, 2.3, uReveal);
      gl_FragColor = vec4(vec3(0.22,0.42,1.0), g*(0.55+0.15*sin(uTime*1.6))*on*uFade); }`,
}));
aura.position.z = -1.4; mono.add(aura);
const orbit = new THREE.Group(); rig.add(orbit);
function makeRing(n, r, tilt, spin, col, size) {
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2; const jr = r + (Math.random() - 0.5) * 0.12; a[i*3] = Math.cos(t) * jr; a[i*3+1] = (Math.random() - 0.5) * 0.04; a[i*3+2] = Math.sin(t) * jr; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: col, size, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  const holder = new THREE.Group(); holder.rotation.set(tilt[0], tilt[1], tilt[2]); holder.add(p); orbit.add(holder);
  p.userData.spin = spin; return p;
}
const rings = [
  makeRing(small ? 260 : 520, 3.35, [1.25, 0, 0.32], 0.16, 0x8fb6ff, 0.045),
  makeRing(small ? 200 : 380, 3.8, [1.05, 0.2, -0.5], -0.11, 0x2f63ff, 0.06),
  makeRing(small ? 120 : 220, 2.9, [1.5, 0, 0.0], 0.22, 0xdfe9ff, 0.035),
];

/* ---------- projector base: rings + light cone + grid ---------- */
const base = new THREE.Group(); base.position.y = -2.55; rig.add(base);
const ringMat = new THREE.ShaderMaterial({
  uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
  fragmentShader: `uniform float uTime; varying vec2 vUv;
    void main(){ vec2 c=vUv-0.5; float r=length(c)*2.0; float a=atan(c.y,c.x);
      float rings = smoothstep(0.035,0.0,abs(fract(r*5.0 - uTime*0.35)-0.5)-0.44);
      float rim = smoothstep(0.02,0.0,abs(r-0.96)) + smoothstep(0.015,0.0,abs(r-0.62))*0.7;
      float ticks = step(0.86, fract(a*32.0/6.2831 + uTime*0.05)) * smoothstep(0.03,0.0,abs(r-0.8));
      float fade = smoothstep(1.0,0.2,r);
      float v = rings*0.35*fade + rim + ticks*0.9;
      gl_FragColor = vec4(vec3(0.35,0.6,1.0)*v, v*0.75); }`,
});
const ring = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 6.2), ringMat); ring.rotation.x = -Math.PI / 2; base.add(ring);
const coneMat = new THREE.ShaderMaterial({
  uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
  fragmentShader: `uniform float uTime; varying vec2 vUv;
    void main(){ float a = pow(1.0-vUv.y, 1.6)*0.16; float s = 0.75+0.25*sin(vUv.x*60.0 + uTime*1.5);
      gl_FragColor = vec4(vec3(0.3,0.55,1.0), a*s); }`,
});
const cone = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 1.9, 4.6, 48, 1, true), coneMat); cone.position.y = 2.3; base.add(cone);

const grid = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShaderMaterial({
  uniforms: U, transparent: true, depthWrite: false,
  vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w;} `,
  fragmentShader: `uniform float uTime; varying vec3 vW;
    void main(){ vec2 g = abs(fract(vW.xz*0.9 + vec2(0.0, uTime*0.12))-0.5)/fwidth(vW.xz*0.9);
      float l = 1.0 - min(min(g.x,g.y),1.0); float d = length(vW.xz);
      float a = l * smoothstep(16.0, 2.0, d) * 0.22;
      gl_FragColor = vec4(vec3(0.25,0.45,1.0), a); }`,
}));
grid.rotation.x = -Math.PI / 2; grid.position.y = -2.56; root.add(grid);

// floating dust
const DUST = small ? 220 : 520;
const dp = new Float32Array(DUST * 3);
for (let i = 0; i < DUST; i++) { dp[i*3] = (Math.random() - 0.5) * 30; dp[i*3+1] = (Math.random() - 0.5) * 16; dp[i*3+2] = -Math.random() * 18 + 3; }
const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0x5b86ff, size: 0.045, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
scene.add(dust);

/* ---------- layout ---------- */
let W = 1, H = 1, wide = true;
function resize() {
  W = innerWidth; H = Math.max(innerHeight, document.documentElement.clientHeight);
  renderer.setSize(W, H, false);
  camera.aspect = W / H; camera.updateProjectionMatrix();
  wide = W / H > 1.05;
  // fit: monogram ~ 5 units wide; keep it inside ~ 70% (portrait) or 46% (wide) of the view width
  const visH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const want = wide ? 0.40 : 0.66;
  const dist = 5.4 / (want * visH * camera.aspect);
  camera.position.z = Math.max(9.5, Math.min(dist, 24));
  const visW = visH * camera.position.z * camera.aspect;
  root.userData.x = wide ? visW * 0.235 : 0;
  root.userData.y = wide ? 0.1 : visH * camera.position.z * 0.24;
  root.position.set(root.userData.x, root.userData.y, 0);
}
addEventListener('resize', resize); resize();

/* ---------- input: pointer, gyro, scroll ---------- */
const target = { rx: 0, ry: 0, mx: 9, my: 9 };
addEventListener('pointermove', e => {
  const nx = e.clientX / innerWidth * 2 - 1, ny = e.clientY / innerHeight * 2 - 1;
  target.ry = nx * 0.55; target.rx = ny * 0.28;
  // project the pointer onto the monogram plane (approx, local units)
  const px = (e.clientX / innerWidth) * 2 - 1, py = -(e.clientY / innerHeight) * 2 + 1;
  const v = new THREE.Vector3(px, py, 0.5).unproject(camera).sub(camera.position).normalize();
  const t = (0 - camera.position.z) / v.z; const hit = camera.position.clone().add(v.multiplyScalar(t));
  target.mx = hit.x - root.position.x; target.my = hit.y - root.position.y;
}, { passive: true });
hero.addEventListener('pointerleave', () => { target.mx = 9; target.my = 9; });

let gyroOn = false;
function onGyro(e) {
  if (e.gamma == null) return; gyroOn = true;
  target.ry = THREE.MathUtils.clamp(e.gamma / 30, -1, 1) * 0.6;
  target.rx = THREE.MathUtils.clamp((e.beta - 45) / 40, -1, 1) * 0.3;
}
if (isTouch && !reduce) {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    const ask = () => { DeviceOrientationEvent.requestPermission().then(s => { if (s === 'granted') addEventListener('deviceorientation', onGyro); }).catch(() => {}); removeEventListener('touchend', ask); };
    addEventListener('touchend', ask, { once: true });
  } else addEventListener('deviceorientation', onGyro);
}

let scrollP = 0, reformP = 0, covered = false;
function readScroll() {
  const r = hero.getBoundingClientRect(); scrollP = THREE.MathUtils.clamp(-r.top / (r.height * 0.9), 0, 1);
  if (reform) { const c = reform.getBoundingClientRect(); reformP = THREE.MathUtils.clamp(1 - (c.top + c.height * 0.5 - innerHeight * 0.5) / (innerHeight * 0.9), 0, 1); }
  covered = covers.some(el => { const b = el.getBoundingClientRect(); return b.top <= 0 && b.bottom >= innerHeight; });
}
addEventListener('scroll', readScroll, { passive: true }); readScroll();

/* ---------- intro timeline (no lib needed) ---------- */
const t0 = performance.now();
const ease = t => 1 - Math.pow(1 - t, 3);
let glitchT = 0;
window.__holo = { ready: false };

/* ---------- loop, paused when the hero is off-screen or the tab is hidden ---------- */
let visible = true, running = false, last = performance.now();
addEventListener('scroll', () => { const was = visible; visible = !covered; if (visible && !was) start_(); }, { passive: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden) start_(); });
function start_() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); } }

const cur = { rx: 0, ry: 0, s: 0, f: 0 };
let fade = 1;
function tick(now) {
  if (!visible || document.hidden) { running = false; return; }
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  const st = window.__introStart;
  const el = st ? (now - st) / 1000 : -1;
  U.uTime.value += reduce ? 0 : dt;
  if (!reduce) {
    const delay = 0.05;
    PU.uForm.value = ease(THREE.MathUtils.clamp((el - delay) / 2.2, 0, 1));
    U.uReveal.value = -2.2 + 4.6 * ease(THREE.MathUtils.clamp((el - delay - 1.5) / 1.6, 0, 1));
    if (U.uReveal.value > 2.3 && !window.__holo.ready) { window.__holo.ready = true; document.documentElement.classList.add('holo-ready'); }
    // occasional glitch burst
    glitchT -= dt; if (glitchT < -3.5 - Math.random() * 3) glitchT = 0.18;
    U.uGlitch.value = glitchT > 0 ? 1 : 0;
  }
  cur.s += (scrollP - cur.s) * 0.12;
  cur.f += (reformP - cur.f) * 0.08;
  const sc = Math.max(0, cur.s * cur.s - cur.f * 1.0);
  PU.uScatter.value = sc;
  fade = 1 - Math.min(1, cur.s * 1.4) * (1 - cur.f);
  U.uScroll.value = cur.s;
  const k = gyroOn ? 0.08 : 0.06;
  cur.rx += (target.rx - cur.rx) * k; cur.ry += (target.ry - cur.ry) * k;
  const idle = reduce ? 0 : Math.sin(U.uTime.value * 0.45) * 0.22;
  const sk = cur.s * (1 - cur.f);
  rig.rotation.set(cur.rx + sk * 0.5, cur.ry + idle + sk * 1.4, 0);
  mono.position.y = reduce ? 0 : Math.sin(U.uTime.value * 0.9) * 0.08;
  mono.position.z = sk * 2.5;
  (meshN.material.uniforms.uReveal.value = U.uReveal.value);
  PU.uMouse.value.set(target.mx, target.my, 0);
  dust.rotation.y = U.uTime.value * 0.01; dust.position.y = cur.s * 2;
  ring.rotation.z = -U.uTime.value * 0.1;
  const ringOn = THREE.MathUtils.clamp((U.uReveal.value + 0.5) / 2.5, 0, 1);
  rings.forEach(p => { p.rotation.y = U.uTime.value * p.userData.spin; p.material.opacity = 0.75 * ringOn * (1 - sk * 0.6); });
  orbit.scale.setScalar(1 + sk * 0.9);
  U.uFade.value = fade;
  mono.visible = true;
  base.visible = grid.visible = fade > 0.02;
  meshN.visible = meshT.visible = fade > 0.02;
  // at the closing CTA the hologram re-forms, centred and larger, behind the words
  const cx = wide ? root.userData.x : 0, cy = root.userData.y;
  root.position.x = cx * (1 - cur.f); root.position.y = cy * (1 - cur.f) + cur.f * (wide ? 0.0 : 0.6);
  const sF = 1 + cur.f * (wide ? 0.55 : 0.25); mono.scale.setScalar(sF);
  canvas.style.opacity = String(0.55 + 0.45 * Math.max(fade, cur.f));
  renderer.render(scene, camera);
  if (reduce) { running = false; return; }
  requestAnimationFrame(tick);
}
start_();
