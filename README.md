# SmartScan Personal

個人用文件及名片掃描 PWA 原型（繁體中文）。

## Features
- 多張圖片匯入和 A4 PDF 匯出
- 繁中／英文／日文 OCR（Tesseract.js）
- 名片欄位編輯和 vCard 匯出
- Google 翻譯連結

## Cloudflare Workers static assets
This repository serves static files from `public/` using the `wrangler.jsonc` configuration. Cloudflare build command: `echo build-ready`; deploy command: `npx wrangler deploy`.

## Privacy
Images are handled locally in the browser. OCR libraries/models are downloaded from third-party CDNs. Clicking Google Translate sends recognized text to Google. Do not use the prototype for sensitive records.

## Status
Prototype 0.1. No automatic crop, searchable PDF or robust card extraction yet.
