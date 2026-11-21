// temporary read-only helper for the 华裔 import; removed after the import
const admin = require(process.env.HOME + "/siyuan-app/functions/node_modules/firebase-admin"); admin.initializeApp({ projectId: "siyuan-academia" }); const db = admin.firestore();
const one = s => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
(async () => {
  const g = async c => (await db.collection(c).get()).docs.map(d => ({ id: d.id, ...d.data() }));
  const [st, fa, te] = await Promise.all(["students", "families", "teachers"].map(g));
  const mode = process.argv[2];
  if (mode === "t") for (const t of te) console.log("TT", t.id, one(t.name), one(t.nameEs), "|", one(JSON.stringify(t.tslots || [])).slice(0, 700), "|", one(t.courseNote).slice(0, 200));
  if (mode === "s") for (const s of st.filter(s => /[一-鿿]/.test(s.nameZh || "") || s.huayi)) console.log("SS", s.id, one(s.nameZh), "/", one(s.nameEs), "/", s.huayi ? "hy" : "", one(s.grade), one(s.status), "/", (s.parents || []).map(p => one(p.phone) + "~" + one(p.wechat)).join(";"));
  if (mode === "f") for (const f of fa) console.log("FF", f.id, one(f.name), (f.studentIds || []).join(","));
  if (mode === "c") { const ids = new Set(st.map(s => s.code).filter(Boolean)); console.log("CODES", [...ids].sort().slice(-5).join(" "), "n=" + st.length); }
})().catch(e => console.log("ERR", e.message));
