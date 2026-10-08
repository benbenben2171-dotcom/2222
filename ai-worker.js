'use strict';
/* Checkers Master Engine
   Stronger browser engine for the game's rules: men may move backward, captures are mandatory.
   Uses iterative deepening, PVS, transposition table, killer/history ordering, quiescence and
   a substantially richer positional evaluation. */
const D=[[-1,-1],[-1,1],[1,-1],[1,1]];
const C=p=>p?p.toLowerCase():null, K=p=>p==='R'||p==='B', O=c=>c==='b'?'r':'b';
const IN=(r,c)=>r>=0&&r<8&&c>=0&&c<8;
const cp=b=>b.map(r=>r.slice());
function caps(b,r,c,p){const out=[],co=C(p);if(K(p)){for(const[d1,d2]of D){let rr=r+d1,cc=c+d2,e=null;while(IN(rr,cc)){if(b[rr][cc]){if(C(b[rr][cc])===co||e)break;e=[rr,cc]}else if(e)out.push({from:[r,c],to:[rr,cc],capture:e.slice()});rr+=d1;cc+=d2}}}else for(const[d1,d2]of D){let mr=r+d1,mc=c+d2,tr=r+2*d1,tc=c+2*d2;if(IN(tr,tc)&&b[mr][mc]&&C(b[mr][mc])===O(co)&&!b[tr][tc])out.push({from:[r,c],to:[tr,tc],capture:[mr,mc]})}return out}
function steps(b,r,c,p){const out=[];if(K(p)){for(const[d1,d2]of D){let rr=r+d1,cc=c+d2;while(IN(rr,cc)&&!b[rr][cc]){out.push({from:[r,c],to:[rr,cc],capture:null});rr+=d1;cc+=d2}}}else for(const[d1,d2]of D){const rr=r+d1,cc=c+d2;if(IN(rr,cc)&&!b[rr][cc])out.push({from:[r,c],to:[rr,cc],capture:null})}return out}
function legal(b,co){const x=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(C(b[r][c])===co)x.push(...caps(b,r,c,b[r][c]));if(x.length)return x;const y=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(C(b[r][c])===co)y.push(...steps(b,r,c,b[r][c]));return y}
function apply(b,m){const n=cp(b);let p=n[m.from[0]][m.from[1]];n[m.from[0]][m.from[1]]=null;if(m.capture)n[m.capture[0]][m.capture[1]]=null;const promoted=!K(p)&&((C(p)==='r'&&m.to[0]===0)||(C(p)==='b'&&m.to[0]===7));if(promoted)p=p.toUpperCase();n[m.to[0]][m.to[1]]=p;return {b:n,p, promoted}}
function next(b,m,p,t){return m.capture&&caps(b,m.to[0],m.to[1],p).length?t:O(t)}
function key(b,t){let s='';for(let r=0;r<8;r++)s+=b[r].join('');return s+t}
function same(a,b){return a&&b&&a.from[0]===b.from[0]&&a.from[1]===b.from[1]&&a.to[0]===b.to[0]&&a.to[1]===b.to[1]}
function pieces(b,co){let n=0,k=0;for(const row of b)for(const p of row)if(C(p)===co){n++;if(K(p))k++}return[n,k]}
const PS=[
 [ -8,-5,-3, 0, 0,-3,-5,-8],[-5,-1, 2, 4, 4, 2,-1,-5],[-3, 2, 7,10,10, 7, 2,-3],
 [ 0, 4,10,14,14,10, 4, 0],[ 0, 4,10,14,14,10, 4, 0],[-3, 2, 7,10,10, 7, 2,-3],
 [-5,-1, 2, 4, 4, 2,-1,-5],[ -8,-5,-3, 0, 0,-3,-5,-8]
];
function evalPos(b){
  let s=0,bc=rc=bk=rk=0, bm=rm=0, bcap=rcap=0, bback=rback=0;
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const p=b[r][c];if(!p)continue;const co=C(p),sg=co==='b'?1:-1,king=K(p);
    if(co==='b'){bc++;if(king)bk++;else bm++}else{rc++;if(king)rk++;else rm++}
    const val=king?185:100;
    let pos=PS[r][c];
    // men can move both ways, so reward centralization and flexible diagonals rather than advancement
    if(!king){
      const nearCenter=(3.5-Math.abs(3.5-c))*3+(3.5-Math.abs(3.5-r))*2;
      pos+=nearCenter;
      if((c===0||c===7)&&r>1&&r<6)pos-=8;
    }
    if(king)pos+=18;
    s+=sg*(val+pos);
    if(co==='b'&&r===7)bback++; if(co==='r'&&r===0)rback++;
  }
  const total=bc+rc;
  const mlb=legal(b,'b').length, mlr=legal(b,'r').length;
  // mobility and forced tactical activity
  s+=(mlb-mlr)*7;
  s+=(bk-rk)*28;
  s+=(bc-rc)*5;
  s+=(bback-rback)*3;
  // connected diagonals / protected adjacency
  let linksB=0,linksR=0, trappedB=0,trappedR=0;
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const p=b[r][c];if(!p)continue;const co=C(p);let links=0,free=0;
    for(const[d1,d2]of D){const rr=r+d1,cc=c+d2;if(IN(rr,cc)){if(C(b[rr][cc])===co)links++;if(!b[rr][cc])free++}}
    if(co==='b'){linksB+=links; if(!K(p)&&free===0)trappedB++} else {linksR+=links;if(!K(p)&&free===0)trappedR++}
  }
  s+=(linksB-linksR)*3-(trappedB-trappedR)*8;
  // Endgames value kings and mobility much more.
  if(total<=8)s+=(bk-rk)*45+(mlb-mlr)*12+(bm-rm)*3;
  if(total<=5)s+=(bk-rk)*55+(mlb-mlr)*18;
  // Large material swings should dominate positional terms.
  return s;
}
function capturesOnly(b,t){const a=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(C(b[r][c])===t)a.push(...caps(b,r,c,b[r][c]));return a}
let nodes=0,ctx=null,TT=new Map(),history=new Map(),killers=Array.from({length:64},()=>[null,null]);
function stop(){if((++nodes&4095)===0&&Date.now()>=ctx.end)throw 1}
function moveScore(m,tt,ply){let s=0;if(same(m,tt))s+=10000000;if(m.capture){s+=1000000;const victim=m.capture?1:0;s+=victim*10000}if(killers[ply]){if(same(m,killers[ply][0]))s+=70000;else if(same(m,killers[ply][1]))s+=50000}const k=m.from[0]+','+m.from[1]+'>'+m.to[0]+','+m.to[1];s+=(history.get(k)||0);s+=(Math.abs(m.to[0]-m.from[0])+Math.abs(m.to[1]-m.from[1]))*4;return s}
function order(ms,tt,ply){return ms.slice().sort((a,b)=>moveScore(b,tt,ply)-moveScore(a,tt,ply))}
function qsearch(b,t,a,z,ply){stop();if(ply>12)return evalPos(b);const ms=capturesOnly(b,t);if(!ms.length)return evalPos(b);const max=t==='b';let best=max?-Infinity:Infinity;for(const m of order(ms,null,ply)){const x=apply(b,m),nt=next(x.b,m,x.p,t),v=qsearch(x.b,nt,a,z,ply+1);if(max){if(v>best)best=v;if(best>a)a=best}else{if(v<best)best=v;if(best<z)z=best}if(z<=a)break}return best}
function search(b,t,d,a,z,ply){stop();const k=key(b,t),old=TT.get(k);if(old&&old.d>=d){if(old.f===0)return old.v;if(old.f===1)a=Math.max(a,old.v);else z=Math.min(z,old.v);if(a>=z)return old.v}const ms=legal(b,t);if(!ms.length)return t==='b'?-1000000+ply:1000000-ply;if(d<=0)return qsearch(b,t,a,z,ply);const max=t==='b',a0=a,z0=z;let best=max?-Infinity:Infinity,bestM=null;const list=order(ms,old?.m,ply);
  let first=true;
  for(let i=0;i<list.length;i++){
    const m=list[i],x=apply(b,m),nt=next(x.b,m,x.p,t);let v;
    if(!first && d>=3){ // Principal variation search
      if(max)v=search(x.b,nt,d-1,a,a+1,ply+1);else v=search(x.b,nt,d-1,z-1,z,ply+1);
      if((max&&v>a&&v<z)||(!max&&v<a&&v>z))v=search(x.b,nt,d-1,a,z,ply+1);
    }else v=search(x.b,nt,d-1,a,z,ply+1);
    first=false;
    if(max){if(v>best){best=v;bestM=m}if(v>a)a=v}else{if(v<best){best=v;bestM=m}if(v<z)z=v}
    if(z<=a){const hk=m.from[0]+','+m.from[1]+'>'+m.to[0]+','+m.to[1];if(!m.capture){if(!killers[ply])killers[ply]=[null,null];if(!same(killers[ply][0],m)){killers[ply][1]=killers[ply][0];killers[ply][0]=m}history.set(hk,(history.get(hk)||0)+d*d)}break}
  }
  let f=0;if(best<=a0)f=2;else if(best>=z0)f=1;TT.set(k,{v:best,d,f,m:bestM});return best;
}
function think(board,t,diff,maxTime,forced){const root=forced?.length?forced:legal(board,t);if(!root.length)return null;const cfg={1:[5,500],2:[8,1800],3:[11,5000],4:[15,12000],5:[19,22000]}[+diff]||[8,1800];ctx={end:Date.now()+Math.min(maxTime||cfg[1],cfg[1])};TT=new Map();history=new Map();killers=Array.from({length:80},()=>[null,null]);nodes=0;let best=root[0],prev=0;
  for(let d=1;d<=cfg[0];d++){if(Date.now()>=ctx.end)break;try{let alpha=-10000000,beta=10000000;if(d>=4&&Number.isFinite(prev)){alpha=prev-90;beta=prev+90}let top=-Infinity,choice=best;const list=order(root,best,0);for(const m of list){stop();const x=apply(board,m),nt=next(x.b,m,x.p,t);let v=search(x.b,nt,d-1,alpha,beta,1);if(v<=alpha||v>=beta)v=search(x.b,nt,d-1,-10000000,10000000,1);if(v>top){top=v;choice=m}}best=choice;prev=top}catch(e){break}}
  return best}
self.onmessage=e=>{if(e.data?.type!=='think')return;try{self.postMessage({type:'best',request:e.data.request,move:think(e.data.board,e.data.turn,e.data.difficulty,e.data.maxTime,e.data.forcedMoves)})}catch(err){self.postMessage({type:'error',request:e.data.request})}};
