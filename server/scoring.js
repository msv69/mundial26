// ============================================================
// SCORING — motore di calcolo punteggi, lato server (fonte di verità unica)
// ============================================================
const { db } = require("./db");
const { MATCHES, GROUPS, POINTS, pointsForGroupPosition } = require("./data");

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

function computeScoreForParticipant(participantId, numParticipants, realMatches, realGroupOrder, realAwards){
  const breakdown = {
    risultatoEsatto: 0, segno1x2: 0, posizioniGironi: 0,
    vincitoreMondiale: 0, capocannoniere: 0, squadraPiuReti: 0,
    migliorGiocatore: 0, miglierPortiere: 0
  };

  const predMatches = db.prepare("SELECT * FROM predictions_matches WHERE participant_id = ?").all(participantId);
  const predMatchMap = {};
  predMatches.forEach(r => predMatchMap[r.match_id] = { home: r.home, away: r.away });

  MATCHES.forEach(m => {
    const real = realMatches[m.id];
    const guess = predMatchMap[m.id];
    if(!real || real.home === null || real.home === undefined || real.away === null || real.away === undefined) return;
    if(!guess || guess.home === null || guess.home === undefined || guess.away === null || guess.away === undefined) return;

    if(guess.home === real.home && guess.away === real.away){
      breakdown.risultatoEsatto += POINTS.exactScore;
    } else {
      const realSign = calcSign(real.home, real.away);
      const guessSign = calcSign(guess.home, guess.away);
      if(realSign && guessSign && realSign === guessSign){
        breakdown.segno1x2 += POINTS.result1x2;
      }
    }
  });

  const perPos = pointsForGroupPosition(numParticipants);
  const predGroupRows = db.prepare("SELECT * FROM predictions_group_order WHERE participant_id = ?").all(participantId);
  const predGroupMap = {};
  predGroupRows.forEach(r => {
    if(!predGroupMap[r.group_letter]) predGroupMap[r.group_letter] = [null, null, null, null];
    predGroupMap[r.group_letter][r.pos] = r.team;
  });
  Object.keys(GROUPS).forEach(g => {
    const real = realGroupOrder[g];
    const guess = predGroupMap[g];
    if(!real || !guess) return;
    for(let i=0;i<4;i++){
      if(real[i] && guess[i] && real[i] === guess[i]) breakdown.posizioniGironi += perPos;
    }
  });

  const pa = db.prepare("SELECT * FROM predictions_awards WHERE participant_id = ?").get(participantId) || {};
  const ra = realAwards;
  if(ra.winner && pa.winner && ra.winner === pa.winner) breakdown.vincitoreMondiale += POINTS.winner;
  if(ra.top_scorer && pa.top_scorer && normalizeName(ra.top_scorer) === normalizeName(pa.top_scorer)) breakdown.capocannoniere += POINTS.topScorer;
  if(ra.most_goals_team && pa.most_goals_team && ra.most_goals_team === pa.most_goals_team) breakdown.squadraPiuReti += POINTS.mostGoalsTeamGroups;
  if(ra.best_player && pa.best_player && normalizeName(ra.best_player) === normalizeName(pa.best_player)) breakdown.migliorGiocatore += POINTS.bestPlayer;
  if(ra.best_goalkeeper && pa.best_goalkeeper && normalizeName(ra.best_goalkeeper) === normalizeName(pa.best_goalkeeper)) breakdown.miglierPortiere += POINTS.bestGoalkeeper;

  const total = Object.values(breakdown).reduce((a,b)=>a+b, 0);
  return { total, breakdown };
}

function computeLeaderboard(){
  const participants = db.prepare("SELECT * FROM participants ORDER BY id").all();
  const numParticipants = participants.length;
  const realMatches = getRealMatches();
  const realGroupOrder = getRealGroupOrder();
  const realAwards = getRealAwards();

  const board = participants.map(p => {
    const { total, breakdown } = computeScoreForParticipant(p.id, numParticipants, realMatches, realGroupOrder, realAwards);
    return { id: p.id, name: p.name, team: p.team, total, breakdown };
  });
  board.sort((a,b) => b.total - a.total);
  return board;
}

module.exports = { computeLeaderboard, computeScoreForParticipant, getRealMatches, getRealGroupOrder, getRealAwards, normalizeName };
