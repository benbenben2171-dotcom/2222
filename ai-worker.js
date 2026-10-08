'use strict';

/*
  Russian Checkers AI — browser Worker
  Rules:
  - men move forward quietly;
  - men capture in all four diagonal directions;
  - kings are flying kings;
  - captures are mandatory;
  - after a capture, the same piece continues capturing when possible.

  Search:
  iterative deepening + alpha-beta/PVS + transposition table +
  killer/history ordering + capture quiescence.
*/

const D=[[-1,-1],[-1,1],[1,-1],[1,1]];
const C=p=>p?p.toLowerCase():null;
const K=p=>p==='R'||p==='B';
const O=c=>c==='b'?'r':'b';
const IN=(r,c)=>r>=0&&r<8&&c>=0&&c<8;
const CP=b=>b.map(r=>r.slice());

function caps(b,r,c,p){
  const out=[],co=C(p);
  if(K(p)){
    for(const[dR,dC] of D){
      let rr=r+dR,cc=c+dC,e=null;
      while(IN(rr,cc)){
        if(b[rr][cc]){
          if(C(b[rr][cc])===co || e) break;
          e=[rr,cc];
        }else if(e){
          out.push({from:[r,c],to:[rr,cc],capture:e.slice()});
        }
        rr+=dR; cc+=dC;
      }
    }
  }else{
    for(const[dR,dC] of D){
      const mr=r+dR,mc=c+dC,tr=r+2*dR,tc=c+2*dC;
      if(IN(tr,tc)&&b[mr][mc]&&C(b[mr][mc])===O(co)&&!b[tr][tc])
        out.push({from:[r,c],to:[tr,tc],capture:[mr,mc]});
    }
  }
  return out;
}

function steps(b,r,c,p){
  const out=[];
  if(K(p)){
    for(const[dR,dC] of D){
      let rr=r+dR,cc=c+dC;
      while(IN(rr,cc)&&!b[rr][cc]){
        out.push({from:[r,c],to:[rr,cc],capture:null});
        rr+=dR; cc+=dC;
      }
    }
  }else{
    // Russian rules: quiet movement is forward only.
    const dR=C(p)==='r'?-1:1;
    for(const dC of[-1,1]){
      const rr=r+dR,cc=c+dC;
      if(IN(rr,cc)&&!b[rr][cc])
        out.push({from:[r,c],to:[rr,cc],capture:null});
    }
  }
  return out;
}

function legal(b,co){
  const cs=[];
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    if(C(b[r][c])===co) cs.push(...caps(b,r,c,b[r][c]));
  }
  if(cs.length) return cs;
  const ms=[];
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    if(C(b[r][c])===co) ms.push(...steps(b,r,c,b[r][c]));
  }
  return ms;
}

function apply(b,m){
  const n=CP(b);
  let p=n[m.from[0]][m.from[1]];
  n[m.from[0]][m.from[1]]=null;
  if(m.capture) n[m.capture[0]][m.capture[1]]=null;
  const promoted=!K(p)&&(
    (C(p)==='r'&&m.to[0]===0) ||
    (C(p)==='b'&&m.to[0]===7)
  );
  if(promoted) p=p.toUpperCase();
  n[m.to[0]][m.to[1]]=p;
  return {b:n,p, promoted};
}

function nextTurn(b,m,p,t){
  return m.capture && caps(b,m.to[0],m.to[1],p).length ? t : O(t);
}

function same(a,b){
  return !!(a&&b&&a.from[0]===b.from[0]&&a.from[1]===b.from[1]&&
    a.to[0]===b.to[0]&&a.to[1]===b.to[1]);
}

function key(b,t){
  let s='';
  for(let r=0;r<8;r++) s+=b[r].join('');
  return s+t;
}

const PS=[
 [-8,-5,-3,0,0,-3,-5,-8],
 [-5,-1,2,4,4,2,-1,-5],
 [-3,2,7,10,10,7,2,-3],
 [0,4,10,14,14,10,4,0],
 [0,4,10,14,14,10,4,0],
 [-3,2,7,10,10,7,2,-3],
 [-5,-1,2,4,4,2,-1,-5],
 [-8,-5,-3,0,0,-3,-5,-8]
];

function evaluate(b){
  let score=0;
  let bc=0,rc=0,bk=0,rk=0,bm=0,rm=0;
  let bAdv=0,rAdv=0,bCenter=0,rCenter=0;

  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const p=b[r][c];
    if(!p) continue;
    const co=C(p),sg=co==='b'?1:-1,isK=K(p);

    if(co==='b'){bc++;if(isK)bk++;else bm++}
    else{rc++;if(isK)rk++;else rm++}

    let v=isK?190:100;
    let pos=PS[r][c];

    if(isK){
      const ctr=(3.5-Math.abs(3.5-c))+(3.5-Math.abs(3.5-r));
      pos += ctr*7;
    }else{
      const advance=co==='r' ? 7-r : r;
      const center=(3.5-Math.abs(3.5-c))*4;
      pos += advance*3 + center;
      if(co==='b') bAdv+=advance;
      else rAdv+=advance;
      if(c>=2&&c<=5){
        if(co==='b') bCenter++;
        else rCenter++;
      }
      if((c===0||c===7)&&r>1&&r<6) pos-=9;
    }
    score += sg*(v+pos);
  }

  const mlb=legal(b,'b');
  const mlr=legal(b,'r');
  score += (bc-rc)*10;
  score += (bk-rk)*38;
  score += (mlb.length-mlr.length)*8;
  score += (bAdv-rAdv)*2;
  score += (bCenter-rCenter)*3;

  let cb=0,cr=0;
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const p=b[r][c];
    if(!p) continue;
    if(C(p)==='b') cb+=caps(b,r,c,p).length;
    else cr+=caps(b,r,c,p).length;
  }
  score += (cb-cr)*18;

  let linksB=0,linksR=0,trappedB=0,trappedR=0;
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const p=b[r][c];
    if(!p) continue;
    const co=C(p);
    let links=0,free=0;
    for(const[dR,dC] of D){
      const rr=r+dR,cc=c+dC;
      if(IN(rr,cc)){
        if(C(b[rr][cc])===co) links++;
        if(!b[rr][cc]) free++;
      }
    }
    if(co==='b'){
      linksB+=links;
      if(!K(p)&&free===0) trappedB++;
    }else{
      linksR+=links;
      if(!K(p)&&free===0) trappedR++;
    }
  }
  score+=(linksB-linksR)*4;
  score-=(trappedB-trappedR)*10;

  const total=bc+rc;
  if(total<=10){
    score+=(bk-rk)*12;
    score+=(mlb.length-mlr.length)*4;
  }
  if(total<=8){
    score+=(bk-rk)*48;
    score+=(mlb.length-mlr.length)*13;
  }
  if(total<=5){
    score+=(bk-rk)*70;
    score+=(mlb.length-mlr.length)*20;
  }
  return score;
}

let nodes=0,ctx=null,TT=new Map(),history=new Map();
let killers=Array.from({length:96},()=>[null,null]);

function stop(){
  if((++nodes&4095)===0 && Date.now()>=ctx.end) throw new Error('TIME');
}

function moveScore(m,tt,ply){
  let s=0;
  if(same(m,tt)) s+=10000000;
  if(m.capture) s+=1000000;
  const k=m.from[0]+','+m.from[1]+'>'+m.to[0]+','+m.to[1];
  s+=history.get(k)||0;
  if(killers[ply]){
    if(same(m,killers[ply][0])) s+=70000;
    else if(same(m,killers[ply][1])) s+=50000;
  }
  s+=(Math.abs(m.to[0]-m.from[0])+Math.abs(m.to[1]-m.from[1]))*4;
  return s;
}

function order(ms,tt,ply){
  return ms.slice().sort((a,b)=>moveScore(b,tt,ply)-moveScore(a,tt,ply));
}

function qsearch(b,t,a,z,ply){
  stop();
  if(ply>14) return evaluate(b);
  const ms=[];
  for(let r=0;r<8;r++)for(let c=0;c<8;c++)
    if(C(b[r][c])===t) ms.push(...caps(b,r,c,b[r][c]));
  if(!ms.length) return evaluate(b);

  const max=t==='b';
  let best=max?-Infinity:Infinity;
  for(const m of order(ms,null,ply)){
    const x=apply(b,m);
    const nt=nextTurn(x.b,m,x.p,t);
    const v=qsearch(x.b,nt,a,z,ply+1);
    if(max){if(v>best)best=v;if(best>a)a=best}
    else{if(v<best)best=v;if(best<z)z=best}
    if(z<=a) break;
  }
  return best;
}

function search(b,t,d,a,z,ply){
  stop();
  const k=key(b,t),old=TT.get(k);
  if(old&&old.d>=d){
    if(old.f===0) return old.v;
    if(old.f===1) a=Math.max(a,old.v);
    else z=Math.min(z,old.v);
    if(a>=z) return old.v;
  }

  const ms=legal(b,t);
  if(!ms.length) return t==='b'?-1000000+ply:1000000-ply;
  if(d<=0) return qsearch(b,t,a,z,ply);

  const max=t==='b',a0=a,z0=z;
  let best=max?-Infinity:Infinity,bestM=null;
  const list=order(ms,old?.m,ply);
  let first=true;

  for(const m of list){
    const x=apply(b,m),nt=nextTurn(x.b,m,x.p,t);
    let v;
    if(!first&&d>=3){
      v=max
        ?search(x.b,nt,d-1,a,a+1,ply+1)
        :search(x.b,nt,d-1,z-1,z,ply+1);
      if((max&&v>a&&v<z)||(!max&&v<a&&v>z))
        v=search(x.b,nt,d-1,a,z,ply+1);
    }else{
      v=search(x.b,nt,d-1,a,z,ply+1);
    }
    first=false;

    if(max){
      if(v>best){best=v;bestM=m}
      if(v>a)a=v;
    }else{
      if(v<best){best=v;bestM=m}
      if(v<z)z=v;
    }

    if(z<=a){
      if(!m.capture){
        const hk=m.from[0]+','+m.from[1]+'>'+m.to[0]+','+m.to[1];
        if(!same(killers[ply]?.[0],m)){
          killers[ply][1]=killers[ply][0];
          killers[ply][0]=m;
        }
        history.set(hk,(history.get(hk)||0)+d*d);
      }
      break;
    }
  }

  let f=0;
  if(best<=a0) f=2;
  else if(best>=z0) f=1;
  TT.set(k,{v:best,d,f,m:bestM});
  return best;
}

function think(board,t,diff,maxTime,forced){
  const root=forced?.length?forced:legal(board,t);
  if(!root.length) return null;

  const cfg={
    1:[7,700],
    2:[10,2200],
    3:[14,5500],
    4:[18,11000],
    5:[23,18000]
  }[+diff]||[10,2200];

  const limit=Math.max(250,Math.min(maxTime||cfg[1],cfg[1]));
  ctx={end:Date.now()+limit};
  TT=new Map();
  history=new Map();
  killers=Array.from({length:96},()=>[null,null]);
  nodes=0;

  let best=root[0],prev=0;

  for(let d=1;d<=cfg[0];d++){
    if(Date.now()>=ctx.end) break;
    try{
      let alpha=-10000000,beta=10000000;
      if(d>=4&&Number.isFinite(prev)){
        alpha=prev-90; beta=prev+90;
      }
      let top=-Infinity,choice=best;
      const list=order(root,best,0);

      for(const m of list){
        stop();
        const x=apply(board,m),nt=nextTurn(x.b,m,x.p,t);
        let v=search(x.b,nt,d-1,alpha,beta,1);
        if(v<=alpha||v>=beta)
          v=search(x.b,nt,d-1,-10000000,10000000,1);
        if(v>top){top=v;choice=m}
      }
      best=choice;
      prev=top;
    }catch(e){
      break;
    }
  }
  return best;
}

self.onmessage=e=>{
  if(e.data?.type!=='think') return;
  try{
    self.postMessage({
      type:'best',
      request:e.data.request,
      move:think(
        e.data.board,
        e.data.turn,
        e.data.difficulty,
        e.data.maxTime,
        e.data.forcedMoves
      )
    });
  }catch(err){
    self.postMessage({type:'error',request:e.data.request});
  }
};
