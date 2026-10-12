// คัดลอกไฟล์ OCR (Tesseract + ข้อมูลภาษาไทย/อังกฤษ) ไปไว้ใน www/ocr เพื่อให้สแกนสลิปได้แบบออฟไลน์ในแอป
import { cpSync, mkdirSync, rmSync } from 'node:fs';
const out = 'www/ocr';
rmSync(out, { recursive: true, force: true });
mkdirSync(out + '/core', { recursive: true });
mkdirSync(out + '/lang', { recursive: true });
cpSync('node_modules/tesseract.js/dist/tesseract.min.js', out + '/tesseract.min.js');
cpSync('node_modules/tesseract.js/dist/worker.min.js', out + '/worker.min.js');
for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'])
  cpSync('node_modules/tesseract.js-core/' + f, out + '/core/' + f);
for (const l of ['tha', 'eng'])
  cpSync(`node_modules/@tesseract.js-data/${l}/4.0.0_best_int/${l}.traineddata.gz`, `${out}/lang/${l}.traineddata.gz`);
console.log('OCR assets ready in', out);
