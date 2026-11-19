# 思源中文学校管理系统 · Firebase 版

- `src/siyuan.html`: the app page (same file as the claude.ai artifact).
- `web/fb.js`: connects the page to Firebase (sign-in, Firestore, Storage, account functions).
- `web/config.js`: this project's public Firebase settings.
- `firestore.rules`, `storage.rules`: who may read and write what.
- `functions/`: account management (first owner, create/change/delete accounts).

Deploy: `npx firebase-tools deploy --project siyuan-academia` (the hosting page is built by `node build.js`).
