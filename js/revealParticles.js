// Rectangular particle "plate" that fades in -> holds -> fades out.
// Runs once for every .reveal-particles section.
// Keeps easing consistent with the logo scene.

const SECTIONS = document.querySelectorAll('.reveal-particles');

// same easings as logo scene
const clamp01 = v => Math.max(0, Math.min(1, v));
const easeOutExpo = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeInOut = t => (t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2)/2);

SECTIONS.forEach(section => {
  // ensure our section can host an absolutely-positioned overlay
  section.classList.add('rp-host');

  const obs = new IntersectionObserver(entries => {
    const e = entries[0];
    if (!e.isIntersecting) return;
    runPlate(section);
    obs.disconnect();
  }, { threshold: 0.25 });
  obs.observe(section);
});

function runPlate(section) {
  // Create the overlay canvas
  const c = document.createElement('canvas');
  c.className = 'rp-overlay';
  section.prepend(c);
  const ctx = c.getContext('2d');

  // Size: centered rect inside the section
  const bounds = section.getBoundingClientRect();
  const padX = 24; // small edge breathing room
  const padY = 24;

  // Canvas pixels (cap for perf)
  const pxW = Math.min( Math.floor(bounds.width  - padX*2), 1200);
  const pxH = Math.min( Math.floor(Math.min(bounds.height - padY*2, 480)), 480);
  if (pxW < 240 || pxH < 160) { // section too small -> skip gracefully
    section.classList.add('show');
    c.remove();
    return;
  }

  // Size & center the canvas in CSS pixels
  c.width = pxW; c.height = pxH;
  c.style.width  = pxW + 'px';
  c.style.height = pxH + 'px';
  c.style.left   = '50%';
  c.style.top    = '0';
  c.style.transform = 'translateX(-50%)';

  // Build a uniform grid of particles in a perfect rectangle
  const step = 7;            // dot spacing
  const jitter = 0.0;        // keep at 0 for uniform
  const dots = [];
  for (let y = step; y <= pxH - step; y += step) {
    for (let x = step; x <= pxW - step; x += step) {
      dots.push({
        x: x + (Math.random() - 0.5) * jitter,
        y: y + (Math.random() - 0.5) * jitter,
        r: 1 + Math.random()*1.2
      });
    }
  }

  const COLOR = '#6be3ff';
  const BG_GLITTER = 'rgba(107, 227, 255, 0.08)';

  // Timeline (ms)
  const T_FADE_IN  = 650;
  const T_HOLD     = 900;
  const T_FADE_OUT = 650;

  const t0 = performance.now();
  let phase = 'in';

  // Hide content until we’re ready to show it
  // (we'll add .show shortly so the CSS fade-up runs)
  section.classList.remove('show');

  requestAnimationFrame(loop);
  function loop(now) {
    let t = now - t0;
    let alpha = 0;

    if (phase === 'in') {
      const p = clamp01(t / T_FADE_IN);
      alpha = easeOutExpo(p);
      if (p >= 1) { phase = 'hold'; t0 = performance.now(); }
    }
    else if (phase === 'hold') {
      alpha = 1;
      if (t >= T_HOLD) {
        // Start revealing the actual section content right as we begin fade-out
        section.classList.add('show');
        phase = 'out';
        t0 = performance.now();
      }
    }
    else if (phase === 'out') {
      const p = clamp01(t / T_FADE_OUT);
      alpha = 1 - easeInOut(p);
      if (p >= 1) {
        // Done — remove overlay
        c.remove();
        return;
      }
    }

    // Draw
    ctx.clearRect(0, 0, pxW, pxH);

    // Light glitter fill so the plate reads as a solid rectangle (very subtle)
    ctx.globalAlpha = alpha * 0.6;
    ctx.fillStyle = BG_GLITTER;
    ctx.fillRect(0, 0, pxW, pxH);

    // Dots
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLOR;
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      // simple square dots keep the ironman/circuit vibe
      ctx.fillRect(d.x, d.y, d.r, d.r);
    }

    requestAnimationFrame(loop);
  }
}
