/* Norivex Technologies — homepage interactions */
(function () {
  "use strict";
  var doc = document.documentElement;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  var hasG = !!(window.gsap && window.ScrollTrigger);
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  if (!hasG || reduce) doc.classList.add("no-js-motion");

  /* ---------- word splitting ---------- */
  $$("[data-words]").forEach(function (el) {
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var s = document.createElement("span"); s.className = "wd"; s.textContent = part; frag.appendChild(s);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
  });

  /* ---------- loader ---------- */
  var count = $(".loader-count"), bar = $(".loader-bar i");
  var t0 = performance.now(), LOAD = reduce ? 200 : 1500, done = false;
  function loaderStep(now) {
    var p = clamp((now - t0) / LOAD, 0, 1); var e = 1 - Math.pow(1 - p, 3);
    if (count) count.textContent = String(Math.round(e * 100)).padStart(3, "0");
    if (bar) bar.style.transform = "scaleX(" + e + ")";
    if (p < 1) requestAnimationFrame(loaderStep); else finish();
  }
  function finish() {
    if (done) return; done = true;
    doc.classList.add("loaded");
    window.__introStart = performance.now(); // the hologram assembles as the loader lifts
    heroIntro();
  }
  requestAnimationFrame(loaderStep);
  setTimeout(finish, 3500); // never trap the page behind the loader

  /* ---------- smooth scroll ---------- */
  var lenis = null;
  if (hasG) gsap.registerPlugin(ScrollTrigger);
  if (window.Lenis && !reduce) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.4 });
    if (hasG) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf);
    }
  }
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href"); var tgt = id === "#top" ? document.body : $(id);
      if (!tgt) return; e.preventDefault(); closeMenu();
      if (lenis) lenis.scrollTo(id === "#top" ? 0 : tgt, { offset: 0, duration: 1.6 });
      else (id === "#top" ? window.scrollTo(0, 0) : tgt.scrollIntoView({ behavior: reduce ? "auto" : "smooth" }));
    });
  });

  /* ---------- nav ---------- */
  var nav = $("#nav"), lastY = 0;
  function onScrollNav() {
    var y = window.scrollY || 0;
    nav.classList.toggle("scrolled", y > 40);
    nav.classList.toggle("hide", y > lastY && y > 500 && !doc.classList.contains("menu-open"));
    lastY = y;
  }
  addEventListener("scroll", onScrollNav, { passive: true }); onScrollNav();
  var burger = $(".burger"), menu = $("#menu");
  function closeMenu() { doc.classList.remove("menu-open"); burger.setAttribute("aria-expanded", "false"); menu.setAttribute("aria-hidden", "true"); if (lenis) lenis.start(); }
  burger.addEventListener("click", function () {
    var open = !doc.classList.contains("menu-open");
    doc.classList.toggle("menu-open", open); burger.setAttribute("aria-expanded", String(open)); menu.setAttribute("aria-hidden", String(!open));
    if (lenis) open ? lenis.stop() : lenis.start();
  });
  addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });

  /* ---------- hero intro ---------- */
  function heroIntro() {
    if (!hasG || reduce) return;
    var tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.from(".hero-title .w", { yPercent: 115, rotate: 6, duration: 1.4, stagger: 0.07 }, 0.15)
      .from(".hero-sub", { y: 24, opacity: 0, duration: 1.1 }, 0.6)
      .from(".hero-cta .btn", { y: 24, opacity: 0, duration: 1, stagger: 0.08 }, 0.7);
    gsap.from(".nav", { opacity: 0, duration: 1.2, delay: 0.2, clearProps: "opacity" });
  }

  /* ---------- HUD readout ---------- */
  var xy = $(".hud-xy");
  if (xy && fine) addEventListener("pointermove", function (e) {
    xy.textContent = "X " + (e.clientX / innerWidth * 2 - 1).toFixed(3) + " · Y " + (-(e.clientY / innerHeight * 2 - 1)).toFixed(3);
  }, { passive: true });

  if (!hasG || reduce) { setupStatic(); return; }

  /* ---------- hero copy parallax out ---------- */
  gsap.to(".hero-copy", { yPercent: -30, opacity: 0, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom 20%", scrub: true } });

  /* ---------- marquee with scroll velocity ---------- */
  var track = $(".marquee-track"), mx = 0, vel = 0, half = 0;
  function measure() { half = track.scrollWidth / 2; }
  measure(); addEventListener("resize", measure);
  ScrollTrigger.create({ trigger: ".marquee", start: "top bottom", end: "bottom top", onUpdate: function (s) { vel = s.getVelocity() / 300; } });
  gsap.ticker.add(function () {
    vel *= 0.92;
    mx -= 1.1 + Math.abs(vel) * 1.2;
    if (mx <= -half) mx += half;
    track.style.transform = "translate3d(" + mx + "px,0,0) skewX(" + clamp(-vel * 1.5, -12, 12) + "deg)";
  });

  /* ---------- statement word fill ---------- */
  var words = $$(".big-text .wd");
  ScrollTrigger.create({
    trigger: ".big-text", start: "top 82%", end: "bottom 45%", scrub: true,
    onUpdate: function (s) { var n = s.progress * words.length; words.forEach(function (w, i) { w.style.opacity = String(clamp(n - i, 0.14, 1)); }); }
  });

  /* ---------- headings: line-mask rise ---------- */
  $$("[data-split]").forEach(function (h) {
    gsap.from(h, { y: 80, opacity: 0, rotateX: -40, transformOrigin: "50% 100%", duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: h, start: "top 88%" } });
  });
  gsap.utils.toArray(".work-note,.about-copy > p,.about-copy blockquote,.contact-row,.why li").forEach(function (el) {
    gsap.from(el, { y: 30, opacity: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 92%" } });
  });

  /* ---------- WORK: stacked 3D project panels ---------- */
  var projs = $$(".proj");
  function stickTops() {
    var base = innerWidth < 641 ? 72 : 90, step = innerWidth < 641 ? 8 : 14;
    projs.forEach(function (p, i) {
      var h = p.firstElementChild.offsetHeight;
      var t = base + i * step;
      if (t + h > innerHeight - 8) t = innerHeight - h - 8; // tall panel: stick once its bottom is in view
      p.style.top = innerWidth >= 1024 ? t + "px" : "";
    });
  }
  stickTops(); addEventListener("resize", stickTops); addEventListener("load", stickTops);
  projs.forEach(function (p, i) {
    var inner = p.firstElementChild, lap = $(".laptop", p), ph = $(".phone", p), stage = $(".proj-stage", p);
    // arrive: panel swings up from below in 3D
    gsap.fromTo(inner, { rotateX: -28, y: 160, scale: 0.9, opacity: 0.55 },
      { rotateX: 0, y: 0, scale: 1, opacity: 1, ease: "none", scrollTrigger: { trigger: p, start: "top bottom", end: "top 35%", scrub: 0.8 } });
    var mob = innerWidth < 1024;
    gsap.fromTo(lap, mob ? { rotateX: 30, rotateY: -10, y: 40, opacity: 0.3 } : { rotateX: 48, rotateY: -30, z: -260, opacity: 0.4 },
      { rotateX: mob ? 4 : 8, rotateY: mob ? -6 : -14, z: 0, y: 0, opacity: 1, ease: "none", scrollTrigger: { trigger: p, start: "top 95%", end: mob ? "top 40%" : "top 25%", scrub: 1 } });
    gsap.fromTo(ph, { yPercent: 80, rotateZ: 18, opacity: 0 },
      { yPercent: 0, rotateZ: 4, opacity: 1, ease: "none", scrollTrigger: { trigger: p, start: "top 80%", end: "top 20%", scrub: 1 } });
    gsap.from($$(".feat li", p), { y: 16, opacity: 0, stagger: 0.04, duration: 0.8, ease: "expo.out", scrollTrigger: { trigger: p, start: "top 55%" } });
    // leave: sink back under the next panel
    var next = projs[i + 1];
    if (next && innerWidth >= 1024) gsap.to(p, { scale: 0.9, rotateX: 6, transformOrigin: "50% 0%", transformPerspective: 1800, filter: "brightness(.55)", ease: "none",
      scrollTrigger: { trigger: next, start: "top 75%", end: "top 15%", scrub: true } });
    // pointer: the devices float in depth
    if (fine) {
      var st = { x: 0, y: 0, tx: 0, ty: 0 };
      inner.addEventListener("pointermove", function (e) {
        var r = inner.getBoundingClientRect(); st.tx = (e.clientX - r.left) / r.width - 0.5; st.ty = (e.clientY - r.top) / r.height - 0.5;
      });
      inner.addEventListener("pointerleave", function () { st.tx = 0; st.ty = 0; });
      gsap.ticker.add(function () {
        st.x = lerp(st.x, st.tx, 0.08); st.y = lerp(st.y, st.ty, 0.08);
        if (Math.abs(st.x) + Math.abs(st.y) < 0.0005) return;
        stage.style.transform = "rotateY(" + st.x * 16 + "deg) rotateX(" + (-st.y * 12) + "deg)";
      });
    }
  });

  /* about-photo tilt */
  if (fine) $$(".about-photo").forEach(function (el) {
    var inner = el.querySelector(".ph-in"), st = { x: 0, y: 0, tx: 0, ty: 0 };
    el.addEventListener("pointermove", function (e) { var r = el.getBoundingClientRect(); st.tx = (e.clientX - r.left) / r.width - 0.5; st.ty = (e.clientY - r.top) / r.height - 0.5; });
    el.addEventListener("pointerleave", function () { st.tx = 0; st.ty = 0; });
    gsap.ticker.add(function () { st.x = lerp(st.x, st.tx, 0.08); st.y = lerp(st.y, st.ty, 0.08); if (Math.abs(st.x) + Math.abs(st.y) < 0.0005) return; inner.style.transform = "rotateY(" + st.x * 14 + "deg) rotateX(" + (-st.y * 10) + "deg)"; });
  });

  /* ---------- SERVICES: scroll-driven 3D cylinder ---------- */
  var svs = $$(".sv"), cyl = $(".svc-cyl"), cnt = null, nm = null;
  var names = svs.map(function (s) { return s.querySelector("h3").textContent; });
  var rot = { v: 0 }, lastFront = -1;
  function drawCyl() {
    cyl.style.transform = "translateZ(calc(var(--r) * -1)) rotateX(-6deg) rotateY(" + (-rot.v) + "deg)";
    var front = ((Math.round(rot.v / 36) % 10) + 10) % 10;
    svs.forEach(function (s, i) {
      var a = ((i * 36 - rot.v) % 360 + 540) % 360 - 180; // -180..180, 0 = facing
      var f = Math.cos(a * Math.PI / 180);
      s.style.opacity = String(clamp(0.15 + f * 0.95, 0, 1));
      s.style.setProperty("--sh", (100 - (a + 90) / 180 * 100) + "%");
    });
    if (front !== lastFront) { lastFront = front; svs.forEach(function (s, i) { s.classList.toggle("front", i === front); }); if (cnt) cnt.textContent = String(front + 1).padStart(2, "0"); if (nm) nm.textContent = names[front]; }
  }
  drawCyl();
  gsap.to(rot, { v: 324, ease: "none", onUpdate: drawCyl,
    scrollTrigger: { trigger: ".svc-pin", start: "top top", end: function () { return "+=" + innerHeight * 3.2; }, pin: true, scrub: 0.8, anticipatePin: 1,
      snap: { snapTo: 1 / 9, duration: { min: 0.2, max: 0.6 }, delay: 0.08, ease: "power2.inOut" } } });

  /* ---------- PROCESS beam ---------- */
  var steps = $$(".step");
  gsap.to(".beam i", { scaleY: 1, ease: "none", scrollTrigger: { trigger: ".steps", start: "top 65%", end: "bottom 65%", scrub: true } });
  steps.forEach(function (s) {
    ScrollTrigger.create({ trigger: s, start: "top 66%", end: "bottom top", onToggle: function (st) { if (st.isActive) s.classList.add("on"); }, onLeaveBack: function () { s.classList.remove("on"); } });
    gsap.from(s.querySelector("p"), { opacity: 0, x: 30, duration: 1, ease: "expo.out", scrollTrigger: { trigger: s, start: "top 72%" } });
  });

  /* ---------- ABOUT photo ---------- */
  gsap.fromTo(".ph-in", { clipPath: "inset(30% 20% 30% 20% round 30px)", scale: 1.1 }, { clipPath: "inset(0% 0% 0% 0% round 30px)", scale: 1, ease: "none", scrollTrigger: { trigger: ".about", start: "top 85%", end: "top 25%", scrub: true } });
  gsap.fromTo(".ph-in img", { yPercent: 8 }, { yPercent: -4, ease: "none", scrollTrigger: { trigger: ".about", start: "top bottom", end: "bottom top", scrub: true } });

  /* ---------- CTA ---------- */
  gsap.fromTo(".cta-ring", { scale: 0.6, rotate: -40 }, { scale: 1.15, rotate: 20, ease: "none", scrollTrigger: { trigger: ".cta", start: "top bottom", end: "bottom top", scrub: true } });
  gsap.from(".cta-btn", { scale: 0, rotate: -90, duration: 1.4, ease: "elastic.out(1,.6)", scrollTrigger: { trigger: ".cta-btn", start: "top 90%" } });
  gsap.from(".foot-word", { yPercent: 60, opacity: 0, duration: 1.6, ease: "expo.out", scrollTrigger: { trigger: ".foot-word", start: "top 98%" } });

  /* ---------- magnetic + cursor ---------- */
  if (fine) {
    doc.classList.add("has-cursor");
    var cur = $(".cursor"), dot = $(".c-dot"), ring = $(".c-ring"), lab = $(".c-ring span");
    var m = { x: innerWidth / 2, y: innerHeight / 2 }, rp = { x: m.x, y: m.y };
    addEventListener("pointermove", function (e) { m.x = e.clientX; m.y = e.clientY; dot.style.transform = "translate3d(" + m.x + "px," + m.y + "px,0) translate(-50%,-50%)"; }, { passive: true });
    gsap.ticker.add(function () { rp.x = lerp(rp.x, m.x, 0.16); rp.y = lerp(rp.y, m.y, 0.16); ring.style.transform = "translate3d(" + rp.x + "px," + rp.y + "px,0) translate(-50%,-50%)"; });
    document.addEventListener("pointerover", function (e) {
      var l = e.target.closest("[data-cursor]"), a = e.target.closest("a,button");
      cur.classList.toggle("is-label", !!l && !a); cur.classList.toggle("is-link", !!a);
      lab.textContent = l ? l.getAttribute("data-cursor") : "";
    });
    $$("[data-magnetic]").forEach(function (el) {
      var xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3" }), yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3" });
      el.addEventListener("pointermove", function (e) { var r = el.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * 0.35); yTo((e.clientY - r.top - r.height / 2) * 0.35); });
      el.addEventListener("pointerleave", function () { xTo(0); yTo(0); });
    });
  }

  addEventListener("load", function () { ScrollTrigger.refresh(); });

  function setupStatic() {
    $$(".step").forEach(function (s) { s.classList.add("on"); });
    var b = $(".beam i"); if (b) b.style.transform = "scaleY(1)";
  }
})();
