// ===== ELEMENTS =====
const startScreen = document.getElementById('start-screen');
const startBtn    = document.getElementById('start-btn');
const canvas      = document.getElementById('game');
const ctx         = canvas.getContext('2d', { alpha:false });
const victory     = document.getElementById('victory'); // not used for text now
const videoEl     = document.getElementById('ending-video');

const stringStart = document.getElementById('string-start');
const sctx        = stringStart.getContext('2d');

// ===== STATE / CONSTANTS =====
ctx.imageSmoothingEnabled = false;
sctx.imageSmoothingEnabled = false;

const THREAD_COLOR = '#8b0000';
const SCORE_FACE_ONLY = true;

const state = {
  width: canvas.width,
  height: canvas.height,
  running:false, t:0, dt:0,
  keys:{}, pressed:{},
  images:{},
  hits:0, maxHits:3,
  boy:   { x: 24,  y: 110, w:64, h:64 },
  girl:  { x: 250, y: 60,  w:64, h:64, tx:250, ty:60, timer:0 },
  arrows:[],
  pops:[],
  phase:'start'
};

// bow to the RIGHT of the face (not on it)
const BOW_OFF = { x: 52, y: 18, w: 42, h: 42 };

// ===== ASSETS =====
function loadImage(key, src){
    return new Promise(res=>{
    const img = new Image();
    img.onload = ()=>{ state.images[key]=img; res(); };
    img.onerror= ()=>{ console.warn('missing', src); res(); };
    img.src = src;
  });
}

async function preload(){
  const A = [
    ['rami','assets/rami.png'],
    ['varun','assets/varun.png'],
    ['rstand','assets/rstand.png'],
    ['vstand','assets/vstand.png'],
    ['arrow','assets/arrow.png'],
    ['heart','assets/heartattack.png'],
    ['bow','assets/bow.png'],
    ['thread','assets/thread.png'],
  ];
  await Promise.all(A.map(([k,s])=>loadImage(k,s)));
  startThreadImage();
}
preload();

// ===== INPUT =====
addEventListener('keydown', e => state.keys[e.key.toLowerCase()] = true);
addEventListener('keyup',   e => state.keys[e.key.toLowerCase()] = false);
function pressedOnce(k){
  if(!state.pressed[k] && state.keys[k]) { state.pressed[k]=true; return true; }
  if(state.pressed[k] && !state.keys[k]) state.pressed[k]=false;
  return false;
}

// ===== START =====
startBtn.addEventListener('click', () => {
  startScreen.style.display='none';
  canvas.style.display='block';
  state.phase='play';
  state.running=true;
  requestAnimationFrame(loop);
});

// ===== LOOP =====
let last=0;
function loop(ts){
  if(!state.running) return;
  state.dt = Math.min(1/30, (ts-last)/1000 || 0); last = ts; state.t = ts;
  update(state.dt);
  render();
  requestAnimationFrame(loop);
}

// ===== UPDATE =====
// ===== UPDATE =====
function update(dt){
  if(state.phase!=='play') return;

  // Boy movement (full range)
  const v = 120;
  if(state.keys['arrowleft'] || state.keys['a'])  state.boy.x -= v*dt;
  if(state.keys['arrowright']|| state.keys['d'])  state.boy.x += v*dt;
  if(state.keys['arrowup']   || state.keys['w'])  state.boy.y -= v*dt;
  if(state.keys['arrowdown'] || state.keys['s'])  state.boy.y += v*dt;
  state.boy.x = clamp(state.boy.x, 0, state.width  - state.boy.w);
  state.boy.y = clamp(state.boy.y, 0, state.height - state.boy.h - 4);

  // Shoot
  if(pressedOnce(' ') || pressedOnce('space')) shoot();

  // Projectiles
  for(const a of state.arrows){ 
    a.x += a.vx*dt; 
    a.y += a.vy*dt; 
    
    // Check for hits and mark them instead of immediately removing
    if(!a.hit && faceHit(a, state.girl)){
      a.hit = true; // Mark as hit but don't remove yet
      a.hitTimer = 0.1; // Show for 0.1 seconds after hit
      popHeart();
      state.hits++;
      if(state.hits >= state.maxHits) winSequence();
    }
    
    // Update hit timer for arrows that hit
    if(a.hit) {
      a.hitTimer -= dt;
    }
  }
  
  // Remove arrows that are off-screen OR have finished their hit display time
  state.arrows = state.arrows.filter(a => a.x < state.width + 220 && (!a.hit || a.hitTimer > 0));

  // Girl: EXTREMELY FAST and challenging movement
  state.girl.timer -= dt;
  
  const minGap = 100; // KEEPS MORE DISTANCE FROM PLAYER
  const maxGap = 180;
  const minX = Math.max(state.boy.x + minGap, state.width * 0.4);
  const maxX = Math.min(state.boy.x + maxGap, state.width - 60);

  if (state.girl.timer <= 0) {
    // Choose new target position that's away from the boy
    const angle = Math.random() * Math.PI * 2; // Random direction
    const distance = randInt(60, 120); // LONGER distance moves
    
    state.girl.tx = clamp(state.girl.x + Math.cos(angle) * distance, minX, maxX);
    state.girl.ty = clamp(state.girl.y + Math.sin(angle) * distance, 20, 120);
    
    state.girl.timer = randRange(0.3, 0.7); // VERY frequent direction changes
  }
  
  // EXTREMELY FAST movement
  const moveSpeed = 0.85; // MUCH FASTER
  state.girl.x += (state.girl.tx - state.girl.x) * moveSpeed;
  state.girl.y += (state.girl.ty - state.girl.y) * moveSpeed;

  // Keep girl in bounds
  state.girl.x = clamp(state.girl.x, state.width * 0.4, state.width - 60);
  state.girl.y = clamp(state.girl.y, 20, state.height - state.girl.h - 10);

  // Pop effects
  for(const p of state.pops) p.t += dt;
  state.pops = state.pops.filter(p => p.t < 0.9);
}

function shoot(){
  // Only show arrow when shooting
  const sx = state.boy.x + BOW_OFF.x + 8;
  const sy = state.boy.y + BOW_OFF.y + 8;
  state.arrows.push({ 
    x: sx, 
    y: sy, 
    w: 96, 
    h: 48, 
    vx: 400, 
    vy: 0,
    hit: false, // Add hit tracking
    hitTimer: 0 
  }); // FASTER arrows
}

function popHeart(){
  state.pops.push({ t:0, x: state.width/2 - 16, y: state.height/2 - 16 });
}

// ===== RENDER =====
function render(){
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#0f0e15'; ctx.fillRect(0,0,canvas.width,canvas.height);

  if(state.phase==='play'){
    // Order: boy face -> bow (beside face) -> arrows only when shooting -> girl
    drawSprite(state.images.varun, state.boy.x, state.boy.y, state.boy.w, state.boy.h);
    if(state.images.bow){
      drawSprite(state.images.bow, state.boy.x + BOW_OFF.x, state.boy.y + BOW_OFF.y, BOW_OFF.w, BOW_OFF.h);
    }
    // Draw arrows (only visible when shooting)
    for(const a of state.arrows) drawSprite(state.images.arrow, a.x, a.y, a.w, a.h);
    
    drawSprite(state.images.rami, state.girl.x, state.girl.y, state.girl.w, state.girl.h);

    // Pop
    for(const p of state.pops){
      const s = 1 + p.t*0.8, a = 1 - p.t/0.9;
      ctx.save(); ctx.globalAlpha = a;
      ctx.translate(p.x+16, p.y+16); ctx.scale(s, s); ctx.translate(-16,-16);
      drawSprite(state.images.heart, 0, 0, 32, 32);
      ctx.restore();
    }

    drawHeartsHUD(state.hits, state.maxHits);

    // Controls text (with up/down)
    ctx.font = '12px "Press Start 2P"';
    ctx.fillStyle = '#efe3d0';
    ctx.fillText('← → ↑ ↓ MOVE   SPACE SHOOT', 10, 208);
  }

  if(state.phase==='ending'){
    renderEnding();
  }
}

// ===== HUD =====
function drawHeartsHUD(h, total){
  const x0=10, y0=8;
  for(let i=0;i<total;i++){
    pixelHeart(x0+i*26, y0, i<h ? '#ff4d6d' : '#5b4f5c');
  }
}
function pixelHeart(x,y,color){
  const s=2;
  const grid=[
    "01100110","11111111","11111111",
    "11111111","01111110","00111100","00011000",
  ];
  ctx.fillStyle=color;
  for(let r=0;r<grid.length;r++)
    for(let c=0;c<grid[r].length;c++)
      if(grid[r][c]==='1') ctx.fillRect(x+c*s,y+r*s,s,s);
}

// ===== ENDING =====
let end = { t:0, gx:0, bx:0, phase:'slide', heartT:0, showText:true };
function winSequence(){
  state.phase='ending';
  // Start positions closer together
  end.t=0; end.phase='slide'; end.heartT=0; end.showText=true;
  end.gx = state.width/2 - 100;
  end.bx = state.width/2 + 36;
}

function renderEnding(){
  end.t += state.dt;

  const midY = state.height/2 - 70;
  
  // Sprites get REALLY close - almost overlapping
  const targetLeft  = state.width/2 - 48;
  const targetRight = state.width/2 - 16;
  end.gx += (targetLeft  - end.gx)*0.08;
  end.bx += (targetRight - end.bx)*0.08;

  drawSprite(state.images.rstand, end.gx, midY, 64, 96);
  drawSprite(state.images.vstand, end.bx, midY, 64, 96);

  // Hand anchors - adjusted to better match sprite hand positions
  const x1 = end.gx + 52, y1 = midY + 68;
  const x2 = end.bx + 12, y2 = midY + 68;

  // Straight shaky thread between hands
  drawShakyString(ctx, x1,y1, x2,y2, 1.0);

  const dist = Math.abs(x2 - x1);
  if(dist < 15) {
    end.phase = 'heart';
  }

  // Big heart appears when really close
  if(end.phase === 'heart'){
    end.heartT += state.dt;
    const cx = (x1+x2)/2, cy = (y1+y2)/2 - 25;
    const scale = Math.min(3.5, 0.5 + end.heartT*2.0);
    ctx.save();
    ctx.globalAlpha = Math.min(1, end.heartT * 2);
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-16, -16);
    drawSprite(state.images.heart, 0, 0, 32, 32);
    ctx.restore();
  }

  // Clean system font message below sprites
  ctx.font = '18px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
  ctx.fillStyle = '#efe3d0';
  ctx.textAlign = 'center';
  ctx.fillText('You sparked magic, love begins soon...', state.width/2, midY + 140);

  // End stays for 3 seconds total
  if(end.heartT > 2.0){
    ctx.fillStyle='rgba(0,0,0,0.05)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    if(end.heartT > 5.0){
      canvas.style.display='none';
      videoEl.style.display='block';
      try{ videoEl.play(); }catch(e){}
      state.running=false;
    }
  }
}

// ===== START SCREEN - ADJUSTABLE LARGE THREAD IMAGE =====
function startThreadImage(){
  const w = stringStart.width, h = stringStart.height;

  stringStart.style.position = 'relative';
  stringStart.style.zIndex = '2';

  // Adjust these values to make thread larger and position it correctly
  const scale = 2.0;
  const threadWidth = w * scale;
  const threadHeight = h * scale;
  const threadX = -w * 0.05;
  const threadY = -h * 0.25;

  function frame(){
    sctx.clearRect(0, 0, w, h);
    
    if(state.images.thread){
      sctx.drawImage(
        state.images.thread, 
        threadX, 
        threadY, 
        threadWidth, 
        threadHeight
      );
    }
    
    requestAnimationFrame(frame);
  }
  frame();
}

// ===== CLICKABLE VERSION FOR PERFECT THREAD POSITIONING =====
function startThreadImageClickable(){
  const w = stringStart.width, h = stringStart.height;

  stringStart.style.position = 'relative';
  stringStart.style.zIndex = '5';

  let threadX = 0;
  let threadY = 0;
  let threadWidth = w;
  let threadHeight = h;

  console.log('🎯 THREAD POSITIONING: Click on the start screen to position the thread');
  console.log('The thread will center on your click position');

  stringStart.addEventListener('click', (e) => {
    const rect = stringStart.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Center thread on click position
    threadX = clickX - threadWidth / 2;
    threadY = clickY - threadHeight / 2;
    
    console.log(`📍 Thread centered at: x=${Math.round(threadX)}, y=${Math.round(threadY)}`);
  });

  function frame(){
    sctx.clearRect(0, 0, w, h);
    
    if(state.images.thread){
      sctx.drawImage(
        state.images.thread, 
        threadX, 
        threadY, 
        threadWidth, 
        threadHeight
      );
    }
    
    requestAnimationFrame(frame);
  }
  frame();
}

// ===== PRECISE FACE HIT DETECTION =====
function faceHit(arrow, girl){
  // More precise face region - smaller and better positioned
  const facePaddingX = girl.w * 0.25;
  const facePaddingY = girl.h * 0.15;
  const faceWidth = girl.w * 0.5;
  const faceHeight = girl.h * 0.4;
  
  const fx = girl.x + facePaddingX;
  const fy = girl.y + facePaddingY;
  const fw = faceWidth;
  const fh = faceHeight;
  
  // Debug: uncomment to see hitbox (remove in final version)
  // ctx.strokeStyle = 'red';
  // ctx.strokeRect(fx, fy, fw, fh);
  
  // Precise arrow-face collision
  const arrowRight = arrow.x + arrow.w;
  const arrowBottom = arrow.y + arrow.h;
  const faceRight = fx + fw;
  const faceBottom = fy + fh;
  
  return (arrow.x < faceRight && 
          arrowRight > fx && 
          arrow.y < faceBottom && 
          arrowBottom > fy);
}

// ===== THREAD DRAWING (for ending scene) =====
function drawShakyString(g, x1,y1, x2,y2, amp=1.5, segs=40){
  const dx=x2-x1, dy=y2-y1, ang=Math.atan2(dy,dx);
  const nx=Math.cos(ang+Math.PI/2), ny=Math.sin(ang+Math.PI/2);

  g.save();
  g.lineWidth = 4;
  g.lineCap = 'round';
  g.strokeStyle = THREAD_COLOR;
  g.beginPath();
  g.moveTo(x1,y1);
  for(let i=1;i<=segs;i++){
    const t=i/segs;
    const x = x1 + dx*t;
    const y = y1 + dy*t;
    const wob = Math.sin((t*12) + performance.now()/400) * 3.0 * amp;
    g.lineTo(x + nx*wob, y + ny*wob);
  }
  g.stroke();
  g.fillStyle=THREAD_COLOR;
  g.fillRect(x1-4,y1-3,8,6);
  g.fillRect(x2-4,y2-3,8,6);
  g.restore();
}

// ===== HELPERS =====
function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
function randInt(a,b){ return a + Math.floor(Math.random()*(b-a+1)); }
function randRange(a,b){ return a + Math.random()*(b-a); }

function drawSprite(img,x,y,w,h){ if(img) ctx.drawImage(img, x|0, y|0, w|0, h|0); }


