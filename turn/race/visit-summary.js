// THIS VISIT (#1061): what one visit to a track has brought, from its start until
// LEAVE RACE. PAUSED shows it in one line; back in ROADBOOK a summary sheet shows it
// in full, with what to try next. A visit with no completed lap shows nothing.
//
// Kept in memory only: RESTART LAP, PAUSE and SETTINGS keep the visit going, and
// the summary only reports what the game has already saved and awarded.

import { TRACK_CATALOG } from '/turn/tracks/catalog.js?source=20260729-r118-m8';
import { getStoredBestLap } from '/turn/race/rival-storage.js?source=20260729-r118-m8';
import { formatRecordTime, trackGoals } from '/turn/roadbook/roadbook.js';
import { getAchievement } from '/turn/achievements/catalog.js';
import { getTrophyRoadReward } from '/turn/progression/trophy-road.js';

const INSTALL_KEY = '__turnVisitSummary';
// Trophy Road reward banners (a reward's reprise at ROADBOOK, or one that lands now)
// wait while the summary is up: it would cover them, their HOW TO PLAY and their way
// to the Trophy Road. They show once it closes.
const REWARD_HOLD = 'visit-summary';
const REWARD_RELEASE_DELAY_MS = 220;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

const seconds = (value) => `${value.toFixed(3)} s`;

function scoreBest(current, result) {
  if (!result?.available) return current;
  const score = Number(result.score) || 0;
  return {
    score: Math.max(current?.score || 0, score),
    newBest: Boolean(current?.newBest || result.newBest)
  };
}

export function installVisitSummary({ windowRef = window, documentRef = document } = {}) {
  if (windowRef[INSTALL_KEY]) return windowRef[INSTALL_KEY];

  let visit = null;
  let pending = null;
  let shown = null;

  function begin() {
    const trackId = windowRef.__turnGetTrackId?.() || windowRef.__turnRuntime?.state?.trackId || '';
    const best = Number(getStoredBestLap(trackId)?.time);
    visit = {
      trackId,
      laps: 0,
      bestTime: null,
      previousBest: Number.isFinite(best) && best > 0 ? best : null,
      drift: null,
      flow: null,
      achievements: [],
      rewards: []
    };
  }

  // The best lap of the visit, and how far it beat the record held before it.
  function improvement(summary) {
    if (!summary?.bestTime || !summary.previousBest) return 0;
    return Math.max(0, summary.previousBest - summary.bestTime);
  }

  function earnedCount(summary) {
    return summary.achievements.length;
  }

  function trophies(summary) {
    return summary.achievements.reduce((total, id) => total + (Number(getAchievement(id)?.trophies) || 0), 0);
  }

  // PAUSED: laps · best lap · new best · earned.
  function compactText(summary = visit) {
    if (!summary?.laps) return '';
    const parts = [`${summary.laps} ${summary.laps === 1 ? 'LAP' : 'LAPS'}`];
    if (summary.bestTime) parts.push(`BEST ${formatRecordTime(summary.bestTime)}`);
    const gain = improvement(summary);
    if (gain > 0) parts.push(`NEW BEST −${seconds(gain)}`);
    else if (summary.bestTime && !summary.previousBest) parts.push('NEW BEST');
    const earned = earnedCount(summary);
    if (earned) parts.push(`${earned} EARNED`);
    // Each part keeps together when the line wraps.
    return parts.map((part) => part.replaceAll(' ', '\u00a0')).join(' · ');
  }

  const dialog = documentRef.createElement('dialog');
  dialog.className = 'm8-dialog turn-dialog turn-dialog--compact turn-visit-summary-dialog';
  dialog.setAttribute('aria-labelledby', 'turnVisitSummaryTitle');
  dialog.setAttribute('aria-describedby', 'turnVisitSummarySpoken');
  dialog.innerHTML = `
    <article class="m8-dialog-card turn-dialog__surface">
      <header class="m8-dialog-head turn-dialog__header">
        <div><span>THIS VISIT</span><h2 id="turnVisitSummaryTitle" tabindex="-1">TRACK</h2></div>
      </header>
      <p class="turn-sr-only" id="turnVisitSummarySpoken"></p>
      <div class="turn-visit-summary-body"></div>
      <div class="turn-visit-summary-actions turn-dialog__actions">
        <button class="turn-visit-summary-close" type="button">CLOSE</button>
      </div>
    </article>`;
  documentRef.body.appendChild(dialog);
  const title = dialog.querySelector('#turnVisitSummaryTitle');
  const body = dialog.querySelector('.turn-visit-summary-body');
  const spokenLine = dialog.querySelector('#turnVisitSummarySpoken');
  let returnFocus = null;

  const holdRewards = () => windowRef.__turnAchievements?.holdRewardPresentation?.(REWARD_HOLD);
  const releaseRewards = () => windowRef.__turnAchievements?.releaseRewardPresentation?.(REWARD_HOLD, { delay: REWARD_RELEASE_DELAY_MS });

  function row(label, value, mark = '') {
    return `<div class="turn-visit-summary-row"><dt>${label}</dt><dd>${value}${mark ? ` <em class="turn-visit-summary-mark">${mark}</em>` : ''}</dd></div>`;
  }

  function sheetMarkup(summary) {
    const rows = [row('LAPS', String(summary.laps))];
    if (summary.bestTime) {
      const gain = improvement(summary);
      const mark = gain > 0 ? `NEW BEST −${seconds(gain)}` : !summary.previousBest ? 'NEW BEST' : '';
      rows.push(row('BEST LAP', formatRecordTime(summary.bestTime), mark));
    }
    if (summary.drift) rows.push(row('BEST DRIFT', summary.drift.score.toLocaleString('en-US'), summary.drift.newBest ? 'NEW BEST' : ''));
    if (summary.flow) rows.push(row('BEST FLOW', summary.flow.score.toLocaleString('en-US'), summary.flow.newBest ? 'NEW BEST' : ''));
    const earned = summary.achievements.map((id) => getAchievement(id)?.title).filter(Boolean);
    const total = trophies(summary);
    if (earned.length) {
      rows.push(row('EARNED', `<ul>${earned.map((name) => `<li>${escapeHtml(name)}</li>`).join('')}</ul>`));
    }
    if (total) rows.push(row('TROPHIES', `+${total}`));
    const unlocked = summary.rewards.map((id) => getTrophyRoadReward(id)?.shortTitle).filter(Boolean);
    if (unlocked.length) {
      rows.push(row('UNLOCKED', `<ul>${unlocked.map((name) => `<li>${escapeHtml(name)}</li>`).join('')}</ul>`));
    }
    const next = trackGoals(summary.trackId).find((goal) => goal.next);
    if (next) {
      const progress = next.progress?.text ? ` <span class="turn-visit-summary-progress">${escapeHtml(next.progress.text)}</span>` : '';
      rows.push(row('NEXT UP', `${escapeHtml(next.achievement.title)}${progress}`));
    }
    return `<dl class="turn-visit-summary-list">${rows.join('')}</dl>`;
  }

  function spoken(summary) {
    const parts = [`${summary.laps} ${summary.laps === 1 ? 'lap' : 'laps'}`];
    const gain = improvement(summary);
    if (gain > 0) parts.push(`new best lap, ${gain.toFixed(3)} seconds faster`);
    const earned = earnedCount(summary);
    if (earned) parts.push(`${earned} earned`);
    return `This visit: ${parts.join(', ')}.`;
  }

  function showSheet(summary) {
    const track = TRACK_CATALOG.find((entry) => entry.id === summary.trackId);
    title.textContent = track?.name || 'THIS VISIT';
    body.innerHTML = sheetMarkup(summary);
    spokenLine.textContent = spoken(summary);
    shown = summary;
    returnFocus = documentRef.activeElement;
    if (!dialog.open) dialog.showModal();
    title.focus();
  }

  dialog.addEventListener('close', () => {
    shown = null;
    releaseRewards();
    const target = returnFocus?.isConnected ? returnFocus : documentRef.querySelector('#m8HomeTitle');
    returnFocus = null;
    target?.focus?.();
  });
  dialog.querySelector('.turn-visit-summary-close').addEventListener('click', () => dialog.close());

  windowRef.addEventListener('turn:ui-state-change', (event) => {
    const reason = event.detail?.reason;
    if (reason === 'race-started' && !visit) begin();
    else if (reason === 'home-open' && visit) {
      pending = visit.laps > 0 ? visit : null;
      visit = null;
    }
  });

  windowRef.addEventListener('turn:home-shown', () => {
    if (!pending) return;
    const summary = pending;
    pending = null;
    // The sheet owns the summary from here, so awards that land while ROADBOOK paints
    // still count. It opens after ROADBOOK has painted and taken focus, unless a new
    // race has begun by then.
    shown = summary;
    holdRewards();
    windowRef.requestAnimationFrame(() => windowRef.requestAnimationFrame(() => {
      if (shown !== summary) return;
      if (visit) {
        shown = null;
        releaseRewards();
      } else showSheet(summary);
    }));
  });

  windowRef.addEventListener('turn:lap-result', (event) => {
    if (!visit) return;
    const detail = event.detail || {};
    visit.laps += 1;
    const time = Number(detail.time);
    // Only a saved lap counts: it is the one that can become the track record.
    if (detail.saved === true && Number.isFinite(time) && time > 0 && (!visit.bestTime || time < visit.bestTime)) {
      visit.bestTime = time;
    }
    visit.drift = scoreBest(visit.drift, detail.drift);
    visit.flow = scoreBest(visit.flow, detail.flow);
  });

  // Awards land just after the lap that earned them, some a moment later (idle-time
  // checks): keep collecting until the sheet closes, and show them as they arrive.
  const collector = () => visit || pending || shown;
  function collect(list, ids) {
    const summary = collector();
    if (!summary) return;
    for (const id of ids || []) {
      if (!summary[list].includes(id)) summary[list].push(id);
    }
    if (summary === shown) {
      body.innerHTML = sheetMarkup(shown);
      spokenLine.textContent = spoken(shown);
    }
  }
  windowRef.addEventListener('turn:achievements-updated', (event) => collect('achievements', event.detail?.unlocked));
  windowRef.addEventListener('turn:trophy-road-updated', (event) => collect('rewards', event.detail?.unlocked));

  const api = Object.freeze({
    dialog,
    compactText: () => compactText(),
    current: () => visit
  });
  windowRef[INSTALL_KEY] = api;
  return api;
}
