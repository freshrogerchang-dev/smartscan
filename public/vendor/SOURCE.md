# QR generator

Project Nayuki, QR-Code-generator v1.8.0, MIT (full license retained in JS header).
Unmodified official ES6 release, 45,336 bytes.

Source: https://github.com/nayuki/QR-Code-generator/releases/tag/v1.8.0
Asset: https://github.com/nayuki/QR-Code-generator/releases/download/v1.8.0/qrcodegen-v1.8.0-es6.js
SHA256: 6a1116192ed1dd67fa1bf31e77f5817103d71c23bbac24c382e698b7668bdd01

Downloaded 2026-10-17. Executes locally; does not transmit vCard contents.

## Barcode reader
@zxing/browser 0.1.5 official npm UMD bundle, 395,062 bytes, MIT browser wrapper; bundled @zxing/library code is Apache-2.0 (upstream dependency range ^0.21.0, exact embedded core version not independently sealed).
Asset: https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/zxing-browser.min.js
SHA256: b5ad3df920738ca7adcb74508d7e6b6a5b9024993fb9a0c702da1ad8964eca07
Sources: https://github.com/zxing-js/browser and https://github.com/zxing-js/library
Full licenses: ZXING-LICENSE and ZXING-LIBRARY-LICENSE. Runtime loads same-origin only on demand. No camera permission is requested; scans imported image canvases. Downloaded 2026-10-17.

## PDF 本機處理
PDF.js / pdfjs-dist 4.10.38：Apache-2.0，檔案與完整授權位於 pdfjs/。來源 https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs 與 pdf.worker.mjs。
jsPDF 2.5.2：MIT，來源 https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js，完整授權 JSPDF-LICENSE。將原先使用的固定版本 CDN 資產保存為同源檔案；未宣稱完成全面相依安全稽核。

- public/vendor/pdfjs/pdf.mjs: SHA-256 `a209a2124baa35cbb9015b809926f1bcec9dd1c247296290e205dd9d76cb9128`
- public/vendor/pdfjs/pdf.worker.mjs: SHA-256 `7c237f83fa56bce645d8af51d183c9c56ba7b2d2928ff42754dc7020bea36323`
- public/vendor/jspdf-2.5.2.js: SHA-256 `85ba2cc3ff858a20fa49fe6e457bec863ea40b55a9f3725e58a940e62f6f61a4`
