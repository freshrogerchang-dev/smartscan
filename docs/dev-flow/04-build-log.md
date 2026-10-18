# S4 Build Log
## 0.6 GitHub 交付（2026-10-17）
使用者指示「推上去」，本輪提交目前0.6工作區至既有GitHub main。程式碼、Dev-Flow文件、合成樣本及驗證證據納入；artifacts、.wrangler、.env及node_modules維持排除。雲端AI仍未開通，沒有將這次程式碼推送解讀為同意文件上傳。推送前同步遠端，推送後比對本機與遠端HEAD；Cloudflare資產另以verify-deployment核對。

## 0.6 V1.2 與 V2 實驗接入（2026-10-17）
使用者指示「繼續11-15」，本輪三個切片：11–12 活動／表格、13 條碼、14–15 本機模型接入。沿用不登入、不上傳、Cloudflare 發布與未提交工作；沒有新增遠端 API、金鑰或 DB migration。

- advanced-tools.js：日期／同列24h時間候選，ICS UTC 或 VALUE=DATE、事件 escaping 與 UTF-8 75-byte folding；台北、東京、UTC 固定時差，使用者核對再下載，不直接寫行事曆。無相對日期／民國年推測，跨日結束須人工改。
- 表格先依 word bbox 的垂直中心群組、水平間距及欄錨點啟發式重建，可保留缺格；沒有 word 座標或 OCR 文字已改時提示重新辨識／文字分欄。支援 TSV、逐行 CSV 引號、直線及多空白，200列30欄，逐格可編輯。下載 XLSX 為 minimal OOXML inline string（非公式），CSV 加 BOM 並對公式前綴加單引號；不支援合併格或 CSV 儲存格內換行。所有表格數值以文字保存，不承諾自動數值型別。
- 條碼先原生 BarcodeDetector，沒有結果再載入同源 vendored @zxing/browser 0.1.5（MIT browser wrapper + Apache 核心聲明），每頁後備1碼；1/.5/1.5倍多尺度，原尺寸漏讀的自製 QR 在半尺寸讀出。沒有新增 WebAssembly 依賴／相機權限，不自動開啟任何結果連結；JSON下載、逐頁內容顯示。來源／雜湊及授權在 public/vendor。
- 14–15 不是完成：接入 LanguageModel availability/create/prompt/destroy、180s AbortSignal／取消，舊結果保留、頁碼來源快照、保存與下載。中日文本機 Translator 橋接英文；模型建立併發啟動以保留使用者啟動的下載意圖。手寫／公式採 image modality，英文單行或 LaTeX 草稿，保留裁切影像預覽。不執行模型輸出，不以印刷 Tesseract 冒稱手寫。文件指令視為不可信內容，回答要求來源頁碼但仍可能錯誤。
- advanced 區域草稿附於既有 document.advanced，舊記錄缺欄位可開啟；reset/open/save hooks。SW cache v7，應用0.6.0。

### 0.6 驗證與未完成項
- 語法及55個測試 PASS，新增日期／時區／ICS注入與折行、CSV與OOXML安全、座標缺格、模型不可用／mock問答／取消／保存還原。模型 mock 不是真實推論證據。
- 真實 IAB 自製英文活動→候選→14:00–15:30台北→ICS下載，獨立查核 DTSTART=20261020T060000Z、DTEND=20261020T073000Z，未匯入真實行事曆。
- 真實 IAB 貼3×2表格、改B2至120、下載CSV/XLSX；openpyxl讀回中文及修改值、A3="=1+1" cell type=s；CSV A3前綴單引號，ZIP CRC有效，見 s4-v12-exports.json。
- 另一張自製1600×1000 PNG、Arial54px、3×3英文表，真實Tesseract英語辨識後依座標得到 Item/Qty/Price、Coffee/2/100、Tea/1/50，XLSX由openpyxl讀回9格一致。見 s4-v12-table-ocr.json / s4-v12-table.jpg。單一清晰合成表格，非真實文件品質結案。
- 中文vCard QR + 自製Code128 PNG，真實IAB讀出 QR_CODE 及 CODE_128，JSON已下載；見 s4-v12-barcodes.jpg。其他條碼／手機待驗。活動與表格保存→reload→open還原值已驗。
- **真實IAB文字模型availability=unavailable、影像模型availability=unavailable**，因此14–15無真實摘要／問答／手寫／公式結果，沒有完成品質驗收。程式接入與mock成功不足以宣稱全部15項完成。證據 s4-v12-model-support.json；維持本機決策，不上傳以繞過能力不足。
- console warn/error讀取空陣列；完整S5、iPhone、HEIC／大批量／複雜表格仍待驗。未commit/push；部署資訊另存s4-cloudflare-deployment.json。

### 0.6 發布結果
Wrangler 4.151.1 dry-run與deploy成功，version_id=1640e782-eb9a-4a49-856f-6e152332f2e3；25個公開檔案HTTP200並與本機bytes一致。正式站貼入自製3×3資料重建預覽成功，console warn/error=[]，1280px與390px均無水平溢位（body1265／375）。證據s4-v12-deployed-smoke.json、s4-v12-deployed.jpg、s4-v12-deployed-mobile.jpg。正式站未保存測試文件到IndexedDB。已明確告知14–15沒有可用模型，不將部署成功當作模型可用。

## 0.5 V1.1 接續摘要（2026-10-17）
使用者在確認 1–5 已有、6–15 尚未完成後，指示「好的請繼續」。本輪沿用本機保存與既有部署授權，分三個垂直切片實作 6–10。

- 切片一（7、8）：本機聯絡人以既有 documents store 的 kind=contact、pages=[] 保存，不升 schema、不改舊文件；可從名片頁直接載入。以 NFKC／Email 小寫／電話符號與 00 國碼正規化找精確候選，不推測國碼或用同名認定同一人。逐欄選目前／已存後明確提交，候選 updatedAt 改變則拒絕；草稿合併到選定聯絡人，掃描候選另建聯絡人，原件保留，不批量清理其他來源。QR 採官方 MIT Nayuki v1.8.0 vendored ES6，UTF-8 ECI 26 + byte segment、MEDIUM ECC、4 modules quiet zone、容量 1,200 bytes，下載 PNG。來源與 SHA256 在 public/vendor/SOURCE.md。
- 切片二（9、10）：收據以總計標籤／有效 20xx 西元日期與明確幣別規則提出欄位，排除 subtotal／稅／找零；多候選不自動選，人工修改後隨文件保存。批次逐頁 canvas→三種 JPEG 品質→ZIP STORE（JPEG 已壓縮），含每頁文字與 manifest。取消在活動頁完成後生效，失敗不中斷其他頁，不將取消／失敗頁放入下載。PDF 共用品質設定，但 OCR canvas 和原圖維持原設定。ZIP 不保證小於所有來源，不包含既有 PDF 重壓縮，記憶體佇列不跨重載。
- 切片三（6）：依 Chrome Translator API 與 Translation API 規範建立按需本機翻譯；選來源／目標，雙欄原文快照及可編輯譯文，保存／還原／文字下載。逐頁翻譯後接回原分隔符，不翻譯結構標記。首載模型可能需網路，提供取消／120 秒 abort，失敗保留原對照，finally 釋放模型與 UI lock。不新增雲端文字傳輸；未支援 API 時說明並允許貼譯文，既有 Google 外連獨立保留其傳輸說明。

### 0.5 驗證
- 語法檢查與 44 個測試 PASS，涵蓋精確候選／逐欄衝突、收據歧義與不合法日期、ZIP header/CRC/UTF-8、QR 容量、聯絡人寫入失敗、候選變更、批次取消／部分失敗、本機翻譯成功／失敗／取消及多頁分隔。這不是完整 S5 安全審查。
- 真實 IAB：自製聯絡人儲存→reload→Email 大小寫候選→逐欄合併→QR PNG 下載；zxing-cpp 2.3.0 獨立解回中文姓名與完整 vCard，證據 s4-v11-qr-decode.json。解碼器只位於忽略的 artifacts/qa-python，非產品依賴；未驗手機通訊錄。
- 真實本機英文→繁中翻譯完成；收據文字的 Change 被譯為「更改」，只證明功能路徑，不能宣稱翻譯準確。原文／譯文／收據 date=2026-10-17、amount=1050.5、currency=TWD，隨文件保存後 reload/open 還原成功。沒有真實三語全部配對或手機翻譯證據。
- 兩張自製 PNG（總 274,486 bytes）批次以 small 完成 2/2，JPEG 共 34,811 bytes，ZIP 35,544 bytes；Python zipfile testzip 無 CRC 問題、Pillow 確認每頁 1200×1200。相同 profile 匯出 2 頁 PDF，pypdf 查核每個影像均不超過 1200px；見 s4-v11-exports.json。不能把這個比例推廣到實拍 JPEG。
- 390px viewport 無水平溢位；截圖 s4-v11-merge.jpg、s4-v11-qr.jpg、s4-v11-translation.jpg、s4-v11-batch.jpg。真實取消／失敗 UI 的 deterministic 邊界主要由 unit mocks 驗，不當成網路／裝置故障實測。
- 新增 productivity-tools.js / productivity.js；保留其他未提交工作，未 commit/push。SW cache v6，套件版本 0.5.0；正式部署資料由 s4-cloudflare-deployment.json 記錄。

### 官方參考（2026-10-17）
- https://developer.chrome.com/docs/ai/translator-api ：桌面支援／feature detection／create／translate／模型下載。
- https://webmachinelearning.github.io/translation-api/ ：create/translate AbortSignal。
- https://github.com/nayuki/QR-Code-generator/releases/tag/v1.8.0 ：固定 JS 來源及 MIT。

### 0.5 發布結果
Wrangler 4.151.1 dry-run 成功後，沿既有授權部署 smartscan-personal，version_id=34bbd570-0f0f-419e-8e0c-6801a5d6440f。20 個 public 實際檔案皆線上 HTTP200 且 bytes 與本機一致。正式站 IAB 兩頁自製英文字串→本機繁中翻譯保留分頁標記，雙語 TXT 下載內容已讀回確認，console warn/error=[]，390px viewport bodyWidth=375。證據 s4-v11-deployed-smoke.json / s4-v11-deployed.jpg / s4-cloudflare-deployment.json。只在正式站操作暫存草稿，未保存測試聯絡人／文件到正式站資料庫。


## 啟動方式
Node >=22，在 repo 根目錄執行 `npm run dev`，開啟 http://127.0.0.1:4173 。不需 npm install 或 .env。
`npm run check` 檢查語法；`npm test` 執行控制流程測試。停止服務使用 Ctrl+C。

## Backlog
- [x] clone 並盤點既有 PWA。
- [x] 無額外相依的本機靜態服務與 npm scripts。
- [x] 頁面前移／後移、90 度旋轉、刪除及匯出共用方向。
- [x] OCR／PDF 執行時鎖定頁面變更；錯誤及 worker cleanup 失敗後解鎖。
- [x] 表單 label、手機單欄、safe-area 與基本鍵盤操作改善。
- [x] 安裝 PNG 圖示、固定 OCR 資源路徑與頂層 CDN 程式 SRI。
- [x] 圖片解碼錯誤、單張／總量／頁數限制與 vCard 3.0 格式。
- [x] App 掃描／文字／名片分頁、固定底部導覽與即時名片預覽。
- [x] 真實 PNG/SVG 匯入、單頁英文 OCR、PDF/vCard 下載整合 smoke。
- [ ] 完整 16 樣本中英日 OCR baseline 與量測。
- [ ] iPhone 安裝、touch icon、相機／HEIC、vCard 匯入。
- [ ] 大量圖片在手機的實際記憶體量測（目前限制不是安全容量保證）。
- [ ] 如需自動裁切／可搜尋 PDF／文件庫，先定義下一輪範圍。

## 紀錄
### 2026-10-17 本機接續：頁面管理與穩定控制流程
- public/app.js：加入旋轉／頁序；PDF/OCR 使用同一 canvas，最長邊 2400px；鎖定可變更頁面的控制。
- public/index.html：補 label、可用鍵盤的檔案 input、手機排版及 safe-area。
- public/sw.js：cache 更新至 v2，只清理屬於 SmartScan 的舊 cache。
- scripts/serve.mjs、package.json：無相依本機 server，限制 loopback、GET/HEAD 與 public 內檔案。
- tests/app.test.cjs：5 個控制流程測試通過；不能推論真實 OCR／PDF 或 iPhone 完成。
- 實際服務印出啟動 URL。預覽工具連到不同專案，故未取得本應用瀏覽器證據。
- 未 commit、push 或 deploy。

### 2026-10-17 S4 接續：相容性、匯出與 App 介面
- 切片一：scripts/build-icons.py 使用現有圖示幾何產生 180/192/512 RGB PNG；manifest、touch icon、SW 快取已加入，未再依賴 SVG-only 安裝。Pillow 僅為開發工具，不是產品 runtime。
- 切片二：public/runtime-config.js 固定 Tesseract.js/core 5.1.1，worker/core 路徑與 tessdata_best Git revision e12c65a915945e4c28e237a9b52bc4a8f39a0cec；頂層 OCR/PDF CDN script 加入 sha384 SRI。scripts/verify-runtime.mjs 將 script GET 與其餘 HEAD 查核保存到 docs/evidence/s4-runtime-assets.json。
- 模型注意：原先浮動套件預設為 best_int；本輪改為明確的 tessdata_best 檔案，並非原預設 bytes 的封存。不主張比舊版更準或更快；舊版沒有真實 baseline。本輪固定來源作後續基準，三語模型約 42.7 MB（13–15 MB/語言），以 gzip=false 載入。
- 切片三：匯入時依序解碼，失敗時釋放 URL 並說明 HEIC/格式；上限 20 MiB/張、80 MiB/批、20 頁、32,000,000 pixels/張。解碼之後才可確認像素，不能保證解碼峰值記憶體。vCard 加 N、CRLF、UTF-8 安全折行、換行 escaping 與無姓名 fallback；不猜姓氏，完整姓名存 given-name component，仍須實機匯入驗證。
- 使用者追加 App 外觀要求：改為三個互斥視圖、固定底部 tab、掃描卡片、相簿入口、文字編輯器、即時名片卡與原生說明 dialog；暖白／深綠視覺、inline SVG、safe-area、reduced-motion、鍵盤方向鍵/Home/End 與焦點狀態。沒有導入 UI framework 或新增 backend/DB。
- 本機開發可用 SMARTSCAN_PORT 改埠，本輪用 43187 成功取得正確預覽；先前 4173 顯示其他專案不再是本輪驗證阻塞。

#### 本輪驗證
- 語法檢查與 15 個測試 PASS：11 個 app 控制流程／匯入／vCard／導覽，4 個 CER scorer。不是完整安全審查。
- IAB 真實匯入英／繁中 SVG、頁序交換與旋轉，下載兩頁 A4 PDF；pypdf 確認 2 頁與 A4，Poppler render 人工確認繁中先、英文後且保留指定 90 度方向。
- 新 App UI 另匯入 1600px 自製英文 PNG，經實際 worker/core/model 得到 SMARTSCAN TEST / Invoice 12345 / Total 100.00，與參考一致；僅一個清晰英文樣本，不代表 16 樣本評估完成。
- 新 UI 的名片即時預覽、tab click/ArrowRight、說明 modal 開關、PDF/vCard 下載成功。初版中文測試 vCard 的 UTF-8/N/CRLF 檢查通過；裝置聯絡人匯入未測。
- 390px 寬度畫面無橫向溢位；console error/warn 讀取回傳空陣列。這是 IAB/viewport 測試，不是 iPhone。瀏覽器 engine/OS 版本、完整 network trace、耗時與記憶體數值未擷取。
- 截圖：docs/evidence/s4-app-text.jpg、s4-app-card.jpg；PDF render：s4-pdf-1.png、s4-pdf-2.png。最終線上畫面與部署資訊另存 s4-cloudflare-preview.jpg / s4-cloudflare-deployment.json。

#### 發佈範圍
使用者明確要求建置後部署 Cloudflare，沿用 smartscan-personal Worker。先前 0.2 功能版已部署一次；0.3 App 介面最終版已再次部署成功，version_id=d80b052e-f803-43fb-9737-94ad695730d9。十個線上資產皆 HTTP 200 且 bytes 與本機相同；正式網址的掃描/名片 tab 操作成功，console warn/error 回傳空陣列，390px viewport 的 bodyWidth=375（無橫向溢位）。部署紀錄見 docs/evidence/s4-cloudflare-deployment.json，不以 Git HEAD 表示此未提交工作區的內容。
本輪未 commit 或 push GitHub；先前 handoff ZIP 是舊快照，不含此次 S4/UI，不能當成最新交接包。

### 2026-10-17 0.4 MVP 功能擴充（依使用者 15 項路線圖）
使用者選擇只在目前裝置保存、不登入／不上傳。全文搜尋問題未收到第二個選項的回答，本輪已告知採建議方案：本機文件庫 + 匯出 PDF 文字層，不加入既有 PDF 輸入。

- 切片一：document-tools.js 的保守亮區連通分析提出矩形邊界；crop dialog 可預覽、拖曳、百分比調整、還原，PDF/OCR 共用 source crop 後旋轉。低對比或滿版無可靠邊界時不裁切。以暗背景白紙自製 PNG 實測，結果與原圖可還原；未主張透視校正。
- 切片二：規則建議檔名／分類，使用者可改；新增 IndexedDB library.js（documents store，schema v1），手動儲存原圖 Blob、裁切、頁序、文字、OCR bbox 與名片欄位。本機重新整理後可開啟、修改及另匯出，查詢檔名／分類／全文。清除網站資料、私密模式與配額回收仍可能失去資料，UI 提醒下載備份。沒有遠端 DB。
- 切片三：document-workflow.js 使用 jsPDF 與 OFL Noto Sans TC 字型匯出不可見文字層；字型 11,941,968 bytes，只有匯出可搜尋 PDF 時載入，原始字型 bytes、來源與 OFL 授權存 public/fonts/。不需安裝系統字型。CJK 搜尋忽略 OCR 字間空格；PDF CJK 文字整理字間空格，不修正錯字。CJK／手動文字位置採整頁排版，搜尋 highlight 不保證精準覆蓋影像字形；英文未編輯 OCR 可使用 word bbox。
- 變更頁序同步文字；旋轉／裁切清除受影響頁的舊 OCR，避免錯圖搭舊文字；分頁標記遭改動時拒絕對錯頁。多頁 OCR 完整成功才套用結果；任一頁失敗保留原文字。儲存等 transaction complete，不把 request success 當作已提交。
- UI 延續既有 App 視覺，新增「文件」tab、搜尋／分類卡、命名儲存與裁切 dialog；更新隱私文案。可搜尋 PDF 選項缺文字時明確拒絕，仍能取消選項匯出圖片 PDF。

#### 驗證（0.4）
- npm run check PASS；31 個測試 PASS（包含裁切／分類搜尋／持久交易失敗／頁序文字一致性／部分 OCR 失敗），並非完整安全或裝置認證。
- 真實 IAB：自製英文裁切 PNG → OCR → 自動名稱／收據分類 → save → reload → library open；全文 Invoice 12345 查詢找到資料。另一批繁中/日文 clean PNG 以 chi_tra+eng+jpn 完成辨識，保存後「智慧掃描」連續關鍵字可查到有字間空格的 OCR 內容。
- 本輪兩個 clean PNG 的 compact CER：繁中 1/32=3.125%，日文 1/23≈4.35%；strict CER 15/39≈38.46%、12/27≈44.44%，主要含空格與換行。這是兩個自製案例的觀察，不是完整 16 樣本或實際文件準確率。原始輸出／分數見 s4-mvp-cjk-raw.txt、s4-mvp-cjk-scores.json。
- searchable-cjk-smoke.pdf：使用手動輸入中英日文字，獨立 pypdf 可擷取六個指定片段，Poppler render 確認可見圖片未被文字層覆蓋；證據 s4-mvp-searchable-pdf.json、s4-mvp-pdf-1.png。這項不算 OCR 準確率。
- searchable-ocr-cjk.pdf：兩頁實際 OCR、未人工修字，獨立 pypdf 驗證第一頁包含「智慧掃描」、第二頁包含「スマートスキャン」；見 s4-mvp-ocr-pdf.json。
- 本機 library 的刪除採產品確認提示，本輪未以瀏覽器刪除持久資料。iPhone/HEIC、配額上限、跨分頁競爭及完整原生 PDF viewer 搜尋／選取驗收未完成。瀏覽器 console warn/error 觀察為空；不是完整 network trace。
- 新截圖：s4-mvp-crop.jpg、s4-mvp-library.jpg。本輪只達到 06 的 MVP 1–5 實作與 bounded desktop smoke，V1.1/V1.2/V2 保留未完成。
- 發布完成：Wrangler 4.151.1 dry-run 後部署 0.4，version ce4d449d-8514-43d6-b859-aea74ed0d181；verify-deployment.mjs 遞迴核對16個公開檔案（含字型／授權），全數 HTTP 200 且 bytes 符合本機。正式站新增文件 tab、空文件庫及本機保存提示可見；390px bodyWidth=390，console error/warn 空陣列，截圖 s4-mvp-deployed.jpg。驗證沒有將本機 IndexedDB 測試資料上傳到伺服器。


## 最新接續：草稿恢復與完整備份
本輪已實作與測試，正式站尚未更新。以 [RECOVERY-BACKUP.md](../RECOVERY-BACKUP.md) 為本輪功能、驗證與部署界線的完整紀錄；舊紀錄保留歷史用途。


## 最新接續：八項功能
已依序完成八項功能並驗證。實作、使用入口、64 個子測試與實際瀏覽器證據、部署界線，見 [EIGHT-FEATURES.md](../EIGHT-FEATURES.md)。以本附錄為最新狀態，舊內容保留歷史紀錄。


## 拍照後自動裁切接續
已加入預設開啟的拍照後自動裁切，保留原檔、可還原，邊界不明時不套用；相簿不變。新增測試與 Chromium 相機輸入 fixture 驗證通過，尚未實機拍攝。完整說明見 ../EIGHT-FEATURES.md 的「拍照後自動裁切」。


## 即時相機與名片欄位接續
主相機入口改為 getUserMedia 即時預覽/邊界框，保留系統相機備援。移除取第一行作姓名的規則，品牌與不確定人名不混用。測試與限制見 [LIVE-CAMERA-CARD.md](../LIVE-CAMERA-CARD.md)。
