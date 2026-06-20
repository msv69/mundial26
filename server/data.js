// ============================================================
// DATI MONDIALE 2026 — condiviso da server e frontend
// 48 squadre, 12 gironi, 72 partite fase a gironi
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

const MATCHES = [
  {id:"A1", group:"A", date:"Gio 11 Giu", home:"Messico", away:"Sudafrica"},
  {id:"A2", group:"A", date:"Gio 11 Giu", home:"Corea del Sud", away:"Cechia"},
  {id:"A3", group:"A", date:"Gio 18 Giu", home:"Cechia", away:"Sudafrica"},
  {id:"A4", group:"A", date:"Gio 18 Giu", home:"Messico", away:"Corea del Sud"},
  {id:"A5", group:"A", date:"Mer 24 Giu", home:"Cechia", away:"Messico"},
  {id:"A6", group:"A", date:"Mer 24 Giu", home:"Sudafrica", away:"Corea del Sud"},
  {id:"B1", group:"B", date:"Ven 12 Giu", home:"Canada", away:"Bosnia ed Erzegovina"},
  {id:"B2", group:"B", date:"Sab 13 Giu", home:"Qatar", away:"Svizzera"},
  {id:"B3", group:"B", date:"Gio 18 Giu", home:"Svizzera", away:"Bosnia ed Erzegovina"},
  {id:"B4", group:"B", date:"Gio 18 Giu", home:"Canada", away:"Qatar"},
  {id:"B5", group:"B", date:"Mer 24 Giu", home:"Svizzera", away:"Canada"},
  {id:"B6", group:"B", date:"Mer 24 Giu", home:"Bosnia ed Erzegovina", away:"Qatar"},
  {id:"C1", group:"C", date:"Sab 13 Giu", home:"Brasile", away:"Marocco"},
  {id:"C2", group:"C", date:"Sab 13 Giu", home:"Haiti", away:"Scozia"},
  {id:"C3", group:"C", date:"Ven 19 Giu", home:"Scozia", away:"Marocco"},
  {id:"C4", group:"C", date:"Ven 19 Giu", home:"Brasile", away:"Haiti"},
  {id:"C5", group:"C", date:"Mer 24 Giu", home:"Scozia", away:"Brasile"},
  {id:"C6", group:"C", date:"Mer 24 Giu", home:"Marocco", away:"Haiti"},
  {id:"D1", group:"D", date:"Ven 12 Giu", home:"Stati Uniti", away:"Paraguay"},
  {id:"D2", group:"D", date:"Sab 13 Giu", home:"Australia", away:"Turchia"},
  {id:"D3", group:"D", date:"Ven 19 Giu", home:"Stati Uniti", away:"Australia"},
  {id:"D4", group:"D", date:"Ven 19 Giu", home:"Turchia", away:"Paraguay"},
  {id:"D5", group:"D", date:"Gio 25 Giu", home:"Turchia", away:"Stati Uniti"},
  {id:"D6", group:"D", date:"Gio 25 Giu", home:"Paraguay", away:"Australia"},
  {id:"E1", group:"E", date:"Dom 14 Giu", home:"Germania", away:"Curaçao"},
  {id:"E2", group:"E", date:"Dom 14 Giu", home:"Costa d'Avorio", away:"Ecuador"},
  {id:"E3", group:"E", date:"Sab 20 Giu", home:"Germania", away:"Costa d'Avorio"},
  {id:"E4", group:"E", date:"Sab 20 Giu", home:"Ecuador", away:"Curaçao"},
  {id:"E5", group:"E", date:"Gio 25 Giu", home:"Ecuador", away:"Germania"},
  {id:"E6", group:"E", date:"Gio 25 Giu", home:"Curaçao", away:"Costa d'Avorio"},
  {id:"F1", group:"F", date:"Dom 14 Giu", home:"Paesi Bassi", away:"Giappone"},
  {id:"F2", group:"F", date:"Dom 14 Giu", home:"Svezia", away:"Tunisia"},
  {id:"F3", group:"F", date:"Sab 20 Giu", home:"Paesi Bassi", away:"Svezia"},
  {id:"F4", group:"F", date:"Sab 20 Giu", home:"Tunisia", away:"Giappone"},
  {id:"F5", group:"F", date:"Gio 25 Giu", home:"Giappone", away:"Svezia"},
  {id:"F6", group:"F", date:"Gio 25 Giu", home:"Tunisia", away:"Paesi Bassi"},
  {id:"G1", group:"G", date:"Lun 15 Giu", home:"Belgio", away:"Egitto"},
  {id:"G2", group:"G", date:"Lun 15 Giu", home:"Iran", away:"Nuova Zelanda"},
  {id:"G3", group:"G", date:"Dom 21 Giu", home:"Belgio", away:"Iran"},
  {id:"G4", group:"G", date:"Dom 21 Giu", home:"Nuova Zelanda", away:"Egitto"},
  {id:"G5", group:"G", date:"Ven 26 Giu", home:"Egitto", away:"Iran"},
  {id:"G6", group:"G", date:"Ven 26 Giu", home:"Nuova Zelanda", away:"Belgio"},
  {id:"H1", group:"H", date:"Lun 15 Giu", home:"Spagna", away:"Capo Verde"},
  {id:"H2", group:"H", date:"Lun 15 Giu", home:"Arabia Saudita", away:"Uruguay"},
  {id:"H3", group:"H", date:"Dom 21 Giu", home:"Spagna", away:"Arabia Saudita"},
  {id:"H4", group:"H", date:"Dom 21 Giu", home:"Uruguay", away:"Capo Verde"},
  {id:"H5", group:"H", date:"Ven 26 Giu", home:"Capo Verde", away:"Arabia Saudita"},
  {id:"H6", group:"H", date:"Ven 26 Giu", home:"Uruguay", away:"Spagna"},
  {id:"I1", group:"I", date:"Mar 16 Giu", home:"Francia", away:"Senegal"},
  {id:"I2", group:"I", date:"Mar 16 Giu", home:"Iraq", away:"Norvegia"},
  {id:"I3", group:"I", date:"Lun 22 Giu", home:"Francia", away:"Iraq"},
  {id:"I4", group:"I", date:"Lun 22 Giu", home:"Norvegia", away:"Senegal"},
  {id:"I5", group:"I", date:"Ven 26 Giu", home:"Norvegia", away:"Francia"},
  {id:"I6", group:"I", date:"Ven 26 Giu", home:"Senegal", away:"Iraq"},
  {id:"J1", group:"J", date:"Mar 16 Giu", home:"Argentina", away:"Algeria"},
  {id:"J2", group:"J", date:"Mar 16 Giu", home:"Austria", away:"Giordania"},
  {id:"J3", group:"J", date:"Lun 22 Giu", home:"Argentina", away:"Austria"},
  {id:"J4", group:"J", date:"Lun 22 Giu", home:"Giordania", away:"Algeria"},
  {id:"J5", group:"J", date:"Sab 27 Giu", home:"Algeria", away:"Austria"},
  {id:"J6", group:"J", date:"Sab 27 Giu", home:"Giordania", away:"Argentina"},
  {id:"K1", group:"K", date:"Mer 17 Giu", home:"Portogallo", away:"RD Congo"},
  {id:"K2", group:"K", date:"Mer 17 Giu", home:"Uzbekistan", away:"Colombia"},
  {id:"K3", group:"K", date:"Mar 23 Giu", home:"Portogallo", away:"Uzbekistan"},
  {id:"K4", group:"K", date:"Mar 23 Giu", home:"Colombia", away:"RD Congo"},
  {id:"K5", group:"K", date:"Sab 27 Giu", home:"Colombia", away:"Portogallo"},
  {id:"K6", group:"K", date:"Sab 27 Giu", home:"RD Congo", away:"Uzbekistan"},
  {id:"L1", group:"L", date:"Mer 17 Giu", home:"Inghilterra", away:"Croazia"},
  {id:"L2", group:"L", date:"Mer 17 Giu", home:"Ghana", away:"Panama"},
  {id:"L3", group:"L", date:"Mar 23 Giu", home:"Inghilterra", away:"Ghana"},
  {id:"L4", group:"L", date:"Mar 23 Giu", home:"Panama", away:"Croazia"},
  {id:"L5", group:"L", date:"Sab 27 Giu", home:"Panama", away:"Inghilterra"},
  {id:"L6", group:"L", date:"Sab 27 Giu", home:"Croazia", away:"Ghana"}
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
  result1x2: 2
};

module.exports = { GROUPS, ALL_TEAMS, MATCHES, PARTICIPANT_NAMES, pointsForGroupPosition, POINTS };
