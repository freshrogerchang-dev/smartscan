# SmartScan 測試資料
建立日期：2026-10-17。沒有下載第三方資料集、模型或照片。

- sample/ocr-reference.txt：早期手工文字，保留供閱讀，不作新版評分 manifest。
- sample/generated/：執行 `node sim/generate-samples.mjs` 可重建的 16 個自製 SVG 與 manifest.json。無外部素材，非真實照片；字型由渲染環境決定。
- sample/run-template.json：空白 run metadata；null/UNKNOWN/NOT_RUN 表示未量測，不能填 0 或成功。
- hypotheses.json：測試者在本機輸出目錄自行建立完整 16 個 `{id,text}`；text 為未經人工修正的 OCR 結果。

評分：`node sim/score-ocr.mjs data/sample/generated/manifest.json <hypotheses.json>`。語言、條件、裝置與模型變更須保留獨立 run。詳見 docs/dev-flow/03-research.md。
外部候選：[CORD v2](https://github.com/clovaai/cord)，1000 張，CC-BY-4.0；未下載，bytes 未確認。下載前須先告知 package/來源/大小並取得同意。
不得把私人文件或真實名片加入 Git。自製素材未使用第三方內容，不代表 repo 已有對外授權；本次不新增 LICENSE。
