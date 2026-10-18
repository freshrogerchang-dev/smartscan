# 草稿恢復與完整備份還原

本輪以公開正式站的 29 個資產為前端基準（PRODUCTION-BASELINE.json 記錄 SHA-256），保留 GitHub 舊版未包含的 Drive、Cloudflare AI 等前端。本次依使用者要求將修改保存至 GitHub 功能分支與 PR；未部署正式站。

## 使用方式
- 掃描頁「草稿與恢復」顯示自動儲存狀態；有舊草稿時自動展開。選取後恢復，原圖、頁序、旋轉、裁切、透視、OCR 與表單皆保留。不同分頁分開儲存；來源草稿保留，可手動刪除。
- 文字/名片草稿也能保存。約 650ms debounce，處理完成與回到背景時嘗試保存，並每 5 秒補查。關閉前須看到已儲存；突然終止瀏覽器不能保證最後尚未提交的輸入。
- 文件頁「完整備份與還原」下載 .smartscan.json，包含文件/聯絡人、原圖、文字、分類標籤、所有本機草稿及檔名範本。模型、登入 Token、OAuth 設定、Drive 同步基線與尚未同步的遠端資料不包含。
- 選取備份先檢查格式/版本/SHA-256/影像中繼資料，再顯示數量；點確認才以新 ID 新增副本，不覆蓋文件與目前工作區。還原草稿須回掃描頁選取。檔名範本另外明確套用。
- 同一備份重複匯入會新增另一組副本。單次最多 2000 份文件、200 份草稿；原圖資料合計（含草稿重複出現的原圖）128 MiB、JSON 檔 192 MiB；每份 20 頁/80 MiB、每張 20 MiB。超限明確拒絕，不產生部分備份。
- 備份未加密；校驗和驗意外毀損，不是來源簽章或密碼保護。請保存到可信任位置。

## 資料與失敗處理
IndexedDB smartscan-personal 由 v1 升到 v2，只新增 recovery store，保留 documents。草稿使用 File/Blob 原始資料，沒有 object URL 文字。下載使用同一 readonly transaction 取得 documents/recovery 一致快照。
匯入全部文件與草稿使用同一 readwrite transaction、add 和新 UUID，任一寫入/容量失敗全部回滾。QuotaExceededError 顯示未儲存，不假稱成功；離開前有尚未保存內容會嘗試觸發瀏覽器提醒（手機 OS 強制終止不保證觸發）。不以草稿保存自動上傳圖片。

## 驗證
- npm test：9 個測試檔 PASS；另直接執行各檔，共 59 個子測試 PASS。npm run check、git diff --check PASS。
- 新增 4 個備份 codec 測試：原始 bytes/MIME/檔名/時間/中繼資料 round-trip、SHA-256/版本/prototype key 拒絕、裁切格式拒絕、空備份與超限拒絕。
- Chromium 154.0.8037.57：重整草稿恢復、原圖 byte equality、旋轉/文字保留、聯絡人備份、全新 context 預覽再確認、重複匯入保留原件、損壞檔拒絕、native IndexedDB abort 全部回滾、quota 失敗提示 PASS，無 pageerror。
- v1->v2 升級保留舊文件、多分頁草稿互不覆寫、實際 Service Worker 離線載入與恢復 PASS。
- 真實 iPhone/Safari、OS 強制終止、128 MiB 邊界的裝置記憶體壓力尚未驗證；未把 Chromium viewport 當成 iPhone。

## 套用與部署界線
更新包提供 public/ 前端覆蓋檔及測試/說明。請合併到目前正式 Worker 的完整專案，保留既有 Worker 程式、/api/ai 路由、bindings、Secrets 及部署設定。
目前 GitHub main 只有靜態 assets 的 wrangler.jsonc，沒有正式站正在使用的 AI 後端原始碼；不可把這份舊靜態設定直接部署到正式 Worker。此環境也尚無 Cloudflare 部署憑證。因此本輪未更新正式網站。
本機測試工作區 /workspace/smartscan-current，預覽服務為 4174（只確認本執行環境可達，不宣稱外部預覽網址可用）。
