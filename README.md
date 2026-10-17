# SmartScan Personal

個人用文件及名片掃描 PWA 原型（繁體中文）。

## Features
- App 式掃描／文件庫／文字／名片分頁、固定底部導覽與名片即時預覽
- 頁面排序、90 度旋轉與處理中操作鎖定
- 多張圖片匯入和 A4 PDF 匯出
- 繁中／英文／日文 OCR（Tesseract.js）
- 名片欄位編輯和 vCard 匯出
- Google 翻譯連結
- 本機翻譯與雙語對照（需支援 Translator API 的桌面瀏覽器）；譯文可編輯、保存及下載
- 本機聯絡人、相同電話／Email 候選、逐欄合併草稿、vCard QR 圖片
- 收據總額／日期規則擷取，候選不唯一時人工確認
- 清晰／輕量／最小 PDF 品質、可取消的逐頁 JPEG 批次 ZIP

## Cloudflare Workers static assets
This repository serves static files from `public/` using the `wrangler.jsonc` configuration. Cloudflare build command: `echo build-ready`; deploy command: `npx wrangler deploy`.

## Privacy
Images are handled locally in the browser. OCR libraries/models are downloaded from third-party CDNs. Clicking Google Translate sends recognized text to Google. Do not use the prototype for sensitive records.

## Status
Prototype 0.6（MVP + V1.1 + V1.2）。1–13 有實作與限定桌面驗證；14–15 僅接入本機模型的實驗流程，當前預覽裝置回報模型不可用，尚未完成真實推論或品質驗收。支援可還原矩形裁切、命名分類、本機保存、搜尋 PDF、活動 ICS、表格 Excel／CSV、條碼與 QR。尚無透視校正、既有 PDF 匯入／合併或雲端同步；辨識結果需核對。

線上試用：https://smartscan-personal.freshrogerchang.workers.dev

## 本機開發
在 `C:\Users\fresh\projects\smartscan`，使用 Node.js 22 以上：

```sh
npm run dev
```

開啟 http://127.0.0.1:4173 。沒有額外 npm 相依，不需 `npm install`。可用 PowerShell `$env:SMARTSCAN_PORT='43187'` 指定另一個 loopback 埠。`npm run check` 檢查語法，`npm test` 執行測試。本輪單一清晰英文 PNG 的真實 OCR 與 PDF/vCard 下載 smoke 通過，完整語言與裝置驗收未完成。

OCR/core 固定 5.1.1，語言模型固定 tessdata_best commit；首載每語言約 13–15 MB。資源與限制見 `public/runtime-config.js`。目前上限每張 20 MiB/32M pixels、總計 80 MiB/20 頁，不代表手機記憶體保證。

五階段紀錄入口：[docs/dev-flow/STATE.md](docs/dev-flow/STATE.md)。目前 S2–S5 尚有手機及整合驗收待完成。

## iPhone 使用方式
部署到 HTTPS 後，以 Safari 開啟網址，從分享選單選「加入主畫面」。相機、圖示與 PDF/vCard 分享效果需在實際裝置確認。離線快取只涵蓋介面，不保證 OCR 模型或 PDF 套件離線可用；重新整理會清掉尚未儲存的掃描；已儲存文件仍需另下載備份。

## 裁切、保存與搜尋
1. 匯入圖片後，按每頁「自動裁切」確認建議範圍；可拖曳、用百分比調整或還原完整圖片。套用後請重新辨識文字。
2. OCR 後核對結果，回掃描頁調整檔名／分類，按「儲存到文件庫」。資料只存在目前瀏覽器；請下載 PDF 備份，清除網站資料可能使文件消失。
3. 「文件」頁可搜尋檔名、分類、已儲存文字；CJK 查詢容忍 OCR 字間空格。未辨識圖片不能全文搜尋。
4. 勾選「加入可搜尋文字層」再匯出，可在支援的 PDF reader 搜尋。每頁需有文字；首次下載約 12 MB 開源字型（OFL，來源及授權在 public/fonts）。PDF 保留圖片，搜尋層可能含 OCR 錯誤；CJK/手動文字的搜尋標示位置未精準對齊影像。

15 項功能與版本狀態見 [路線圖](docs/dev-flow/06-feature-roadmap.md)。1–13 有分階段實作與桌面 smoke，14–15 仍待可用本機模型；不能宣稱 15 項全部完成。iPhone 與完整品質／安全驗收未完成。

## V1.2 與 V2 實驗區
- 文字頁展開「日期與活動」找有效西元日期與同列 24 小時制時間，選候選後核對活動名稱、地點、起訖及時區，再下載 ICS，自行匯入行事曆。只列台北／東京／UTC，匯出 UTC；全天結束日不含當日。不推測民國年、相對日期、夏令時間地區或跨日結束時間。
- 「表格轉 Excel／CSV」可用已辨識頁的 word bbox 重建行列（間距啟發式），或貼 Tab／CSV／直線／連續空白文字分欄。逐格編輯後下載；200 列／30 欄上限。XLSX 全部存文字，CSV 公式前綴加單引號。不是可靠的合併儲存格／多欄複雜版面還原，請核對。編輯 OCR 文字後舊座標失效，可重新辨識或改用文字分欄。
- 「條碼與 QR 辨識」讀本次圖片的裁切／旋轉後 canvas。先試原生 BarcodeDetector，再用同源 vendored ZXing 0.1.5 多尺度後備；後備每頁一碼。只顯示及下載內容，不自動開啟網址或匯入 vCard；讀不到不等於沒有碼。實測中文 vCard QR、Code 128，其他格式／手機待驗。
- 「AI 摘要與語意問答」需本機 LanguageModel API 及可用模型；英文直接推論，繁中／日文經本機 Translator 橋接英文再轉回。來源以頁碼標示，原文快照與結果隨文件保存，模型要求引用但不保證引用或回答正確。每次 12,000 字元上限，超出拒絕而不截斷；可取消／180 秒逾時，不上傳文件。目前 IAB 實測文字模型 unavailable，沒有取得真實 AI 摘要／問答，不以 mock 成功當完成。
- 「手寫與公式辨識」為支援影像輸入的本機 LanguageModel 實驗接入；先裁切單行英文手寫或一個公式，原圖保留，草稿可修正下載，不執行 LaTeX 指令。不宣稱中日手寫通用 OCR。目前 IAB 影像模型 unavailable，未取得真實手寫／公式結果，需另驗資料集與模型品質。無可用模型時保留舊結果並解鎖介面。

官方依據：[Prompt API](https://developer.chrome.com/docs/ai/prompt-api)、[ZXing Browser](https://github.com/zxing-js/browser)、[iCalendar RFC 5545](https://www.rfc-editor.org/rfc/rfc5545)。模型可能需大量磁碟、RAM／GPU 與初次網路下載，手機不列為已支援。沒有加入付費服務、雲端 AI、金鑰或自動文件上傳。

## V1.1 使用方式與邊界
- 文字頁展開「翻譯與原文對照」，選原文／譯文語言後按「在裝置上翻譯」。首次可能下載模型，120 秒逾時或可取消；失敗保留原對照。多頁分開翻譯，保留分頁符號。原文快照不隨後續 OCR 編輯改變，需重新翻譯或擷取。手機／不支援的瀏覽器可貼上自己的譯文；Google 外連仍是另外一個會傳送文字的選項。
- 名片可獨立保存為本機聯絡人，不需圖片。「新增聯絡人草稿」開始下一張；「檢查重複名片」只用完整正規化電話／Email，姓名不當成身份。逐欄預覽後，把目前草稿合併到選定聯絡人；若候選來自掃描文件，另存合併聯絡人並保留掃描。其他已儲存來源不會批量刪除。
- QR 在本機產生，含 UTF-8 vCard，可下載 PNG，限 1,200 bytes；不是公開雲端頁面，手機實際掃描／聯絡人匯入仍需驗收。
- 收據按「擷取收據金額與日期」後核對欄位，只接受有效 20xx 西元日期與含總計標籤的金額；不是會計驗證。多個不同日期／金額不猜，幣別無標記就留空，日文／英文／中文規則仍需實際文件品質測試。
- 掃描頁展開「批次處理與壓縮」，品質同時用於 PDF 與 JPEG ZIP，保留原圖與 OCR。逐頁列完成／失敗／取消，下載只含完成頁、已有文字與 manifest；可重新執行。不是既有 PDF 重壓縮，也不保證每個來源都更小。工作與 ZIP 留在記憶體，重新整理後不保留。

本機翻譯能力來源：[Chrome 官方文件](https://developer.chrome.com/docs/ai/translator-api)、[Translation API 規範](https://webmachinelearning.github.io/translation-api/)。QR 產生器採 [Project Nayuki v1.8.0](https://github.com/nayuki/QR-Code-generator/releases/tag/v1.8.0)，隨站提供，完整 MIT 授權與雜湊在 public/vendor/。獨立解碼用 zxing-cpp 2.3.0，僅安裝於忽略的 artifacts/qa-python，不屬於網站 runtime。
