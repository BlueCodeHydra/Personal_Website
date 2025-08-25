/* Programming charts (OOP vs Non-OOP) — no deps */
(() => {
  // palette with more variety but on-brand
  const PALETTE = [
    '#48E1FF', '#00FFC6', '#7FE8FF', '#19B2FF',
    '#58FFD7', '#B56DFF', '#FF7DF7', '#35D6FF'
  ];

  function setupDonut(canvasId, legendId, centerLabel, items){
    const c = document.getElementById(canvasId);
    const legend = document.getElementById(legendId);
    if (!c || !legend) return;

    // Hi-DPI crispness using the canvas attributes for logical size
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const size = Math.min(c.width, c.height);
    c.width = size * dpr; c.height = size * dpr;
    c.style.width = size + 'px'; c.style.height = size + 'px';
    const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);

    const cx = size/2, cy = size/2;
    const radius = size * 0.38;    // ring radius
    const lw = size * 0.18;        // ring thickness
    const total = items.reduce((a,b)=>a+b.value,0);

    const draw = (t) => {
      ctx.clearRect(0,0,size,size);

      // track ring
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(18,52,69,.6)';
      ctx.beginPath(); ctx.arc(cx,cy,radius,0,Math.PI*2); ctx.stroke();

      // segments
      let start = -Math.PI/2;
      items.forEach((it,i)=>{
        const end = start + (it.value/total) * Math.PI*2;
        const sweep = start + (end - start) * t;

        // subtle gradient per segment for depth
        const g = ctx.createLinearGradient(cx-radius, cy-radius, cx+radius, cy+radius);
        g.addColorStop(0, it.color);
        g.addColorStop(1, (i%2) ? it.color + 'CC' : it.color);

        ctx.strokeStyle = g;
        ctx.shadowBlur = 14;
        ctx.shadowColor = it.color + 'AA';

        ctx.beginPath();
        ctx.arc(cx,cy,radius,start,sweep);
        ctx.stroke();

        start = end;
      });

      // center soft fill + label
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(72,225,255,.08)';
      ctx.beginPath(); ctx.arc(cx,cy,radius-lw/2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#bfe1ef';
      ctx.font = `600 ${Math.round(size*0.10)}px Roboto`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(centerLabel, cx, cy);
    };

    function animate(){
      const s = performance.now();
      function step(n){
        const t = Math.min(1, (n - s) / 900);
        draw(t);
        if (t < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    // build legend
    legend.innerHTML = '';
    items.forEach(it=>{
      const li = document.createElement('li');
      li.innerHTML = `<i style="background:${it.color}"></i><span>${it.name}</span><b>${it.value}</b>`;
      legend.appendChild(li);
    });

    // animate when visible
    const io = new IntersectionObserver(es=>{
      es.forEach(e=>{ if (e.isIntersecting){ animate(); io.unobserve(c); }});
    },{threshold:.3});
    io.observe(c);
  }

    function initCharts(){
    // OOP — use widely separated hues
    setupDonut('oopPie','oopLegend','OOP',[
        {name:'Java',       value:25, color:PALETTE[0]}, // cyan
        {name:'Python',     value:20, color:PALETTE[6]}, // hot magenta
        {name:'C++',        value:40, color:PALETTE[1]}, // teal
        {name:'JavaScript', value:15, color:PALETTE[5]}, // purple
    ]);

    // Non-OOP / Markup — different hues from OOP and from each other
    setupDonut('nonOopPie','nonOopLegend','Non-OOP',[
        {name:'HTML',    value:30, color:PALETTE[3]}, // electric blue
        {name:'C',       value:60, color:PALETTE[5]}, // purple
        {name:'Arduino', value:10, color:PALETTE[4]}, // mint/seafoam
    ]);
    }


  if (document.readyState !== 'loading') initCharts();
  else document.addEventListener('DOMContentLoaded', initCharts);
})();
