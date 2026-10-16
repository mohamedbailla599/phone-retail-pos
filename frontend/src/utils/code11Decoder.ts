/**
 * Code 11 (USD-8) 1D Barcode Decoder
 *
 * Implements high-performance discrete 5-element decoding with independent
 * bar vs space thresholding and continuous adaptive tracking.
 * Specifically engineered to instantly decode Apple iPhone *#06# on-screen barcodes
 * even in the presence of strong OLED/Retina screen bloom, backlight glare,
 * and arbitrary scan direction (forward and reverse).
 */

const CODE11_PATTERNS: Record<string, string> = {
  '00001': '0',
  '10001': '1',
  '01001': '2',
  '11000': '3',
  '00101': '4',
  '10100': '5',
  '01100': '6',
  '00011': '7',
  '10010': '8',
  '10000': '9',
  '00100': '-',
  '00110': '*', // Start/Stop delimiter
};

// Precomputed reversed patterns for right-to-left scanline traversal
const REV_CODE11_PATTERNS: Record<string, string> = {};
for (const [pattern, char] of Object.entries(CODE11_PATTERNS)) {
  REV_CODE11_PATTERNS[pattern.split('').reverse().join('')] = char;
}

interface Run {
  isBar: boolean;
  len: number;
}

function decodeRuns(runs: Run[], isReverse = false): string | null {
  const startTarget = isReverse ? '01100' : '00110';
  const patternMap = isReverse ? REV_CODE11_PATTERNS : CODE11_PATTERNS;

  for (let i = 0; i < runs.length - 15; i++) {
    // Delimiter must begin on a bar
    if (!runs[i].isBar) continue;

    const elements = runs.slice(i, i + 5);

    let narrowBarEst: number;
    let wideBarEst: number;
    let narrowSpaceEst: number;
    let wideSpaceEst: number;

    if (!isReverse) {
      // 00110: bar(N) space(N) bar(W) space(W) bar(N)
      narrowBarEst = (elements[0].len + elements[4].len) / 2;
      wideBarEst = elements[2].len;
      narrowSpaceEst = elements[1].len;
      wideSpaceEst = elements[3].len;
    } else {
      // 01100: bar(N) space(W) bar(W) space(N) bar(N)
      narrowBarEst = (elements[0].len + elements[4].len) / 2;
      wideBarEst = elements[2].len;
      narrowSpaceEst = elements[3].len;
      wideSpaceEst = elements[1].len;
    }

    if (narrowBarEst < 0.6 || narrowSpaceEst < 0.6) continue;
    if (wideBarEst < narrowBarEst * 1.2 || wideSpaceEst < narrowSpaceEst * 1.2) continue;

    let barThresh = (narrowBarEst + wideBarEst) / 2;
    let spaceThresh = (narrowSpaceEst + wideSpaceEst) / 2;

    const pStart = [
      elements[0].len > barThresh ? '1' : '0',
      elements[1].len > spaceThresh ? '1' : '0',
      elements[2].len > barThresh ? '1' : '0',
      elements[3].len > spaceThresh ? '1' : '0',
      elements[4].len > barThresh ? '1' : '0',
    ].join('');

    if (pStart === startTarget) {
      let curIdx = i + 5;
      let decoded = '';

      while (curIdx < runs.length - 4) {
        // Skip intercharacter space(s)
        while (curIdx < runs.length && !runs[curIdx].isBar) {
          curIdx++;
        }
        if (curIdx + 4 >= runs.length) break;

        const charEls = runs.slice(curIdx, curIdx + 5);
        const b0 = charEls[0].len > barThresh ? '1' : '0';
        const s1 = charEls[1].len > spaceThresh ? '1' : '0';
        const b2 = charEls[2].len > barThresh ? '1' : '0';
        const s3 = charEls[3].len > spaceThresh ? '1' : '0';
        const b4 = charEls[4].len > barThresh ? '1' : '0';
        const charPat = b0 + s1 + b2 + s3 + b4;

        const matched = patternMap[charPat];
        if (!matched) break;

        // Reached Stop delimiter
        if (matched === '*') {
          const finalResult = isReverse ? decoded.split('').reverse().join('') : decoded;
          if (finalResult.length >= 10) {
            // Standard iPhone IMEI in Code 11 is 15 digits + 1 or 2 check digits (15-17 chars)
            if (finalResult.length >= 15) {
              return finalResult.slice(0, 15);
            }
            return finalResult;
          }
          break;
        }

        decoded += matched;

        // Adaptive tracking: refine thresholds with newly decoded character's elements
        const narrowBars = [charEls[0].len, charEls[2].len, charEls[4].len].filter(
          (_, idx) => [b0, b2, b4][idx] === '0'
        );
        const wideBars = [charEls[0].len, charEls[2].len, charEls[4].len].filter(
          (_, idx) => [b0, b2, b4][idx] === '1'
        );
        if (narrowBars.length > 0) {
          const avg = narrowBars.reduce((a, b) => a + b, 0) / narrowBars.length;
          narrowBarEst = narrowBarEst * 0.75 + avg * 0.25;
        }
        if (wideBars.length > 0) {
          const avg = wideBars.reduce((a, b) => a + b, 0) / wideBars.length;
          wideBarEst = wideBarEst * 0.75 + avg * 0.25;
        }
        barThresh = (narrowBarEst + wideBarEst) / 2;

        const narrowSpaces = [charEls[1].len, charEls[3].len].filter(
          (_, idx) => [s1, s3][idx] === '0'
        );
        const wideSpaces = [charEls[1].len, charEls[3].len].filter(
          (_, idx) => [s1, s3][idx] === '1'
        );
        if (narrowSpaces.length > 0) {
          const avg = narrowSpaces.reduce((a, b) => a + b, 0) / narrowSpaces.length;
          narrowSpaceEst = narrowSpaceEst * 0.75 + avg * 0.25;
        }
        if (wideSpaces.length > 0) {
          const avg = wideSpaces.reduce((a, b) => a + b, 0) / wideSpaces.length;
          wideSpaceEst = wideSpaceEst * 0.75 + avg * 0.25;
        }
        spaceThresh = (narrowSpaceEst + wideSpaceEst) / 2;

        curIdx += 5;
      }
    }
  }
  return null;
}

function extractRuns(
  gray: Uint8Array,
  width: number,
  method: 'adaptive_normal' | 'adaptive_bright' | 'midpoint',
  minG: number,
  maxG: number,
  invert = false
): Run[] {
  const runs: Run[] = [];
  const win = Math.max(6, Math.floor(width / 28));
  const halfWin = win >> 1;

  if (method === 'midpoint') {
    const thresh = minG + (maxG - minG) * 0.45;
    let curIsBar = invert ? gray[0] >= thresh : gray[0] < thresh;
    let curLen = 0;
    for (let x = 0; x < width; x++) {
      const isBar = invert ? gray[x] >= thresh : gray[x] < thresh;
      if (isBar === curIsBar) {
        curLen++;
      } else {
        if (curLen > 0) runs.push({ isBar: curIsBar, len: curLen });
        curIsBar = isBar;
        curLen = 1;
      }
    }
    if (curLen > 0) runs.push({ isBar: curIsBar, len: curLen });
    return runs;
  }

  // Adaptive moving average
  const offset = method === 'adaptive_bright' ? 7 : 3;
  let curSum = 0;
  for (let k = 0; k <= Math.min(width - 1, halfWin); k++) curSum += gray[k];

  const firstAvg = curSum / (halfWin + 1);
  let curIsBar = invert ? gray[0] >= firstAvg + offset : gray[0] < firstAvg - offset;
  let curLen = 0;

  for (let x = 0; x < width; x++) {
    const addX = Math.min(width - 1, x + halfWin);
    const subX = x - halfWin - 1;
    if (x > 0) {
      curSum += gray[addX] - (subX >= 0 ? gray[subX] : 0);
    }
    const count = Math.min(width - 1, x + halfWin) - Math.max(0, x - halfWin) + 1;
    const avg = curSum / count;
    const isBar = invert ? gray[x] >= avg + offset : gray[x] < avg - offset;

    if (isBar === curIsBar) {
      curLen++;
    } else {
      if (curLen > 0) runs.push({ isBar: curIsBar, len: curLen });
      curIsBar = isBar;
      curLen = 1;
    }
  }
  if (curLen > 0) runs.push({ isBar: curIsBar, len: curLen });
  return runs;
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

  // Skip low-contrast lines (empty background / no screen in view)
  if (maxG - minG < 18) return null;

  // Try binarization methods
  const methods: ('adaptive_normal' | 'adaptive_bright' | 'midpoint')[] = [
    'adaptive_normal',
    'adaptive_bright',
    'midpoint',
  ];

  for (const method of methods) {
    for (const invert of [false, true]) {
      const runs = extractRuns(gray, width, method, minG, maxG, invert);
      if (runs.length >= 25) {
        // 1. Try forward
        const fwd = decodeRuns(runs, false);
        if (fwd) return fwd;

        // 2. Try backward (phone held upside down / reverse camera scan)
        const bwd = decodeRuns(runs.slice().reverse(), true);
        if (bwd) return bwd;
      }
    }
  }

  return null;
}

export function decodeCode11FromImageData(imageData: ImageData): string | null {
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
