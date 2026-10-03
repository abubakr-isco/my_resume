(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Loading screen ("HELLO, WORLD_"), then the hero intro ---------- */
  const LOADER_DURATION = reduceMotion ? 0 : 900; // ms the loader stays on screen
  const loader = document.getElementById('loader');
  // Hero animations wait for this so they don't play hidden behind the loader
  const pageReady = new Promise((resolve) => setTimeout(resolve, LOADER_DURATION));

  pageReady.then(() => {
    root.classList.add('is-loaded');
    if (!loader) return;
    loader.classList.add('is-hidden');
    setTimeout(() => loader.remove(), 500);
  });

  /* ---------- Header: background on scroll, hide on scroll down ---------- */
  const header = document.getElementById('header');
  let lastY = window.scrollY;

  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 20);
    if (!document.body.classList.contains('menu-open')) {
      header.classList.toggle('is-hidden', y > lastY && y > 300);
    }
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  const burger = document.getElementById('burger');
  const nav = document.getElementById('nav');

  const setMenu = (open) => {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    if (open) header.classList.remove('is-hidden');
  };

  burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setMenu(false);
  });

  /* ---------- Reveal on scroll (with stagger for siblings) ---------- */
  const revealEls = document.querySelectorAll('[data-reveal]');

  revealEls.forEach((el) => {
    const siblings = [...el.parentElement.children].filter((c) => c.hasAttribute('data-reveal'));
    const index = siblings.indexOf(el);
    if (index > 0) el.style.setProperty('--d', `${Math.min(index, 6) * 0.08}s`);
  });

  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          pageReady.then(() => entry.target.classList.add('is-visible'));
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---------- Hero code card: types itself out ---------- */
  const code = document.getElementById('terminal-code');

  if (code && !reduceMotion) {
    const highlighted = code.innerHTML;
    const plain = code.textContent;
    let i = 0;
    code.textContent = '';

    const type = () => {
      i += 1;
      code.textContent = plain.slice(0, i);
      if (i < plain.length) setTimeout(type, 18);
      else code.innerHTML = highlighted; // put the syntax colours back
    };
    pageReady.then(() => setTimeout(type, 900));
  }

  /* ---------- Copy email ---------- */
  const toast = document.getElementById('toast');
  let toastTimer;
  const showToast = (text) => {
    toast.textContent = text;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
  };

  document.getElementById('copy').addEventListener('click', async () => {
    const email = document.getElementById('email').textContent.trim();
    try {
      await navigator.clipboard.writeText(email);
      showToast('Email copied ✓');
    } catch {
      showToast(email);
    }
  });

  /* ---------- Footer year ---------- */
  document.getElementById('year').textContent = new Date().getFullYear();

  /* ---------- Network background (drifting nodes linked by lines) ---------- */
  const canvas = document.getElementById('bg-network');
  const ctx = canvas && canvas.getContext('2d');

  if (ctx) {
    const rgb = getComputedStyle(root).getPropertyValue('--network-rgb').trim() || '124, 108, 255';
    const LINK_DIST = 140;
    const POINTER_RADIUS = 180;
    const CLICK_RADIUS = 250;
    // Fixed "hub" nodes, as fractions of the viewport
    const HUBS = [
      [0.1, 0.25], [0.9, 0.2], [0.5, 0.5], [0.15, 0.8], [0.85, 0.75],
      [0.35, 0.35], [0.65, 0.4], [0.25, 0.6], [0.75, 0.65],
    ];

    const pointer = { x: null, y: null, ripple: 0 };
    let nodes = [];
    let w = 0;
    let h = 0;
    let rafId = null;

    const seed = () => {
      const max = w < 768 ? 60 : 160;
      const count = Math.min(Math.floor((w * h) / 5500), max);
      nodes = [];
      for (let i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.15,
          r: Math.random() * 2 + 1.5,
          phase: Math.random() * Math.PI * 2,
          hub: Math.random() > 0.8,
        });
      }
      HUBS.forEach(([fx, fy]) => {
        nodes.push({
          x: fx * w, y: fy * h, homeX: fx * w, homeY: fy * h,
          vx: 0, vy: 0, r: 4, phase: Math.random() * Math.PI * 2, hub: true, fixed: true,
        });
      });
    };

    const update = () => {
      const hasPointer = pointer.x !== null;

      for (const n of nodes) {
        n.phase += 0.01;
        const dx = hasPointer ? pointer.x - n.x : 0;
        const dy = hasPointer ? pointer.y - n.y : 0;
        const d = Math.hypot(dx, dy);
        const pull = hasPointer && d < POINTER_RADIUS ? (POINTER_RADIUS - d) / POINTER_RADIUS : 0;

        if (n.fixed) {
          // Hubs lean toward the pointer, otherwise ease back home
          if (pull) {
            n.x += dx * pull * 0.025;
            n.y += dy * pull * 0.025;
          } else {
            n.x += (n.homeX - n.x) * 0.03;
            n.y += (n.homeY - n.y) * 0.03;
          }
          continue;
        }

        if (pull && d > 0) {
          n.vx += (dx / d) * pull * 0.04;
          n.vy += (dy / d) * pull * 0.04;
        }

        n.x += n.vx;
        n.y += n.vy;
        n.vx = n.vx * 0.98 + (Math.random() - 0.5) * 0.02;
        n.vy = n.vy * 0.98 + (Math.random() - 0.5) * 0.02;

        const speed = Math.hypot(n.vx, n.vy);
        if (speed > 5) {
          n.vx = (n.vx / speed) * 5;
          n.vy = (n.vy / speed) * 5;
        }

        // Soft walls
        if (n.x < 20) n.vx += 0.08;
        if (n.x > w - 20) n.vx -= 0.08;
        if (n.y < 20) n.vy += 0.08;
        if (n.y > h - 20) n.vy -= 0.08;
        n.x = Math.max(5, Math.min(w - 5, n.x));
        n.y = Math.max(5, Math.min(h - 5, n.y));
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const hasPointer = pointer.x !== null;

      // Links between nearby nodes
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d >= LINK_DIST) continue;
          ctx.strokeStyle = `rgba(${rgb}, ${(1 - d / LINK_DIST) * 0.3})`;
          ctx.lineWidth = a.hub || b.hub ? 1.2 : 0.6;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      if (hasPointer) {
        // Links from nodes to the pointer
        ctx.lineWidth = 1.5;
        for (const n of nodes) {
          const d = Math.hypot(pointer.x - n.x, pointer.y - n.y);
          if (d >= POINTER_RADIUS) continue;
          ctx.strokeStyle = `rgba(${rgb}, ${(1 - d / POINTER_RADIUS) * 0.5})`;
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.stroke();
        }

        // Click ripple
        if (pointer.ripple > 0) {
          const radius = (1 - pointer.ripple) * 200;
          ctx.lineWidth = 3 * pointer.ripple;
          ctx.strokeStyle = `rgba(${rgb}, ${pointer.ripple * 0.6})`;
          ctx.beginPath();
          ctx.arc(pointer.x, pointer.y, radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.lineWidth = 2 * pointer.ripple;
          ctx.strokeStyle = `rgba(255, 255, 255, ${pointer.ripple * 0.4})`;
          ctx.beginPath();
          ctx.arc(pointer.x, pointer.y, radius * 0.6, 0, Math.PI * 2);
          ctx.stroke();
          pointer.ripple -= 0.025;
        }

        // Soft glow under the pointer
        const glow = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 40);
        glow.addColorStop(0, `rgba(${rgb}, 0.18)`);
        glow.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, 40, 0, Math.PI * 2);
        ctx.fill();
      }

      // Nodes
      for (const n of nodes) {
        const near = hasPointer && Math.hypot(pointer.x - n.x, pointer.y - n.y) < POINTER_RADIUS;
        const r = n.r * (Math.sin(n.phase) * 0.2 + 1);

        if (n.hub || near) {
          ctx.fillStyle = `rgba(${rgb}, ${near ? 0.15 : 0.08})`;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r * (near ? 4 : 3), 0, Math.PI * 2);
          ctx.fill();
        }

        if (n.hub) {
          const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r);
          g.addColorStop(0, near ? '#ffffff' : `rgb(${rgb})`);
          g.addColorStop(1, `rgba(${rgb}, 0.6)`);
          ctx.fillStyle = g;
        } else {
          ctx.fillStyle = `rgba(${rgb}, ${near ? 0.9 : 0.55})`;
        }
        ctx.beginPath();
        ctx.arc(n.x, n.y, near ? r * 1.3 : r, 0, Math.PI * 2);
        ctx.fill();

        if (n.hub) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.beginPath();
          ctx.arc(n.x, n.y, r * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const resize = () => {
      const prevW = w;
      w = window.innerWidth;
      h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, w < 768 ? 1 : 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Mobile browsers fire resize when the URL bar slides; re-seed only on width change
      if (w !== prevW) seed();
      if (!rafId) draw();
    };

    const loop = () => {
      update();
      draw();
      rafId = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!rafId && !reduceMotion) rafId = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(rafId);
      rafId = null;
    };

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    });
    document.addEventListener('mouseleave', () => {
      pointer.x = pointer.y = null;
    });
    window.addEventListener('mousedown', (e) => {
      if (e.target.closest('a, button, input, textarea, select')) return;
      pointer.ripple = 1;
      for (const n of nodes) {
        const dx = n.x - e.clientX;
        const dy = n.y - e.clientY;
        const d = Math.hypot(dx, dy);
        if (d === 0 || d >= CLICK_RADIUS) continue;
        const force = (CLICK_RADIUS - d) / CLICK_RADIUS;
        if (n.fixed) {
          n.x += (dx / d) * force * 20;
          n.y += (dy / d) * force * 20;
        } else {
          n.vx += (dx / d) * force * 12;
          n.vy += (dy / d) * force * 12;
        }
      }
    });
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    window.addEventListener('resize', resize);

    resize();
    start();
  }
})();
