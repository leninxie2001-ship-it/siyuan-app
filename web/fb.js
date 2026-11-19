/* Firebase build of the Siyuan system: gives app.js the same window.claude.use(...) pieces it has on claude.ai
   (db, assets, downloads, user), backed by Firestore, Cloud Storage and Firebase Authentication. */
(function () {
  const cfg = window.FIREBASE_CONFIG;
  firebase.initializeApp(cfg);
  const auth = firebase.auth(), fs = firebase.firestore(), st = firebase.storage(), fn = firebase.app().functions(cfg.functionsRegion || "us-central1");
  fs.settings({ ignoreUndefinedProperties: true, merge: true });
  if (window.FIREBASE_EMULATOR) {
    auth.useEmulator("http://127.0.0.1:9099"); fs.useEmulator("127.0.0.1", 8080); st.useEmulator("127.0.0.1", 9199); fn.useEmulator("127.0.0.1", 5001);
  }
  // keeps a copy on this computer: pages open faster and fewer reads are billed
  else fs.enablePersistence({ synchronizeTabs: true }).catch(() => { });
  document.documentElement.classList.add("fb");
  // usernames sign in as <name>@users.siyuan.local; nobody gets mail there, it only keys the account
  const email = u => `${u}@users.siyuan.local`;
  const bucket = cfg.storageBucket;
  const hex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, "0")).join("");
  const FB = window.__FB = {
    user: null, claims: null, needSetup: false,
    url: id => window.FIREBASE_EMULATOR ? `http://127.0.0.1:9199/v0/b/${bucket}/o/assets%2F${encodeURIComponent(id)}?alt=media` : `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/assets%2F${encodeURIComponent(id)}?alt=media`,
    uname: () => FB.claims?.uname || null,
    ready: new Promise(res => {
      const off = auth.onAuthStateChanged(async u => { off(); FB.user = u; FB.claims = u ? (await u.getIdTokenResult()).claims : null; res(); });
    }),
    async checkSetup() { try { FB.needSetup = !(await fs.doc("meta/owner").get()).exists; } catch { FB.needSetup = false; } },
    async login(u, pw) { const r = await auth.signInWithEmailAndPassword(email(u), pw); FB.user = r.user; FB.claims = (await r.user.getIdTokenResult(true)).claims; },
    logout: () => auth.signOut(),
    async call(name, data) { try { return (await fn.httpsCallable(name)(data)).data; } catch (e) { throw { code: e.code, message: e.message }; } },
    async bootstrap(u, name, pw) { await FB.call("bootstrap", { uname: u, name, pw }); await FB.login(u, pw); },
    async changePw(old, pw) { await FB.user.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(FB.user.email, old)); await FB.user.updatePassword(pw); },
    putAsset: (id, blob, type) => st.ref("assets/" + id).put(blob, { contentType: type || blob.type || "application/octet-stream", cacheControl: "private,max-age=31536000" }),
  };
  const caps = {
    db: () => fs,
    assets: () => ({
      async upload(blob, opt = {}) { const id = hex(16), type = opt.type || blob.type || "application/octet-stream"; await FB.putAsset(id, blob, type); return { id, url: FB.url(id), sizeBytes: blob.size, contentType: type }; },
    }),
    downloads: () => ({
      async save({ filename, data }) {
        const b = data instanceof Blob ? data : new Blob([data], { type: "text/plain;charset=utf-8" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = filename; document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      },
    }),
    user: () => ({ can: async () => true, id: async () => FB.user?.uid || null }),
  };
  window.claude = { use: async n => (caps[n] ? caps[n]() : null) };
})();
