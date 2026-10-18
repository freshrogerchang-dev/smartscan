# SmartScan Personal — Dev-Flow State
最後更新：2026-10-17（by /s4-build）

## 一句話目標
將現有文件／名片掃描原型整理為可持續開發、可在手機加入主畫面的個人 PWA。

## 來源與範圍
- GitHub：freshrogerchang-dev/smartscan，main，clone 基準 85acb93。
- 本機：C:\Users\fresh\projects\smartscan。使用者提及 /project/smartscan，本次採目前提供的 Windows 工作區。
- Repo 沒有先前五階段文件；本次依原始碼回填，並經使用者確認依現有原型補齊五階段。
- 下列文件是本次盤點與接續紀錄，不代表找到或重現過往 sessions 的內容。

## Phase 狀態
| Phase | 狀態 | 邊界 |
|---|---|---|
| S1 架構 | 完成（既有架構盤點版） | 延續既有靜態 PWA，未重新進行完整商業競品選型 |
| S2 相容性 | 規劃／工具鏈查核完成；相容性驗收進行中 | 本機 HTTP/MIME 已驗證；PNG 圖示、依賴固定、iPhone 相機／安裝／HEIC 交 S4/S5 |
| S3 考察 | 完成（研究與評估工具準備） | 6 項主要文獻／規範、16 自製 SVG、CER scorer；真實 OCR／裝置結果留 S5，未量測 |
| S4 建置 | 0.6 的1–13已實作；14–15實驗接入仍未完成 | 活動ICS、座標表格／Excel／CSV、QR與條碼可走通；文字及影像模型在目前IAB皆unavailable，不能宣稱15項全部完成 |
| S5 驗證 | 進行中 | 55測試與限定IAB smoke；ICS時間、openpyxl表格／公式安全、真實3×3表格OCR、QR與Code128通過；模型實測、手機與獨立安全審查未完成 |

## 關鍵決策（ADR 精簡版）
| 日期 | Session | 決策 | 理由 | 替代方案 |
|---|---|---|---|---|
| 2026-10-17 | 既有 | vanilla JS + 靜態 Cloudflare assets | Repo 已採用，不因補文件重寫 | React／後端留待實際需求 |
| 2026-10-17 | 既有 | Tesseract.js、jsPDF、vCard 3.0 | 延續現有 OCR／匯出功能 | 不新增付費 OCR API |
| 2026-10-17 | 既有 | 不建立帳號與遠端 DB | 原型在瀏覽器處理圖片 | 持久保存需另訂需求 |
| 2026-10-17 | S4 | PDF 與 OCR 共用旋轉後 canvas，最長邊 2400px | 統一處理方向、限制單頁像素量 | 原始解析度辨識留待品質比較 |
| 2026-10-17 | S3 | 先以自製樣本與 NFC/CER 測現有 baseline | 分開文字、欄位及裝置驗收，避免先換模型失去比較基準 | Transformer／自動校正列後續候選 |
| 2026-10-17 | S4 使用者新需求 | 依 06 擴充 MVP 1–5，文件保存在目前瀏覽器 IndexedDB | 使用者明確選擇本機保存，不登入、不上傳 | 原本記憶體-only 範圍被新需求擴充；不新增遠端 DB |
| 2026-10-17 | S4 使用者指示繼續 | 以三個切片完成 V1.1 6–10 的 bounded 實作 | 保留本機架構，翻譯用瀏覽器 Translator、QR vendored MIT 套件 | 不新增第三方翻譯後端；不支援 API 的手機可手動貼譯文 |

## 決策變更
使用者新增自動裁切、檔名分類與全文搜尋，並確認本機保存。本輪因此加入本機文件庫與可搜尋 PDF，取代 S1 原先「不含文件庫／自動裁切／文字層」的範圍限制；純前端、無帳號、無遠端 DB 的架構維持。自動裁切限可確認的矩形，透視校正仍未實作。詳見 06-feature-roadmap.md。

## 未決問題 / 風險
- 使用者已確認主要終端是 iPhone「加入主畫面」PWA；型號與 iOS 版本尚未提供。現有桌面 Chrome 本機 LanguageModel／Translator 方案不能作為 iPhone AI 可用性依據。14–15若採雲端推論，仍須使用者明確同意傳送所選文字／裁切影像，現有「文件不上傳」決策尚未變更。
- 先前 4173 預覽顯示其他專案；本輪改 43187 已取得正確 SmartScan IAB 證據。
- 未儲存的掃描留記憶體；按儲存後留 IndexedDB，但非永久備份，清除網站資料或瀏覽器回收可能遺失。
- 已限制 20 MiB/張、80 MiB/批、20 頁與 32M pixels/張；仍可能造成手機解碼峰值記憶體壓力，尚未校準安全容量。
- CDN 套件／OCR 模型依賴網路；目前只快取 app shell，不能宣稱離線 OCR。
- 已補 180/192/512 PNG 並固定 OCR/core/模型來源；iPhone 安裝／相機／HEIC、聯絡人匯入尚未實機驗證。
- 使用者已授權部署 Cloudflare，並於本輪指示將目前0.6程式碼提交／推送GitHub；此提交包含S4至0.6的程式、測試與Dev-Flow證據。舊ZIP不含後續S4，不能當成最新交接。
- 0.6 已更新上線：https://smartscan-personal.freshrogerchang.workers.dev ，25個資產HTTP200／bytes一致；版本1640e782-eb9a-4a49-856f-6e152332f2e3。正式站表格編輯smoke、390px bodyWidth=375無水平溢位，console warn/error=[]。14–15保留實驗及不可用提示，並未完成模型驗收。
- 已有保守矩形自動裁切建議與可搜尋 PDF；透視校正、既有 PDF 匯入／合併尚未實作。CJK 文字層 highlight 非精準影像座標。

## 下一步
`/s4-build` 取得可用本機文字／影像模型環境後完成14–15真實輸出與品質驗證；目前只保留模型接入及不可用提示。若改用雲端AI，需使用者明確改變「不傳出裝置」決策，不能自行切換。`/s5-verify` 對0.6做獨立安全／手機／複雜表格驗收。完整16樣本中英日baseline仍待補，不能把現有印刷字OCR當作手寫公式；發布試用版不等於S5結案。

0.5 邊界：Translator 真實 IAB 英→繁中可用但含詞義錯誤，不代表手機支援；收據為規則候選；名片只合併草稿到選定聯絡人，不批量刪除其他來源；批次只處理本次圖片與文字、記憶體佇列，不是既有 PDF 重壓縮。最新部署證據見 docs/evidence/s4-cloudflare-deployment.json。


## 最新接續：草稿恢復與完整備份
本輪已實作與測試，正式站尚未更新。以 [RECOVERY-BACKUP.md](../RECOVERY-BACKUP.md) 為本輪功能、驗證與部署界線的完整紀錄；舊紀錄保留歷史用途。


## 最新接續：八項功能
已依序完成八項功能並驗證。實作、使用入口、64 個子測試與實際瀏覽器證據、部署界線，見 [EIGHT-FEATURES.md](../EIGHT-FEATURES.md)。以本附錄為最新狀態，舊內容保留歷史紀錄。


## 拍照後自動裁切接續
已加入預設開啟的拍照後自動裁切，保留原檔、可還原，邊界不明時不套用；相簿不變。新增測試與 Chromium 相機輸入 fixture 驗證通過，尚未實機拍攝。完整說明見 ../EIGHT-FEATURES.md 的「拍照後自動裁切」。


## 即時相機與名片欄位接續
主相機入口改為 getUserMedia 即時預覽/邊界框，保留系統相機備援。移除取第一行作姓名的規則，品牌與不確定人名不混用。測試與限制見 [LIVE-CAMERA-CARD.md](../LIVE-CAMERA-CARD.md)。
