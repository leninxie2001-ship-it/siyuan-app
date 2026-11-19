// Account management for the Siyuan system. Passwords live only in Firebase Authentication;
// the role, username and on/off state ride on the sign-in as custom claims, which the security rules read.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
const auth = getAuth(), db = getFirestore();
const ID_RE = /^[a-z0-9._-]{2,32}$/, ROLES = ["owner", "staff", "edu", "teacher"];
const email = u => `${u}@users.siyuan.local`;
const fail = (code, msg) => { throw new HttpsError(code, msg); };
const checkPw = pw => { if (typeof pw !== "string" || pw.length < 6) fail("invalid-argument", "El contraseña debe tener al menos 6 caracteres / 密码至少 6 位"); };
const userFor = async u => { try { return await auth.getUserByEmail(email(u)); } catch (e) { if (e.code === "auth/user-not-found") return null; throw e; } };
const needOwner = req => { const t = req.auth?.token; if (!t || t.role !== "owner" || t.active !== true) fail("permission-denied", "Solo el administrador general / 只有总管理员可以"); return t; };
const opts = { region: "us-central1", cors: true };

// The very first owner. Works once: after meta/owner exists it refuses.
exports.bootstrap = onCall(opts, async req => {
  const { uname, name, pw } = req.data || {};
  if (!ID_RE.test(uname || "")) fail("invalid-argument", "username");
  checkPw(pw);
  const ref = db.doc("meta/owner");
  await db.runTransaction(async tx => { if ((await tx.get(ref)).exists) fail("already-exists", "Ya está configurado / 已经设置过了"); tx.set(ref, { uname, at: new Date().toISOString() }); });
  let u;
  try {
    u = await userFor(uname);
    if (u) await auth.updateUser(u.uid, { password: pw, disabled: false, displayName: name || uname });
    else u = await auth.createUser({ email: email(uname), password: pw, displayName: name || uname });
  } catch (e) { await ref.delete(); fail("internal", e.message); }
  await auth.setCustomUserClaims(u.uid, { role: "owner", uname, active: true });
  const now = new Date().toISOString();
  await db.doc(`accounts/${uname}`).set({ name: name || uname, role: "owner", active: true, scores: true, uid: u.uid, createdAt: now, updatedAt: now }, { merge: true });
  return { ok: true };
});

// Create or change an account: name, role, on/off, and (optionally) a new password.
exports.saveAccount = onCall(opts, async req => {
  const t = needOwner(req);
  const { uname, isNew, name, role, active, scores, pw, teacherId } = req.data || {};
  if (!ID_RE.test(uname || "")) fail("invalid-argument", "username");
  if (!ROLES.includes(role)) fail("invalid-argument", "role");
  if (pw) checkPw(pw);
  // a teacher account is tied to one name in the teacher list: it sees that teacher's classes only
  if (role === "teacher" && (typeof teacherId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(teacherId) || !(await db.doc(`teachers/${teacherId}`).get()).exists)) fail("invalid-argument", "Elige el profesor de esta cuenta / 请选择这个账号对应的老师");
  const ref = db.doc(`accounts/${uname}`), cur = await ref.get();
  if (isNew && cur.exists) fail("already-exists", "Ese usuario ya existe / 这个用户名已经有了");
  const self = uname === t.uname, rl = self ? "owner" : role, on = self ? true : !!active, tid = rl === "teacher" ? teacherId : null;
  if (!(rl === "owner" && on)) {
    const owners = await db.collection("accounts").where("role", "==", "owner").get();
    if (!owners.docs.some(d => d.id !== uname && d.data().active !== false)) fail("failed-precondition", "Debe quedar un administrador general activo / 至少要保留一个在用的总管理员");
  }
  let u = await userFor(uname);
  if (!u) {
    if (!pw) fail("failed-precondition", "Ponle una contraseña a esta cuenta / 这个账号还没有密码，请设一个");
    u = await auth.createUser({ email: email(uname), password: pw, displayName: name || uname, disabled: !on });
  } else await auth.updateUser(u.uid, { ...(pw ? { password: pw } : {}), displayName: name || uname, disabled: !on });
  const old = u.customClaims || {};
  await auth.setCustomUserClaims(u.uid, { role: rl, uname, active: on, ...(tid ? { tid } : {}) });
  // a changed role, teacher link, a stop or a new password signs that person out everywhere
  if (!self && (old.role !== rl || old.active !== on || (old.tid || null) !== tid || pw)) await auth.revokeRefreshTokens(u.uid);
  const now = new Date().toISOString();
  await ref.set({ name: name || uname, role: rl, active: on, scores: rl === "owner" || (rl !== "teacher" && !!scores), teacherId: tid || FieldValue.delete(), ...(pw ? { mustChangePw: !self } : {}), uid: u.uid, updatedAt: now, ...(cur.exists ? {} : { createdAt: now, createdBy: t.uname }) }, { merge: true });
  return { ok: true };
});

exports.deleteAccount = onCall(opts, async req => {
  const t = needOwner(req);
  const { uname } = req.data || {};
  if (!ID_RE.test(uname || "") || uname === t.uname) fail("invalid-argument", "username");
  const u = await userFor(uname);
  if (u) await auth.deleteUser(u.uid);
  await db.doc(`accounts/${uname}`).delete();
  return { ok: true };
});
