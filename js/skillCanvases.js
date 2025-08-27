// js/skillCanvases.js
// Three themed, lightweight canvas animations (no 3D):
// 1) apps-visual  : app windows + cursor pulses
// 2) net-visual   : network graph with moving packets
// 3) tools-visual : rotating cogs
//
// All are DPR-aware, resize-safe, and match your cyan/teal palette.

const THEME = {
  bgStroke: 'rgba(18,52,69,.65)',
  glow: 'rgba(72,225,255,.18)',
  cyan: '#48E1FF',
  teal: '#00FFC6',
  ink: '#bfe1ef'
};

function makeLoop(canvas, draw) {
  if (!canvas) return { stop: () => {} };
  const ctx = canvas.getContext('2d');

  function fit() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = canvas.clientWidth | 0;
    const h = canvas.clientHeight | 0;
    canvas.width = Math.max(1, w * dpr);
    canvas.height = Math.max(1, h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fit();
  addEventListener('resize', fit);

  let raf = 0, t0 = performance.now();
  function tick(t) {
    raf = requestAnimationFrame(tick);
    draw(ctx, (t - t0) / 1000); // seconds
  }
  raf = requestAnimationFrame(tick);
  return { stop: () => cancelAnimationFrame(raf) };
}

/* ----------------------------- APPS VISUAL ------------------------------ */
// Floating app "windows" with soft cursor clicks
function appsVisual(canvas) {
  const boxes = [];
  const colors = [THEME.cyan, THEME.teal, '#7FE8FF', '#19B2FF'];

  function init(ctx) {
    boxes.length = 0;
    const { width: W, height: H } = ctx.canvas;
    const n = Math.max(6, Math.floor(W / 220));
    for (let i = 0; i < n; i++) {
      const w = 120 + Math.random() * 80;
      const h = 70 + Math.random() * 50;
      boxes.push({
        x: Math.random() * (W / ctx.getTransform().a - w),
        y: Math.random() * (H / ctx.getTransform().a - h),
        w, h,
        vx: (Math.random() * 0.6 + 0.2) * (Math.random() < .5 ? -1 : 1),
        vy: (Math.random() * 0.4 + 0.1) * (Math.random() < .5 ? -1 : 1),
        color: colors[i % colors.length],
        t: Math.random() * 10
      });
    }
  }

  return makeLoop(canvas, (ctx, s) => {
    if (!boxes.length) init(ctx);
    const W = canvas.width / (window.devicePixelRatio || 1);
    const H = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0,0,W,H);

    // subtle backdrop grid/glow
    ctx.save();
    const g1 = ctx.createLinearGradient(0,0,W,0);
    g1.addColorStop(0,'rgba(72,225,255,.06)');
    g1.addColorStop(1,'rgba(0,255,198,.05)');
    ctx.fillStyle = g1;
    ctx.fillRect(0,0,W,H);
    ctx.restore();

    // float boxes
    boxes.forEach(b=>{
      b.x += b.vx; b.y += b.vy; b.t += 0.015;
      if (b.x < 10 || b.x > W - b.w - 10) b.vx *= -1;
      if (b.y < 10 || b.y > H - b.h - 10) b.vy *= -1;

      // window body
      ctx.fillStyle = 'rgba(7,22,33,.95)';
      ctx.strokeStyle = THEME.bgStroke;
      ctx.lineWidth = 1;
      roundRect(ctx, b.x, b.y, b.w, b.h, 10, true, true);

      // title bar
      ctx.fillStyle = 'rgba(16,40,54,.9)';
      roundRect(ctx, b.x, b.y, b.w, 18, {tl:10,tr:10,br:0,bl:0}, true, false);

      // tiny controls
      ['#ff5f57','#ffbd2e','#28c840'].forEach((c,i)=>{
        ctx.fillStyle=c; ctx.beginPath();
        ctx.arc(b.x+12+i*10, b.y+9, 3, 0, Math.PI*2); ctx.fill();
      });

      // app icon bar shimmer
      const barY = b.y + b.h - 16;
      const gg = ctx.createLinearGradient(b.x, barY, b.x+b.w, barY);
      gg.addColorStop(0, `${b.color}88`);
      gg.addColorStop(1, `${b.color}22`);
      ctx.fillStyle = gg;
      roundRect(ctx, b.x+8, barY, b.w-16, 8, 4, true, false);

      // pulse "cursor click"
      const r = 6 + (Math.sin(b.t*2)+1)*6;
      ctx.strokeStyle = `${b.color}99`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(b.x + b.w*0.7, b.y + b.h*0.55, r, 0, Math.PI*2); ctx.stroke();
    });
  });
}

/* ---------------------------- NETWORKS VISUAL --------------------------- */
// Nodes + edges with packet dots traveling along links
function networksVisual(canvas) {
  const nodes = [], edges = [], packets = [];
  let W=0,H=0;

  function init(ctx){
    nodes.length = edges.length = packets.length = 0;
    W = ctx.canvas.width / (window.devicePixelRatio || 1);
    H = ctx.canvas.height / (window.devicePixelRatio || 1);

    const N = 9;
    for (let i=0;i<N;i++){
      nodes.push({
        x: 60 + Math.random()*(W-120),
        y: 60 + Math.random()*(H-120),
        r: 4 + Math.random()*3
      });
    }
    // connect to nearest neighbors
    for (let i=0;i<N;i++){
      const a = nodes[i];
      const others = nodes
        .map((n,j)=>({n, j, d: dist(a,n)}))
        .sort((u,v)=>u.d-v.d)
        .slice(1, 4);
      others.forEach(o=>{
        if (!edges.find(e=> (e.i===i && e.j===o.j) || (e.i===o.j && e.j===i))){
          edges.push({ i:i, j:o.j, w: 0.6 + Math.random()*0.8 });
        }
      });
    }
    // seed packets
    for (let k=0;k<22;k++){
      const e = edges[Math.floor(Math.random()*edges.length)];
      packets.push({
        e, t: Math.random(), speed: 0.002 + Math.random()*0.006,
        color: Math.random()<.5 ? THEME.cyan : THEME.teal
      });
    }
  }

  return makeLoop(canvas, (ctx)=>{
    if (!nodes.length) init(ctx);
    ctx.clearRect(0,0,W,H);

    // glow backdrop
    ctx.save();
    ctx.shadowBlur = 18; ctx.shadowColor = THEME.glow;
    edges.forEach(e=>{
      const a=nodes[e.i], b=nodes[e.j];
      ctx.strokeStyle = 'rgba(16,50,68,.9)';
      ctx.lineWidth = e.w;
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    });
    ctx.restore();

    // packets
    packets.forEach(p=>{
      p.t += p.speed; if (p.t>1) p.t=0;
      const a=nodes[p.e.i], b=nodes[p.e.j];
      const x = a.x + (b.x-a.x)*p.t;
      const y = a.y + (b.y-a.y)*p.t;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(x,y,2.2,0,Math.PI*2); ctx.fill();
    });

    // nodes
    nodes.forEach(n=>{
      ctx.fillStyle = '#0a1b25';
      ctx.strokeStyle = THEME.bgStroke; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(n.x,n.y,9,0,Math.PI*2); ctx.fill(); ctx.stroke();

      // inner dot
      ctx.fillStyle = THEME.ink;
      ctx.beginPath(); ctx.arc(n.x,n.y, n.r, 0, Math.PI*2); ctx.fill();
    });
  });
}

/* ----------------------------- TOOLS VISUAL ----------------------------- */
// Larger rotating cogs
function toolsVisual(canvas) {
  // Bigger radii + slightly spread out positions
  const gears = [
    { x: 130, y: 130, r: 90, teeth: 14, dir:  1, speed: 0.006, color: THEME.cyan },
    { x: 240, y: 200, r: 65, teeth: 12, dir: -1, speed: 0.010, color: THEME.teal },
    { x: 70,  y: 220, r: 50, teeth: 10, dir: -1, speed: 0.012, color: '#7FE8FF' }
  ];
  let t = 0;

  return makeLoop(canvas, (ctx, sec)=>{
    t = sec;
    const W = canvas.width / (window.devicePixelRatio||1);
    const H = canvas.height / (window.devicePixelRatio||1);
    ctx.clearRect(0,0,W,H);

    // gentle vignette
    const g = ctx.createRadialGradient(W*0.5, H*0.6, 0, W*0.5, H*0.6, Math.max(W,H)*0.9);
    g.addColorStop(0,'rgba(72,225,255,.05)');
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

    // draw gears larger
    gears.forEach((g,i)=>{
      const rot = t * g.speed * g.dir * (i===0?1:1.15);
      drawGear(ctx, g.x, g.y, g.r, g.teeth, rot, g.color);
    });
  });
}


/* ------------------------------- helpers -------------------------------- */
function roundRect(ctx, x, y, w, h, r, fill, stroke){
  if (typeof r === 'number') r = {tl:r,tr:r,br:r,bl:r};
  ctx.beginPath();
  ctx.moveTo(x+r.tl, y);
  ctx.lineTo(x+w-r.tr, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r.tr);
  ctx.lineTo(x+w, y+h-r.br);
  ctx.quadraticCurveTo(x+w, y+h, x+w-r.br, y+h);
  ctx.lineTo(x+r.bl, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r.bl);
  ctx.lineTo(x, y+r.tl);
  ctx.quadraticCurveTo(x, y, x+r.tl, y);
  if (fill) ctx.fill(); if (stroke) ctx.stroke();
}
function dist(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return Math.hypot(dx,dy); }

function drawGear(ctx, cx, cy, R, teeth, rot, color){
  const inner = R * 0.52;
  const toothH = R * 0.18;
  const steps = teeth * 2;
  ctx.save();
  ctx.translate(cx,cy);
  ctx.rotate(rot);

  // outer profile with teeth
  ctx.beginPath();
  for (let i=0;i<steps;i++){
    const angle = (i/steps) * Math.PI*2;
    const r = (i%2===0) ? R : R - toothH;
    const x = Math.cos(angle)*r;
    const y = Math.sin(angle)*r;
    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(7,22,33,.96)';
  ctx.strokeStyle = `${color}66`;
  ctx.lineWidth = 1.2;
  ctx.fill(); ctx.stroke();

  // inner circle
  ctx.beginPath();
  ctx.arc(0,0, inner, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(18,52,69,.7)';
  ctx.stroke();

  // hub
  ctx.beginPath();
  ctx.arc(0,0, inner*0.35, 0, Math.PI*2);
  ctx.fillStyle = color; ctx.globalAlpha = .85; ctx.fill(); ctx.globalAlpha = 1;
  ctx.restore();
}

/* ------------------------------ bootstraps ------------------------------- */
function byId(id){ return document.getElementById(id); }

appsVisual(  byId('apps-visual')  );
networksVisual(byId('net-visual') );
toolsVisual( byId('tools-visual') );
