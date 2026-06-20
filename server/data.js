// ============================================================
// DATI MONDIALE 2026 — condiviso da server e frontend
// 48 squadre, 12 gironi (fase a gironi) + fase a eliminazione diretta
// Tutti gli orari sono ora italiana (CEST, UTC+2) in formato ISO 8601
// ============================================================

const GROUPS = {
  A: ["Messico", "Sudafrica", "Corea del Sud", "Cechia"],
  B: ["Canada", "Bosnia ed Erzegovina", "Qatar", "Svizzera"],
  C: ["Brasile", "Marocco", "Haiti", "Scozia"],
  D: ["Stati Uniti", "Paraguay", "Australia", "Turchia"],
  E: ["Germania", "Curaçao", "Costa d'Avorio", "Ecuador"],
  F: ["Paesi Bassi", "Giappone", "Svezia", "Tunisia"],
  G: ["Belgio", "Egitto", "Iran", "Nuova Zelanda"],
  H: ["Spagna", "Capo Verde", "Arabia Saudita", "Uruguay"],
  I: ["Francia", "Senegal", "Iraq", "Norvegia"],
  J: ["Argentina", "Algeria", "Austria", "Giordania"],
  K: ["Portogallo", "RD Congo", "Uzbekistan", "Colombia"],
  L: ["Inghilterra", "Croazia", "Ghana", "Panama"]
};

const ALL_TEAMS = Object.values(GROUPS).flat();

// kickoff: timestamp ISO (ora italiana CEST, UTC+2) del calcio d'inizio
const MATCHES = [
  {id:"A1", group:"A", date:"Gio 11 Giu", kickoff:"2026-06-11T21:00:00+02:00", home:"Messico", away:"Sudafrica"},
  {id:"A2", group:"A", date:"Ven 12 Giu", kickoff:"2026-06-12T04:00:00+02:00", home:"Corea del Sud", away:"Cechia"},
  {id:"A3", group:"A", date:"Gio 18 Giu", kickoff:"2026-06-18T18:00:00+02:00", home:"Cechia", away:"Sudafrica"},
  {id:"A4", group:"A", date:"Ven 19 Giu", kickoff:"2026-06-19T03:00:00+02:00", home:"Messico", away:"Corea del Sud"},
  {id:"A5", group:"A", date:"Gio 25 Giu", kickoff:"2026-06-25T03:00:00+02:00", home:"Cechia", away:"Messico"},
  {id:"A6", group:"A", date:"Gio 25 Giu", kickoff:"2026-06-25T03:00:00+02:00", home:"Sudafrica", away:"Corea del Sud"},
  {id:"B1", group:"B", date:"Ven 12 Giu", kickoff:"2026-06-12T12:00:00+02:00", home:"Canada", away:"Bosnia ed Erzegovina"},
  {id:"B2", group:"B", date:"Sab 13 Giu", kickoff:"2026-06-13T21:00:00+02:00", home:"Qatar", away:"Svizzera"},
  {id:"B3", group:"B", date:"Gio 18 Giu", kickoff:"2026-06-18T21:00:00+02:00", home:"Svizzera", away:"Bosnia ed Erzegovina"},
  {id:"B4", group:"B", date:"Ven 19 Giu", kickoff:"2026-06-20T00:00:00+02:00", home:"Canada", away:"Qatar"},
  {id:"B5", group:"B", date:"Mer 24 Giu", kickoff:"2026-06-24T21:00:00+02:00", home:"Svizzera", away:"Canada"},
  {id:"B6", group:"B", date:"Mer 24 Giu", kickoff:"2026-06-24T21:00:00+02:00", home:"Bosnia ed Erzegovina", away:"Qatar"},
  {id:"C1", group:"C", date:"Sab 13 Giu", kickoff:"2026-06-14T00:00:00+02:00", home:"Brasile", away:"Marocco"},
  {id:"C2", group:"C", date:"Dom 14 Giu", kickoff:"2026-06-14T03:00:00+02:00", home:"Haiti", away:"Scozia"},
  {id:"C3", group:"C", date:"Sab 20 Giu", kickoff:"2026-06-20T00:00:00+02:00", home:"Scozia", away:"Marocco"},
  {id:"C4", group:"C", date:"Sab 20 Giu", kickoff:"2026-06-20T02:30:00+02:00", home:"Brasile", away:"Haiti"},
  {id:"C5", group:"C", date:"Gio 25 Giu", kickoff:"2026-06-25T00:00:00+02:00", home:"Marocco", away:"Haiti"},
  {id:"C6", group:"C", date:"Gio 25 Giu", kickoff:"2026-06-25T00:00:00+02:00", home:"Brasile", away:"Scozia"},
  {id:"D1", group:"D", date:"Ven 12 Giu", kickoff:"2026-06-13T03:00:00+02:00", home:"Stati Uniti", away:"Paraguay"},
  {id:"D2", group:"D", date:"Sab 13 Giu", kickoff:"2026-06-13T06:00:00+02:00", home:"Australia", away:"Turchia"},
  {id:"D3", group:"D", date:"Ven 19 Giu", kickoff:"2026-06-19T21:00:00+02:00", home:"Stati Uniti", away:"Australia"},
  {id:"D4", group:"D", date:"Ven 19 Giu", kickoff:"2026-06-19T06:00:00+02:00", home:"Turchia", away:"Paraguay"},
  {id:"D5", group:"D", date:"Ven 26 Giu", kickoff:"2026-06-26T04:00:00+02:00", home:"Turchia", away:"Stati Uniti"},
  {id:"D6", group:"D", date:"Ven 26 Giu", kickoff:"2026-06-26T04:00:00+02:00", home:"Paraguay", away:"Australia"},
  {id:"E1", group:"E", date:"Dom 14 Giu", kickoff:"2026-06-14T19:00:00+02:00", home:"Germania", away:"Curaçao"},
  {id:"E2", group:"E", date:"Dom 14 Giu", kickoff:"2026-06-14T22:00:00+02:00", home:"Costa d'Avorio", away:"Ecuador"},
  {id:"E3", group:"E", date:"Sab 20 Giu", kickoff:"2026-06-20T22:00:00+02:00", home:"Germania", away:"Costa d'Avorio"},
  {id:"E4", group:"E", date:"Dom 21 Giu", kickoff:"2026-06-21T02:00:00+02:00", home:"Ecuador", away:"Curaçao"},
  {id:"E5", group:"E", date:"Gio 25 Giu", kickoff:"2026-06-25T22:00:00+02:00", home:"Ecuador", away:"Germania"},
  {id:"E6", group:"E", date:"Gio 25 Giu", kickoff:"2026-06-25T22:00:00+02:00", home:"Curaçao", away:"Costa d'Avorio"},
  {id:"F1", group:"F", date:"Dom 14 Giu", kickoff:"2026-06-14T22:00:00+02:00", home:"Paesi Bassi", away:"Giappone"},
  {id:"F2", group:"F", date:"Gio 18 Giu", kickoff:"2026-06-18T05:00:00+02:00", home:"Svezia", away:"Tunisia"},
  {id:"F3", group:"F", date:"Sab 20 Giu", kickoff:"2026-06-20T19:00:00+02:00", home:"Paesi Bassi", away:"Svezia"},
  {id:"F4", group:"F", date:"Sab 20 Giu", kickoff:"2026-06-20T06:00:00+02:00", home:"Tunisia", away:"Giappone"},
  {id:"F5", group:"F", date:"Ven 26 Giu", kickoff:"2026-06-26T01:00:00+02:00", home:"Giappone", away:"Svezia"},
  {id:"F6", group:"F", date:"Ven 26 Giu", kickoff:"2026-06-26T01:00:00+02:00", home:"Tunisia", away:"Paesi Bassi"},
  {id:"G1", group:"G", date:"Lun 15 Giu", kickoff:"2026-06-14T22:30:00+02:00", home:"Belgio", away:"Egitto"},
  {id:"G2", group:"G", date:"Lun 15 Giu", kickoff:"2026-06-15T03:00:00+02:00", home:"Iran", away:"Nuova Zelanda"},
  {id:"G3", group:"G", date:"Dom 21 Giu", kickoff:"2026-06-21T21:00:00+02:00", home:"Belgio", away:"Iran"},
  {id:"G4", group:"G", date:"Lun 22 Giu", kickoff:"2026-06-22T03:00:00+02:00", home:"Nuova Zelanda", away:"Egitto"},
  {id:"G5", group:"G", date:"Sab 27 Giu", kickoff:"2026-06-27T05:00:00+02:00", home:"Egitto", away:"Iran"},
  {id:"G6", group:"G", date:"Sab 27 Giu", kickoff:"2026-06-27T05:00:00+02:00", home:"Nuova Zelanda", away:"Belgio"},
  {id:"H1", group:"H", date:"Lun 15 Giu", kickoff:"2026-06-15T18:00:00+02:00", home:"Spagna", away:"Capo Verde"},
  {id:"H2", group:"H", date:"Lun 15 Giu", kickoff:"2026-06-16T00:00:00+02:00", home:"Arabia Saudita", away:"Uruguay"},
  {id:"H3", group:"H", date:"Dom 21 Giu", kickoff:"2026-06-21T18:00:00+02:00", home:"Spagna", away:"Arabia Saudita"},
  {id:"H4", group:"H", date:"Lun 22 Giu", kickoff:"2026-06-22T00:00:00+02:00", home:"Uruguay", away:"Capo Verde"},
  {id:"H5", group:"H", date:"Sab 27 Giu", kickoff:"2026-06-27T02:00:00+02:00", home:"Capo Verde", away:"Arabia Saudita"},
  {id:"H6", group:"H", date:"Sab 27 Giu", kickoff:"2026-06-27T02:00:00+02:00", home:"Uruguay", away:"Spagna"},
  {id:"I1", group:"I", date:"Mar 16 Giu", kickoff:"2026-06-16T21:00:00+02:00", home:"Francia", away:"Senegal"},
  {id:"I2", group:"I", date:"Mer 17 Giu", kickoff:"2026-06-17T00:00:00+02:00", home:"Iraq", away:"Norvegia"},
  {id:"I3", group:"I", date:"Lun 22 Giu", kickoff:"2026-06-22T23:00:00+02:00", home:"Francia", away:"Iraq"},
  {id:"I4", group:"I", date:"Mar 23 Giu", kickoff:"2026-06-23T02:00:00+02:00", home:"Norvegia", away:"Senegal"},
  {id:"I5", group:"I", date:"Ven 26 Giu", kickoff:"2026-06-26T19:00:00+02:00", home:"Norvegia", away:"Francia"},
  {id:"I6", group:"I", date:"Ven 26 Giu", kickoff:"2026-06-26T19:00:00+02:00", home:"Senegal", away:"Iraq"},
  {id:"J1", group:"J", date:"Mer 17 Giu", kickoff:"2026-06-17T03:00:00+02:00", home:"Argentina", away:"Algeria"},
  {id:"J2", group:"J", date:"Mer 17 Giu", kickoff:"2026-06-17T06:00:00+02:00", home:"Austria", away:"Giordania"},
  {id:"J3", group:"J", date:"Lun 22 Giu", kickoff:"2026-06-22T19:00:00+02:00", home:"Argentina", away:"Austria"},
  {id:"J4", group:"J", date:"Mar 23 Giu", kickoff:"2026-06-23T05:00:00+02:00", home:"Giordania", away:"Algeria"},
  {id:"J5", group:"J", date:"Dom 28 Giu", kickoff:"2026-06-28T04:00:00+02:00", home:"Algeria", away:"Austria"},
  {id:"J6", group:"J", date:"Dom 28 Giu", kickoff:"2026-06-28T04:00:00+02:00", home:"Giordania", away:"Argentina"},
  {id:"K1", group:"K", date:"Mer 17 Giu", kickoff:"2026-06-17T19:00:00+02:00", home:"Portogallo", away:"RD Congo"},
  {id:"K2", group:"K", date:"Gio 18 Giu", kickoff:"2026-06-18T04:00:00+02:00", home:"Uzbekistan", away:"Colombia"},
  {id:"K3", group:"K", date:"Mar 23 Giu", kickoff:"2026-06-23T19:00:00+02:00", home:"Portogallo", away:"Uzbekistan"},
  {id:"K4", group:"K", date:"Mer 24 Giu", kickoff:"2026-06-24T04:00:00+02:00", home:"Colombia", away:"RD Congo"},
  {id:"K5", group:"K", date:"Dom 28 Giu", kickoff:"2026-06-28T01:30:00+02:00", home:"Portogallo", away:"Colombia"},
  {id:"K6", group:"K", date:"Dom 28 Giu", kickoff:"2026-06-28T01:30:00+02:00", home:"Uzbekistan", away:"RD Congo"},
  {id:"L1", group:"L", date:"Mer 17 Giu", kickoff:"2026-06-17T22:00:00+02:00", home:"Inghilterra", away:"Croazia"},
  {id:"L2", group:"L", date:"Gio 18 Giu", kickoff:"2026-06-18T01:00:00+02:00", home:"Ghana", away:"Panama"},
  {id:"L3", group:"L", date:"Mar 23 Giu", kickoff:"2026-06-23T22:00:00+02:00", home:"Inghilterra", away:"Ghana"},
  {id:"L4", group:"L", date:"Mer 24 Giu", kickoff:"2026-06-24T01:00:00+02:00", home:"Croazia", away:"Panama"},
  {id:"L5", group:"L", date:"Sab 27 Giu", kickoff:"2026-06-27T23:00:00+02:00", home:"Inghilterra", away:"Panama"},
  {id:"L6", group:"L", date:"Sab 27 Giu", kickoff:"2026-06-27T23:00:00+02:00", home:"Croazia", away:"Ghana"}
];

// ============================================================
// FASE A ELIMINAZIONE DIRETTA
// Gli "slot" iniziano vuoti (homeSlot/awaySlot descrittivi, es. "1ª Girone A").
// L'admin assegna la squadra reale (homeTeam/awayTeam) quando è nota, e
// può correggere il kickoff se cambia. I concorrenti pronosticano solo
// sugli incontri il cui homeTeam/awayTeam sono già stati assegnati.
// ============================================================

const KNOCKOUT_PHASES = [
  { id: "sedicesimi", label: "Sedicesimi di finale", order: 1, firstKickoff: "2026-06-28T21:00:00+02:00" },
  { id: "ottavi", label: "Ottavi di finale", order: 2, firstKickoff: "2026-07-04T19:00:00+02:00" },
  { id: "quarti", label: "Quarti di finale", order: 3, firstKickoff: "2026-07-09T22:00:00+02:00" },
  { id: "semifinali", label: "Semifinali", order: 4, firstKickoff: "2026-07-14T21:00:00+02:00" },
  { id: "finale3", label: "Finale 3°/4° posto", order: 5, firstKickoff: "2026-07-18T23:00:00+02:00" },
  { id: "finale", label: "Finale", order: 6, firstKickoff: "2026-07-19T21:00:00+02:00" }
];

// 16 incontri dei sedicesimi (slot secondo la mappatura ufficiale FIFA:
// 24 squadre dirette = 1°/2° di ogni girone + 8 migliori terze classificate).
// Gli accoppiamenti esatti con le "terze" si conoscono solo a fine gironi:
// l'admin li conferma dal pannello quando la classifica reale è definita.
const KNOCKOUT_MATCHES = [
  // --- SEDICESIMI (16 partite) ---
  {id:"R32-1", phase:"sedicesimi", order:1, kickoff:"2026-06-28T21:00:00+02:00", homeSlot:"2ª Girone A", awaySlot:"2ª Girone B", homeTeam:null, awayTeam:null},
  {id:"R32-2", phase:"sedicesimi", order:2, kickoff:"2026-06-29T01:00:00+02:00", homeSlot:"1ª Girone E", awaySlot:"3ª Girone A/B/C/D/F", homeTeam:null, awayTeam:null},
  {id:"R32-3", phase:"sedicesimi", order:3, kickoff:"2026-06-29T19:00:00+02:00", homeSlot:"1ª Girone C", awaySlot:"2ª Girone F", homeTeam:null, awayTeam:null},
  {id:"R32-4", phase:"sedicesimi", order:4, kickoff:"2026-06-30T03:00:00+02:00", homeSlot:"1ª Girone F", awaySlot:"2ª Girone C", homeTeam:null, awayTeam:null},
  {id:"R32-5", phase:"sedicesimi", order:5, kickoff:"2026-06-30T19:00:00+02:00", homeSlot:"2ª Girone E", awaySlot:"2ª Girone I", homeTeam:null, awayTeam:null},
  {id:"R32-6", phase:"sedicesimi", order:6, kickoff:"2026-06-30T23:00:00+02:00", homeSlot:"1ª Girone I", awaySlot:"3ª Girone C/D/F/G/H", homeTeam:null, awayTeam:null},
  {id:"R32-7", phase:"sedicesimi", order:7, kickoff:"2026-07-01T03:00:00+02:00", homeSlot:"1ª Girone A", awaySlot:"3ª Girone C/E/F/H/I", homeTeam:null, awayTeam:null},
  {id:"R32-8", phase:"sedicesimi", order:8, kickoff:"2026-07-01T18:00:00+02:00", homeSlot:"1ª Girone L", awaySlot:"3ª Girone E/H/I/J/K", homeTeam:null, awayTeam:null},
  {id:"R32-9", phase:"sedicesimi", order:9, kickoff:"2026-07-01T22:00:00+02:00", homeSlot:"1ª Girone G", awaySlot:"3ª Girone A/E/H/I/J", homeTeam:null, awayTeam:null},
  {id:"R32-10", phase:"sedicesimi", order:10, kickoff:"2026-07-02T02:00:00+02:00", homeSlot:"1ª Girone D", awaySlot:"3ª Girone B/E/F/I/J", homeTeam:null, awayTeam:null},
  {id:"R32-11", phase:"sedicesimi", order:11, kickoff:"2026-07-02T21:00:00+02:00", homeSlot:"1ª Girone H", awaySlot:"2ª Girone J", homeTeam:null, awayTeam:null},
  {id:"R32-12", phase:"sedicesimi", order:12, kickoff:"2026-07-03T01:00:00+02:00", homeSlot:"2ª Girone K", awaySlot:"2ª Girone L", homeTeam:null, awayTeam:null},
  {id:"R32-13", phase:"sedicesimi", order:13, kickoff:"2026-07-03T05:00:00+02:00", homeSlot:"1ª Girone B", awaySlot:"3ª Girone E/F/G/I/J", homeTeam:null, awayTeam:null},
  {id:"R32-14", phase:"sedicesimi", order:14, kickoff:"2026-07-03T20:00:00+02:00", homeSlot:"2ª Girone D", awaySlot:"2ª Girone G", homeTeam:null, awayTeam:null},
  {id:"R32-15", phase:"sedicesimi", order:15, kickoff:"2026-07-04T00:00:00+02:00", homeSlot:"1ª Girone J", awaySlot:"2ª Girone H", homeTeam:null, awayTeam:null},
  {id:"R32-16", phase:"sedicesimi", order:16, kickoff:"2026-07-04T03:30:00+02:00", homeSlot:"1ª Girone K", awaySlot:"3ª Girone D/E/I/J/L", homeTeam:null, awayTeam:null},

  // --- OTTAVI (8 partite) ---
  {id:"R16-1", phase:"ottavi", order:1, kickoff:"2026-07-04T19:00:00+02:00", homeSlot:"Vincente R32-3", awaySlot:"Vincente R32-1", homeTeam:null, awayTeam:null},
  {id:"R16-2", phase:"ottavi", order:2, kickoff:"2026-07-04T23:00:00+02:00", homeSlot:"Vincente R32-15", awaySlot:"Vincente R32-11", homeTeam:null, awayTeam:null},
  {id:"R16-3", phase:"ottavi", order:3, kickoff:"2026-07-05T22:00:00+02:00", homeSlot:"Vincente R32-9", awaySlot:"Vincente R32-2", homeTeam:null, awayTeam:null},
  {id:"R16-4", phase:"ottavi", order:4, kickoff:"2026-07-06T02:00:00+02:00", homeSlot:"Vincente R32-6", awaySlot:"Vincente R32-4", homeTeam:null, awayTeam:null},
  {id:"R16-5", phase:"ottavi", order:5, kickoff:"2026-07-06T21:00:00+02:00", homeSlot:"Vincente R32-8", awaySlot:"Vincente R32-5", homeTeam:null, awayTeam:null},
  {id:"R16-6", phase:"ottavi", order:6, kickoff:"2026-07-07T02:00:00+02:00", homeSlot:"Vincente R32-16", awaySlot:"Vincente R32-12", homeTeam:null, awayTeam:null},
  {id:"R16-7", phase:"ottavi", order:7, kickoff:"2026-07-07T18:00:00+02:00", homeSlot:"Vincente R32-7", awaySlot:"Vincente R32-10", homeTeam:null, awayTeam:null},
  {id:"R16-8", phase:"ottavi", order:8, kickoff:"2026-07-07T22:00:00+02:00", homeSlot:"Vincente R32-13", awaySlot:"Vincente R32-14", homeTeam:null, awayTeam:null},

  // --- QUARTI (4 partite) ---
  {id:"QF-1", phase:"quarti", order:1, kickoff:"2026-07-09T22:00:00+02:00", homeSlot:"Vincente R16-1", awaySlot:"Vincente R16-2", homeTeam:null, awayTeam:null},
  {id:"QF-2", phase:"quarti", order:2, kickoff:"2026-07-10T21:00:00+02:00", homeSlot:"Vincente R16-5", awaySlot:"Vincente R16-6", homeTeam:null, awayTeam:null},
  {id:"QF-3", phase:"quarti", order:3, kickoff:"2026-07-11T23:00:00+02:00", homeSlot:"Vincente R16-3", awaySlot:"Vincente R16-4", homeTeam:null, awayTeam:null},
  {id:"QF-4", phase:"quarti", order:4, kickoff:"2026-07-12T03:00:00+02:00", homeSlot:"Vincente R16-7", awaySlot:"Vincente R16-8", homeTeam:null, awayTeam:null},

  // --- SEMIFINALI (2 partite) ---
  {id:"SF-1", phase:"semifinali", order:1, kickoff:"2026-07-14T21:00:00+02:00", homeSlot:"Vincente QF-1", awaySlot:"Vincente QF-2", homeTeam:null, awayTeam:null},
  {id:"SF-2", phase:"semifinali", order:2, kickoff:"2026-07-15T21:00:00+02:00", homeSlot:"Vincente QF-3", awaySlot:"Vincente QF-4", homeTeam:null, awayTeam:null},

  // --- FINALE 3°/4° POSTO ---
  {id:"F3-1", phase:"finale3", order:1, kickoff:"2026-07-18T23:00:00+02:00", homeSlot:"Perdente SF-1", awaySlot:"Perdente SF-2", homeTeam:null, awayTeam:null},

  // --- FINALE ---
  {id:"FINAL-1", phase:"finale", order:1, kickoff:"2026-07-19T21:00:00+02:00", homeSlot:"Vincente SF-1", awaySlot:"Vincente SF-2", homeTeam:null, awayTeam:null}
];

// Lista reale dei 36 concorrenti (dal file Excel fornito dall'utente)
const PARTICIPANT_NAMES = [
  "Yan","Athos","Vera","Matic","Rami","Gianola","Serra","Sam","Moor","Micio",
  "Bea","Luca S.","Lemos","Adriana","Vasco","Jonny","Klemm","Alberto","Anto","Kevin",
  "Luca Pres","Jack","Teo","Pez","Andrea DS","Dzigi","Grigo","André","Thor","Yago",
  "Pato","Biba","Andrew","Stefano P","Basa","Milo"
];

function pointsForGroupPosition(numParticipants){
  if(numParticipants <= 10) return 4;
  if(numParticipants <= 19) return 6;
  if(numParticipants <= 27) return 8;
  if(numParticipants <= 34) return 10;
  if(numParticipants <= 39) return 12;
  if(numParticipants <= 46) return 15;
  return 20;
}

const POINTS = {
  winner: 20,
  topScorer: 10,
  mostGoalsTeamGroups: 5,
  bestPlayer: 5,
  bestGoalkeeper: 5,
  exactScore: 5,
  result1x2: 2,
  knockoutExactScore: 8,
  knockoutResult1x2: 3,
  knockoutQualified: 4
};

module.exports = {
  GROUPS, ALL_TEAMS, MATCHES, KNOCKOUT_PHASES, KNOCKOUT_MATCHES,
  PARTICIPANT_NAMES, pointsForGroupPosition, POINTS
};
