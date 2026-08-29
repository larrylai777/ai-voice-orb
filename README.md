# AI Voice Orb

一個以「聲波玻璃光場」為設計核心的互動式網頁。光球會根據使用者麥克風的即時音量，改變自身的體積、發光、內部流體與非完整聲場環線。介面不會錄製、上傳或儲存音訊內容。

## 線上網址

部署完成後，網站會位於：

`https://larrylai777.github.io/ai-voice-orb/`

## 功能

- 點擊「開始聆聽」後，透過瀏覽器 Web Audio API 取得本機麥克風音量。
- 聲音資料會經過平滑處理，再驅動 AI 光球、聲場環線、輸入刻度和頻譜細線。
- 支援準備聆聽、請求權限、正在聆聽、未取得權限、不支援與錯誤等狀態。
- 麥克風僅用於裝置端即時視覺化；停止後會立即釋放音訊串流。
- 提供桌面與手機版排版，並遵循 `prefers-reduced-motion` 的減少動態效果偏好。

## 本機開發

請先安裝 Node.js 22 與 pnpm，接著在專案目錄執行：

```bash
pnpm install
pnpm dev
```

若要驗證型別與建立正式靜態檔案，請執行：

```bash
pnpm check
pnpm build
```

## 麥克風測試注意事項

瀏覽器通常只允許在 HTTPS 或 `localhost` 環境請求麥克風權限，而且必須由使用者主動點擊按鈕觸發。因此正式測試請使用 GitHub Pages 網址，而不是一般未加密的 HTTP 網址。

若先前拒絕麥克風權限，請在瀏覽器網站設定中重新允許，再刷新頁面。建議以最新版 Chrome、Safari 或 Edge 在實體手機及桌面裝置各測試一次。

## GitHub Pages 部署

網站的原始碼位於 `main` 分支，已建置的靜態網站會發佈到 `gh-pages` 分支。Repository 的 **Settings → Pages → Build and deployment** 請選擇 **Deploy from a branch**，並將 Branch 指向 `gh-pages`、資料夾選擇 `/(root)`。

日後更新介面後，先執行 `GITHUB_PAGES=true pnpm build`，再將 `dist/public` 的內容推送至 `gh-pages` 分支。這個設定可讓 Vite 自動使用 `/ai-voice-orb/` 作為靜態資源基底路徑。

## 設計原則

AI Voice Orb 採深海墨黑作為安靜的背景，以極光青作為唯一高飽和識別色。主光球由半透明內部流體、非完整非對稱聲場環線和周圍微弱擾動組成，避免將 AI 視覺簡化成單一漸層球。
