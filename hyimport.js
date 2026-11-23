// temporary one-off: imports the Saturday 华裔 roster from ~/hy.json; removed after the import
// node hyimport.js check   -> reports conflicts, writes nothing
// node hyimport.js go      -> writes students, families and the Saturday courses
const admin = require(process.env.HOME + "/siyuan-app/functions/node_modules/firebase-admin"); admin.initializeApp({ projectId: "siyuan-academia" }); const db = admin.firestore();
const D = JSON.parse(require("fs").readFileSync(process.env.HOME + "/hy.json", "utf8"));
const TN = { "t-wangyuan": "王源", "t-zhanghuixia": "张慧霞", "t-huangyanqi": "黄彦琪", "t-liyang": "李杨", "t-maorongrong": "毛容容", "t-zhangying": "张英" };
(async () => {
  const mode = process.argv[2];
  const st = (await db.collection("students").get()).docs.map(d => ({ id: d.id, ...d.data() }));
  const loc = await db.collection("locations").doc("loc-quito").get();
  const ids = new Set(st.map(s => s.id));
  // codes continue after the highest SY code in use right now
  const top = Math.max(0, ...st.map(s => +((s.code || "").match(/^SY(\d+)$/) || [])[1] || 0));
  D.students.forEach((s, i) => { s.code = "SY" + String(top + 1 + i).padStart(4, "0"); });
  const bad = D.students.filter(s => ids.has(s.id)).map(s => s.id);
  const tch = await Promise.all(Object.keys(TN).map(t => db.collection("teachers").doc(t).get()));
  console.log("students", D.students.length, "families", D.families.length, "codes", D.students[0].code + "-" + D.students[D.students.length - 1].code, "conflicts", bad.join(",") || "none", "loc-quito", loc.exists, "teachers", tch.every(t => t.exists));
  if (mode !== "go" || bad.length || !loc.exists) return;
  const now = new Date().toISOString(), b = db.batch();
  for (const s of D.students) b.set(db.collection("students").doc(s.id), {
    code: s.code, nameZh: s.nameZh, nameEs: s.nameEs, huayi: true, grade: s.grade, birth: s.birth, status: "上课中", regDate: now.slice(0, 10),
    locationId: "loc-quito", address: s.address, level: "",
    parents: [{ name: "", relation: "其他", phone: s.phone, email: "", wechat: s.wechat, idNo: "", address: "" }],
    note: "周六华裔线下班 · " + TN[s.teacher], createdAt: now, createdBy: "import-huayi"
  });
  for (const f of D.families) b.set(db.collection("families").doc(f.id), { name: f.name, note: "", studentIds: f.studentIds, createdAt: now, createdBy: "import-huayi", updatedAt: now });
  const K = {}; for (const s of D.students) (K[s.teacher] = K[s.teacher] || { grade: s.grade, ids: [] }).ids.push(s.id);
  for (const [t, k] of Object.entries(K)) b.set(db.collection("courses").doc("hy26-k-" + t.slice(2)), {
    level: "华裔 " + k.grade, title: "周六线下", teacherId: t, teacher: "", locationId: "loc-quito", start: "2026-11-28", end: "2027-06-26",
    slots: [{ d: 6, start: "09:00", end: "16:30" }], studentIds: k.ids, note: "", hours: null, skip: [], extra: [], createdAt: now, createdBy: "import-huayi"
  });
  await b.commit();
  console.log("IMPORT_OK", D.students.length, D.families.length, Object.keys(K).length);
})().catch(e => console.log("ERR", e.message));
