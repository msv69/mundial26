// ============================================================
// SESSIONS — sessioni in memoria + cookie di sessione firmato (HMAC)
// Nessuna dipendenza esterna richiesta
// ============================================================
const crypto = require("crypto");

const SESSION_SECRET = process.env.SESSION_SECRET || "cambia-questo-segreto-in-produzione";
const SESSION_COOKIE_NAME = "wc2026_sid";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 giorni

// Store sessioni in memoria: { sid: { participantId, isAdmin, expires } }
const sessions = new Map();

function sign(value){
  const hmac = crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
  return `${value}.${hmac}`;
}
function unsign(signed){
  if(!signed || !signed.includes(".")) return null;
  const idx = signed.lastIndexOf(".");
  const value = signed.slice(0, idx);
  const hmac = signed.slice(idx + 1);
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
  const a = Buffer.from(hmac);
  const b = Buffer.from(expected);
  if(a.length !== b.length) return null;
  if(!crypto.timingSafeEqual(a, b)) return null;
  return value;
}

function createSession(){
  const sid = crypto.randomBytes(24).toString("hex");
  sessions.set(sid, { participantId: null, isAdmin: false, expires: Date.now() + SESSION_MAX_AGE_MS });
  return sid;
}

function getSession(sid){
  if(!sid) return null;
  const s = sessions.get(sid);
  if(!s) return null;
  if(s.expires < Date.now()){ sessions.delete(sid); return null; }
  return s;
}

function parseCookies(header){
  const out = {};
  if(!header) return out;
  header.split(";").forEach(part => {
    const idx = part.indexOf("=");
    if(idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(val);
  });
  return out;
}

// Middleware-like: attacca req.session (creandola se assente) e prepara res._setSessionCookie
function sessionMiddleware(req, res){
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[SESSION_COOKIE_NAME];
  const sid = unsign(raw);
  let session = getSession(sid);
  let currentSid = sid;
  let isNew = false;

  if(!session){
    currentSid = createSession();
    session = getSession(currentSid);
    isNew = true;
  }

  req.session = session;
  req.session.save = () => {
    // niente da fare: l'oggetto è già nella Map per riferimento
  };
  req.session.destroy = () => {
    sessions.delete(currentSid);
  };

  res._sessionCookieToSet = isNew ? currentSid : null;
  res._currentSid = currentSid;
}

function applySessionCookie(req, res){
  // Se la sessione è nuova o è stata modificata, re-imposta sempre il cookie (rinnova scadenza)
  const sid = res._currentSid;
  const signed = sign(sid);
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(signed)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_MAX_AGE_MS / 1000)}`
  ];
  if(process.env.NODE_ENV === "production") cookieParts.push("Secure");
  res.setHeader("Set-Cookie", cookieParts.join("; "));
}

module.exports = { sessionMiddleware, applySessionCookie };
