
'use strict';
const $=id=>document.getElementById(id);
const DIRS=[[-1,-1],[-1,1],[1,-1],[1,1]];
const clone=b=>b.map(r=>r.slice());
const color=p=>p?p.toLowerCase():null;
const king=p=>p==='R'||p==='B';
const opp=c=>c==='r'?'b':'r';
const inb=(r,c)=>r>=0&&r<8&&c>=0&&c<8;
const forward=c=>c==='r'?-1:1;
let ysdk=null,worker=null,aiBusy=false,aiRequest=0,aiTimer=null,aiWatchdog=null,mode='ai',difficulty=2,soundOn=true,gameStarted=false,toastTimer=null;
const S={board:[],turn:'r',selected:null,legal:[],history:[],captures:{r:0,b:0},moves:0,winner:null,chain:null,animating:false};

function initial(){const b=Array.from({length:8},()=>Array(8).fill(null));for(let r=0;r<3;r++)for(let c=0;c<8;c++)if((r+c)%2)b[r][c]='b';for(let r=5;r<8;r++)for(let c=0;c<8;c++)if((r+c)%2)b[r][c]='r';return b}
function captures(b,r,c,p){const out=[],co=color(p);if(king(p)){for(const[dR,dC]of DIRS){let rr=r+dR,cc=c+dC,e=null;while(inb(rr,cc)){if(b[rr][cc]){if(color(b[rr][cc])===co||e)break;e=[rr,cc]}else if(e)out.push({from:[r,c],to:[rr,cc],capture:e.slice()});rr+=dR;cc+=dC}}}else{for(const[dR,dC]of DIRS){const mr=r+dR,mc=c+dC,tr=r+2*dR,tc=c+2*dC;if(inb(tr,tc)&&b[mr]?.[mc]&&color(b[mr][mc])===opp(co)&&!b[tr][tc])out.push({from:[r,c],to:[tr,tc],capture:[mr,mc]})}}return out}
function moves(b,r,c,p){const out=[],co=color(p);if(king(p)){for(const[dR,dC]of DIRS){let rr=r+dR,cc=c+dC;while(inb(rr,cc)&&!b[rr][cc]){out.push({from:[r,c],to:[rr,cc],capture:null});rr+=dR;cc+=dC}}}else{for(const dR of[-1,1])for(const dC of[-1,1]){const rr=r+dR,cc=c+dC;if(inb(rr,cc)&&!b[rr][cc])out.push({from:[r,c],to:[rr,cc],capture:null})}}return out}
function legal(b,co){const cs=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=b[r][c];if(color(p)===co)cs.push(...captures(b,r,c,p))}if(cs.length)return cs;const ms=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=b[r][c];if(color(p)===co)ms.push(...moves(b,r,c,p))}return ms}
function apply(b,m){const nb=clone(b);let p=nb[m.from[0]][m.from[1]];nb[m.from[0]][m.from[1]]=null;if(m.capture)nb[m.capture[0]][m.capture[1]]=null;if(!king(p)&&((color(p)==='r'&&m.to[0]===0)||(color(p)==='b'&&m.to[0]===7)))p=p.toUpperCase();nb[m.to[0]][m.to[1]]=p;return {board:nb,piece:p}}
function snapshot(){return {board:clone(S.board),turn:S.turn,captures:{...S.captures},moves:S.moves,chain:S.chain?S.chain.slice():null}}
function restore(x){S.animating=false;S.board=clone(x.board);S.turn=x.turn;S.captures={...x.captures};S.moves=x.moves;S.chain=x.chain?x.chain.slice():null;S.selected=null;S.legal=legal(S.board,S.turn);S.winner=null}

function render(){const by=new Map();for(const m of S.legal){const k=m.from.join(',');if(!by.has(k))by.set(k,[]);by.get(k).push(m)}$('board').querySelectorAll('.cell').forEach(x=>x.remove());for(let r=0;r<8;r++)for(let c=0;c<8;c++){const cell=document.createElement('div');cell.className='cell '+((r+c)%2?'dark':'light');cell.dataset.r=r;cell.dataset.c=c;const key=r+','+c;if(S.selected?.[0]===r&&S.selected?.[1]===c)cell.classList.add('selected');if(by.has(key))cell.classList.add('selectable');const target=S.selected&&S.legal.find(m=>m.from[0]===S.selected[0]&&m.from[1]===S.selected[1]&&m.to[0]===r&&m.to[1]===c);if(target)cell.classList.add(target.capture?'capture':'move');cell.addEventListener('click',()=>clickCell(r,c));const p=S.board[r][c];if(p){const el=document.createElement('div');el.className='piece '+(color(p)==='r'?'red':'black')+(king(p)?' king':'');if(by.has(key))el.classList.add('hint');cell.appendChild(el)}$('board').appendChild(cell)}updateUI()}
function updateUI(){const flat=S.board.flat();$('redCount').textContent=flat.filter(p=>color(p)==='r').length;$('blackCount').textContent=flat.filter(p=>color(p)==='b').length;$('redCaptured').textContent=S.captures.r;$('blackCaptured').textContent=S.captures.b;$('redKings').textContent=flat.filter(p=>p==='R').length;$('blackKings').textContent=flat.filter(p=>p==='B').length;$('redTurn').classList.toggle('active',S.turn==='r');$('blackTurn').classList.toggle('active',S.turn==='b');$('turnBadge').textContent=S.turn==='r'?'Ход красных':'Ход чёрных';$('statusText').textContent=aiBusy?'Компьютер думает…':S.chain?'Продолжайте взятие':'Выберите шашку'}
function clickCell(r,c){if(S.winner||aiBusy||(mode==='ai'&&S.turn==='b'))return;const p=S.board[r][c];const chosen=S.selected&&S.legal.find(m=>m.from[0]===S.selected[0]&&m.from[1]===S.selected[1]&&m.to[0]===r&&m.to[1]===c);if(chosen){make(chosen);return}if(p&&color(p)===S.turn){const ms=S.legal.filter(m=>m.from[0]===r&&m.from[1]===c);if(ms.length){S.selected=[r,c];render()}}}
function cellAt(r,c){return $('board').querySelector(`.cell[data-r="${r}"][data-c="${c}"]`)}
function animateMove(m){
  if(!m||S.animating)return;
  S.animating=true; S.history.push(snapshot());
  const layer=$('animLayer'), source=cellAt(m.from[0],m.from[1]), target=cellAt(m.to[0],m.to[1]);
  const piece=source?.querySelector('.piece');
  if(!piece||!target){commitMove(m);return}
  const br=$('board').getBoundingClientRect(), sr=source.getBoundingClientRect(), tr=target.getBoundingClientRect();
  const ghost=piece.cloneNode(true);
  ghost.style.position='absolute'; ghost.style.left=(sr.left-br.left+(sr.width-piece.offsetWidth)/2)+'px'; ghost.style.top=(sr.top-br.top+(sr.height-piece.offsetHeight)/2)+'px';
  ghost.style.width=piece.offsetWidth+'px'; ghost.style.height=piece.offsetHeight+'px'; ghost.style.margin='0'; ghost.style.transform='translate3d(0,0,0)'; ghost.style.transition='none'; ghost.classList.remove('hint'); layer.appendChild(ghost); piece.style.opacity='0';
  let captured=null;
  if(m.capture){const cc=cellAt(m.capture[0],m.capture[1]);captured=cc?.querySelector('.piece');if(captured)captured.classList.add('captured')}
  const dx=tr.left-sr.left, dy=tr.top-sr.top, duration=m.capture?360:300;
  const anim=ghost.animate([
    {transform:'translate3d(0,0,0) scale(.98)'},
    {transform:`translate3d(${dx}px,${dy}px,0) scale(1.035)`},
    {transform:`translate3d(${dx}px,${dy}px,0) scale(1)`}
  ],{duration,easing:'cubic-bezier(.16,1,.3,1)',fill:'forwards'});
  anim.finished.then(()=>{ghost.remove();if(captured)captured.remove();commitMove(m)}).catch(()=>{ghost.remove();commitMove(m)});
}
function commitMove(m){
  const a=apply(S.board,m), oldPiece=S.board[m.from[0]][m.from[1]];
  S.board=a.board;if(m.capture)S.captures[S.turn]++;S.moves++;sound(m.capture?'capture':'move');
  const promoted=!king(oldPiece)&&king(a.piece), more=m.capture?captures(S.board,m.to[0],m.to[1],a.piece):[];
  S.animating=false;
  if(m.capture&&more.length){S.chain=m.to.slice();S.selected=m.to.slice();S.legal=more;render();save();
    if(mode==='ai'&&S.turn==='b'&&!S.winner){aiTimer=setTimeout(()=>{aiTimer=null;ai(true)},140)}
    return
  }
  S.chain=null;S.selected=null;S.turn=opp(S.turn);S.legal=legal(S.board,S.turn);checkEnd();render();
  const landed=cellAt(m.to[0],m.to[1])?.querySelector('.piece');
  if(landed){landed.classList.add('land');if(promoted)landed.classList.add('kinged');setTimeout(()=>landed.classList.remove('land','kinged'),520)}
  save();if(!S.winner&&mode==='ai'&&S.turn==='b')setTimeout(ai,180);
}
function make(m){animateMove(m)}
function checkEnd(){const r=S.board.flat().some(p=>color(p)==='r'),b=S.board.flat().some(p=>color(p)==='b');if(!r)return end('b');if(!b)return end('r');if(!legal(S.board,S.turn).length)return end(opp(S.turn))}
function end(w){cancelAI();S.winner=w;aiBusy=false;stopGameplay();$('resultTitle').textContent=w==='r'?'🏆 Победа!':'Игра окончена';$('resultText').textContent=mode==='ai'?(w==='r'?'Вы победили компьютер. Отличная партия!':'Компьютер победил. Попробуйте ещё раз!'):(w==='r'?'Победили красные!':'Победили чёрные!');$('resultMoves').textContent=S.moves;$('resultCaptures').textContent=S.captures.r+S.captures.b;$('result').classList.remove('hidden');showAdMaybe()}
function undo(){if(aiBusy||S.animating||!S.history.length||S.winner)return;let n=mode==='ai'&&S.turn==='r'?2:1, snap=null;while(n--&&S.history.length)snap=S.history.pop();if(snap){restore(snap);render();save();}}

function save(){try{localStorage.setItem('checkers.pro.save',JSON.stringify({version:2,mode,difficulty,soundOn,state:snapshot()}))}catch(e){}}
function load(){try{const x=JSON.parse(localStorage.getItem('checkers.pro.save')||'null');if(!x?.state?.board)return false;mode=x.mode||'ai';difficulty=x.difficulty||2;soundOn=x.soundOn!==false;restore(x.state);gameStarted=true;return true}catch(e){return false}}
function cancelAI(){aiRequest++;if(aiTimer){clearTimeout(aiTimer);aiTimer=null}if(aiWatchdog){clearTimeout(aiWatchdog);aiWatchdog=null}aiBusy=false}
function newGame(){cancelAI();S.animating=false;$('animLayer').innerHTML='';S.board=initial();S.turn='r';S.selected=null;S.legal=legal(S.board,'r');S.history=[];S.captures={r:0,b:0};S.moves=0;S.winner=null;S.chain=null;aiBusy=false;gameStarted=true;$('result').classList.add('hidden');startGameplay();render();save()}

function ai(forced=false){if(aiBusy||S.winner||S.turn!=='b'||(mode!=='ai'))return;aiBusy=true;render();const request=++aiRequest;const legalMoves=S.chain?S.legal:legal(S.board,'b');if(!legalMoves.length){aiBusy=false;checkEnd();render();return}
  const payload={board:S.board,turn:'b',difficulty,maxTime:difficulty===1?500:difficulty===2?1800:difficulty===3?5000:difficulty===4?12000:22000,forcedMoves:S.chain?legalMoves:null};
  if(worker){worker.postMessage({type:'think',request,...payload});aiWatchdog=setTimeout(()=>{if(request!==aiRequest||!aiBusy)return;aiBusy=false;toast('Компьютер задумался слишком надолго');try{worker.terminate()}catch(e){}worker=null;makeWorker();ai()},Math.max(payload.maxTime+1800,2500));return}
  aiTimer=setTimeout(()=>{if(request!==aiRequest||S.winner||S.turn!=='b'){aiBusy=false;return}const ms=S.chain?S.legal:legal(S.board,'b');const m=ms[Math.floor(Math.random()*ms.length)];aiBusy=false;if(m)make(m);},40)}
function makeWorker(){try{worker=new Worker('ai-worker.js');worker.onmessage=e=>{if(e.data.type!=='best'||!aiBusy||e.data.request!==aiRequest)return;if(aiWatchdog){clearTimeout(aiWatchdog);aiWatchdog=null}aiBusy=false;const m=e.data.move; if(m && S.turn==='b' && !S.winner){make(m)}else{checkEnd();render()}};worker.onerror=()=>{worker=null;cancelAI();toast('ИИ перезапущен');makeWorker();if(S.turn==='b'&&mode==='ai'&&!S.winner)ai()}}catch(e){worker=null}}

let audio=null;function sound(type){if(!soundOn)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=type==='capture'?180:310;g.gain.setValueAtTime(.045,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.12);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.12);if(navigator.vibrate)navigator.vibrate(type==='capture'?20:8)}catch(e){}}
function toggleSound(){soundOn=!soundOn;$('soundBtn').textContent=soundOn?'🔊':'🔇';$('menuSound').textContent=soundOn?'Включён':'Выключен';save()}
function toast(t){clearTimeout(toastTimer);$('toast').textContent=t;$('toast').classList.add('show');toastTimer=setTimeout(()=>$('toast').classList.remove('show'),1800)}

async function initYandex(){try{if(window.YaGames){ysdk=await YaGames.init();try{ysdk.features?.LoadingAPI?.ready()}catch(e){}}}catch(e){console.warn(e)}}
function startGameplay(){try{ysdk?.features?.GameplayAPI?.start()}catch(e){}}
function stopGameplay(){try{ysdk?.features?.GameplayAPI?.stop()}catch(e){}}
function showAdMaybe(){const n=Number(localStorage.getItem('checkers.pro.games')||0)+1;localStorage.setItem('checkers.pro.games',n);if(n%3!==0||!ysdk?.adv?.showFullscreenAdv)return;try{ysdk.adv.showFullscreenAdv({callbacks:{onClose:startGameplay,onError:startGameplay}})}catch(e){}}

$('newBtn').onclick=newGame;$('undoBtn').onclick=undo;$('againBtn').onclick=newGame;$('soundBtn').onclick=toggleSound;$('menuSound').onclick=toggleSound;$('menuBtn').onclick=()=>{cancelAI();$('menu').classList.remove('hidden');stopGameplay()};$('resultMenuBtn').onclick=()=>{cancelAI();$('result').classList.add('hidden');$('menu').classList.remove('hidden');stopGameplay()};$('startBtn').onclick=()=>{$('menu').classList.add('hidden');newGame()};$('continueBtn').onclick=()=>{$('menu').classList.add('hidden');if(load()){render();startGameplay()}else newGame()};$('aiMode').onclick=()=>{mode='ai';$('aiMode').classList.add('active');$('twoMode').classList.remove('active')};$('twoMode').onclick=()=>{mode='two';$('twoMode').classList.add('active');$('aiMode').classList.remove('active')};$('difficulty').onchange=e=>difficulty=+e.target.value;
window.addEventListener('yandex-sdk-ready',initYandex);makeWorker();if(!load())newGame();else{render();startGameplay()};
