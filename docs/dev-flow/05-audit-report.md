# S5 Audit 報告（2026-10-17）
## 0.6 增補（最新 S4 證據，非獨立 S5 結案）
55個測試及語法通過。活動候選／UTC ICS、表格逐格修正／CSV／XLSX、中文QR與Code128已走真實IAB；openpyxl核對下載的中文／修改值及公式字串安全，另有真實OCR座標3×3表格重建與9格匯出讀回證據。保存重開保留表格與活動。詳見04及s4-v12-*。

14–15僅本機模型實驗接入，當前IAB的文字及影像模型皆回報unavailable；沒有真實推論輸出，不以mock結果宣稱AI或手寫公式完成。模型提示只能降低錯誤風險，不能保證來源引用／抗文件指令／辨識準確率。不能把15項介面已存在當作15項可用。表格重建是間距啟發式，合併格／實拍／手機未驗；XLSX數字均為文字，CSV換行儲存格未支援。條碼後備每頁1碼，多尺度漏讀仍可能存在。iPhone、整批記憶體、離線、完整依賴安全與S5獨立審查待驗。


## 0.5 V1.1 增補（最新 S4 證據，非獨立 S5 結案）
44 個測試及語法通過。新增本機聯絡人／精確候選逐欄合併、vCard QR、規則收據欄位、JPEG 批次 ZIP 及 PDF 品質、本機 Translator API 對照。IAB 走過保存／reload／候選合併、QR PNG、英文→繁中模型翻譯、收據欄位與翻譯保存還原、兩張自製 PNG 批次匯出；獨立 zxing-cpp、zipfile/Pillow、pypdf 查核已保存證據（s4-v11-*）。語法／測試不等於跨平台品質。

翻譯有詞義錯誤且平台受限，模型下載需網路；取消／120 秒 signal 中止，原有結果在失敗時保留。名片以電話／Email 作候選，不保證身份或國碼變體偵測；其他來源保留。QR 含可讀聯絡資料，需使用者自行分享，手機匯入待驗。收據多候選不猜，不適合作會計自動確認。ZIP 與解碼仍有記憶體開銷，手機配額／長批次未量測。完整依賴漏洞／安全審查仍待驗，無獨立 S5 結案。

## 0.4 MVP 增補（歷史）
裁切／本機文件庫／命名分類／文字搜尋／PDF 文字層完成實作及桌面 bounded smoke，31 測試與語法通過。詳見 04-build-log.md、06-feature-roadmap.md 及 s4-mvp-* 證據。已驗證 save/reload/open、CJK 空格容錯、手動及實際 OCR 文字的 PDF 獨立擷取；原文 OCR 輸出保留，沒有將文字正規化當作模型準確率。
新增風險：IndexedDB 配額／回收不保證永久保存；本機資料未加密且同源 script 可存取；CJK/手動文字層位置非精準影像對齊；字型載入約12MB，手機 PDF 產生的記憶體峰值未量測。裁切限明亮區域矩形建議，沒有透視校正。既有 PDF 輸入不在本次，V1.1–V2 未完成；完整 S5 安全／裝置驗收仍未結案。

## S4 更新註記（原報告保留於下方）
本輪 15 個單元／控制流程測試與語法通過；真實 IAB 清晰英文 SVG/PNG OCR、兩頁 PDF 頁數/A4/視覺核對、vCard 下載與 UTF-8/N/CRLF、App tab/名片預覽/dialog smoke 通過。390px viewport 無橫向溢位，console warn/error 空陣列。
已修：PNG 圖示、vCard N/折行/escaping、總量與頁數限制、精確 OCR/core/模型來源、頂層 script SRI。解碼峰值、手機安裝與聯絡人匯入仍待測；worker/core/model 尚無 SRI 內容檢查，HEAD 200 不是模型正確性證據。jsPDF 2.5.2 與完整相依漏洞掃描仍未完成。
本輪是 S4 的驗證增補，不是獨立 S5 審查結案；下方 5/5、NOT RUN 與舊問題是先前基準快照，不能當作最新狀態。完整最新記錄見 04-build-log.md 與 docs/evidence/s4-*。

## 總結
本輪建置控制流程測試通過，完整產品驗收未完成，不能據此宣稱可正式發布。
本報告為本機人工 source review；未執行專用 /code-review high 或 /security-review 工具，未做獨立審查。

## 自動化檢查
| 檢查 | 結果 | 證據邊界 |
|---|---|---|
| npm run check | PASS | app.js、sw.js、serve.mjs 語法 |
| npm test | 5/5 PASS | fake DOM/canvas/worker/pdf 的控制流程 |
| npm run dev | 啟動成功訊息 | 不等同瀏覽器可達或部署 |
| lint / typecheck / build | 無專用設定 | 原生 JS 靜態資產，不虛構通過 |
| npm audit | 未執行 | CDN 相依不在 npm manifest，空 manifest audit 不能證明其安全 |

## 發現與限制
| 等級 | 位置 | 描述 | 狀態 |
|---|---|---|---|
| Medium | public/app.js | vCard 3.0 沒有 N 欄位，未折行；需標準及實機匯入驗證 | 待修／待驗 |
| Medium | public/app.js | 無總圖片容量限制；大型照片解碼可能耗盡手機記憶體 | 待量測 |
| Medium | public/index.html | CDN 執行外部 JS，未 vendor 或 SRI；OCR 固定 major 而非完整版本 | 待後續依賴治理 |
| Medium | public/manifest.webmanifest | SVG-only 圖示的 iPhone 安裝效果未驗證 | 待實機 |
| Low | public/app.js | parseCard 以第一個合格文字行猜姓名，需人工核對 | 介面已提示 |

## 功能驗收
| 項目 | 結果 |
|---|---|
| 空文件停用匯出、排序保留身份、旋轉／刪除釋放 URL | 控制流程測試通過 |
| PDF 處理中禁止清空、旋轉後寬高與 A4 fit | 控制流程測試通過 |
| PDF 相依缺失與 OCR/cleanup 失敗後解鎖 | 控制流程測試通過 |
| 多頁 OCR canvas 方向與 worker terminate | 控制流程測試通過 |
| 真實圖片匯入／旋轉視覺／下載 PDF 可讀 | NOT RUN |
| 真實中英日 OCR 與名片品質 | NOT RUN |
| iPhone 加主畫面、相機、離線、聯絡人匯入 | NOT RUN |

## 依賴與授權
Tesseract.js：Apache-2.0；jsPDF：MIT，來源見 S1。此處不是完整 SBOM／安全掃描；OCR 模型及 transitive dependencies 未盤點完成。Repo 本身未見 LICENSE，不推論授權。

## 下一輪實際驗收清單
1. 在 Windows 瀏覽器開本工作區服務，確認標題 SmartScan Personal。
2. 匯入兩張自製樣本，交換順序、旋轉；匯出 PDF 並確認頁數、方向及文字可讀。
3. 逐一測中英日 OCR，核對結果與錯誤後重試；檢查 console / network。
4. 名片人工填入虛構資料，匯入 vCard，確認姓名、公司、電話及 Email。
5. 以 HTTPS 測 iPhone 加主畫面、相機、下載／分享、旋轉與離線 shell；不宣稱完整離線 OCR。


## 最新接續：草稿恢復與完整備份
本輪已實作與測試，正式站尚未更新。以 [RECOVERY-BACKUP.md](../RECOVERY-BACKUP.md) 為本輪功能、驗證與部署界線的完整紀錄；舊紀錄保留歷史用途。


## 最新接續：八項功能
已依序完成八項功能並驗證。實作、使用入口、64 個子測試與實際瀏覽器證據、部署界線，見 [EIGHT-FEATURES.md](../EIGHT-FEATURES.md)。以本附錄為最新狀態，舊內容保留歷史紀錄。


## 拍照後自動裁切接續
已加入預設開啟的拍照後自動裁切，保留原檔、可還原，邊界不明時不套用；相簿不變。新增測試與 Chromium 相機輸入 fixture 驗證通過，尚未實機拍攝。完整說明見 ../EIGHT-FEATURES.md 的「拍照後自動裁切」。
