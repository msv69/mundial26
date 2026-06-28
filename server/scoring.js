// ============================================================
// SCORING — motore di calcolo punteggi
//
// 1. punteggioPartite  — risultati esatti + 1X2 fase gironi
// 2. punteggioKnockout — risultati esatti + 1X2 fase finale (al 90')
// 3. punteggioGironi   — pronostico classifica gironi
// 4. totaleDefinitivo  — tutto sommato
// ============================================================

const { db } = require("./db");
const { MATCHES, GROUPS, POINTS, KNOCKOUT_MATCHES, pointsForGroupPosition } = require("./data");

function normalizeName(s){
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function calcSign(home, away){
  if(home === null || home === undefined || away === null || away === undefined) return null;
  if(home > away) return "1";
  if(home < away) return "2";
  return "X";
}

function getRealMatches(){
  const rows = db.prepare("SELECT * FROM real_matches").all();
  const map = {};
  rows.forEach(r => map[r.match_id] = { home: r.home, away: r.away });
  return map;
}

function getRealGroupOrder(){
  const rows = db.prepare("SELECT * FROM real_group_order").all();
  const map = {};
  rows.forEach(r => {
    if(!map[r.group_letter]) map[r.group_letter] = [null, null, null, null];
    map[r.group_letter][r.pos] = r.team;
  });
  return map;
}

function getRealAwards(){
  return db.prepare("SELECT * FROM real_awards WHERE id = 1").get() || {};
}

function getRealKnockout(){
  const rows = db.prepare("SELECT * FROM real_knockout").all();
  const map = {};
  rows.forEach(r => map[r.match_id] = { home: r.home, away: r.away, qualifier: r.qualifier });
  return map;
}

function isGroupPhaseLocked(){
  const row = db.prepare("SELECT group_phase_locked FROM admin_settings WHERE id = 1").get();
  return row ? (row.group_phase_locked === 1 || row.group_phase_locked === true) : false;
}

// ------------------------------------------------------------
// Calcola i punti delle partite dei gironi (risultato esatto / 1X2)
// ------------------------------------------------------------
function calcPunteggioPartite(participantId, realMatches){
  let risultatoEsatto = 0;
  let segno1x2 = 0;

  const predRows = db.prepare(
    "SELECT match_id, home, away FROM predictions_matches WHERE participant_id = ?"
  ).all(participantId);
  const predMap = {};
  predRows.forEach(r => predMap[r.match_id] = { home: r.home, away: r.away });

  MATCHES.forEach(m => {
    const real = realMatches[m.id];
    const guess = predMap[m.id];
    if(!real || real.home === null || real.home === undefined ||
       real.away === null || real.away === undefined) return;
    if(!guess || guess.home === null || guess.home === undefined ||
       guess.away === null || guess.away === undefined) return;

    if(Number(guess.home) === Number(real.home) && Number(guess.away) === Number(real.away)){
      risultatoEsatto += POINTS.exactScore;
    } else {
      const realSign = calcSign(Number(real.home), Number(real.away));
      const guessSign = calcSign(Number(guess.home), Number(guess.away));
      if(realSign && guessSign && realSign === guessSign){
        segno1x2 += POINTS.result1x2;
      }
    }
  });

  return { risultatoEsatto, segno1x2, totale: risultatoEsatto + segno1x2 };
}

// ------------------------------------------------------------
// Calcola i punti della fase knockout (risultato esatto / 1X2 al 90')
// ------------------------------------------------------------
function calcPunteggioKnockout(participantId, realKnockout){
  let risultatoEsatto = 0;
  let segno1x2 = 0;

  const predRows = db.prepare(
    "SELECT match_id, home, away FROM predictions_knockout WHERE participant_id = ?"
  ).all(participantId);
  const predMap = {};
  predRows.forEach(r => predMap[r.match_id] = { home: r.home, away: r.away });

  Object.entries(realKnockout).forEach(([matchId, real]) => {
    const guess = predMap[matchId];
    if(!real || real.home === null || real.home === undefined ||
       real.away === null || real.away === undefined) return;
    if(!guess || guess.home === null || guess.home === undefined ||
       guess.away === null || guess.away === undefined) return;

    if(Number(guess.home) === Number(real.home) && Number(guess.away) === Number(real.away)){
      risultatoEsatto += POINTS.knockoutExactScore;
    } else {
      const realSign = calcSign(Number(real.home), Number(real.away));
      const guessSign = calcSign(Number(guess.home), Number(guess.away));
      if(realSign && guessSign && realSign === guessSign){
        segno1x2 += POINTS.knockoutResult1x2;
      }
    }
  });

  return { risultatoEsatto, segno1x2, totale: risultatoEsatto + segno1x2 };
}

// ------------------------------------------------------------
// Calcola i punti dei gironi (pronostico classifica)
// ------------------------------------------------------------
function pointsForCorrectPositions(correct){
  if(correct <= 9)  return 4;
  if(correct <= 19) return 6;
  if(correct <= 27) return 8;
  if(correct <= 34) return 10;
  if(correct <= 39) return 12;
  if(correct <= 46) return 15;
  return 20;
}

function calcPunteggioGironi(participantId, numParticipants, realGroupOrder){
  const predRows = db.prepare(
    "SELECT group_letter, pos, team FROM predictions_group_order WHERE participant_id = ?"
  ).all(participantId);
  const predMap = {};
  predRows.forEach(r => {
    if(!predMap[r.group_letter]) predMap[r.group_letter] = [null, null, null, null];
    predMap[r.group_letter][r.pos] = r.team;
  });

  let correct = 0;
  Object.keys(GROUPS).forEach(g => {
    const real = realGroupOrder[g];
    const guess = predMap[g];
    if(!real || !guess) return;
    for(let i = 0; i < 4; i++){
      if(real[i] && guess[i] && real[i] === guess[i]) correct++;
    }
  });

  return pointsForCorrectPositions(correct);
}

// ------------------------------------------------------------
// Calcola i punti dei premi finali
// ------------------------------------------------------------
function calcPunteggioPremi(participantId, realAwards){
  const pa = db.prepare(
    "SELECT * FROM predictions_awards WHERE participant_id = ?"
  ).get(participantId) || {};
  const ra = realAwards;
  let punti = 0;

  if(ra.winner && pa.winner && ra.winner === pa.winner)
    punti += POINTS.winner;
  if(ra.top_scorer && pa.top_scorer &&
     normalizeName(ra.top_scorer) === normalizeName(pa.top_scorer))
    punti += POINTS.topScorer;
  if(ra.most_goals_team && pa.most_goals_team){
    const realTeams = ra.most_goals_team.split(',').map(t => t.trim().toLowerCase());
    if(realTeams.includes(pa.most_goals_team.trim().toLowerCase()))
      punti += POINTS.mostGoalsTeamGroups;
  }
  if(ra.best_player && pa.best_player &&
     normalizeName(ra.best_player) === normalizeName(pa.best_player))
    punti += POINTS.bestPlayer;
  if(ra.best_goalkeeper && pa.best_goalkeeper &&
     normalizeName(ra.best_goalkeeper) === normalizeName(pa.best_goalkeeper))
    punti += POINTS.bestGoalkeeper;

  return punti;
}

// ------------------------------------------------------------
// Calcola la classifica completa
// ------------------------------------------------------------
function computeLeaderboard(){
  const participants = db.prepare("SELECT * FROM participants ORDER BY id").all();
  const numParticipants = participants.length;
  const realMatches = getRealMatches();
  const realGroupOrder = getRealGroupOrder();
  const realAwards = getRealAwards();
  const realKnockout = getRealKnockout();
  const groupsLocked = isGroupPhaseLocked();

  const board = participants.map(p => {
    const partite  = calcPunteggioPartite(p.id, realMatches);
    const knockout = calcPunteggioKnockout(p.id, realKnockout);
    const gironi   = calcPunteggioGironi(p.id, numParticipants, realGroupOrder);
    const premi    = calcPunteggioPremi(p.id, realAwards);

    const totaleProvvisorio = partite.totale;
    const totalePartite = partite.totale;
    const totaleKnockout = knockout.totale;

    const totaleDefinitivo = partite.totale
      + knockout.totale
      + (groupsLocked ? gironi : 0)
      + premi;

    return {
      id: p.id,
      name: p.name,
      team: p.team,
      avatar_url: p.avatar_url,
      totaleProvvisorio,
      totalePartite,
      totaleKnockout,
      punteggioGironi: gironi,
      gironiDefinitivi: groupsLocked,
      totaleDefinitivo,
      breakdown: {
        risultatoEsatto: partite.risultatoEsatto,
        segno1x2: partite.segno1x2,
        knockoutEsatto: knockout.risultatoEsatto,
        knockoutSign: knockout.segno1x2,
        gironi,
        premi
      }
    };
  });

  board.sort((a, b) =>
    b.totaleDefinitivo !== a.totaleDefinitivo
      ? b.totaleDefinitivo - a.totaleDefinitivo
      : b.totalePartite - a.totalePartite
  );

  return { board, groupsLocked };
}

module.exports = {
  computeLeaderboard,
  getRealMatches,
  getRealGroupOrder,
  getRealAwards,
  isGroupPhaseLocked,
  normalizeName
};

function normalizeName(s){
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function calcSign(home, away){
  if(home === null || home === undefined || away === null || away === undefined) return null;
  if(home > away) return "1";
  if(home < away) return "2";
  return "X";
}

function getRealMatches(){
  const rows = db.prepare("SELECT * FROM real_matches").all();
  const map = {};
  rows.forEach(r => map[r.match_id] = { home: r.home, away: r.away });
  return map;
}

function getRealGroupOrder(){
  const rows = db.prepare("SELECT * FROM real_group_order").all();
  const map = {};
  rows.forEach(r => {
    if(!map[r.group_letter]) map[r.group_letter] = [null, null, null, null];
    map[r.group_letter][r.pos] = r.team;
  });
  return map;
}

function getRealAwards(){
  return db.prepare("SELECT * FROM real_awards WHERE id = 1").get() || {};
}

function isGroupPhaseLocked(){
  const row = db.prepare("SELECT group_phase_locked FROM admin_settings WHERE id = 1").get();
  return row ? (row.group_phase_locked === 1 || row.group_phase_locked === true) : false;
}

// ------------------------------------------------------------
// Calcola i punti delle partite (risultato esatto / 1X2)
// Solo partite dei gironi (MATCHES) per ora
// ------------------------------------------------------------
function calcPunteggioPartite(participantId, realMatches){
  let risultatoEsatto = 0;
  let segno1x2 = 0;

  const predRows = db.prepare(
    "SELECT match_id, home, away FROM predictions_matches WHERE participant_id = ?"
  ).all(participantId);
  const predMap = {};
  predRows.forEach(r => predMap[r.match_id] = { home: r.home, away: r.away });

  MATCHES.forEach(m => {
    const real = realMatches[m.id];
    const guess = predMap[m.id];
    if(!real || real.home === null || real.home === undefined ||
       real.away === null || real.away === undefined) return;
    if(!guess || guess.home === null || guess.home === undefined ||
       guess.away === null || guess.away === undefined) return;

    if(Number(guess.home) === Number(real.home) && Number(guess.away) === Number(real.away)){
      risultatoEsatto += POINTS.exactScore;
    } else {
      const realSign = calcSign(Number(real.home), Number(real.away));
      const guessSign = calcSign(Number(guess.home), Number(guess.away));
      if(realSign && guessSign && realSign === guessSign){
        segno1x2 += POINTS.result1x2;
      }
    }
  });

  return { risultatoEsatto, segno1x2, totale: risultatoEsatto + segno1x2 };
}

// ------------------------------------------------------------
// Calcola i punti dei gironi (pronostico classifica)
// Restituisce anche il flag "definitivo" (se i gironi sono chiusi)
// ------------------------------------------------------------
function pointsForCorrectPositions(correct){
  // Punteggio fisso totale in base al numero di posizioni corrette indovinate
  if(correct <= 9)  return 4;
  if(correct <= 19) return 6;
  if(correct <= 27) return 8;
  if(correct <= 34) return 10;
  if(correct <= 39) return 12;
  if(correct <= 46) return 15;
  return 20; // 47-48
}

function calcPunteggioGironi(participantId, numParticipants, realGroupOrder){
  const predRows = db.prepare(
    "SELECT group_letter, pos, team FROM predictions_group_order WHERE participant_id = ?"
  ).all(participantId);
  const predMap = {};
  predRows.forEach(r => {
    if(!predMap[r.group_letter]) predMap[r.group_letter] = [null, null, null, null];
    predMap[r.group_letter][r.pos] = r.team;
  });

  // Conta prima il numero totale di posizioni corrette
  let correct = 0;
  Object.keys(GROUPS).forEach(g => {
    const real = realGroupOrder[g];
    const guess = predMap[g];
    if(!real || !guess) return;
    for(let i = 0; i < 4; i++){
      if(real[i] && guess[i] && real[i] === guess[i]) correct++;
    }
  });

  // Il punteggio totale è fisso in base alla fascia
  return pointsForCorrectPositions(correct);
}

// ------------------------------------------------------------
// Calcola i punti dei premi finali
// ------------------------------------------------------------
function calcPunteggioPremi(participantId, realAwards){
  const pa = db.prepare(
    "SELECT * FROM predictions_awards WHERE participant_id = ?"
  ).get(participantId) || {};
  const ra = realAwards;
  let punti = 0;

  if(ra.winner && pa.winner && ra.winner === pa.winner)
    punti += POINTS.winner;
  if(ra.top_scorer && pa.top_scorer &&
     normalizeName(ra.top_scorer) === normalizeName(pa.top_scorer))
    punti += POINTS.topScorer;
  if(ra.most_goals_team && pa.most_goals_team){
    // Supporta più squadre a pari merito separate da virgola (es. "Germania,Francia")
    const realTeams = ra.most_goals_team.split(',').map(t => t.trim().toLowerCase());
    if(realTeams.includes(pa.most_goals_team.trim().toLowerCase()))
      punti += POINTS.mostGoalsTeamGroups;
  }
  if(ra.best_player && pa.best_player &&
     normalizeName(ra.best_player) === normalizeName(pa.best_player))
    punti += POINTS.bestPlayer;
  if(ra.best_goalkeeper && pa.best_goalkeeper &&
     normalizeName(ra.best_goalkeeper) === normalizeName(pa.best_goalkeeper))
    punti += POINTS.bestGoalkeeper;

  return punti;
}

// ------------------------------------------------------------
// Calcola la classifica completa con le tre colonne
// ------------------------------------------------------------
function computeLeaderboard(){
  const participants = db.prepare("SELECT * FROM participants ORDER BY id").all();
  const numParticipants = participants.length;
  const realMatches = getRealMatches();
  const realGroupOrder = getRealGroupOrder();
  const realAwards = getRealAwards();
  const groupsLocked = isGroupPhaseLocked();

  const board = participants.map(p => {
    const partite = calcPunteggioPartite(p.id, realMatches);
    const gironi  = calcPunteggioGironi(p.id, numParticipants, realGroupOrder);
    const premi   = calcPunteggioPremi(p.id, realAwards);

    // Totale provvisorio = solo partite (aggiornato in tempo reale)
    const totaleProvvisorio = partite.totale;

    // Totale definitivo = partite + gironi (solo se chiusi) + premi
    const totaleDefinitivo = partite.totale
      + (groupsLocked ? gironi : 0)
      + premi;

    return {
      id: p.id,
      name: p.name,
      team: p.team,
      // Colonne visibili in classifica
      totaleProvvisorio,        // esatti + 1X2 (aggiornato in tempo reale)
      totalePartite: partite.totale, // alias esplicito = esatti + 1X2
      punteggioGironi: gironi,
      gironiDefinitivi: groupsLocked,
      totaleDefinitivo,
      // Breakdown dettagliato
      breakdown: {
        risultatoEsatto: partite.risultatoEsatto,
        segno1x2: partite.segno1x2,
        gironi,
        premi
      }
    };
  });

  // Ordina per totaleDefinitivo, poi per totaleProvvisorio come spareggio
  board.sort((a, b) =>
    b.totaleDefinitivo !== a.totaleDefinitivo
      ? b.totaleDefinitivo - a.totaleDefinitivo
      : b.totaleProvvisorio - a.totaleProvvisorio
  );

  return { board, groupsLocked };
}

module.exports = {
  computeLeaderboard,
  getRealMatches,
  getRealGroupOrder,
  getRealAwards,
  isGroupPhaseLocked,
  normalizeName
};
