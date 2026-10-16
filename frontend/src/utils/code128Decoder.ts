/**
 * Code 128 1D Barcode Decoder
 *
 * Implements discrete 6-element (and 7-element stop) decoding with checksum
 * verification. Supports Code Sets A, B, and C (numeric pairs), code set switching,
 * bi-directional scanning, and adaptive thresholding.
 *
 * Specifically engineered for fast (<1ms) real-time camera decoding of:
 * - Mobile phone IMEI barcodes (Code 128C)
 * - Box serial number / SKU barcodes (Code 128A/B/C)
 * - Physical sticker labels and on-screen barcode displays
 */

const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'                                 // 100-106 (106 = Stop)
];

const PAT_TO_CODE: Record<string, number> = {};
CODE128_PATTERNS.forEach((p, idx) => {
  PAT_TO_CODE[p] = idx;
});

// Precompute reverse patterns for right-to-left scan
const REV_PAT_TO_CODE: Record<string, number> = {};
CODE128_PATTERNS.forEach((p, idx) => {
  const revP = p.split('').reverse().join('');
  REV_PAT_TO_CODE[revP] = idx;
});

interface Run {
  isBar: boolean;
  len: number;
}

function decodeRuns(runs: Run[], isReverse = false): string | null {
  const patMap = isReverse ? REV_PAT_TO_CODE : PAT_TO_CODE;

  for (let i = 0; i < runs.length - 12; i++) {
    // Delimiter must begin on a bar
    if (!runs[i].isBar) continue;

    // In forward: start character is 6 elements.
    // In reverse: reversed stop character is 7 elements ('2111332')
    if (isReverse) {
      if (i + 7 > runs.length) continue;
      const stopEls = runs.slice(i, i + 7);
      const stopSum = stopEls.reduce((a, b) => a + b.len, 0);
      const stopUnit = stopSum / 13;
      if (stopUnit < 0.5) continue;

      const stopPat = stopEls
        .map((e) => Math.max(1, Math.min(4, Math.round(e.len / stopUnit))))
        .join('');
      if (stopPat !== '2111332') continue;

      // Found reversed stop character, decode backwards
      let curIdx = i + 7;
      const codes: number[] = [];

      while (curIdx + 6 <= runs.length) {
        const charEls = runs.slice(curIdx, curIdx + 6);
        const cSum = charEls.reduce((a, b) => a + b.len, 0);
        const cUnit = cSum / 11;
        const cPat = charEls
          .map((e) => Math.max(1, Math.min(4, Math.round(e.len / cUnit))))
          .join('');
        const codeVal = patMap[cPat];
        if (codeVal === undefined) break;

        codes.push(codeVal);
        curIdx += 6;

        // Check if reached Start A (103), Start B (104), or Start C (105)
        if (codeVal === 103 || codeVal === 104 || codeVal === 105) {
          // In reverse, Start is the last code collected.
          // Reverse codes array so Start is at index 0
          const forwardCodes = codes.slice().reverse();
          return parseCodes(forwardCodes);
        }
      }
      continue;
    }

    // Forward direction
    const sEls = runs.slice(i, i + 6);
    const sum = sEls.reduce((a, b) => a + b.len, 0);
    const unit = sum / 11;
    if (unit < 0.5) continue;

    const sPat = sEls.map((e) => Math.max(1, Math.min(4, Math.round(e.len / unit)))).join('');
    const startCode = patMap[sPat];
    if (startCode !== 103 && startCode !== 104 && startCode !== 105) continue;

    let curIdx = i + 6;
    const codes: number[] = [startCode];

    while (curIdx < runs.length - 5) {
      // Check for Stop symbol (7 elements, 13 modules: '2331112')
      if (curIdx + 7 <= runs.length) {
        const stopEls = runs.slice(curIdx, curIdx + 7);
        const stopSum = stopEls.reduce((a, b) => a + b.len, 0);
        const stopUnit = stopSum / 13;
        const stopPat = stopEls
          .map((e) => Math.max(1, Math.min(4, Math.round(e.len / stopUnit))))
          .join('');
        if (stopPat === '2331112' || patMap[stopPat] === 106) {
          return parseCodes(codes);
        }
      }

      const charEls = runs.slice(curIdx, curIdx + 6);
      const cSum = charEls.reduce((a, b) => a + b.len, 0);
      const cUnit = cSum / 11;
      const cPat = charEls.map((e) => Math.max(1, Math.min(4, Math.round(e.len / cUnit)))).join('');
      const codeVal = patMap[cPat];
      if (codeVal === undefined) break;

      codes.push(codeVal);
      curIdx += 6;
    }
  }
  return null;
}

function parseCodes(codes: number[]): string | null {
  if (codes.length < 3) return null;

  const startCode = codes[0];
  const checkDigit = codes[codes.length - 1];

  // Verify Checksum
  let checkSum = startCode;
  for (let idx = 1; idx < codes.length - 1; idx++) {
    checkSum += codes[idx] * idx;
  }
  if (checkSum % 103 !== checkDigit) {
    return null;
  }

  let curCodeSet = startCode === 105 ? 'C' : startCode === 104 ? 'B' : 'A';
  let decodedText = '';

  for (let idx = 1; idx < codes.length - 1; idx++) {
    const codeVal = codes[idx];

    if (curCodeSet === 'C') {
      if (codeVal <= 99) {
        decodedText += codeVal < 10 ? '0' + codeVal : '' + codeVal;
      } else if (codeVal === 100) {
        curCodeSet = 'B';
      } else if (codeVal === 101) {
        curCodeSet = 'A';
      }
    } else if (curCodeSet === 'B') {
      if (codeVal <= 95) {
        decodedText += String.fromCharCode(32 + codeVal);
      } else if (codeVal === 99) {
        curCodeSet = 'C';
      } else if (codeVal === 101) {
        curCodeSet = 'A';
      }
    } else {
      // CodeSet A
      if (codeVal <= 63) {
        decodedText += String.fromCharCode(32 + codeVal);
      } else if (codeVal <= 95) {
        decodedText += String.fromCharCode(codeVal - 64);
      } else if (codeVal === 99) {
        curCodeSet = 'C';
      } else if (codeVal === 100) {
        curCodeSet = 'B';
      }
    }
  }

  const trimmed = decodedText.trim();
  return trimmed.length >= 4 ? trimmed : null;
}

function decodeScanline(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  yStart: number,
  yEnd: number
): string | null {
  const gray = new Uint8Array(width);
  let minG = 255;
  let maxG = 0;

  for (let x = 0; x < width; x++) {
    const y = Math.floor(yStart + ((yEnd - yStart) * x) / width);
    if (y < 0 || y >= height) continue;
    const idx = (y * width + x) * 4;
    const g = (data[idx] * 77 + data[idx + 1] * 151 + data[idx + 2] * 28) >> 8;
    gray[x] = g;
    if (g < minG) minG = g;
    if (g > maxG) maxG = g;
  }

  // Skip low contrast scanlines
  if (maxG - minG < 18) return null;

  // 1. Midpoint thresholds (fastest for high-contrast barcodes and screens)
  for (const factor of [0.48, 0.38, 0.58]) {
    const midThresh = minG + (maxG - minG) * factor;

    // 1a. Normal (dark bars on light background)
    const runsMid: Run[] = [];
    let curIsBar = gray[0] < midThresh;
    let curLen = 0;
    for (let x = 0; x < width; x++) {
      const isBar = gray[x] < midThresh;
      if (isBar === curIsBar) {
        curLen++;
      } else {
        if (curLen > 0) runsMid.push({ isBar: curIsBar, len: curLen });
        curIsBar = isBar;
        curLen = 1;
      }
    }
    if (curLen > 0) runsMid.push({ isBar: curIsBar, len: curLen });
    const resMid = decodeRuns(runsMid, false) || decodeRuns(runsMid, true);
    if (resMid) return resMid;

    // 1b. Inverted (white bars on dark background / dark mode screen)
    const runsInv: Run[] = [];
    let curIsBarInv = gray[0] >= midThresh;
    let curLenInv = 0;
    for (let x = 0; x < width; x++) {
      const isBar = gray[x] >= midThresh;
      if (isBar === curIsBarInv) {
        curLenInv++;
      } else {
        if (curLenInv > 0) runsInv.push({ isBar: curIsBarInv, len: curLenInv });
        curIsBarInv = isBar;
        curLenInv = 1;
      }
    }
    if (curLenInv > 0) runsInv.push({ isBar: curIsBarInv, len: curLenInv });
    const resInv = decodeRuns(runsInv, false) || decodeRuns(runsInv, true);
    if (resInv) return resInv;
  }

  // 2. Adaptive moving average (handles lighting gradients across screens)
  const win = Math.max(6, Math.floor(width / 28));
  const halfWin = win >> 1;
  let curSum = 0;
  for (let k = 0; k <= Math.min(width - 1, halfWin); k++) curSum += gray[k];

  for (const offset of [3, 7, -2]) {
    const runsAdapt: Run[] = [];
    let isBarAdapt = gray[0] < curSum / (halfWin + 1) - offset;
    let lenAdapt = 0;
    let sumAdapt = curSum;

    for (let x = 0; x < width; x++) {
      const addX = Math.min(width - 1, x + halfWin);
      const subX = x - halfWin - 1;
      if (x > 0) {
        sumAdapt += gray[addX] - (subX >= 0 ? gray[subX] : 0);
      }
      const count = Math.min(width - 1, x + halfWin) - Math.max(0, x - halfWin) + 1;
      const isBar = gray[x] < sumAdapt / count - offset;

      if (isBar === isBarAdapt) {
        lenAdapt++;
      } else {
        if (lenAdapt > 0) runsAdapt.push({ isBar: isBarAdapt, len: lenAdapt });
        isBarAdapt = isBar;
        lenAdapt = 1;
      }
    }
    if (lenAdapt > 0) runsAdapt.push({ isBar: isBarAdapt, len: lenAdapt });

    const resAdapt = decodeRuns(runsAdapt, false) || decodeRuns(runsAdapt, true);
    if (resAdapt) return resAdapt;
  }

  return null;
}

export function decodeCode128FromImageData(imageData: ImageData): string | null {
  const { data, width, height } = imageData;

  // Dense horizontal scanlines across middle 18% to 82% of cropped frame
  for (let ratio = 0.20; ratio <= 0.80; ratio += 0.025) {
    const y = Math.floor(height * ratio);
    const res = decodeScanline(data, width, height, y, y);
    if (res) return res;
  }

  // Slanted scanlines (handles slight phone tilt +/- 6% to 10%)
  const tiltRatios = [0.35, 0.45, 0.55, 0.65];
  for (const r of tiltRatios) {
    const yStart = Math.floor(height * (r - 0.06));
    const yEnd = Math.floor(height * (r + 0.06));
    const res1 = decodeScanline(data, width, height, yStart, yEnd);
    if (res1) return res1;

    const res2 = decodeScanline(data, width, height, yEnd, yStart);
    if (res2) return res2;
  }

  return null;
}
