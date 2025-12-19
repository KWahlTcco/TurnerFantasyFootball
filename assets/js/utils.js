export function uid(){
  return crypto?.randomUUID?.() || `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function esc(str){
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

export function clamp(n,min,max){
  return Math.max(min,Math.min(max,n));
}

export function fmtNum(n){
  const x=Number(n);
  return Number.isFinite(x)?x.toFixed(1).replace(/\.0$/,''):'0';
}

export function shuffleArray(arr){
  const a=arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
