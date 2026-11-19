// Builds public/index.html: the Firebase libraries, this project's settings and fb.js, then the same page that runs on claude.ai (src/siyuan.html).
const fs = require("fs"), path = require("path");
const V = "10.14.1", libs = ["app", "auth", "firestore", "storage", "functions"].map(n => `<script src="https://www.gstatic.com/firebasejs/${V}/firebase-${n}-compat.js"></script>`).join("\n");
const r = f => fs.readFileSync(path.join(__dirname, f), "utf8");
const emu = process.argv.includes("--emulator");
const page = r("src/siyuan.html");
const html = `<!doctype html>
<html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>*,*::before,*::after{box-sizing:border-box}body{margin:0}</style>
${libs}
<script>${r("web/config.js")}${emu ? "\nwindow.FIREBASE_EMULATOR = true;" : ""}</script>
<script>${r("web/fb.js")}</script>
</head><body>
${page}
</body></html>
`;
fs.mkdirSync(path.join(__dirname, "public"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "public/index.html"), html);
console.log("public/index.html", (html.length / 1024).toFixed(0) + " KB" + (emu ? " (emulator)" : ""));
