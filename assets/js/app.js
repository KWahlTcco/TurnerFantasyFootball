import {esc, uid} from './utils.js';
import {
  defaultState,
  loadState,
  saveState,
  validateState,
  generateRoundRobin,
  computeStandings,
  resolveTeamInput,
  labelTeam,
  countCompletedMatchups,
} from './state.js';

let state=loadState();
let activeTab='dashboard';
let toastTimer=null;

const els={
  leagueTitle:document.getElementById('leagueTitle'),
  leagueSeason:document.getElementById('leagueSeason'),
  view:document.getElementById('view'),
  nav:document.getElementById('nav'),
  sectionTitle:document.getElementById('sectionTitle'),
  weekChip:document.getElementById('weekChip'),
  dataStatus:document.getElementById('dataStatus'),
  navTeamsMeta:document.getElementById('navTeamsMeta'),
  navScheduleMeta:document.getElementById('navScheduleMeta'),
  navResultsMeta:document.getElementById('navResultsMeta'),
  btnSettings:document.getElementById('btnSettings'),
  btnExport:document.getElementById('btnExport'),
  btnImport:document.getElementById('btnImport'),
  btnReset:document.getElementById('btnReset'),
  btnHelp:document.getElementById('btnHelp'),
  dlgSettings:document.getElementById('dlgSettings'),
  formSettings:document.getElementById('formSettings'),
  btnSaveSettings:document.getElementById('btnSaveSettings'),
  dlgTeam:document.getElementById('dlgTeam'),
  teamModalTitle:document.getElementById('teamModalTitle'),
  formTeam:document.getElementById('formTeam'),
  btnSaveTeam:document.getElementById('btnSaveTeam'),
  btnDeleteTeam:document.getElementById('btnDeleteTeam'),
  dlgImport:document.getElementById('dlgImport'),
  importText:document.getElementById('importText'),
  btnDoImport:document.getElementById('btnDoImport'),
  dlgHelp:document.getElementById('dlgHelp'),
  toast:document.getElementById('toast'),
  toastMsg:document.getElementById('toastMsg'),
};

init();

function init(){
  wireUI();
  renderShell();
  render();
}

function wireUI(){
  els.nav.addEventListener('click',e=>{
    const btn=e.target.closest('[data-tab]');
    if(btn) setTab(btn.dataset.tab);
  });
  document.addEventListener('click',e=>{
    const c=e.target.closest('[data-close]');
    if(c){
      const d=c.closest('dialog');
      if(d) d.close();
    }
  });
  els.btnSettings.addEventListener('click',()=>openSettings());
  els.btnSaveSettings.addEventListener('click',e=>{e.preventDefault();saveSettings();});
  els.btnExport.addEventListener('click',()=>doExport());
  els.btnImport.addEventListener('click',()=>openImport());
  els.btnReset.addEventListener('click',()=>doReset());
  els.btnDoImport.addEventListener('click',e=>{e.preventDefault();doImport();});
  els.btnHelp.addEventListener('click',()=>els.dlgHelp.showModal());
  els.btnSaveTeam.addEventListener('click',e=>{e.preventDefault();upsertTeamFromForm();});
  els.btnDeleteTeam.addEventListener('click',e=>{e.preventDefault();deleteTeamFromForm();});
}

function renderShell(){
  els.leagueTitle.textContent=state.league.name;
  els.leagueSeason.textContent=`${state.league.seasonYear}`;
  els.weekChip.textContent=`Week ${state.league.currentWeek}`;
  els.navTeamsMeta.textContent=`${state.teams.length}`;
  els.navScheduleMeta.textContent=`${state.schedule.length} wks`;
  els.navResultsMeta.textContent=`Week ${state.league.currentWeek}`;
}

function setTab(tab){
  activeTab=tab;
  els.nav.querySelectorAll('[data-tab]').forEach(t=>t.setAttribute('aria-selected',String(t.dataset.tab===tab)));
  const titles={dashboard:'Dashboard',teams:'Teams',schedule:'Schedule',results:'Results',standings:'Standings',notes:'Notes'};
  els.sectionTitle.textContent=titles[tab]||'Dashboard';
  render();
}

function render(){
  renderShell();
  if(activeTab==='dashboard') return renderDashboard();
  if(activeTab==='teams') return renderTeams();
  if(activeTab==='schedule') return renderSchedule();
  if(activeTab==='results') return renderResults();
  if(activeTab==='standings') return renderStandings();
  if(activeTab==='notes') return renderNotes();
}

function renderDashboard(){
  const teams=state.teams.length;
  const weeks=state.schedule.length;
  const completed=countCompletedMatchups(state);
  const total=state.schedule.reduce((s,w)=>s+w.matchups.length,0);
  els.view.innerHTML=`
    <div class="kpi">
      <div class="card"><div class="label">Teams</div><div class="value">${teams}</div><div class="note">${teams<4?'Add more to get started':'Ready to play'}</div></div>
      <div class="card"><div class="label">Schedule</div><div class="value">${weeks}</div><div class="note">${weeks?'Weeks generated':'Generate matchups'}</div></div>
      <div class="card"><div class="label">Games</div><div class="value">${completed}/${total||0}</div><div class="note">Completed this season</div></div>
    </div>
    <div class="row space" style="margin-bottom:12px"><div class="hint">Quick actions to manage your league</div></div>
    <div class="row" style="gap:12px"><button class="btn" id="dashAddTeam">➕ Add Team</button><button class="btn primary" id="dashGenSched">🗓️ Generate Schedule</button></div>
  `;
  document.getElementById('dashAddTeam')?.addEventListener('click',()=>openTeamModal());
  document.getElementById('dashGenSched')?.addEventListener('click',()=>openGenerateScheduleModal());
}

function renderTeams(){
  const rows=state.teams
    .slice()
    .sort((a,b)=>a.name.localeCompare(b.name))
    .map(t=>{
      const dot=t.color?`<span style="width:10px;height:10px;border-radius:50%;background:${esc(t.color)}"></span>`:'';
      return `<tr><td class="nowrap"><div class="row" style="gap:8px">${dot}<strong>${esc(t.name)}</strong>${t.abbrev?`<span class="chip mono">${esc(t.abbrev.toUpperCase())}</span>`:''}</div></td><td>${t.owner?esc(t.owner):'<span class="muted">—</span>'}</td><td class="num"><button class="btn small" data-edit-team="${t.id}">Edit</button></td></tr>`;
    }).join('');
  els.view.innerHTML=`
    <div class="row space" style="margin-bottom:12px"><div class="hint">Teams are the foundation of your league</div><button class="btn" id="btnAddTeam">➕ Add Team</button></div>
    ${state.teams.length===0?`<div class="empty"><strong>No teams yet</strong><div class="hint">Add teams to get started</div></div>`:`<div class="tablewrap"><table><thead><tr><th>Team</th><th>Owner</th><th class="num">Action</th></tr></thead><tbody>${rows}</tbody></table></div>`}
  `;
  document.getElementById('btnAddTeam')?.addEventListener('click',()=>openTeamModal());
  els.view.querySelectorAll('[data-edit-team]').forEach(btn=>btn.addEventListener('click',()=>openTeamModal(btn.getAttribute('data-edit-team'))));
}

function renderSchedule(){
  const weeks=state.schedule.map(w=>`<option value="${w.week}" ${w.week===state.league.currentWeek?'selected':''}>Week ${w.week}</option>`).join('');
  const currentWeek=state.schedule.find(w=>w.week===state.league.currentWeek) || state.schedule[0];
  const rows=currentWeek?currentWeek.matchups.map((m,idx)=>{
    const home=labelTeam(state,m.homeId);
    const away=labelTeam(state,m.awayId);
    return `<div class="matchup-card"><div class="row space"><div class="row" style="gap:8px"><strong>${home}</strong><span class="vs">vs</span><strong>${away}</strong></div><div class="row" style="gap:8px"><button class="btn small" data-swap="${idx}">Swap</button><button class="btn small" data-delete="${idx}">Delete</button></div></div></div>`;
  }).join(''):'<div class="empty"><strong>No schedule yet</strong><div class="hint">Generate a schedule to manage weekly matchups</div></div>';
  els.view.innerHTML=`
    <div class="weekbar">
      <button class="btn" id="btnGenSchedule">Generate</button>
      <label class="sr-only" for="selectWeek">Week</label>
      <select id="selectWeek">${weeks}</select>
      <button class="btn" id="btnAddWeek">Add Week</button>
    </div>
    <div class="list">${rows}</div>
  `;
  document.getElementById('btnGenSchedule')?.addEventListener('click',()=>openGenerateScheduleModal());
  document.getElementById('btnAddWeek')?.addEventListener('click',()=>addBlankWeek());
  document.getElementById('selectWeek')?.addEventListener('change',e=>{state.league.currentWeek=Number(e.target.value);persistState('Week changed',{silent:true});render();});
  els.view.querySelectorAll('[data-swap]').forEach(btn=>btn.addEventListener('click',()=>openSwapModal(state.league.currentWeek,Number(btn.dataset.swap))));
  els.view.querySelectorAll('[data-delete]').forEach(btn=>btn.addEventListener('click',()=>deleteMatchup(state.league.currentWeek,Number(btn.dataset.delete))));
}

function renderResults(){
  if(!state.schedule.length){
    els.view.innerHTML='<div class="empty"><strong>No games scheduled</strong><div class="hint">Generate a schedule to record scores</div></div>';
    return;
  }
  const week=state.schedule.find(w=>w.week===state.league.currentWeek) || state.schedule[0];
  const list=week.matchups.map((m,idx)=>{
    const home=labelTeam(state,m.homeId);
    const away=labelTeam(state,m.awayId);
    return `
      <div class="matchup-card" data-matchup="${idx}">
        <div class="row space" style="margin-bottom:8px"><strong>${home}</strong><span class="vs">vs</span><strong>${away}</strong></div>
        <div class="score"><label class="sr-only" for="home-${idx}">Home score</label><input id="home-${idx}" type="number" placeholder="Home" value="${m.homeScore??''}" /><label class="sr-only" for="away-${idx}">Away score</label><input id="away-${idx}" type="number" placeholder="Away" value="${m.awayScore??''}" /><button class="btn small" data-save="${idx}">Save</button></div>
        ${m.completed?'<span class="chip good">Completed</span>':'<span class="chip warn">Pending</span>'}
      </div>
    `;
  }).join('');
  els.view.innerHTML=`
    <div class="weekbar">
      <label class="sr-only" for="selectWeekResults">Week</label>
      <select id="selectWeekResults">${state.schedule.map(w=>`<option value="${w.week}" ${w.week===week.week?'selected':''}>Week ${w.week}</option>`).join('')}</select>
    </div>
    <div class="list">${list}</div>
  `;
  document.getElementById('selectWeekResults')?.addEventListener('change',e=>{state.league.currentWeek=Number(e.target.value);persistState('Week changed',{silent:true});render();});
  els.view.querySelectorAll('[data-save]').forEach(btn=>btn.addEventListener('click',()=>saveResult(week.week,Number(btn.dataset.save))));
}

function renderStandings(){
  if(!state.teams.length){
    els.view.innerHTML='<div class="empty"><strong>No teams to rank</strong><div class="hint">Add teams to see standings</div></div>';
    return;
  }
  const standings=computeStandings(state);
  const rows=standings.map((s,idx)=>{
    const t=state.teams.find(x=>x.id===s.teamId);
    return `<tr><td>${idx+1}</td><td><div class="row" style="gap:8px"><strong>${esc(t?.name||'(Unknown)')}</strong>${t?.abbrev?`<span class="chip mono">${esc(t.abbrev.toUpperCase())}</span>`:''}</div></td><td class="num">${s.w}-${s.l}${s.t?`-${s.t}`:''}</td><td class="num">${s.pf}</td><td class="num">${s.pa}</td><td>${renderStreakChip(s.streak)}</td></tr>`;
  }).join('');
  els.view.innerHTML=`
    <div class="hint" style="margin-bottom:12px">Tiebreaker: ${state.league.tiebreaker.toUpperCase()}</div>
    <div class="tablewrap"><table><thead><tr><th>#</th><th>Team</th><th>Record</th><th class="num">PF</th><th class="num">PA</th><th>Streak</th></tr></thead><tbody>${rows}</tbody></table></div>
  `;
}

function renderNotes(){
  els.view.innerHTML=`
    <div class="field"><label for="leagueNotes">Commissioner Notes</label><textarea id="leagueNotes" placeholder="Draft reminders, waiver rules...">${esc(state.league.notes||'')}</textarea></div>
    <div class="field"><label for="playoffNotes">Playoff Notes</label><textarea id="playoffNotes">${esc(state.league.playoffNotes||'')}</textarea></div>
    <div class="row" style="margin-top:12px"><button class="btn primary" id="btnSaveNotes">Save Notes</button></div>
  `;
  document.getElementById('btnSaveNotes')?.addEventListener('click',()=>{
    state.league.notes=document.getElementById('leagueNotes').value;
    state.league.playoffNotes=document.getElementById('playoffNotes').value;
    persistState('Notes saved');
  });
}

function openTeamModal(id){
  const team=id?state.teams.find(t=>t.id===id):null;
  els.teamModalTitle.textContent=team?'Edit Team':'Add Team';
  els.btnDeleteTeam.hidden=!team;
  els.formTeam.reset();
  els.formTeam.teamId.value=team?.id||'';
  els.formTeam.teamName.value=team?.name||'';
  els.formTeam.teamOwner.value=team?.owner||'';
  els.formTeam.teamAbbrev.value=team?.abbrev||'';
  els.formTeam.teamColor.value=team?.color||'';
  els.dlgTeam.showModal();
}

function upsertTeamFromForm(){
  const data=new FormData(els.formTeam);
  const id=data.get('teamId')||uid();
  const next={
    id,
    name:String(data.get('teamName')||'').trim(),
    owner:String(data.get('teamOwner')||'').trim(),
    abbrev:String(data.get('teamAbbrev')||'').trim().slice(0,4),
    color:String(data.get('teamColor')||'').trim(),
  };
  if(!next.name) return showToast('Team name required','bad');
  const existing=state.teams.findIndex(t=>t.id===id);
  if(existing>=0) state.teams[existing]=next; else state.teams.push(next);
  persistState('Team saved');
  els.dlgTeam.close();
  render();
}

function deleteTeamFromForm(){
  const id=els.formTeam.teamId.value;
  if(!id) return;
  if(!confirm('Delete this team?')) return;
  state.teams=state.teams.filter(t=>t.id!==id);
  state.schedule=state.schedule.map(w=>({...w,matchups:w.matchups.filter(m=>m.homeId!==id&&m.awayId!==id)}));
  persistState('Team deleted');
  els.dlgTeam.close();
  render();
}

function openSettings(){
  els.formSettings.reset();
  els.formSettings.leagueName.value=state.league.name;
  els.formSettings.seasonYear.value=state.league.seasonYear;
  els.formSettings.regularWeeks.value=state.league.regularWeeks;
  els.formSettings.tiebreaker.value=state.league.tiebreaker;
  els.formSettings.playoffNotes.value=state.league.playoffNotes;
  els.dlgSettings.showModal();
}

function saveSettings(){
  const data=new FormData(els.formSettings);
  state.league.name=String(data.get('leagueName')||'').trim()||'Fantasy Football League';
  state.league.seasonYear=Number(data.get('seasonYear'))||new Date().getFullYear();
  state.league.regularWeeks=Number(data.get('regularWeeks'))||14;
  state.league.tiebreaker=String(data.get('tiebreaker'))||'pf';
  state.league.playoffNotes=String(data.get('playoffNotes')||'');
  persistState('Settings saved');
  els.dlgSettings.close();
  render();
}

function openImport(){
  els.importText.value='';
  els.dlgImport.showModal();
}

function doImport(){
  const raw=els.importText.value.trim();
  if(!raw) return showToast('Paste JSON','bad');
  try{
    state=validateState(JSON.parse(raw));
    persistState('Imported');
    els.dlgImport.close();
    setTab('dashboard');
  }catch(e){
    showToast('Invalid format','bad');
    console.error(e);
  }
}

function doExport(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`${state.league.name.replace(/[^a-z0-9]/gi,'-').toLowerCase()||'league'}-${state.league.seasonYear}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
  showToast('Exported');
}

function doReset(){
  if(!confirm('Reset everything? This cannot be undone.')) return;
  localStorage.removeItem('ff_commish_v2');
  state=defaultState();
  persistState('Reset complete');
  setTab('dashboard');
}

function openGenerateScheduleModal(){
  if(state.teams.length<2) return showToast('Need 2+ teams','bad');
  const weeks=prompt(`How many weeks? (Suggested: ${state.league.regularWeeks})`,String(state.league.regularWeeks));
  if(weeks===null) return;
  const w=Number(weeks);
  if(!Number.isFinite(w)||w<1) return showToast('Invalid weeks','bad');
  const dbl=prompt('Double round-robin? (y/n)','n');
  const double=String(dbl||'').toLowerCase().startsWith('y');
  const shuf=prompt('Shuffle teams? (y/n)','y');
  const shuffle=String(shuf||'').toLowerCase().startsWith('y');
  if(state.schedule.length&&!confirm('Overwrite current schedule?')) return;
  state.schedule=generateRoundRobin(state.teams.map(t=>t.id),{weeks:w,double,shuffle});
  state.league.currentWeek=1;
  persistState('Schedule generated');
  setTab('schedule');
}

function openSwapModal(weekNum,matchupIdx){
  const week=state.schedule.find(w=>w.week===weekNum);
  if(!week) return;
  const m=week.matchups[matchupIdx];
  if(!m) return;
  const opts=['BYE',...state.teams.map(t=>t.id)];
  const newHome=prompt(`Week ${weekNum}: New home team (current: ${labelTeam(state,m.homeId)})`,labelTeam(state,m.homeId));
  if(newHome===null) return;
  const newAway=prompt(`New away team (current: ${labelTeam(state,m.awayId)})`,labelTeam(state,m.awayId));
  if(newAway===null) return;
  const homeId=resolveTeamInput(state,newHome,opts);
  const awayId=resolveTeamInput(state,newAway,opts);
  if(!homeId||!awayId) return showToast('Team not found','bad');
  if(homeId===awayId) return showToast('Same team twice','bad');
  m.homeId=homeId;
  m.awayId=awayId;
  m.homeScore=null;
  m.awayScore=null;
  m.completed=(homeId==='BYE'||awayId==='BYE');
  persistState('Matchup updated');
  render();
}

function deleteMatchup(weekNum,idx){
  const week=state.schedule.find(w=>w.week===weekNum);
  if(!week) return;
  week.matchups.splice(idx,1);
  persistState('Matchup deleted');
  render();
}

function addBlankWeek(){
  const weekNum=state.schedule.length?Math.max(...state.schedule.map(w=>w.week))+1:1;
  state.schedule.push({week:weekNum,matchups:[]});
  state.league.currentWeek=weekNum;
  persistState('Week added');
  render();
}

function saveResult(weekNum,idx){
  const week=state.schedule.find(w=>w.week===weekNum);
  if(!week) return;
  const m=week.matchups[idx];
  if(!m) return;
  const home=document.getElementById(`home-${idx}`);
  const away=document.getElementById(`away-${idx}`);
  const homeScore=home.value===''?null:Number(home.value);
  const awayScore=away.value===''?null:Number(away.value);
  if(homeScore===null||awayScore===null) return showToast('Scores required','bad');
  m.homeScore=homeScore;
  m.awayScore=awayScore;
  m.completed=true;
  persistState('Result saved');
  render();
}

function renderStreakChip(streak){
  if(!streak) return '<span class="chip">—</span>';
  const kind=streak.startsWith('W')?'good':streak.startsWith('L')?'bad':'warn';
  return `<span class="chip ${kind}">${esc(streak)}</span>`;
}

function showToast(msg,kind='good'){
  if(toastTimer) clearTimeout(toastTimer);
  els.toastMsg.textContent=msg;
  els.toast.classList.add('show');
  els.toast.style.borderColor=kind==='bad'?'rgba(244,63,94,.5)':kind==='warn'?'rgba(245,158,11,.5)':'rgba(16,185,129,.5)';
  toastTimer=setTimeout(()=>els.toast.classList.remove('show'),2500);
}

function persistState(msg='Saved',{silent=false}={}){
  saveState(state);
  els.dataStatus.textContent='Saved';
  if(!silent) showToast(msg);
  renderShell();
}
