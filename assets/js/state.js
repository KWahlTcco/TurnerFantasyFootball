import {uid, clamp, shuffleArray} from './utils.js';

export const STORE_KEY='ff_commish_v2';

export function defaultState(){
  return {
    league:{name:'Fantasy Football League',seasonYear:new Date().getFullYear(),regularWeeks:14,tiebreaker:'pf',playoffNotes:'',notes:'',currentWeek:1},
    teams:[],
    schedule:[],
  };
}

export function seedState(){
  const s=defaultState();
  s.teams=[
    {id:uid(),name:'Gridiron Gurus',owner:'Kris',abbrev:'GG',color:'#6366f1'},
    {id:uid(),name:'Waiver Wire Wizards',owner:'Jake',abbrev:'WWW',color:'#10b981'},
    {id:uid(),name:'Monday Night Miracles',owner:'Zoe',abbrev:'MNM',color:'#f59e0b'},
    {id:uid(),name:'Bye Week Bandits',owner:'Gina',abbrev:'BWB',color:'#f43f5e'},
  ];
  return s;
}

export function loadState(){
  const raw=localStorage.getItem(STORE_KEY);
  if(!raw){
    return seedState();
  }
  try{
    return validateState(JSON.parse(raw));
  }catch{
    return defaultState();
  }
}

export function saveState(state){
  localStorage.setItem(STORE_KEY,JSON.stringify(state));
}

export function validateState(s){
  const d=defaultState();
  if(!s||typeof s!=='object') return d;
  const league=s.league&&typeof s.league==='object'?s.league:d.league;
  const teams=Array.isArray(s.teams)?s.teams:[];
  const schedule=Array.isArray(s.schedule)?s.schedule:[];

  const clean={
    league:{
      name:typeof league.name==='string'&&league.name.trim()?league.name.trim():d.league.name,
      seasonYear:Number.isFinite(Number(league.seasonYear))?Number(league.seasonYear):d.league.seasonYear,
      regularWeeks:Number.isFinite(Number(league.regularWeeks))?Number(league.regularWeeks):d.league.regularWeeks,
      tiebreaker:['pf','pa','h2h'].includes(league.tiebreaker)?league.tiebreaker:d.league.tiebreaker,
      playoffNotes:typeof league.playoffNotes==='string'?league.playoffNotes:'',
      notes:typeof league.notes==='string'?league.notes:'',
      currentWeek:Number.isFinite(Number(league.currentWeek))?Number(league.currentWeek):1,
    },
    teams:teams
      .filter(t=>t&&typeof t==='object'&&typeof t.id==='string'&&typeof t.name==='string')
      .map(t=>({
        id:t.id,
        name:String(t.name).trim()||'Unnamed',
        owner:typeof t.owner==='string'?t.owner.trim():'',
        abbrev:typeof t.abbrev==='string'?t.abbrev.trim().slice(0,4):'',
        color:typeof t.color==='string'?t.color.trim():''
      })),
    schedule:schedule
      .filter(w=>w&&typeof w==='object'&&Number.isFinite(Number(w.week))&&Array.isArray(w.matchups))
      .map(w=>({
        week:Number(w.week),
        matchups:w.matchups
          .filter(m=>m&&typeof m==='object'&&typeof m.homeId==='string'&&typeof m.awayId==='string')
          .map(m=>({
            homeId:m.homeId,
            awayId:m.awayId,
            homeScore:(m.homeScore===null||m.homeScore===undefined||m.homeScore==='')?null:Number(m.homeScore),
            awayScore:(m.awayScore===null||m.awayScore===undefined||m.awayScore==='')?null:Number(m.awayScore),
            completed:Boolean(m.completed)||(m.homeId==='BYE'||m.awayId==='BYE'),
          })),
      })),
  };

  clean.league.currentWeek=clamp(clean.league.currentWeek,1,Math.max(1,clean.schedule.length||clean.league.regularWeeks));
  return clean;
}

export function generateRoundRobin(teamIds,{weeks,double,shuffle}){
  let ids=teamIds.slice();
  if(shuffle) ids=shuffleArray(ids);
  if(ids.length%2===1) ids.push('BYE');
  const n=ids.length,rounds=n-1,cycle=[];
  let arr=ids.slice();
  for(let r=0;r<rounds;r++){
    const matchups=[];
    for(let i=0;i<n/2;i++){
      const home=arr[i],away=arr[n-1-i],flip=r%2===1;
      matchups.push({
        homeId:flip?away:home,
        awayId:flip?home:away,
        homeScore:null,
        awayScore:null,
        completed:(home==='BYE'||away==='BYE'),
      });
    }
    cycle.push(matchups);
    arr=rotateRR(arr);
  }
  let allRounds=cycle;
  if(double){
    allRounds=cycle.concat(cycle.map(ms=>ms.map(m=>({
      homeId:m.awayId,
      awayId:m.homeId,
      homeScore:null,
      awayScore:null,
      completed:(m.homeId==='BYE'||m.awayId==='BYE'),
    }))));
  }
  const out=[];
  for(let w=1;w<=weeks;w++){
    const ms=allRounds[(w-1)%allRounds.length];
    out.push({week:w,matchups:ms.map(m=>({...m}))});
  }
  return out;
}

export function rotateRR(arr){
  const fixed=arr[0];
  const rest=arr.slice(1);
  rest.unshift(rest.pop());
  return [fixed,...rest];
}

export function computeStandings(state){
  const map=new Map();
  state.teams.forEach(t=>map.set(t.id,{teamId:t.id,w:0,l:0,t:0,pf:0,pa:0,games:[],streak:[]}));
  for(const w of state.schedule){
    for(const m of w.matchups){
      if(m.homeId==='BYE'||m.awayId==='BYE'||!m.completed||m.homeScore===null||m.awayScore===null) continue;
      const home=map.get(m.homeId),away=map.get(m.awayId);
      if(!home||!away) continue;
      home.pf+=m.homeScore;home.pa+=m.awayScore;
      away.pf+=m.awayScore;away.pa+=m.homeScore;
      home.games.push({opp:m.awayId,for:m.homeScore,against:m.awayScore});
      away.games.push({opp:m.homeId,for:m.awayScore,against:m.homeScore});
      if(m.homeScore>m.awayScore){home.w++;away.l++;home.streak.push('W');away.streak.push('L');}
      else if(m.homeScore<m.awayScore){home.l++;away.w++;home.streak.push('L');away.streak.push('W');}
      else{home.t++;away.t++;home.streak.push('T');away.streak.push('T');}
    }
  }
  const items=Array.from(map.values()).map(s=>({...s,streak:collapseStreak(s.streak)}));
  items.sort((a,b)=>{
    if(b.w!==a.w) return b.w-a.w;
    if(a.l!==b.l) return a.l-b.l;
    if(b.t!==a.t) return b.t-a.t;
    const tb=state.league.tiebreaker;
    if(tb==='pf'&&b.pf!==a.pf) return b.pf-a.pf;
    if(tb==='pa'&&a.pa!==b.pa) return a.pa-b.pa;
    if(tb==='h2h'){
      const h=h2h(state,a.teamId,b.teamId);
      if(h!==0) return h;
      if(b.pf!==a.pf) return b.pf-a.pf;
    }
    const diffB=b.pf-b.pa,diffA=a.pf-a.pa;
    if(diffB!==diffA) return diffB-diffA;
    return (teamById(state,a.teamId)?.name||a.teamId).localeCompare(teamById(state,b.teamId)?.name||b.teamId);
  });
  return items;
}

export function h2h(state,a,b){
  let aW=0,aL=0;
  for(const w of state.schedule){
    for(const m of w.matchups){
      if(!m.completed||m.homeScore===null||m.awayScore===null) continue;
      const isPair=(m.homeId===a&&m.awayId===b)||(m.homeId===b&&m.awayId===a);
      if(!isPair) continue;
      const aScore=m.homeId===a?m.homeScore:m.awayScore;
      const bScore=m.homeId===a?m.awayScore:m.homeScore;
      if(aScore>bScore) aW++;
      else if(aScore<bScore) aL++;
    }
  }
  if(aW+aL===0) return 0;
  return aW>aL?-1:aW<aL?1:0;
}

export function collapseStreak(list){
  if(!list.length) return '';
  const last=list[list.length-1];
  let n=0;
  for(let i=list.length-1;i>=0;i--){
    if(list[i]===last) n++;
    else break;
  }
  return `${last}${n}`;
}

export function countCompletedMatchups(state){
  let n=0;
  for(const w of state.schedule){
    for(const m of w.matchups){
      if(m.homeId==='BYE'||m.awayId==='BYE'||m.completed) n++;
    }
  }
  return n;
}

export function labelTeam(state,id){
  if(id==='BYE') return 'BYE';
  const t=teamById(state,id);
  return t?t.abbrev?`${t.name} (${t.abbrev.toUpperCase()})`:t.name:'(Unknown)';
}

export function teamById(state,id){
  return state.teams.find(t=>t.id===id)||null;
}

export function resolveTeamInput(state,input,validIds){
  const raw=String(input).trim();
  if(!raw) return null;
  if(raw.toUpperCase()==='BYE') return 'BYE';
  let t=state.teams.find(x=>x.name.toLowerCase()===raw.toLowerCase());
  if(t) return t.id;
  t=state.teams.find(x=>(x.abbrev||'').toLowerCase()===raw.toLowerCase());
  if(t) return t.id;
  t=state.teams.find(x=>x.name.toLowerCase().includes(raw.toLowerCase()));
  if(t) return t.id;
  if(Array.isArray(validIds)&&validIds.includes(raw)) return raw;
  return null;
}
