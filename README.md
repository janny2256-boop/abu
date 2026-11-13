# 收銀 POS（PWA）

## 本機執行
    npm install
    npm run dev

## 部署到 Vercel
1. 把整個資料夾推到 GitHub（或用 `npx vercel` 直接部署）
2. Vercel → Add New Project → 匯入該 repo
3. Framework Preset 選 Vite（自動偵測），Build Command `npm run build`，Output Directory `dist`
4. Deploy 完成後，用手機開啟網址 →「加入主畫面」

## 資料
所有資料存在該裝置瀏覽器的 localStorage。換手機請先到「商品管理」匯出 JSON 備份，再於新裝置匯入。

## 打包 Android APK
**免電腦（推薦）**：推到 GitHub 後，到 Actions → Build Android APK → Run workflow，
完成後在該次執行頁面下方 Artifacts 下載 `pos-apk`，解壓得到 app-debug.apk，傳到手機安裝（需允許「安裝未知來源應用程式」）。

**本機**：`npm install && npm run build && npx cap add android && npx cap sync android && npx cap open android`，用 Android Studio 的 Build > Build APK。
