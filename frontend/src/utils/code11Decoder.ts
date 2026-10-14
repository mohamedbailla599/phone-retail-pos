/**
 * Code 11 (USD-8) 1D Barcode Decoder
 *
 * Implements discrete 5-element decoding (3 bars, 2 spaces) with adaptive
 * moving-average thresholding to support real-time decoding from camera frames
 * (including screen-reflected barcodes like tec-it.com/en/Code11).
 *
 * Supports horizontal and slanted scanlines to handle tilted cameras.
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

interface Run {
  isBar: boolean;
  len: number;
}

function scanRunsForCode11(runs: Run[]): string | null {
  for (let i = 0; i < runs.length - 12; i++) {
    // Start pattern must begin on a black bar
    if (!runs[i].isBar) continue;

    const elements = runs.slice(i, i + 5);
    // Start character: narrow bar, narrow space, wide bar, wide space, narrow bar (00110)
    const narrowEst = (elements[0].len + elements[1].len + elements[4].len) / 3;
    if (narrowEst < 0.75) continue;
    const threshold = narrowEst * 1.5;

    const pStart = elements.map((e) => (e.len > threshold ? '1' : '0')).join('');
    if (pStart === '00110') {
      let curIdx = i + 5;
      let decoded = '';
      let unit = narrowEst;

      while (curIdx < runs.length - 4) {
        // Skip intercharacter narrow space
        if (!runs[curIdx].isBar) {
          curIdx++;
        }
        if (curIdx + 4 >= runs.length) break;

        const charElements = runs.slice(curIdx, curIdx + 5);
        const thresh = unit * 1.5;
        const charPat = charElements.map((e) => (e.len > thresh ? '1' : '0')).join('');

        const matched = CODE11_PATTERNS[charPat];
        if (!matched) break;

        // Reached Stop character
        if (matched === '*') {
          if (decoded.length >= 3) {
            // Strip C and K check digits if present
            if (decoded.length === 17) return decoded.slice(0, 15);
            if (decoded.length === 16) return decoded.slice(0, 15);
            return decoded;
          }
          break;
        }

        decoded += matched;

        // Adapt narrow unit estimate based on decoded character elements
        const narrows = charElements.filter((e) => e.len <= thresh).map((e) => e.len);
        if (narrows.length > 0) {
          const avgNarrow = narrows.reduce((a, b) => a + b, 0) / narrows.length;
          unit = unit * 0.7 + avgNarrow * 0.3;
        }

        curIdx += 5;
      }
    }
  }
  return null;
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

  // Skip if low contrast (e.g. solid background)
  if (maxG - minG < 22) return null;

  // Adaptive moving-average thresholding (handles glare and screen reflection)
  const win = Math.max(8, Math.floor(width / 20));
  const halfWin = win >> 1;
  let curSum = 0;
  for (let k = 0; k <= Math.min(width - 1, halfWin); k++) curSum += gray[k];

  const runs: Run[] = [];
  let curIsBar = gray[0] < curSum / (halfWin + 1) - 4;
  let curLen = 0;

  for (let x = 0; x < width; x++) {
    const addX = Math.min(width - 1, x + halfWin);
    const subX = x - halfWin - 1;
    if (x > 0) {
      curSum += gray[addX] - (subX >= 0 ? gray[subX] : 0);
    }
    const count = Math.min(width - 1, x + halfWin) - Math.max(0, x - halfWin) + 1;
    const avg = curSum / count;
    const isBar = gray[x] < avg - 4;

    if (isBar === curIsBar) {
      curLen++;
    } else {
      if (curLen > 0) runs.push({ isBar: curIsBar, len: curLen });
      curIsBar = isBar;
      curLen = 1;
    }
  }
  if (curLen > 0) runs.push({ isBar: curIsBar, len: curLen });

  // Try forward and backward
  const forwardResult = scanRunsForCode11(runs);
  if (forwardResult) return forwardResult;

  const backwardResult = scanRunsForCode11(runs.slice().reverse());
  if (backwardResult) return backwardResult;

  return null;
}

export function decodeCode11FromImageData(imageData: ImageData): string | null {
  const { data, width, height } = imageData;

  // Horizontal scanlines across middle 30% to 70%
  const horizontalRatios = [0.35, 0.40, 0.45, 0.48, 0.50, 0.52, 0.55, 0.60, 0.65];
  for (const ratio of horizontalRatios) {
    const y = Math.floor(height * ratio);
    const res = decodeScanline(data, width, height, y, y);
    if (res) return res;
  }

  // Tilted scanlines (slight tilt down: +8%)
  const tiltRatios = [0.42, 0.48, 0.54];
  for (const r of tiltRatios) {
    const yStart = Math.floor(height * (r - 0.05));
    const yEnd = Math.floor(height * (r + 0.05));
    const res = decodeScanline(data, width, height, yStart, yEnd);
    if (res) return res;

    // Slight tilt up: -8%
    const resRev = decodeScanline(data, width, height, yEnd, yStart);
    if (resRev) return resRev;
  }

  return null;
}
