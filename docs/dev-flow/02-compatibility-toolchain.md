# S2 相容性與工具鏈
## 0.6 增補
- @zxing/browser 0.1.5 UMD，395,062 bytes，同源按需載入；瀏覽器wrapper MIT、核心Apache-2.0，來源／雜湊／授權在public/vendor。不新增相機串流或權限，掃描匯入圖片；後備每頁一碼，實測QR/Code128，手機與其他格式待驗。
- ICS只支援台北、東京、UTC明確選擇，匯出UTC或全天DATE；不支援任意時區的DST推算。
- XLSX不需外部套件，原生ZIP+OOXML inlineStr，openpyxl獨立讀回通過；CSV防護公式前綴，表格數值以文字保存。啟發式行列不等於複雜表格辨識已驗收。
- LanguageModel Prompt API按官方expectedInputs/expectedOutputs與availability作文字／image能力區分，模型由瀏覽器管理，未下載獨立TrOCR／公式模型。IAB兩者實測unavailable，所以14–15未完成；mock僅驗控制流程。官方目前支援桌面及特定語言、硬體條件，模型大小可能變化；不以Translator可用推論LanguageModel可用。
- 官方來源（2026-10-17）：https://developer.chrome.com/docs/ai/prompt-api 、https://github.com/zxing-js/browser 、https://www.rfc-editor.org/rfc/rfc5545 。

## 0.5 增補
- 本機翻譯使用瀏覽器內建 Translator API，沒有新增文字傳輸 API／金鑰；初次下載模型。官方目前以桌面環境為主，執行 feature detection，不支援時提示手動貼譯文；真實 IAB 英→繁中成功，iPhone 不列已支援。120 秒逾時／取消以 AbortSignal 中止，測試保留失敗前對照。
- QR 使用本機 vendored Nayuki v1.8.0 ES6，MIT／來源／SHA256 見 public/vendor/SOURCE.md，無 npm runtime 安裝；QR UTF-8 ECI、PNG 可由獨立解碼器還原，手機掃描匯入待驗。
- QA-only zxing-cpp==2.3.0 安裝於 artifacts/qa-python，沒有寫入系統 Python 或產品相依。ZIP 採原生 Uint8Array/DataView/Blob 包裝已壓縮 JPEG，無新增壓縮依賴。PNG smoke 約 268KB→35KB ZIP，不是普遍壓縮保證。
- IndexedDB schema 維持 1，documents store 以 kind=contact 區分獨立聯絡人，掃描記錄可附 receipt/translation。既有文件可讀取缺欄位的舊記錄，不需遠端 migration。
- 來源：https://developer.chrome.com/docs/ai/translator-api 、https://webmachinelearning.github.io/translation-api/ 、https://github.com/nayuki/QR-Code-generator/releases/tag/v1.8.0 （2026-10-17）。

## 0.4 範圍更新
使用者已選擇「先保存在目前裝置，不登入、不上傳」；因此新增瀏覽器 IndexedDB（smartscan-personal DB / documents store / schema v1），取代下方原始盤點的記憶體-only 保存方式，不建立遠端 DB／帳號／RLS。
文件內容含原圖 Blob、裁切／頁序、OCR 文字與欄位，使用 transaction complete 作為儲存成功條件。資料依 origin 隔離，不跨裝置同步；配額／私密模式／瀏覽器清理與回收行為必須實機驗證，非永久備份。
可搜尋 PDF 新增開源 Noto Sans TC TrueType 資產約12MB，按需載入，授權／來源／檔案雜湊見 public/fonts/。本輪 jsPDF 已實際產檔並由 pypdf 擷取中英日文字，iPhone 大字型載入與匯出峰值尚未量測。下方保留早期相容性盤點，最新執行證據見 04 與 s4-mvp-*。

2026-10-17；使用 `/s2-hw` 接續，無額外硬體與韌體，採軟體精簡版。
本次完成工具鏈盤點與官方相容性查核；產品相容性尚未驗收。未安裝套件、修改應用程式、部署或登入外部帳號。

## 相容性矩陣
| 元件 | 本次觀察 | 狀態 |
|---|---|---|
| Git | 2.55.0.windows.5；clone 成功 | 已驗證 |
| Node / npm | 22.21.0 / 10.9.4 | 已驗證 |
| 本機服務 | Node child process 啟動 serve.mjs，fetch 六個路徑 | HTTP 與 MIME 已驗證，見下表 |
| OCR | HTML 使用 tesseract.js@5 CDN | 真實模型下載及辨識待驗 |
| PDF | HTML 使用 jsPDF@2.5.2 CDN | 真實 PDF 下載待驗 |
| 手機／相機 | file input，capture=environment | iPhone 未實測 |
| PWA | manifest、SVG icon、SW 存在 | 安裝／離線待驗 |

## 本機 HTTP 驗證（2026-10-17）
受限環境第一次 fetch 回報 EACCES。經執行權限核准後，以相同 Node probe 在限制外啟動短暫 loopback 服務，讀取以下 URL 後停止 child process，命令 exit 0。
這只能證明該測試執行環境的 HTTP 服務，不代表預覽工具已連到正確主機。

| 路徑 | 狀態碼 | Content-Type / 內容 |
|---|---|---|
| / | 200 | text/html; charset=utf-8；包含 SmartScan Personal |
| /app.js | 200 | text/javascript; charset=utf-8 |
| /manifest.webmanifest | 200 | application/manifest+json |
| /sw.js | 200 | text/javascript; charset=utf-8 |
| /icon.svg | 200 | image/svg+xml |
| /missing | 404 | 無 Content-Type；Not found |

manifest JSON 可解析、圖示檔案存在；name、display=standalone、start_url=/、scope=/ 已確認。只有 sizes=any 的 SVG，沒有明確的 192x192／512x512 PNG。此為靜態盤點，不是瀏覽器 installability 測試。

## 平台相容性與實作交接
| 功能 | 官方資訊／原始碼觀察 | 本專案結論與驗收方式 |
|---|---|---|
| PWA 安裝來源 | HTTPS 或 localhost/loopback；平台安裝流程有差異 [1] | 桌面用 localhost 開發；iPhone 需獨立 HTTPS 網址。手機的 127.0.0.1 指向手機本身，不能開 Windows loopback 服務 |
| 安裝圖示 | MDN 列出 Chromium manifest 的 192px／512px 圖示要求；Apple 舊版 Web Clip 文件使用 PNG 與 180x180 範例 [1][2] | S4 補 192/512 PNG 與 180 PNG touch icon，並保留 SVG；不能僅依文件宣稱現有 SVG 一定失敗 |
| HEIC | WebKit 宣布 Safari 17.0 支援匯入與編輯 HEIC [3] | 以 iOS 17+ Safari 作為 HEIC 測試起點；不推論 Chrome/Edge 支援。JPEG/PNG 作跨平台基準，HEIC 須測 file.type、解碼、方向、canvas 及 PDF/OCR |
| 相機 | 原始碼採 file input + capture=environment，不是 getUserMedia 串流 | 實測 Safari 是否給拍攝選項、實際 MIME/解析度/EXIF 方向；不能保證指定後鏡頭必定生效 |
| OCR | API 層還會載入 worker、core/WASM 及 traineddata [4] | CDN 可達性、Web Worker/WASM、首次模型下載與記憶體皆須真實瀏覽器驗證 |
| 離線 | sw.js 只攔截同源 GET，shell 名單不含第三方程式或模型 | 目前只規劃離線介面；不承諾離線 PDF/OCR。瀏覽器自己的 HTTP／模型快取不等於應用保證 |
| 複製 | app.js 使用 navigator.clipboard.writeText | 在 HTTPS/localhost 與使用者點擊下測試，拒絕權限時要顯示失敗；尚未取得真實剪貼簿證據 |
| PDF / vCard | 下載透過 jsPDF.save / Blob objectURL | Safari 獨立模式的下載、分享與聯絡人匯入交 S5；控制流程 mock 不能證明檔案內容正確 |
| Cloudflare | 官方支援 assets.directory 指定靜態目錄 [5] | wrangler.jsonc 指向 ./public，設定形狀吻合；未執行 Wrangler 或部署，不宣稱遠端已可用 |

## 第三方資源、認證與費用邊界
| 資源 | Repo 設定 | Key／費用與限制 | 狀態 |
|---|---|---|---|
| Tesseract API layer | jsDelivr tesseract.js@5 | 無 API key；本機運算；CDN 流量政策未核定，沒有本專案 SLA | major 浮動，實際 CDN 解析版本未記錄 |
| jsPDF | jsDelivr jspdf@2.5.2 | 無 API key；本機產檔；未做該版本漏洞評估 | URL 固定版本；未下載驗證 bytes |
| OCR worker / core / models | createWorker(language)，未顯式設定路徑 | 需網路與下載流量；不能只 allowlist API layer | 實際完整請求清單待瀏覽器 network capture |
| Google 翻譯 | 使用者點擊開啟 translate.google.com | 網頁連結，非付費 API 整合；文字會送 Google。程式目前截取前 3500 字元 | 服務政策／文字上限不是本次保證 |
| Cloudflare hosting | wrangler.jsonc | 部署需帳號與授權；實際方案、費用與額度尚未確認 | 本次無部署需求，未安裝 CLI |

Tesseract v5.1.1 官方 source 作為 v5 參考：[6] 顯示預設語言資料來自 jsDelivr 的 @tesseract.js-data packages。這不是本應用實際解析到 v5.1.1 的證據；S4 應固定精確版本並記錄 worker/core/models 路徑，再做整合測試。授權沿用 S1 記錄，模型與間接相依尚未完成完整盤點。

## MCP / 工具
GitHub connector 用於確認正確 repo；Git 用於 clone。Node 內建 http、node:test、vm 用於開發與控制流程驗證。
預覽工具開啟同一 loopback URL 卻顯示「布麗的生活任務」，不是本專案，未操作該頁；需能連到此 shell 的瀏覽器。
先前 PowerShell HTTP probe 遭 socket 權限拒絕；CIM socket inventory 亦不可用，不據此判定服務故障或其他專案程序歸屬。本次 Node probe 在核准權限環境已成功，如上表。
已暴露的工具包含 GitHub connector、web、瀏覽器 UI 工具。此純前端範圍不需要新增 MCP；registry search 工具未暴露，未執行搜尋或安裝。沒有需要連接的 DB 或硬體 server。

## Database、設定與待安裝項目
目前無 DB、Auth、金鑰或環境變數；不建立 Supabase project。文件僅在記憶體，保留策略為重新整理後清除。
本機啟動不需 npm install。Cloudflare 發佈仍沿用 README 指令，本次未部署。
Python、Expo、React、原生 SDK 不在目前執行路徑，無須安裝；Wrangler 的本機可用性與認證未驗證，也不是本機開發 prerequisite。
DB schema／RLS／migration：不適用；沒有遠端資料表可檢查。不因 S2 模板要求而新增資料庫。

## 待確認
真實 iPhone Safari 的安裝、相機、HEIC 解碼、PNG touch icon 與 PDF/vCard 分享匯入。模型首載和離線辨識不能由 shell cache 推定。

## S4 / S5 交接與結案條件
- S4：補 PNG 圖示；固定第三方完整版本與下載路徑；定義不支援圖片的訊息。維持既有純前端架構。
- S5：記錄實際 iPhone 型號/iOS、Windows 瀏覽器版本；JPEG/PNG/HEIC 各跑匯入→旋轉→OCR/PDF，記錄結果。用自製資料，不使用真實私人文件。
- S5：全新瀏覽器 profile 的模型首載、網路錯誤、離線 shell、獨立模式下載與 vCard 匯入；記錄 console/network。
- 使用者尚未提供本專案目標手機型號、iOS 版本或部署網址，不以其他專案裝置資訊代入。
- S2 規劃與本機工具鏈查核完成；相容性驗收仍為進行中。下一個流程指令 `/s3-research`，上述裝置與整合驗收於 S4/S5 執行。

## 官方來源（2026-10-17 查閱）
1. [MDN：Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
2. [Apple：Configuring Web Applications](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)（封存文件，PNG 基線參考，不能當作最新 iOS 實測）
3. [WebKit：Safari 17.0 HEIC](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/)
4. [Tesseract.js：Local Installation](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md)
5. [Cloudflare：Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
6. [Tesseract.js v5.1.1：worker-script](https://github.com/naptha/tesseract.js/blob/v5.1.1/src/worker-script/index.js)
