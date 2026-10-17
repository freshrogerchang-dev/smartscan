# S3 應用深度考察
## 0.6 V2 選型增補（2026-10-17）
為維持使用者不傳出裝置的決策，選擇可用時的瀏覽器Prompt API作摘要／語意問答及影像轉錄實驗接入。官方文件列expectedInputs image、文字語言與硬體限制，不能因API介面存在就假設模型可用。實測IAB文字與image availability皆unavailable，沒有真實V2輸出；14–15不結案。https://developer.chrome.com/docs/ai/prompt-api

TrOCR瀏覽器ONNX候選仍僅研究：https://huggingface.co/Xenova/trocr-small-handwritten ，針對手寫的模型不等於中英日整頁／數學公式模型；本輪未下載此模型或新增transformers.js。後續需在可用模型環境，以獨立英文手寫、中文／日文手寫（若選型支援）、公式與易混符號測試集量測轉錄、LaTeX結構及無法辨識處理；不能用原本印刷字16樣本或provider mocks作準確度證據。

2026-10-17。一般文件／名片掃描 PWA；研究與評估工具準備完成，真實 OCR 尚未評估。

## 研究問題
現有 Tesseract.js 在繁中、英文、日文的錯誤集中在哪些字元與條件？2400px 限制、旋轉、傾斜及陰影有何影響？文字正確能否轉成正確名片欄位？如何以自製資料量測，同時避免把合成測試推成手機可用性？

## 文獻與規範摘要
來源於 2026-10-17 查閱。外部 benchmark 不代表 SmartScan 準確率。

| 引用／年份 | 方法與關鍵資訊 | 對本專案意義 | 來源 |
|---|---|---|---|
| Tesseract ImproveQuality／持續維護 | 官方建議掃描至少 300dpi；指出傾斜與背景不均影響分割／二值化；列 PSM 6 單區塊、7 單行、11 稀疏文字 | 手機照片沒有可靠實體 DPI，不只改 metadata 宣稱改善。先量測解析度、方向與背景 | [官方指南](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html) |
| Tesseract.js Local Installation／持續維護 | worker 之外需 core/WASM 與語言資料 | 記錄實際版本與模型、cold/warm 狀態；mock 不等於整合成功 | [官方文件](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md) |
| Li 等，TrOCR／2021 初稿、2022 v5 | 預訓練影像與文字 Transformer，使用合成及標註資料；作者報告印刷、手寫、場景任務改善 | 是替代方法研究，不是本 PWA 的中英日整頁速度或記憶體證據；未擷取特定表格分數作選型依據，本次不引入模型 | [arXiv:2109.10282v5](https://arxiv.org/abs/2109.10282v5) |
| Park 等，CORD／2019，v2 2022 | 公開 1000 張印尼收據，800/100/100 split，含文字框、轉錄與語意階層 | OCR 與欄位解析要分開評估；不能代表中日文或名片 | [作者 repository](https://github.com/clovaai/cord) |
| Unicode UAX #15／持續維護 | 定義 canonical 與 compatibility normalization | 評分採 NFC，不以 NFKC 混掉全半形；這是本專案設計 | [UAX #15](https://www.unicode.org/reports/tr15/) |
| Dawson & Howes，RFC 2426／1998 | vCard 3.0 必須包含 VERSION、FN、N，長行建議折行；v4 另見 RFC 6350 | 現有程式宣告 3.0，應補 N 並測 CRLF／escaping／匯入；本次不改為 v4 | [RFC 2426](https://www.rfc-editor.org/rfc/rfc2426) |

## 採用的方法 / 演算法與評估指標
### Baseline 與變因
保留單 worker、使用者選語言、人工旋轉與 canvas 最長邊 2400px。S4 先固定完整套件／模型版本，再取得真實 baseline。圖片 PDF 不含搜尋文字；名片欄位仍須人工確認。
取得 baseline 後，同批輸入一次只改一個變因：2400 vs 3200px（原圖須足夠大）、PSM 預設 vs 6/11、原圖 vs 灰階／二值化。自動 deskew／透視校正只列後續候選，不在 S3 實作。不要同時換模型及前處理後歸因單一因素。
rotate90 樣本可先原方向探索，再手動旋轉 270 度作主要驗收；5 度傾斜不是現有 90 度按鈕能校正的功能。陰影及 skew 是探索條件，不承諾其準確率。

### CER 與評分規則
`CER = Levenshtein(reference,hypothesis) / reference code-point count`。距離為插入、刪除、替換的最小總次數；CER 可大於 1，不截斷。
- strict：NFC、CRLF/CR→LF、去整段頭尾空白；保留內部空白／換行、大小寫、標點。
- compact：strict 後移除 JS `\s` 空白，作跨中英日主要字元指標；同時報 strict 揭露版面差異。
- 以 `Array.from` Unicode code points 計數，不是 UTF-16 units 或 grapheme clusters。全半形、標點差異不抹除，不以 WER 比較中日文。
- micro CER = edits 總和／reference_chars 總和，另報每語言、條件、單頁結果。
- 空 reference 拒絕評分；非空 reference 的空 OCR 計 CER=1。缺少、未知、重複 ID 直接拒絕，不能排除失敗頁。

執行：`node sim/score-ocr.mjs data/sample/generated/manifest.json hypotheses.json`。
hypotheses 是完整 16 個 `[{"id":"eng-clean","text":"實際未編輯的 OCR 輸出"}, ...]`。CLI 只評 CER，不自動判定名片／裝置相容性。

### 名片、效能與工程目標
- 姓名／公司／電話／Email 分欄 exact-match，分母四個非空參考欄位。先評未編輯解析結果，人工更正另記；電話另列移除空白、括號、連字號的診斷匹配，不覆蓋嚴格分數或忽略國碼。
- PDF 頁數、順序、方向、A4 邊界與可讀性逐項核對；vCard 格式與匯入後欄位另驗，不能由 CER 代替。
- 用 performance.now 記 init、每頁 recognize 與總耗時；記 cold/warm、成功／失敗／timeout、版本與裝置。沒有可靠記憶體量測則記 unavailable，不拿檔案大小當 private memory。
- **暫定工程目標，非文獻結論或使用者已接受的標準**：clean 每語言 compact micro CER ≤5%、每單頁 ≤10%；人工校正 rotate90 後相較 clean 不劣於 2 個百分點。小樣本僅作 regression gate，不能估計真實世界準確率。
- latency 先蒐集基線，不設定無依據秒數門檻。若當次測試設 timeout，必須記其值與數量，不能刪除超時樣本或算成功。

## 模擬軟體評估與選擇
| 工具 | 用途／Windows／成本與授權 | 學習成本與取捨 |
|---|---|---|
| Node fs、node:test | 現成 Windows runtime；無新增套件費用，授權見 Node distribution | 低；採用 SVG generator 與 CER scorer |
| 真實瀏覽器 + Canvas/Tesseract.js | 與產品同一路徑，沿用既有套件授權 | 中；S4/S5 必要整合驗證，本輪未執行 |
| Python + OpenCV | Windows 可用，額外安裝；實際套件授權須按選定版本核對 | 中；可探索 deskew/threshold，本次不安裝、不選為產品 runtime |

`node sim/generate-samples.mjs` 產生 4 種內容×4 條件=16 個 SVG 與 manifest。這是程式繪製的文字／幾何 fixture，非照片或 AI 圖片。字型由環境決定，S5 須記字型、缺字與 raster 尺寸；本輪未做視覺或 OCR 驗證。
SVG 不證明 JPEG/PNG/HEIC 支援；S5 另拍攝或轉存 raster 後測試。generator 只覆寫專屬 generated 目錄的固定檔名，不讀取使用者照片。Node mock 只驗控制流程，不驗影像品質。

## 資料集清單
| 名稱 | 內容／大小 | 授權與商用邊界 | 狀態 |
|---|---|---|---|
| SmartScan synthetic v1 | 16 SVG+manifest；英／繁中／日文／虛構名片 × clean/rotate90/skew5/shadow | 自製內容，無第三方素材；不推定整個 repo 授權 | 已產生，非代表性樣本 |
| CORD v2 | 1000 張印尼收據，800/100/100；下載 bytes 未核定 | 作者 repo CC-BY-4.0，遵守署名等條件可商用；下載包與內容權利仍須核對 | 候選，未下載，不作中英日主要門檻 |
| 自製實拍計畫 | 16 組內容/條件，每台裝置至少一次；另加 JPEG/PNG/HEIC 格式組 | 僅自製文字；不收私人資料 | 未蒐集 |

不下載公開 dataset 或模型。本次閱讀網頁不是資料集下載。後續若用 CORD，先告知確切 package、來源、大小與授權，再取得使用者同意。

## Data dictionary
| 欄位 | 型別／單位 | 定義 |
|---|---|---|
| id | string | 唯一 sample ID，評分要求 exact identity set |
| language | string | Tesseract 語言設定 |
| condition | enum | clean、rotate90、skew5、shadow |
| image | string | 相對 manifest 的 SVG 檔名 |
| reference_text | string | 人工定義正確全文 |
| fields | object/null | 名片四欄位參考，非名片為 null |
| source | string | self-authored-synthetic；實拍須另設身份 |
| recommended_manual_rotation | integer/度 | rotate90 為 270，其餘 0，非自動校正結果 |
| text（hypotheses） | string | 原始未編輯 OCR output，空輸出亦保留 |
| run_id、device、os、browser、ocr_version、model_paths、cold_warm | run metadata | 見 run-template.json；不得填猜測值 |
| init_ms、recognize_ms、total_ms | number/null，毫秒 | 未測為 null；另記 status/error |

## 自行蒐集計畫與隱私考量
先用合成資料驗證工具，再於可連到本工作區的桌面瀏覽器與一台真實 iPhone 逐條件拍攝／匯入。每次改版本或影像處理時重跑同批資料；不持續收集個人文件。
姓名、公司、電話及 email 均為虛構測試值。實拍排除私人背景、定位與 EXIF 個資，不啟動 Google 翻譯傳送評分文字。裝置型號/iOS 未提供，不套用其他專案資訊。
外部資料放 data/raw/ 前需同意；本次沒有 raw dataset。使用者照片與完整 network capture 不預設 commit，只存經確認的去識別摘要。

## 執行紀錄與界線
generator 成功產生 16 SVG 與 manifest；16 個唯一 ID、檔案存在、XML 解析、重新生成 bytes 一致性均通過。SVG 檔案合計 9800 bytes，不含 manifest。
CER 工具 4 個單元測試通過（edit distance、Unicode/空白、exact IDs、micro average）；完整 npm test 回傳 9/9 PASS、exit 0。兩個 sim 腳本語法與 git diff --check 通過。測試工具曾延遲傳回完整輸出，不將工具等待時間當成測試執行或產品延遲。
reference 直接當 hypothesis 的 self-check 只驗評分器，不能報成 OCR CER=0 或辨識率 100%。
未執行真實 OCR、瀏覽器 raster、PDF/vCard 匯入、效能或手機測試。

## 對架構的影響與 S4 交接
沿用 S1/S2 純前端架構，不新增 API、DB、模型或產品依賴。本輪只新增研究工具與資料。
下一步 `/s4-build`：補 PNG 圖示、固定第三方完整版本與路徑、改善格式失敗訊息及 vCard 3.0；再用 manifest 取得未修改 baseline，才決定是否加入 deskew／二值化。實機與準確率留 S5。
