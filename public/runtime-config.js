"use strict";
window.SMARTSCAN_CONFIG = Object.freeze({
  tesseractVersion: "5.1.1",
  workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
  corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1",
  modelRevision: "e12c65a915945e4c28e237a9b52bc4a8f39a0cec",
  langPath: "https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/e12c65a915945e4c28e237a9b52bc4a8f39a0cec",
  gzip: false,
  cachePath: "smartscan-best-e12c65a915945e4c28e237a9b52bc4a8f39a0cec",
  maxFileBytes: 20 * 1024 * 1024,
  maxTotalBytes: 80 * 1024 * 1024,
  maxPages: 20,
  maxImagePixels: 32_000_000
});
