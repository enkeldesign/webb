// main.js – logiken för Färöarna Open 2026 webbapp
// All data (ruleset, marathon, historik) importeras från data/data.js som ES‑modul

// Data constants (RULESET, MARATHON, HISTORIK) are defined on window by
// global-data.js.  We rely on those global variables instead of ES module
// imports because the app runs from the local filesystem where module
// imports are not supported.

/*
 * Svenska nationsnamn mappade till flagg‑filer i ./flags/.  När nya nationer läggs till i maratontabellen
 * bör de läggas in här så rätt flagga visas.  Filnamnen måste matcha exakt de som finns i foldern.
 */
const FLAG_MAP = {
  'Färöarna': 'Flag_of_the_Faroe_Islands.svg',
  'Jugoslavien': 'Flag_of_Yugoslavia_(1946-1992).svg',
  'Finland': 'Flag_of_Finland.svg',
  'Sverige': 'Flag_of_Sweden.svg',
  'Nordkorea': 'Flag_of_North_Korea.svg',
  'Chile': 'Flag_of_Chile.svg',
  'Schweiz': 'Flag_of_Switzerland.svg',
  'Australien': 'Flag_of_Australia.svg',
  'Iran': 'Flag_of_Iran.svg',
  'Tamil Eelam': 'Tamil_Eelam_Flag.svg',
  'Kanada': 'Flag_of_Canada.svg',
  'Albanien': 'Flag_of_Albania.svg',
  'Peru': 'Flag_of_Peru.svg',
  'Norge': 'Flag_of_Norway.svg',
  'Västtyskland': 'Flag_of_West_Germany;_Flag_of_Germany_(1990#U20131996).svg',
  'Belgien': 'Flag_of_Belgium.svg',
  'Mali': 'Flag_of_Mali.svg',
  'El Salvador': 'Flag_of_El_Salvador.svg',
  'Italien': 'Flag_of_Italy.svg',
  'Sovjetunionen': 'Flag_of_the_Soviet_Union.svg',
  'Polen': 'Flag_of_Poland.svg',
  'Nauru': 'Flag_of_Nauru.svg',
  'Östtyskland': 'Flag_of_East_Germany.svg',
  'Skottland': 'Flag_of_Scotland.svg',
  'Danmark': 'Flag_of_Denmark.svg',
  'Grekland': 'Flag_of_Greece.svg',
  'St: Kitts/Nevis': 'Flag_of_Saint_Kitts_and_Nevis.svg',
  // Include alias without space after colon for St Kitts/Nevis to cover alternate spellings
  'St:Kitts/Nevis': 'Flag_of_Saint_Kitts_and_Nevis.svg',
  'Övre Volta': 'Flag_of_Upper_Volta.svg',
  'Cypern': 'Flag_of_Cyprus.svg',
  'USA': 'Flag_of_the_United_States.svg',
  'England': 'Flag_of_England.svg',
  'Spanien': 'Flag_of_Spain.svg',
  'Mexiko': 'Flag_of_Mexico.svg',
  'Tunisien': 'Flag_of_Tunisia.svg',
  'Rhodesia': 'Flag_of_Rhodesia_(1968#U20131979).svg',
  'Malta': 'Flag_of_Malta.svg',
  'Japan': 'Flag_of_Japan.svg',
  'Trinidad/Tobago': 'Flag_of_Trinidad_and_Tobago.svg',
  // Additional mappings for flags not present in the marathon list
  'Island': 'Flag_of_Iceland.svg',
  'Åland': 'Flag_of_#U00c5land.svg',
  'Ukraina': 'Flag_of_Ukraine.svg',
  // Korrigera stavning för Nepal (rätt namn i maratonlistan). Lägg även till alias
  // utan sista bokstaven för bakåtkompatibilitet.  Båda pekar på samma fil.
  'Nepal': 'Flag_of_Nepal.svg',
  'Nepa': 'Flag_of_Nepal.svg',
  // Alias för stavning med avslutande l ("Nepa" + "l"): "Nepa\u006c" = "Nepa l" (fem tecken)
  'Nepa\u006c': 'Flag_of_Nepal.svg',
  // Fyll ut saknade nationer
  'Indien': 'Flag_of_India.svg',
  // Dubbletter nedan behålls men påverkar inte eftersom samma nycklar redan definierats.
  'Nordkorea': 'Flag_of_North_Korea.svg',
  'Jugoslavien': 'Flag_of_Yugoslavia_(1946-1992).svg',
  'Kanada': 'Flag_of_Canada.svg',
  'Nauru': 'Flag_of_Nauru.svg',
  'Iran': 'Flag_of_Iran.svg',
  'Albanien': 'Flag_of_Albania.svg'
};

// Helper function: given a nation name, return the encoded flag source path.  This ensures
// that special characters in filenames (e.g. semicolons, spaces or unicode) are URL encoded
// so the image loads correctly in the browser.  If a nation is not found in the map,
// the default placeholder image is used instead.
function getFlagSrc(nation) {
  const file = FLAG_MAP[nation] || DEFAULT_FLAG;
  // Use encodeURIComponent to escape characters such as spaces, semicolons and parentheses
  return `flags/${encodeURIComponent(file)}`;
}

// Fallback for nations without flag (use placeholder light gray block)
const DEFAULT_FLAG = 'placeholder_light_gray_block.png';

// State management: we persist state in localStorage under key 'fo-state'
let state = {};

function loadState() {
  try {
    const stored = localStorage.getItem('fo-state');
    if (stored) {
      state = JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Kunde inte läsa state från localStorage', e);
  }
  // If state is empty or invalid, initialise defaults
  if (!state.stage) {
    state = {
      stage: 'select',
      numSlots: 12,
      selectedTeams: [],
      groups: [],
      drawAssignments: {},
      schedule: [],
      results: {}, // matchId -> {score1, score2}
      numBoards: 1,
      marathonUpdated: null,
      // Use a stable ordering for matches in progress to avoid concurrency issues
      playing: [],
      // List of schedule indices that are currently being played. This is
      // separate from the list of team names and ensures that matches in
      // progress persist in the UI until their results are recorded.
      playingMatches: []
    };
  }
  // Ensure selectedTeams is array
  if (!Array.isArray(state.selectedTeams)) state.selectedTeams = [];
  if (!state.drawAssignments) state.drawAssignments = {};
  if (!Array.isArray(state.schedule)) state.schedule = [];
  if (!state.results) state.results = {};
  if (!state.playing) state.playing = [];
  if (!Array.isArray(state.playingMatches)) state.playingMatches = [];
  return state;
}

function saveState() {
  try {
    localStorage.setItem('fo-state', JSON.stringify(state));
    updateAutosaveStatus('sparat');
  } catch (e) {
    console.error('Kunde inte spara state', e);
  }
}

// Debounce autosave status reset
let autosaveTimeout;
function updateAutosaveStatus(status) {
  const statusEl = document.getElementById('autosave-status');
  if (!statusEl) return;
  statusEl.textContent = `Autosave: ${status}`;
  clearTimeout(autosaveTimeout);
  autosaveTimeout = setTimeout(() => {
    statusEl.textContent = 'Autosave: väntar…';
  }, 3000);
}

// Utility: sort teams by Swedish name (locale aware)
function sortTeamsAlphabetical(teams) {
  return [...teams].sort((a, b) => a.localeCompare(b, 'sv'));
}

// Utility: compute format for a given number of participants
function getFormat(numParticipants) {
  return RULESET.formats.find(f => f.participants === numParticipants);
}

// Populate number of slots select options (12–22)
function populateNumSlotsSelect() {
  const select = document.getElementById('num-slots-select');
  for (let i = 12; i <= 22; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i;
    select.appendChild(opt);
  }
  select.value = state.numSlots;
  document.getElementById('slots-total').textContent = state.numSlots;
  select.addEventListener('change', () => {
    state.numSlots = parseInt(select.value, 10);
    // Clear selection when changing number of slots
    state.selectedTeams = [];
    updateNationCards();
    updateSelectedCounter();
    updateDrawButtonState();
    saveState();
    document.getElementById('slots-total').textContent = state.numSlots;
  });
}

// Extract all nation names from marathon table (MARATHON) and append additional teams that
// do not appear in the historic data (e.g. Åland, Island, Ukraina).  We de‑duplicate the list
// and sort alphabetically.  This allows the new nations to be selected even though they
// are missing from historik.json and marathon.md.
const ADDITIONAL_TEAMS = ['Åland', 'Island', 'Ukraina'];
const ALL_TEAMS = sortTeamsAlphabetical(Array.from(new Set([...MARATHON.map(item => item.nation), ...ADDITIONAL_TEAMS])));

// Render nation cards for selection
function renderNationList() {
  const list = document.getElementById('nation-list');
  list.innerHTML = '';
  ALL_TEAMS.forEach(nation => {
    const card = document.createElement('div');
    card.classList.add('nation-card');
    if (state.selectedTeams.includes(nation)) card.classList.add('selected');
    // flag image
    const img = document.createElement('img');
    img.src = getFlagSrc(nation);
    img.alt = nation;
    img.classList.add('flag');
    // name
    const nameSpan = document.createElement('span');
    nameSpan.classList.add('name');
    nameSpan.textContent = nation;
    card.appendChild(img);
    card.appendChild(nameSpan);
    card.addEventListener('click', () => {
      toggleTeamSelection(nation);
    });
    list.appendChild(card);
  });
}

function updateNationCards() {
  const cards = document.querySelectorAll('.nation-card');
  cards.forEach(card => {
    const nation = card.querySelector('.name').textContent;
    if (state.selectedTeams.includes(nation)) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });
}

function updateSelectedCounter() {
  const selectedCountEl = document.getElementById('selected-count');
  selectedCountEl.textContent = state.selectedTeams.length;
}

function updateDrawButtonState() {
  const btn = document.getElementById('draw-btn');
  const hint = document.getElementById('select-hint');
  const count = state.selectedTeams.length;
  const slots = state.numSlots;
  if (count === slots && count >= 12 && count <= 22) {
    btn.disabled = false;
    hint.textContent = '';
  } else {
    btn.disabled = true;
    if (count < 12) {
      hint.textContent = `Välj minst 12 nationer (du har valt ${count}).`;
    } else if (count > 22) {
      hint.textContent = `Max 22 nationer är tillåtna.`;
    } else if (count !== slots) {
      hint.textContent = `Du måste välja exakt ${slots} nationer.`;
    }
  }
}

function toggleTeamSelection(nation) {
  const idx = state.selectedTeams.indexOf(nation);
  if (idx >= 0) {
    state.selectedTeams.splice(idx, 1);
  } else {
    if (state.selectedTeams.length < state.numSlots) {
      state.selectedTeams.push(nation);
    }
  }
  updateNationCards();
  updateSelectedCounter();
  updateDrawButtonState();
  saveState();
}

// Begin draw: create groups and show draw-stage
function startDraw() {
  const format = getFormat(state.numSlots);
  if (!format) {
    alert('Ingen formatdefinition hittades för ' + state.numSlots + ' lag.');
    return;
  }
  // Initialise groups based on slots
  state.groups = format.groups.map(g => ({
    label: g.label,
    slots: g.slots.map(slot => ({ id: slot, team: null }))
  }));
  state.drawAssignments = {};
  state.stage = 'draw';
  saveState();
  // Render the appropriate stage and draw UI when entering draw stage.  Without this
  // call, the group containers and selected nation list will not appear.  The
  // draw stage UI must be built after switching stages.
  renderStage();
  renderDrawStage();
}

// Fill all draw assignments randomly (debug)
function fillDrawRandomly() {
  // Create array of all slots
  const allSlots = [];
  state.groups.forEach(group => group.slots.forEach(slot => allSlots.push(slot)));
  // Shuffle selected teams
  const teams = [...state.selectedTeams];
  for (let i = teams.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [teams[i], teams[j]] = [teams[j], teams[i]];
  }
  // Assign sequentially
  allSlots.forEach((slot, idx) => {
    const team = teams[idx];
    slot.team = team;
    state.drawAssignments[slot.id] = team;
  });
  updateGroupSlotsUI();
  updateStartTournamentButtonState();
  saveState();
}

// Handle slot click to assign selected nation
let selectedNationForAssignment = null;

function handleSelectedNationClick(nation, cardEl) {
  // Set as the currently selected for assignment
  selectedNationForAssignment = nation;
  // Highlight the selected nation in list above groups
  document.querySelectorAll('.selected-card').forEach(el => {
    if (el.dataset.nation === nation) {
      el.classList.add('selected-team');
    } else {
      el.classList.remove('selected-team');
    }
  });
}

function handleSlotAssignmentClick(slotEl, groupIndex, slotIndex) {
  const slot = state.groups[groupIndex].slots[slotIndex];
  if (slot.team) {
    // Already filled: do nothing
    return;
  }
  if (!selectedNationForAssignment) {
    alert('Välj en nation att placera.');
    return;
  }
  slot.team = selectedNationForAssignment;
  state.drawAssignments[slot.id] = selectedNationForAssignment;
  // Remove from list of selectable assignments
  const idx = state.selectedTeams.indexOf(selectedNationForAssignment);
  if (idx >= 0) state.selectedTeams.splice(idx, 1);
  selectedNationForAssignment = null;
  updateSelectedNationCards();
  updateGroupSlotsUI();
  updateStartTournamentButtonState();
  saveState();
}

function updateSelectedNationCards() {
  const container = document.getElementById('selected-nations');
  container.innerHTML = '';
  const remaining = state.selectedTeams.filter(t => {
    // Remove those already assigned to slots (state.drawAssignments)
    return !Object.values(state.drawAssignments).includes(t);
  });
  remaining.forEach(nation => {
    const card = document.createElement('div');
    card.classList.add('selected-card');
    card.dataset.nation = nation;
    const img = document.createElement('img');
    img.src = getFlagSrc(nation);
    img.alt = nation;
    img.classList.add('flag');
    const span = document.createElement('span');
    span.textContent = nation;
    card.appendChild(img);
    card.appendChild(span);
    card.addEventListener('click', () => handleSelectedNationClick(nation, card));
    container.appendChild(card);
  });
}

function updateGroupSlotsUI() {
  const groupsContainer = document.getElementById('groups-container');
  groupsContainer.innerHTML = '';
  state.groups.forEach((group, gi) => {
    const groupEl = document.createElement('div');
    groupEl.classList.add('group');
    // header
    const header = document.createElement('header');
    header.textContent = 'Grupp ' + group.label;
    groupEl.appendChild(header);
    group.slots.forEach((slot, si) => {
      const slotEl = document.createElement('div');
      slotEl.classList.add('slot');
        if (slot.team) {
        slotEl.classList.add('filled');
        const img = document.createElement('img');
        img.src = getFlagSrc(slot.team);
        img.alt = slot.team;
        img.classList.add('flag');
        const span = document.createElement('span');
        span.textContent = slot.team;
        slotEl.appendChild(img);
        slotEl.appendChild(span);
      } else {
        slotEl.textContent = slot.id;
      }
      slotEl.addEventListener('click', () => handleSlotAssignmentClick(slotEl, gi, si));
      groupEl.appendChild(slotEl);
    });
    groupsContainer.appendChild(groupEl);
  });
}

function updateStartTournamentButtonState() {
  const btn = document.getElementById('start-tournament-btn');
  // Determine if all slots are filled
  let allFilled = true;
  state.groups.forEach(group => {
    group.slots.forEach(slot => {
      if (!slot.team) allFilled = false;
    });
  });
  btn.disabled = !allFilled;
}

// Build schedule of matches based on assignments and ruleset
function buildSchedule() {
  const format = getFormat(state.numSlots);
  const matches = [];
  format.groupStage.matches.forEach(matchDef => {
    const homeTeam = state.drawAssignments[matchDef.home];
    const awayTeam = state.drawAssignments[matchDef.away];
    matches.push({
      id: matchDef.id,
      homeSlot: matchDef.home,
      awaySlot: matchDef.away,
      team1: homeTeam,
      team2: awayTeam,
      // Lagra gruppen denna match hör till genom att titta på första tecknet i hemmaslottet.
      group: matchDef.home.charAt(0),
      score1: null,
      score2: null,
      status: 'pending' // pending, playing, completed
    });
  });
  state.schedule = matches;
  state.results = {};
  state.playing = [];
  saveState();
}

// Prompt user for number of boards and start tournament
function startTournament() {
  let boards = parseInt(prompt('Hur många bord (1–5)?', state.numBoards || 1), 10);
  if (isNaN(boards) || boards < 1 || boards > 5) boards = 1;
  state.numBoards = boards;
  buildSchedule();
  // Initialise group standings with zero values so that groups are displayed even before any matches are played.
  initGroupStandings();
  state.stage = 'tournament';
  // Clear playing matches list when starting new tournament
  state.playingMatches = [];
  saveState();
  renderStage();
  updateScheduleUI();
  updateNowPlaying();
  updateStandingsUI();
}

// Determine matches ready to be played (next for each board)
function getReadyMatches() {
  const ready = [];
  // We'll iterate through schedule sequentially; pick matches that are pending and whose teams have completed all previous matches and are not currently playing
  for (let i = 0; i < state.schedule.length; i++) {
    const match = state.schedule[i];
    if (match.status !== 'pending') continue;
    const team1 = match.team1;
    const team2 = match.team2;
    // Check if team1 or team2 is currently playing
    if (state.playing.includes(team1) || state.playing.includes(team2)) continue;
    // Check if there is any earlier pending match involving team1 or team2
    let previousIncomplete = false;
    for (let j = 0; j < i; j++) {
      const m = state.schedule[j];
      if (m.status !== 'completed') {
        if (m.team1 === team1 || m.team2 === team1 || m.team1 === team2 || m.team2 === team2) {
          previousIncomplete = true;
          break;
        }
      }
    }
    if (!previousIncomplete) {
      ready.push({ match, index: i });
      if (ready.length >= state.numBoards) break;
    }
  }
  return ready;
}

// Render now playing area
function updateNowPlaying() {
  const container = document.getElementById('current-matches');
  container.innerHTML = '';
  // Remove any completed matches from the playingMatches list
  state.playingMatches = state.playingMatches.filter(idx => {
    const m = state.schedule[idx];
    return m && m.status !== 'completed';
  });
  // Reset status of all non-completed matches to pending; matches
  // currently in playingMatches will be set to 'playing' later
  state.schedule.forEach((m, i) => {
    if (m.status !== 'completed') m.status = 'pending';
  });
  // Prepare the list of team names currently playing (for readiness check)
  state.playing = [];
  state.playingMatches.forEach(idx => {
    const m = state.schedule[idx];
    if (m) {
      state.playing.push(m.team1);
      state.playing.push(m.team2);
    }
  });
  // Determine how many slots we need to fill
  let slotsToFill = state.numBoards - state.playingMatches.length;
  if (slotsToFill > 0) {
    const ready = getReadyMatches();
    for (const item of ready) {
      if (slotsToFill <= 0) break;
      // Skip if this match is already in playingMatches
      if (!state.playingMatches.includes(item.index)) {
        state.playingMatches.push(item.index);
        // Add team names so subsequent ready checks avoid duplicates
        state.playing.push(item.match.team1);
        state.playing.push(item.match.team2);
        slotsToFill--;
      }
    }
  }
  // Render all currently playing matches
  state.playingMatches.forEach(idx => {
    const match = state.schedule[idx];
    if (!match) return;
    // Mark match as playing so schedule UI can highlight it
    if (match.status !== 'completed') match.status = 'playing';
    const card = document.createElement('div');
    card.classList.add('match-card');
    // Insert group label at top of card
    const groupLabel = document.createElement('div');
    groupLabel.classList.add('match-group');
    groupLabel.textContent = match.group ? `Grupp ${match.group}` : '';
    card.appendChild(groupLabel);
    // Teams display: use three columns (team1, vs, team2) for better alignment
    const teamsRow = document.createElement('div');
    teamsRow.classList.add('match-teams');
    // Left team element with flag and name
    const team1Div = document.createElement('div');
    team1Div.classList.add('match-team-left');
    const t1img = document.createElement('img');
    t1img.src = getFlagSrc(match.team1);
    t1img.alt = match.team1;
    t1img.classList.add('flag');
    const t1name = document.createElement('span');
    t1name.textContent = match.team1;
    team1Div.appendChild(t1img);
    team1Div.appendChild(t1name);
    // vs text
    const vsDiv = document.createElement('div');
    vsDiv.classList.add('match-vs');
    vsDiv.textContent = 'vs';
    // Right team element with name and flag
    const team2Div = document.createElement('div');
    team2Div.classList.add('match-team-right');
    const t2name = document.createElement('span');
    t2name.textContent = match.team2;
    const t2img = document.createElement('img');
    t2img.src = getFlagSrc(match.team2);
    t2img.alt = match.team2;
    t2img.classList.add('flag');
    team2Div.appendChild(t2name);
    team2Div.appendChild(t2img);
    teamsRow.appendChild(team1Div);
    teamsRow.appendChild(vsDiv);
    teamsRow.appendChild(team2Div);
    card.appendChild(teamsRow);
    // History
    const historyContainer = document.createElement('div');
    historyContainer.classList.add('history');
    const history = getHistory(match.team1, match.team2);
    if (history.length > 0) {
      const title = document.createElement('div');
      title.classList.add('history-title');
      title.textContent = 'Tidigare möten';
      historyContainer.appendChild(title);
      history.forEach(entry => {
        const row = document.createElement('div');
        row.classList.add('history-entry');
        // Year
        const yearSpan = document.createElement('span');
        yearSpan.classList.add('history-year');
        yearSpan.textContent = entry.year;
        // Determine oriented scores relative to the current match orientation.  If
        // the historical entry has the same orientation (team1 vs team2) as the
        // current match, then score1 belongs to the left team and score2 to the
        // right team.  Otherwise the scores must be swapped.
        let leftScore, rightScore;
        if (entry.team1 === match.team1 && entry.team2 === match.team2) {
          leftScore = entry.score1;
          rightScore = entry.score2;
        } else {
          leftScore = entry.score2;
          rightScore = entry.score1;
        }
        // Create spans for the scores and assign win/loss/draw classes based on
        // the oriented scores.  Win indicates the left team won, loss the right.
        const score1Span = document.createElement('span');
        score1Span.classList.add('history-score');
        const score2Span = document.createElement('span');
        score2Span.classList.add('history-score');
        if (leftScore > rightScore) {
          score1Span.classList.add('win');
          score2Span.classList.add('loss');
        } else if (leftScore < rightScore) {
          score1Span.classList.add('loss');
          score2Span.classList.add('win');
        } else {
          score1Span.classList.add('draw');
          score2Span.classList.add('draw');
        }
        score1Span.textContent = leftScore;
        score2Span.textContent = rightScore;
        // Insert a dash between scores for clarity
        const dashSpanHist = document.createElement('span');
        dashSpanHist.classList.add('history-dash');
        dashSpanHist.textContent = '–';
        row.appendChild(yearSpan);
        row.appendChild(score1Span);
        row.appendChild(dashSpanHist);
        row.appendChild(score2Span);
        historyContainer.appendChild(row);
      });
    } else {
      // No historic meetings: simply inform that there are no previous meetings.
      historyContainer.textContent = 'Inga möten i historiken.';
    }
    card.appendChild(historyContainer);
    // Input fields
    const inputRow = document.createElement('div');
    inputRow.classList.add('match-inputs');
    const input1 = document.createElement('input');
    input1.type = 'number';
    input1.min = '0';
    input1.value = '';
    const input2 = document.createElement('input');
    input2.type = 'number';
    input2.min = '0';
    input2.value = '';
    const doneBtn = document.createElement('button');
    doneBtn.classList.add('btn', 'btn-primary');
    doneBtn.textContent = 'Klar';
    doneBtn.addEventListener('click', () => {
      const s1 = parseInt(input1.value, 10);
      const s2 = parseInt(input2.value, 10);
      if (isNaN(s1) || isNaN(s2)) {
        alert('Fyll i resultat.');
        return;
      }
      recordResult(idx, s1, s2);
    });
    inputRow.appendChild(input1);
    const dash = document.createElement('span');
    dash.textContent = '-';
    inputRow.appendChild(dash);
    inputRow.appendChild(input2);
    inputRow.appendChild(doneBtn);
    card.appendChild(inputRow);
    container.appendChild(card);
  });
  saveState();
}

// Precompute last year each team appeared in historik for fallback messages
const LAST_APPEARANCE = {};
if (typeof HISTORIK !== 'undefined' && HISTORIK.matches) {
  HISTORIK.matches.forEach(m => {
    [m.team1, m.team2].forEach(team => {
      if (!LAST_APPEARANCE[team] || m.year > LAST_APPEARANCE[team]) {
        LAST_APPEARANCE[team] = m.year;
      }
    });
  });
}

// Retrieve historical results between two teams (either orientation)
function getHistory(teamA, teamB) {
  const matches = HISTORIK.matches || [];
  const filtered = matches.filter(m => {
    return (
      (m.team1 === teamA && m.team2 === teamB) ||
      (m.team1 === teamB && m.team2 === teamA)
    );
  });
  // Sort descending by year
  filtered.sort((a, b) => b.year - a.year);
  return filtered;
}

// Record result for a match
function recordResult(scheduleIndex, score1, score2) {
  const match = state.schedule[scheduleIndex];
  match.score1 = score1;
  match.score2 = score2;
  match.status = 'completed';
  state.results[match.id] = { score1, score2 };
  // Show toast with result and winner information
  showToast(match, score1, score2);
  // Remove teams from playing list
  state.playing = state.playing.filter(team => team !== match.team1 && team !== match.team2);
  // Remove this match from the list of currently playing matches so that it
  // can be replaced by a new ready match. Without this, the match card
  // would persist after results are entered.
  state.playingMatches = state.playingMatches.filter(i => i !== scheduleIndex);
  // Update standings
  updateStandings(match);
  // Save state
  saveState();
  // Update UI
  updateScheduleUI();
  updateNowPlaying();
  updateStandingsUI();
  // Check if group stage is complete and update UI accordingly
  checkGroupStageComplete();
}

// Show a toast notification summarising a match result.  The toast displays the
// winner (in primary color) and the loser (in secondary color) along with the
// score.  It fades in and out automatically after a few seconds.  In case of a
// draw the teams are displayed in neutral colors.  The toast element is
// expected to exist in the DOM with id "toast".
function showToast(match, score1, score2) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  let resultHtml;
  // Generate HTML with flag icons and scores.  A draw shows both teams in neutral colour;
  // otherwise the winner uses the "winner" class and the loser uses the "loser" class.  Flags
  // are always displayed and sized consistently via CSS.
  if (score1 === score2) {
    resultHtml = `
      <img src="${getFlagSrc(match.team1)}" alt="${match.team1}" class="flag">
      <span class="winner">${match.team1}</span>
      <span class="score">${score1}</span>
      <span>–</span>
      <span class="score">${score2}</span>
      <img src="${getFlagSrc(match.team2)}" alt="${match.team2}" class="flag">
      <span class="loser">${match.team2}</span>
    `;
  } else {
    let winnerTeam, loserTeam, winnerScore, loserScore;
    if (score1 > score2) {
      winnerTeam = match.team1;
      winnerScore = score1;
      loserTeam = match.team2;
      loserScore = score2;
    } else {
      winnerTeam = match.team2;
      winnerScore = score2;
      loserTeam = match.team1;
      loserScore = score1;
    }
    resultHtml = `
      <img src="${getFlagSrc(winnerTeam)}" alt="${winnerTeam}" class="flag">
      <span class="winner">${winnerTeam}</span>
      <span class="score">${winnerScore}</span>
      <span>–</span>
      <span class="score">${loserScore}</span>
      <img src="${getFlagSrc(loserTeam)}" alt="${loserTeam}" class="flag">
      <span class="loser">${loserTeam}</span>
    `;
  }
  toast.innerHTML = `
    <div class="toast-title">Senaste resultat</div>
    <div class="toast-body">${resultHtml}</div>
  `;
  toast.hidden = false;
  // Restart the fade‑in animation by toggling class
  toast.classList.remove('show');
  void toast.offsetWidth;
  toast.classList.add('show');
}

// Generate the playoff bracket based on final group standings and ruleset.
// This function constructs a data structure representing each playoff round
// and the matches within it. Seeds referencing group placements (e.g. 'A1')
// are resolved to actual team names using the final group standings. Seeds
// referencing winners of previous matches (e.g. 'V1', '1') remain as
// identifiers and will be resolved after those matches are played. A bronze
// match is appended after the semifinals using placeholder loser seeds ('L1', 'L2').
function generatePlayoffBracket() {
  const format = getFormat(state.numSlots);
  if (!format || !format.playoffs || !format.playoffs.rounds) return [];
  // Compute final standings order for each group (sorted by rank)
  const finalStandings = {};
  state.groups.forEach(group => {
    const stats = Object.values(state.groupStandings[group.label]);
    stats.sort(compareStandings);
    finalStandings[group.label] = stats.map(s => s.team);
  });
  const rounds = [];
  format.playoffs.rounds.forEach(round => {
    const r = { name: round.name, matches: [] };
    round.matches.forEach(match => {
      const seed1 = match.home;
      const seed2 = match.away;
      // Resolve group seeds (e.g. 'A2') to team names.  Seeds referencing
      // winners of previous matches (e.g. 'V1', '1') remain unresolved (null)
      let team1 = null;
      let team2 = null;
      if (typeof seed1 === 'string' && /^[A-Z][0-9]+$/.test(seed1)) {
        const g = seed1.charAt(0);
        const rnk = parseInt(seed1.slice(1), 10);
        const arr = finalStandings[g];
        if (arr && arr.length >= rnk) team1 = arr[rnk - 1];
      }
      if (typeof seed2 === 'string' && /^[A-Z][0-9]+$/.test(seed2)) {
        const g = seed2.charAt(0);
        const rnk = parseInt(seed2.slice(1), 10);
        const arr = finalStandings[g];
        if (arr && arr.length >= rnk) team2 = arr[rnk - 1];
      }
      r.matches.push({
        id: match.id,
        homeSeed: seed1,
        awaySeed: seed2,
        team1,
        team2,
        score1: null,
        score2: null,
        status: 'pending',
        winRef: match.winRef || null
      });
    });
    rounds.push(r);
  });
  // Append a bronze match after the last round (semifinals) if not defined.
  // Seeds 'L1' and 'L2' represent the losers of semifinal 1 and 2.
  rounds.push({
    name: 'Bronsmatch',
    matches: [
      {
        id: 'BM',
        homeSeed: 'L1',
        awaySeed: 'L2',
        team1: null,
        team2: null,
        score1: null,
        score2: null,
        status: 'pending',
        winRef: null
      }
    ]
  });
  return rounds;
}

// Start playoffs: generate bracket, set stage to 'playoff' and render the bracket
function startPlayoffs() {
  // Generate the playoff bracket using final group standings
  const bracket = generatePlayoffBracket();
  state.playoffs = bracket;
  state.stage = 'playoff';
  // Save and render playoff stage
  saveState();
  renderStage();
  renderPlayoffStage();
}

// Render the playoff stage UI.  This function populates the playoff-bracket
// container with rounds and matches based on state.playoffs.  For each match
// the home and away teams are displayed if resolved; otherwise the seed
// identifiers are shown.  Scores are left blank until implemented.
function renderPlayoffStage() {
  const bracketDiv = document.getElementById('playoff-bracket');
  if (!bracketDiv) return;
  bracketDiv.innerHTML = '';
  const rounds = state.playoffs || [];
  rounds.forEach(round => {
    const roundDiv = document.createElement('div');
    roundDiv.classList.add('playoff-round');
    const title = document.createElement('h3');
    title.textContent = round.name;
    roundDiv.appendChild(title);
    round.matches.forEach(match => {
      const matchDiv = document.createElement('div');
      matchDiv.classList.add('playoff-match');
      // Home team or seed
      const homeDiv = document.createElement('div');
      homeDiv.classList.add('playoff-match-team');
      if (match.team1) {
        const img = document.createElement('img');
        img.src = getFlagSrc(match.team1);
        img.alt = match.team1;
        img.classList.add('flag');
        homeDiv.appendChild(img);
        const span = document.createElement('span');
        span.textContent = match.team1;
        homeDiv.appendChild(span);
      } else {
        const span = document.createElement('span');
        span.textContent = match.homeSeed;
        homeDiv.appendChild(span);
      }
      // Score
      const scoreDiv = document.createElement('div');
      scoreDiv.classList.add('playoff-match-score');
      if (match.score1 != null && match.score2 != null) {
        scoreDiv.textContent = `${match.score1} – ${match.score2}`;
      } else {
        scoreDiv.textContent = '';
      }
      // Away team or seed
      const awayDiv = document.createElement('div');
      awayDiv.classList.add('playoff-match-team');
      if (match.team2) {
        const img2 = document.createElement('img');
        img2.src = getFlagSrc(match.team2);
        img2.alt = match.team2;
        img2.classList.add('flag');
        awayDiv.appendChild(img2);
        const span2 = document.createElement('span');
        span2.textContent = match.team2;
        awayDiv.appendChild(span2);
      } else {
        const span2 = document.createElement('span');
        span2.textContent = match.awaySeed;
        awayDiv.appendChild(span2);
      }
      matchDiv.appendChild(homeDiv);
      matchDiv.appendChild(scoreDiv);
      matchDiv.appendChild(awayDiv);
      roundDiv.appendChild(matchDiv);
    });
    bracketDiv.appendChild(roundDiv);
  });
}

// Check if the group stage is complete (all matches completed).  If so,
// replace the "Kör nu" area with a message and a button to start the
// playoffs.  The actual playoff bracket is not implemented; instead we
// show a confirmation modal when the user chooses to start playoffs.
function checkGroupStageComplete() {
  // Only execute in tournament stage
  if (state.stage !== 'tournament') return;
  const allDone = state.schedule && state.schedule.every(m => m.status === 'completed');
  if (!allDone) return;
  const nowPlaying = document.getElementById('now-playing');
  if (!nowPlaying) return;
  // Clear existing content
  nowPlaying.innerHTML = '';
  // Message indicating group stage completion
  const msg = document.createElement('h2');
  msg.textContent = 'Gruppspelet är slut';
  nowPlaying.appendChild(msg);
}

// Compute and update group standings after a result
function updateStandings(match) {
  // On first call create standings structure
  if (!state.groupStandings) {
    state.groupStandings = {};
    state.groups.forEach(g => {
      state.groupStandings[g.label] = {};
      g.slots.forEach(slot => {
        const team = slot.team;
        state.groupStandings[g.label][team] = {
          team: team,
          games: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          points: 0
        };
      });
    });
  }
  const team1 = match.team1;
  const team2 = match.team2;
  // Determine groups for teams (look up in state.groups)
  let gLabel1 = null;
  let gLabel2 = null;
  state.groups.forEach(g => {
    g.slots.forEach(slot => {
      if (slot.team === team1) gLabel1 = g.label;
      if (slot.team === team2) gLabel2 = g.label;
    });
  });
  const s1 = match.score1;
  const s2 = match.score2;
  // Update stats for team1
  const stat1 = state.groupStandings[gLabel1][team1];
  const stat2 = state.groupStandings[gLabel2][team2];
  stat1.games++;
  stat2.games++;
  stat1.goalsFor += s1;
  stat1.goalsAgainst += s2;
  stat2.goalsFor += s2;
  stat2.goalsAgainst += s1;
  if (s1 > s2) {
    // A win awards two points instead of three
    stat1.wins++;
    stat2.losses++;
    stat1.points += 2;
  } else if (s2 > s1) {
    // A win awards two points instead of three
    stat2.wins++;
    stat1.losses++;
    stat2.points += 2;
  } else {
    // A draw still awards one point to each team
    stat1.draws++;
    stat2.draws++;
    stat1.points += 1;
    stat2.points += 1;
  }
}

/**
 * Infer direct and chance qualifiers from a playoffs bracket when explicit seeds
 * are missing. The ruleset defines playoff rounds as an array of rounds.
 * Each round contains matches with `home` and `away` codes that may reference
 * group placements (e.g. 'A1' for group A rank 1). This function determines
 * which group positions advance directly to later rounds and which must
 * participate in earlier play-in rounds.
 *
 * The algorithm identifies the highest round (closest to the final) that
 * contains at least one group seed. Seeds in this round are treated as direct
 * qualifiers (green). Seeds in any earlier rounds are treated as potential
 * qualifiers (yellow). Winners of earlier matches (codes like 'V1' or numeric
 * IDs) are ignored.
 *
 * @param {Object} playoffs - The playoffs definition from the ruleset.
 * @returns {{direct: Object, chance: Object}} An object where keys are group
 *          letters and values are Sets of ranks for direct and chance qualifiers.
 */
function computeQualifiersFromPlayoffs(playoffs) {
  const direct = {};
  const chance = {};
  if (!playoffs || !Array.isArray(playoffs.rounds)) {
    return { direct, chance };
  }
  const rounds = playoffs.rounds;
  // Find the highest round index that contains a group seed
  let directRoundIndex = null;
  for (let i = rounds.length - 1; i >= 0; i--) {
    const round = rounds[i];
    if (!round.matches) continue;
    let found = false;
    for (const match of round.matches) {
      const codes = [match.home, match.away];
      for (const code of codes) {
        if (typeof code === 'string' && /^[A-Z][0-9]+$/.test(code)) {
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (found) {
      directRoundIndex = i;
      break;
    }
  }
  // Helper to add group and rank to a map
  function add(map, group, rank) {
    const rNum = parseInt(rank, 10);
    if (isNaN(rNum)) return;
    if (!map[group]) map[group] = new Set();
    map[group].add(rNum);
  }
  // Gather seeds from each round
  for (let i = 0; i < rounds.length; i++) {
    const round = rounds[i];
    if (!round.matches) continue;
    for (const match of round.matches) {
      const codes = [match.home, match.away];
      for (const code of codes) {
        if (typeof code === 'string' && /^[A-Z][0-9]+$/.test(code)) {
          const group = code[0];
          const rank = code.slice(1);
          if (i === directRoundIndex) {
            add(direct, group, rank);
          } else {
            add(chance, group, rank);
          }
        }
      }
    }
  }
  return { direct, chance };
}

// Compare two standings entries for sorting within a group
function compareStandings(a, b) {
  // Sort by points desc, then goal difference desc, then goalsFor desc
  const gdA = a.goalsFor - a.goalsAgainst;
  const gdB = b.goalsFor - b.goalsAgainst;
  if (a.points !== b.points) return b.points - a.points;
  if (gdA !== gdB) return gdB - gdA;
  if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
  return a.team.localeCompare(b.team, 'sv');
}

// Determine if the entire group stage is complete (all matches completed)
function isGroupStageComplete() {
  return state.schedule && state.schedule.every(m => m.status === 'completed');
}

// Compute the number of remaining group-stage matches for each team
function getRemainingByTeam() {
  const remaining = {};
  (state.schedule || []).forEach(m => {
    if (m.status === 'completed') return;
    remaining[m.team1] = (remaining[m.team1] || 0) + 1;
    remaining[m.team2] = (remaining[m.team2] || 0) + 1;
  });
  return remaining;
}

// Return number of points awarded for a win
function pointsPerWin() {
  return 2;
}

// Determine how many best third slots exist in this format
function getBestThirdSlotsCount(format) {
  if (!format?.playoffs?.seeds) return 0;
  let c = 0;
  Object.values(format.playoffs.seeds).forEach(seedDef => {
    if (seedDef.fromBestOf) c += 1;
  });
  return c;
}

// Return an object mapping group labels to sorted standings arrays
function getSortedGroupStats() {
  const out = {};
  state.groups.forEach(g => {
    const label = g.label;
    const stats = Object.values(state.groupStandings[label] || {});
    stats.sort(compareStandings);
    out[label] = stats;
  });
  return out;
}

// Determine if a team has conservatively clinched a given rank in its group
// using only points (no goal difference assumptions). A team clinches a rank
// if its worst-case points (losing all remaining games) are strictly greater
// than any other team's best-case points (winning all remaining games).
function isClinchedRankByPoints(groupStatsSorted, team, rankWanted, remainingByTeam) {
  const pWin = pointsPerWin();
  const idx = groupStatsSorted.findIndex(s => s.team === team);
  if (idx === -1) return false;
  // Must currently be at or above wanted rank
  const currentRank = idx + 1;
  if (currentRank > rankWanted) return false;
  const me = groupStatsSorted[idx];
  const myWorst = me.points; // lose remaining
  // Anyone behind could potentially overtake or tie
  for (let j = 0; j < groupStatsSorted.length; j++) {
    if (j === idx) continue;
    const other = groupStatsSorted[j];
    const otherBest = other.points + (remainingByTeam[other.team] || 0) * pWin;
    if (otherBest >= myWorst) return false;
  }
  return true;
}

// Compute current best third leaders and number of slots. Leaders are the third-place
// teams sorted across all groups using the standard tie-break order.
function getBestThirdLeaders(format) {
  const slots = getBestThirdSlotsCount(format);
  if (!slots) return { slots: 0, leaders: [] };
  const groupsSorted = getSortedGroupStats();
  const thirdPlacers = [];
  Object.entries(groupsSorted).forEach(([groupLabel, stats]) => {
    if (stats.length >= 3) {
      const s = { ...stats[2], __group: groupLabel, __rank: 3 };
      thirdPlacers.push(s);
    }
  });
  thirdPlacers.sort((a, b) => compareStandings(a, b));
  return { slots, leaders: thirdPlacers.slice(0, slots) };
}

// Determine conservatively if a best-third qualifier is clinched. A third-place team
// is clinched as best third if its worst-case points exceed the best-case points
// of the first challenger outside the qualifying slots.
function getClinchedBestThird(format) {
  const { slots } = getBestThirdLeaders(format);
  if (!slots) return new Set();
  const remainingByTeam = getRemainingByTeam();
  const pWin = pointsPerWin();
  const groupsSorted = getSortedGroupStats();
  const thirdPlacers = [];
  Object.entries(groupsSorted).forEach(([label, stats]) => {
    if (stats.length >= 3) thirdPlacers.push({ ...stats[2], __group: label });
  });
  thirdPlacers.sort((a, b) => compareStandings(a, b));
  if (thirdPlacers.length <= slots) return new Set();
  const cutoff = thirdPlacers[slots];
  const challengerBest = cutoff.points + (remainingByTeam[cutoff.team] || 0) * pWin;
  const clinched = new Set();
  for (let i = 0; i < slots; i++) {
    const q = thirdPlacers[i];
    const qWorst = q.points;
    if (qWorst > challengerBest) clinched.add(q.team);
  }
  return clinched;
}

// Initialise group standings for all groups with zero values.  Called when the
// tournament starts to ensure the standings table is displayed even before
// any matches have been played.
function initGroupStandings() {
  state.groupStandings = {};
  state.groups.forEach(g => {
    state.groupStandings[g.label] = {};
    g.slots.forEach(slot => {
      const team = slot.team;
      state.groupStandings[g.label][team] = {
        team: team,
        games: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0
      };
    });
  });
}

function updateStandingsUI() {
  const container = document.getElementById('groups-rankings');
  // Reset container content and classes
  container.innerHTML = '';
  // Set a class based on the number of groups so that CSS can adjust the
  // grid layout (e.g. 3 columns for 3 groups, 2 columns for 4 groups etc.)
  container.className = 'groups-rankings';
  if (state.groups && state.groups.length) {
    container.classList.add(`groups-count-${state.groups.length}`);
  }
  if (!state.groupStandings) return;
  // Determine direct and chance seeds for each group
  const format = getFormat(state.numSlots);
  const direct = {};
  const chance = {};
  if (format.playoffs && format.playoffs.seeds) {
    // If explicit seeds are defined in the ruleset, use them to determine
    // direct (green) and chance (yellow) placements. Seeds with `from` map
    // directly to a group and rank; seeds with `fromBestOf` indicate potential
    // qualifiers (best third placements).
    Object.entries(format.playoffs.seeds).forEach(([seedName, seedDef]) => {
      if (seedDef.from) {
        const g = seedDef.from.group;
        const r = seedDef.from.rank;
        if (!direct[g]) direct[g] = new Set();
        direct[g].add(r);
      } else if (seedDef.fromBestOf) {
        const groups = seedDef.fromBestOf.groups;
        groups.forEach(g => {
          if (!chance[g]) chance[g] = new Set();
          chance[g].add(seedDef.fromBestOf.rank);
        });
      }
    });
  } else if (format.playoffs && format.playoffs.rounds) {
    // When explicit seeds are not provided, infer qualifiers from the playoff
    // bracket using computeQualifiersFromPlayoffs(). This examines the
    // bracket structure to classify seeds into direct and chance based on
    // which rounds they appear in.
    const tmp = computeQualifiersFromPlayoffs(format.playoffs);
    // Merge computed seeds into direct and chance maps
    Object.keys(tmp.direct).forEach(g => {
      if (!direct[g]) direct[g] = new Set();
      tmp.direct[g].forEach(r => direct[g].add(r));
    });
    Object.keys(tmp.chance).forEach(g => {
      if (!chance[g]) chance[g] = new Set();
      tmp.chance[g].forEach(r => chance[g].add(r));
    });
  }
  // Precompute whether group stage is complete and which third-placed teams
  // qualify as best third (based on points) when group stage is done.  If
  // group stage is not complete, bestThirdTeams will be used only to mark
  // current best third seeds for seeding purposes.  Teams not in bestThird
  // will be left without highlight once group stage is complete.
  const allDone = isGroupStageComplete();
  const bestThirdInfo = getBestThirdLeaders(format);
  const bestThirdTeams = new Set(bestThirdInfo.leaders.map(x => x.team));

  state.groups.forEach(group => {
    const label = group.label;
    const rankingDiv = document.createElement('div');
    rankingDiv.classList.add('group-ranking');
    const title = document.createElement('h3');
    title.textContent = 'Grupp ' + label;
    rankingDiv.appendChild(title);
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    ['#', 'Nation', 'M', 'V', 'O', 'F', '+', '-', 'P'].forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    // Create array of stats
    const stats = Object.values(state.groupStandings[label]);
    stats.sort(compareStandings);
    stats.forEach((stat, idx) => {
      const tr = document.createElement('tr');
      const rank = idx + 1;
      // Determine highlight class for this row.  Direct placements are always
      // green.  Before group stage completion, all chance seeds (rank per
      // ruleset) are yellow.  After completion, only the actual best third
      // qualifiers remain yellow; other chance seeds become default.
      const isDirectRank = direct[label] && direct[label].has(rank);
      // Determine if this third-place team is a qualifying best third when done
      const isBestThirdNow = bestThirdTeams.has(stat.team);
      let highlight = '';
      if (isDirectRank) {
        highlight = 'direct';
      } else {
        if (!allDone) {
          // Group stage in progress: highlight all potential chance seeds
          const isChanceSeed = chance[label] && chance[label].has(rank);
          if (isChanceSeed) highlight = 'chance';
        } else {
          // Group stage finished: highlight only actual qualifying third teams
          if (isBestThirdNow) highlight = 'chance';
        }
      }
      if (highlight) tr.classList.add(highlight);

      // Rank cell
      const tdRank = document.createElement('td');
      tdRank.textContent = rank;
      tr.appendChild(tdRank);
      // Nation cell with flag, icons and name
      const tdNation = document.createElement('td');
      tdNation.classList.add('nation-cell');
      const flagImg = document.createElement('img');
      flagImg.src = getFlagSrc(stat.team);
      flagImg.alt = stat.team;
      flagImg.classList.add('flag');
      const nameSpan = document.createElement('span');
      nameSpan.textContent = stat.team;
      tdNation.appendChild(flagImg);
      tdNation.appendChild(nameSpan);
      tr.appendChild(tdNation);
      // Remaining statistic cells
      const values = [stat.games, stat.wins, stat.draws, stat.losses, stat.goalsFor, stat.goalsAgainst, stat.points];
      values.forEach(v => {
        const td = document.createElement('td');
        td.textContent = v;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    rankingDiv.appendChild(table);
    container.appendChild(rankingDiv);
  });
}

// Render schedule at bottom
function updateScheduleUI() {
  const list = document.getElementById('schedule-list');
  list.innerHTML = '';
  // Bygg varje rad i spelschemat med en tydlig struktur: flagga + nation, resultat,
  // flagga + nation, gruppnamn och en ändra‑knapp. Vinnande lag markeras med
  // fetstil. Gruppnamn hämtas från match.group som sätts i buildSchedule().
  state.schedule.forEach((match, idx) => {
    const item = document.createElement('div');
    item.classList.add('schedule-item');
    // Mark schedule item with its status to allow styling. Completed status
    // still gets the dedicated class.  Pending and playing statuses will
    // receive their own class names (pending, playing).
    item.classList.add(match.status);
    if (match.status === 'completed') item.classList.add('completed');
    // Build columns: flag1, team1, score, flag2, team2, group label, edit button
    // Flag for team1
    const leftImg = document.createElement('img');
    leftImg.src = getFlagSrc(match.team1);
    leftImg.alt = match.team1;
    leftImg.classList.add('flag');
    // Team1 name
    const leftName = document.createElement('div');
    leftName.classList.add('schedule-team');
    const leftNameSpan = document.createElement('span');
    if (match.status === 'completed' && match.score1 > match.score2) {
      leftNameSpan.innerHTML = `<strong>${match.team1}</strong>`;
    } else {
      leftNameSpan.textContent = match.team1;
    }
    leftName.appendChild(leftNameSpan);
    // Score
    const score = document.createElement('div');
    score.classList.add('schedule-score');
    if (match.status === 'completed') {
      score.innerHTML = `<span>${match.score1}</span><span> – </span><span>${match.score2}</span>`;
    } else {
      score.innerHTML = '';
    }
    // Flag for team2
    const rightImg = document.createElement('img');
    rightImg.src = getFlagSrc(match.team2);
    rightImg.alt = match.team2;
    rightImg.classList.add('flag');
    // Team2 name
    const rightName = document.createElement('div');
    rightName.classList.add('schedule-team');
    const rightNameSpan = document.createElement('span');
    if (match.status === 'completed' && match.score2 > match.score1) {
      rightNameSpan.innerHTML = `<strong>${match.team2}</strong>`;
    } else {
      rightNameSpan.textContent = match.team2;
    }
    rightName.appendChild(rightNameSpan);
    // Group label
    const groupDiv = document.createElement('div');
    groupDiv.classList.add('schedule-group');
    groupDiv.textContent = match.group ? `Grupp ${match.group}` : '';
    // Change result button (if match completed)
    let changeBtn = null;
    if (match.status === 'completed') {
      changeBtn = document.createElement('button');
      changeBtn.classList.add('btn', 'btn-secondary', 'change-result');
      changeBtn.textContent = 'Ändra';
      changeBtn.addEventListener('click', () => {
        editResult(idx);
      });
    }
    // Append in order to match grid columns
    item.appendChild(leftImg);
    item.appendChild(leftName);
    item.appendChild(score);
    item.appendChild(rightImg);
    item.appendChild(rightName);
    item.appendChild(groupDiv);
    if (changeBtn) item.appendChild(changeBtn);
    list.appendChild(item);
  });
  // After rendering the schedule, check if the group stage has been completed.
  // This ensures that on page reload the "Gruppspelet är slut" message and button
  // appear if all matches have results.
  checkGroupStageComplete();
}

function editResult(idx) {
  const match = state.schedule[idx];
  const newScore1 = parseInt(prompt(`Nytt resultat för ${match.team1}`, match.score1), 10);
  const newScore2 = parseInt(prompt(`Nytt resultat för ${match.team2}`, match.score2), 10);
  if (isNaN(newScore1) || isNaN(newScore2)) return;
  // Need to undo old stats then apply new? Simpler: reset standings and recompute all results
  // Reset groupStandings and recompute for all completed matches
  state.groupStandings = null;
  match.score1 = newScore1;
  match.score2 = newScore2;
  state.results[match.id] = { score1: newScore1, score2: newScore2 };
  // Recompute standings from scratch
  state.schedule.forEach(m => {
    if (m.status === 'completed') {
      updateStandings(m);
    }
  });
  saveState();
  updateScheduleUI();
  updateStandingsUI();
  updateNowPlaying();
}

// Render marathon modal
function renderMarathonTable() {
  // Build updated marathon table combining MARATHON and this tournament's results
  const combined = {};
  // Copy base stats
  MARATHON.forEach(entry => {
    combined[entry.nation] = { ...entry };
    // Split goal difference string to compute totals; we'll convert to numbers
    const [gf, ga] = entry.goal_difference.split('-').map(x => parseInt(x, 10));
    combined[entry.nation].goalsFor = gf;
    combined[entry.nation].goalsAgainst = ga;
  });
  // Apply results from this tournament
  state.schedule.forEach(match => {
    if (match.status !== 'completed') return;
    const { team1, team2, score1, score2 } = match;
    // If team not in marathon list, add placeholder entry
    [team1, team2].forEach(team => {
      if (!combined[team]) {
        combined[team] = {
          rank: 99,
          nation: team,
          tournaments: 0,
          matches: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          points: 0
        };
      }
    });
    // Update tournaments and matches; we'll assume each result belongs to one tournament
    combined[team1].matches++;
    combined[team2].matches++;
    combined[team1].goalsFor += score1;
    combined[team1].goalsAgainst += score2;
    combined[team2].goalsFor += score2;
    combined[team2].goalsAgainst += score1;
    if (score1 > score2) {
      combined[team1].wins++;
      combined[team2].losses++;
      // Award two points for a win instead of three
      combined[team1].points += 2;
    } else if (score2 > score1) {
      combined[team2].wins++;
      combined[team1].losses++;
      // Award two points for a win instead of three
      combined[team2].points += 2;
    } else {
      combined[team1].draws++;
      combined[team2].draws++;
      combined[team1].points += 1;
      combined[team2].points += 1;
    }
  });
  // Convert back to array
  const entries = Object.values(combined);
  // Compute goal difference strings for display
  entries.forEach(e => {
    e.goal_difference = `${e.goalsFor}-${e.goalsAgainst}`;
  });
  // Sort by points desc, then goal difference desc, then wins, draws, etc.
  entries.sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdA !== gdB) return gdB - gdA;
    if (a.wins !== b.wins) return b.wins - a.wins;
    return a.nation.localeCompare(b.nation, 'sv');
  });
  // Compare with original ranking to mark up/down
  const originalRanks = {};
  MARATHON.forEach(entry => {
    originalRanks[entry.nation] = entry.rank;
  });
  // Render table
  const tableContainer = document.getElementById('marathon-table');
  tableContainer.innerHTML = '';
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  ['Plac', 'Nation', 'Matcher', 'Vinster', 'Oavg', 'Förluster', 'Målskillnad', 'Poäng', '∆'].forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  // Determine which nations are participating in this tournament.  Use drawAssignments to
  // gather assigned teams, as selectedTeams may change during draw.
  const participants = new Set(Object.values(state.drawAssignments || {}));

  entries.forEach((entry, idx) => {
    const tr = document.createElement('tr');
    const rank = idx + 1;
    const originalRank = originalRanks[entry.nation] || null;
    const delta = originalRank ? originalRank - rank : null;

    // If this nation is participating in the current tournament, mark row with participant class
    if (participants.has(entry.nation)) {
      tr.classList.add('participant');
    }

    // Build cells: rank, nation (with flag), matches, wins, draws, losses, goal difference, points, delta
    // Rank
    const tdRank = document.createElement('td');
    tdRank.textContent = rank;
    tr.appendChild(tdRank);
    // Nation cell with flag and name
    const tdNation = document.createElement('td');
    tdNation.classList.add('nation-cell');
    const flagImg = document.createElement('img');
    flagImg.src = getFlagSrc(entry.nation);
    flagImg.alt = entry.nation;
    flagImg.classList.add('flag');
    const nameSpan = document.createElement('span');
    nameSpan.textContent = entry.nation;
    tdNation.appendChild(flagImg);
    tdNation.appendChild(nameSpan);
    tr.appendChild(tdNation);
    // Matches, wins, draws, losses, goal diff, points
    const values = [entry.matches, entry.wins, entry.draws, entry.losses, entry.goal_difference, entry.points];
    values.forEach(val => {
      const td = document.createElement('td');
      td.textContent = val;
      tr.appendChild(td);
    });
    // Delta cell (rank change)
    const deltaCell = document.createElement('td');
    if (delta) {
      if (delta > 0) deltaCell.innerHTML = `<span class="up">↑ ${delta}</span>`;
      else if (delta < 0) deltaCell.innerHTML = `<span class="down">↓ ${-delta}</span>`;
      else deltaCell.textContent = '–';
    } else {
      deltaCell.textContent = '';
    }
    tr.appendChild(deltaCell);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  tableContainer.appendChild(table);
}

// Show/hide marathon modal
function toggleMarathonModal(show) {
  const modal = document.getElementById('marathon-modal');
  if (show) {
    renderMarathonTable();
    modal.hidden = false;
  } else {
    modal.hidden = true;
  }
}

// Render current stage UI
function renderStage() {
  const selectStage = document.getElementById('select-stage');
  const drawStage = document.getElementById('draw-stage');
  const tournamentStage = document.getElementById('tournament-stage');
  if (state.stage === 'select') {
    selectStage.hidden = false;
    drawStage.hidden = true;
    tournamentStage.hidden = true;
    const playoffStage = document.getElementById('playoff-stage');
    if (playoffStage) playoffStage.hidden = true;
  } else if (state.stage === 'draw') {
    selectStage.hidden = true;
    drawStage.hidden = false;
    tournamentStage.hidden = false;
    // In draw stage we still show tournament stage? No, hide tournament
    tournamentStage.hidden = true;
    const playoffStage = document.getElementById('playoff-stage');
    if (playoffStage) playoffStage.hidden = true;
  } else if (state.stage === 'tournament') {
    selectStage.hidden = true;
    drawStage.hidden = true;
    tournamentStage.hidden = false;
    const playoffStage = document.getElementById('playoff-stage');
    if (playoffStage) playoffStage.hidden = true;
  } else if (state.stage === 'playoff') {
    selectStage.hidden = true;
    drawStage.hidden = true;
    tournamentStage.hidden = true;
    const playoffStage = document.getElementById('playoff-stage');
    if (playoffStage) playoffStage.hidden = false;
  }
}

// Set up event listeners
function bindEvents() {
  document.getElementById('draw-btn').addEventListener('click', startDraw);
  document.getElementById('fill-all-draw').addEventListener('click', fillDrawRandomly);
  document.getElementById('start-tournament-btn').addEventListener('click', startTournament);
  document.getElementById('marathon-btn').addEventListener('click', () => toggleMarathonModal(true));
  document.getElementById('close-marathon').addEventListener('click', () => toggleMarathonModal(false));
  document.getElementById('backup-btn').addEventListener('click', backupState);
  document.getElementById('reset-btn').addEventListener('click', resetState);
  document.getElementById('auto-results').addEventListener('click', autoFillResults);

  // Return to group stage from playoffs
  // Removed: no playoff stage in this version

  // Hamburger menu toggle: show/hide dropdown on click and hide when clicking outside
  const menuToggle = document.getElementById('menu-toggle');
  const menuDropdown = document.getElementById('menu-dropdown');
  if (menuToggle && menuDropdown) {
    menuToggle.addEventListener('click', evt => {
      evt.stopPropagation();
      if (menuDropdown.hasAttribute('hidden')) {
        menuDropdown.removeAttribute('hidden');
      } else {
        menuDropdown.setAttribute('hidden', '');
      }
    });
    // Close the menu when clicking outside of it
    document.addEventListener('click', evt => {
      if (!menuDropdown.hasAttribute('hidden') && !menuDropdown.contains(evt.target) && evt.target !== menuToggle) {
        menuDropdown.setAttribute('hidden', '');
      }
    });
  }
  // Event listeners for start playoff modal actions are removed: no playoff stage
  window.addEventListener('beforeunload', () => {
    saveState();
  });
}

// Backup state by downloading JSON file
function backupState() {
  const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-');
  a.download = `faeroarna-open-backup-${ts}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Reset state (debug) and reload page
function resetState() {
  if (!confirm('Detta kommer att nollställa allt sparad data. Är du säker?')) return;
  // Radera all data från localStorage så att allt sparat från tidigare sessioner
  // tas bort. removeItem() på enskild nyckel räcker inte alltid när sidan
  // körs under file://-protokollet, därför kör vi clear().
  try {
    localStorage.clear();
  } catch (e) {
    console.warn('Kunde inte rensa localStorage', e);
  }
  // Reset the global state object till sina ursprungliga standardvärden.  Vi
  // inkluderar playingMatches så att logiken för "Kör nu" fungerar korrekt
  // direkt efter återställning.
  state = {
    stage: 'select',
    numSlots: 12,
    selectedTeams: [],
    groups: [],
    drawAssignments: {},
    schedule: [],
    results: {},
    numBoards: 1,
    marathonUpdated: null,
    playing: [],
    playingMatches: []
  };
  // Spara detta tomma state så att nästa laddning av sidan tar del av det.
  saveState();
  // Ladda om sidan för att uppdatera hela gränssnittet
  location.reload();
}

// Auto fill results for debugging
function autoFillResults() {
  state.schedule.forEach((match, idx) => {
    if (match.status !== 'completed') {
      const s1 = Math.floor(Math.random() * 6);
      const s2 = Math.floor(Math.random() * 6);
      match.score1 = s1;
      match.score2 = s2;
      match.status = 'completed';
      state.results[match.id] = { score1: s1, score2: s2 };
    }
  });
  // Reset standings and recompute
  state.groupStandings = null;
  // Initialize empty standings so that ranking tables are visible even before recomputation
  initGroupStandings();
  // Recalculate standings based on the completed matches
  state.schedule.forEach(match => {
    if (match.status === 'completed') {
      updateStandings(match);
    }
  });
  saveState();
  // Refresh UI: schedule, now playing list, and standings
  updateScheduleUI();
  updateNowPlaying();
  updateStandingsUI();
  // After auto filling results, check if group stage is complete
  checkGroupStageComplete();
}

// Update selected items each time we enter draw stage
function renderDrawStage() {
  updateSelectedNationCards();
  updateGroupSlotsUI();
  updateStartTournamentButtonState();
}

// Initial bootstrap
function init() {
  loadState();
  populateNumSlotsSelect();
  renderNationList();
  updateSelectedCounter();
  updateDrawButtonState();
  bindEvents();
  if (state.stage === 'draw') {
    // Rebuild group assignments from state
    renderDrawStage();
  }
  renderStage();
  if (state.stage === 'tournament') {
    // Always build the schedule and now playing lists from stored state
    updateScheduleUI();
    updateNowPlaying();
    // If no group standings exist yet, initialise them so that the rankings
    // table displays even before any games have been played. Without this
    // initialisation, the rankings section would remain blank on page load
    // until at least one match result is recorded. We then recompute
    // statistics for all completed matches to reflect current results.
    if (!state.groupStandings) {
      initGroupStandings();
    }
    // Recompute standings from scratch based on completed matches. This
    // ensures that standings reflect any results that were entered before
    // reloading the page. Note that updateStandings() will update the
    // groupStandings object in place.
    state.schedule.forEach(match => {
      if (match.status === 'completed') updateStandings(match);
    });
    // Finally, render the standings table UI
    updateStandingsUI();
  }
}

init();