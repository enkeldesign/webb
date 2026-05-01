const PRESETS = {
  qf_sf_bronze_final: {
    label: 'Kvartsfinal + Semi + Brons + Final',
    rounds: [
      { name: 'Quarterfinals', matches: ['QF1','QF2','QF3','QF4'] },
      { name: 'Semifinals', matches: ['SF1','SF2'] },
      { name: 'Bronze', matches: ['BR'] },
      { name: 'Final', matches: ['F'] }
    ],
    links: {
      QF1:{winner:['SF1','home']}, QF2:{winner:['SF2','home']}, QF3:{winner:['SF1','away']}, QF4:{winner:['SF2','away']},
      SF1:{winner:['F','home'], loser:['BR','home']}, SF2:{winner:['F','away'], loser:['BR','away']}
    }
  },
  group_sf_bronze_final: {
    label: 'Slutspelsgrupper + Semi + Brons + Final',
    rounds: [
      { name: 'Slutspelsgrupp A', matches: ['GA1','GA2','GA3'] },
      { name: 'Slutspelsgrupp B', matches: ['GB1','GB2','GB3'] },
      { name: 'Semifinals', matches: ['SF1','SF2'] },
      { name: 'Bronze', matches: ['BR'] },
      { name: 'Final', matches: ['F'] }
    ],
    links: { SF1:{winner:['F','home'], loser:['BR','home']}, SF2:{winner:['F','away'], loser:['BR','away']} }
  }
};


const DEFAULT_FLAG = 'placeholder_light_gray_block.png';
const FLAG_MAP = {
  'Färöarna': 'Flag_of_the_Faroe_Islands.svg','Jugoslavien':'Flag_of_Yugoslavia_(1946-1992).svg','Finland':'Flag_of_Finland.svg','Sverige':'Flag_of_Sweden.svg','Nordkorea':'Flag_of_North_Korea.svg','Chile':'Flag_of_Chile.svg','Schweiz':'Flag_of_Switzerland.svg','Australien':'Flag_of_Australia.svg','Iran':'Flag_of_Iran.svg','Tamil Eelam':'Tamil_Eelam_Flag.svg','Kanada':'Flag_of_Canada.svg','Albanien':'Flag_of_Albania.svg','Peru':'Flag_of_Peru.svg','Norge':'Flag_of_Norway.svg','Västtyskland':'Flag_of_West_Germany;_Flag_of_Germany_(1990#U20131996).svg','Östtyskland':'Flag_of_East_Germany.svg','Belgien':'Flag_of_Belgium.svg','Mali':'Flag_of_Mali.svg','El Salvador':'Flag_of_El_Salvador.svg','Italien':'Flag_of_Italy.svg','Sovjetunionen':'Flag_of_the_Soviet_Union.svg','Polen':'Flag_of_Poland.svg','Nauru':'Flag_of_Nauru.svg','Skottland':'Flag_of_Scotland.svg','Danmark':'Flag_of_Denmark.svg','Grekland':'Flag_of_Greece.svg','St: Kitts/Nevis':'Flag_of_Saint_Kitts_and_Nevis.svg','St:Kitts/Nevis':'Flag_of_Saint_Kitts_and_Nevis.svg','Övre Volta':'Flag_of_Upper_Volta.svg','Cypern':'Flag_of_Cyprus.svg','USA':'Flag_of_the_United_States.svg','England':'Flag_of_England.svg','Spanien':'Flag_of_Spain.svg','Mexiko':'Flag_of_Mexico.svg','Tunisien':'Flag_of_Tunisia.svg','Rhodesia':'Flag_of_Rhodesia_(1968#U20131979).svg','Malta':'Flag_of_Malta.svg','Japan':'Flag_of_Japan.svg','Trinidad/Tobago':'Flag_of_Trinidad_and_Tobago.svg','Island':'Flag_of_Iceland.svg','Åland':'Flag_of_#U00c5land.svg','Ukraina':'Flag_of_Ukraine.svg','Irland':'Flag_of_Ireland.svg','Nepal':'Flag_of_Nepal.svg','Indien':'Flag_of_India.svg'
};
function getFlagSrc(nation){ return `flags/${encodeURIComponent(FLAG_MAP[nation] || DEFAULT_FLAG)}`; }

let backupData = null;
let teams = [];
let state = { preset: 'qf_sf_bronze_final', matches: {} };

function init() {
  const presetEl = document.getElementById('preset');
  Object.entries(PRESETS).forEach(([key,p]) => {
    const o=document.createElement('option'); o.value=key; o.textContent=p.label; presetEl.appendChild(o);
  });
  presetEl.value = state.preset;
  presetEl.addEventListener('change', ()=> { state.preset=presetEl.value; buildBracket(); saveState(); });

  document.getElementById('load-backup').addEventListener('click', ()=>document.getElementById('backup-file').click());
  document.getElementById('backup-file').addEventListener('change', onBackupFile);
  document.getElementById('save-export').addEventListener('click', exportFullTournament);

  const stored = localStorage.getItem('fo-playoff-state');
  if (stored) state = JSON.parse(stored);
  buildBracket();
}

function saveState(){ localStorage.setItem('fo-playoff-state', JSON.stringify(state)); }

function onBackupFile(e){
  const file=e.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    backupData=JSON.parse(reader.result);
    teams = extractTeams(backupData);
    document.getElementById('meta-status').textContent = `Backup inläst (${teams.length} nationer).`;
    buildBracket();
  };
  reader.readAsText(file);
}

function extractTeams(data){
  if (Array.isArray(data?.selectedTeams)) return data.selectedTeams;
  if (Array.isArray(data?.participants)) return data.participants.map(p=>p.nation||p.display_name).filter(Boolean);
  return [];
}

function ensureMatch(id){
  if(!state.matches[id]) state.matches[id]={ home:'', away:'', scoreHome:'', scoreAway:'', winner:'' };
  return state.matches[id];
}

function teamSelect(value, onchange){
  const s=document.createElement('select');
  const blank=document.createElement('option'); blank.value=''; blank.textContent='— välj lag —'; s.appendChild(blank);
  teams.forEach(t=>{ const o=document.createElement('option'); o.value=t; o.textContent=t; s.appendChild(o); });
  s.value=value||''; s.addEventListener('change',()=>onchange(s.value)); return s;
}

function buildBracket(){
  const wrap=document.getElementById('rounds'); wrap.innerHTML='';
  const preset=PRESETS[state.preset];
  preset.rounds.forEach(r=>{
    const sec=document.createElement('div'); sec.className='match';
    const h=document.createElement('h3'); h.textContent=r.name; sec.appendChild(h);
    r.matches.forEach(id=>{ sec.appendChild(renderMatch(id)); });
    wrap.appendChild(sec);
  });
  updateSummary();
}

function renderMatch(id){
  const m=ensureMatch(id); const el=document.createElement('div'); el.className='match';
  const t=document.createElement('strong'); t.textContent=id; el.appendChild(t);
  const s1=document.createElement('div'); s1.className='slot'; const f1=document.createElement('img'); f1.className='flag-sm'; f1.src=getFlagSrc(m.home); f1.alt=m.home||''; s1.append('Hemma: ', f1, teamSelect(m.home,v=>{m.home=v; saveState(); buildBracket();}));
  const s2=document.createElement('div'); s2.className='slot'; const f2=document.createElement('img'); f2.className='flag-sm'; f2.src=getFlagSrc(m.away); f2.alt=m.away||''; s2.append('Borta: ', f2, teamSelect(m.away,v=>{m.away=v; saveState(); buildBracket();}));
  el.append(s1,s2);

  const rs=document.createElement('div'); rs.className='slot';
  const a=document.createElement('input'); a.type='number'; a.placeholder='Mål hemma'; a.value=m.scoreHome;
  const b=document.createElement('input'); b.type='number'; b.placeholder='Mål borta'; b.value=m.scoreAway;
  const btn=document.createElement('button'); btn.className='btn btn-secondary'; btn.textContent='Spara resultat';
  btn.onclick=()=>{ m.scoreHome=a.value; m.scoreAway=b.value; resolveMatch(id); saveState(); buildBracket(); };
  rs.append(a,b,btn); el.appendChild(rs);
  return el;
}

function resolveMatch(id){
  const m=state.matches[id]; if(!(m.home&&m.away)) return;
  const sh=Number(m.scoreHome), sa=Number(m.scoreAway); if(Number.isNaN(sh)||Number.isNaN(sa)||sh===sa) return;
  m.winner = sh>sa?m.home:m.away;
  const loser = sh>sa?m.away:m.home;
  const link=PRESETS[state.preset].links[id]; if(!link) return;
  if(link.winner){ const [next,slot]=link.winner; ensureMatch(next)[slot]=m.winner; }
  if(link.loser){ const [next,slot]=link.loser; ensureMatch(next)[slot]=loser; }
}

function updateSummary(){
  const f=state.matches.F, br=state.matches.BR;
  const sum=document.getElementById('summary');
  if(!f?.winner || !br?.winner){ sum.innerHTML='Spela klart semifinaler/final/bronsmatch för att se GULD/SILVER/BRONS.<p class="status">Tips: Exportfilen används som komplett arkiv/backup. Statistik hämtas från NotebookLM och kan senare skrivas in i exportens awards-fält.</p>'; return; }
  const finalLoser = f.winner===f.home?f.away:f.home;
  sum.innerHTML = `<p><strong>GULD:</strong> ${f.winner}</p><p><strong>SILVER:</strong> ${finalLoser}</p><p><strong>BRONS:</strong> ${br.winner}</p>`;
}

function exportFullTournament(){
  const out={
    version:'tournament-export-v1.1',
    generatedAt:new Date().toISOString(),
    sourceBackup:backupData,
    playoff:{preset:state.preset,matches:state.matches}
  };
  if(state.matches.F?.winner && state.matches.BR?.winner){
    const f=state.matches.F;
    out.finalStandings={ gold:f.winner, silver:f.winner===f.home?f.away:f.home, bronze:state.matches.BR.winner };
  }
  const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='fopen-full-tournament.json'; a.click();
}

init();
