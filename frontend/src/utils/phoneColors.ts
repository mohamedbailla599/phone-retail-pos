/**
 * Phone Colors Utility & Smart Mapper
 * Maps official phone color names (Apple, Samsung, Xiaomi, Google, etc.),
 * standard color names (French & English), and arbitrary custom inputs
 * to exact hex values with automatic border & light-detection.
 */

export interface ColorInfo {
  hex: string;
  isLight: boolean;
  border?: string;
  gradient?: string;
}

// Comprehensive dictionary of official phone model colors & common variants
const EXACT_PHONE_COLORS: Record<string, ColorInfo> = {
  // --- Apple iPhone specific colors ---
  'deep purple': { hex: '#4B3D60', isLight: false },
  'space black': { hex: '#2C2B2E', isLight: false },
  'space gray': { hex: '#4E4F51', isLight: false },
  'gris sideral': { hex: '#4E4F51', isLight: false },
  'midnight': { hex: '#1E232A', isLight: false },
  'minuit': { hex: '#1E232A', isLight: false },
  'starlight': { hex: '#F8F7F2', isLight: true, border: '#D1CEBD' },
  'lumiere stellaire': { hex: '#F8F7F2', isLight: true, border: '#D1CEBD' },
  'natural titanium': { hex: '#9F9990', isLight: false, gradient: 'linear-gradient(135deg, #B5AEA4 0%, #8A847C 100%)' },
  'titane naturel': { hex: '#9F9990', isLight: false, gradient: 'linear-gradient(135deg, #B5AEA4 0%, #8A847C 100%)' },
  'titanium naturel': { hex: '#9F9990', isLight: false, gradient: 'linear-gradient(135deg, #B5AEA4 0%, #8A847C 100%)' },
  'white titanium': { hex: '#EBEBEB', isLight: true, border: '#C5C5C5' },
  'titane blanc': { hex: '#EBEBEB', isLight: true, border: '#C5C5C5' },
  'black titanium': { hex: '#373634', isLight: false },
  'titane noir': { hex: '#373634', isLight: false },
  'blue titanium': { hex: '#3B4454', isLight: false },
  'titane bleu': { hex: '#3B4454', isLight: false },
  'desert titanium': { hex: '#CBBBA8', isLight: false, gradient: 'linear-gradient(135deg, #D8C8B6 0%, #BBA895 100%)' },
  'titane desert': { hex: '#CBBBA8', isLight: false },
  'titane sable': { hex: '#CBBBA8', isLight: false },
  'sierra blue': { hex: '#9BB5CE', isLight: true, border: '#7E9BB8' },
  'bleu alpin': { hex: '#9BB5CE', isLight: true, border: '#7E9BB8' },
  'pacific blue': { hex: '#2D4E68', isLight: false },
  'bleu pacifique': { hex: '#2D4E68', isLight: false },
  'alpine green': { hex: '#505F4E', isLight: false },
  'vert alpin': { hex: '#505F4E', isLight: false },
  'midnight green': { hex: '#4A544C', isLight: false },
  'vert nuit': { hex: '#4A544C', isLight: false },
  'product red': { hex: '#E11C2A', isLight: false },
  'rose gold': { hex: '#E8B4B8', isLight: true, border: '#CFA0A4' },
  'or rose': { hex: '#E8B4B8', isLight: true, border: '#CFA0A4' },
  'gold': { hex: '#F9E5C9', isLight: true, border: '#DBC5A6', gradient: 'linear-gradient(135deg, #FDEED9 0%, #E2C9A8 100%)' },
  'or': { hex: '#F9E5C9', isLight: true, border: '#DBC5A6', gradient: 'linear-gradient(135deg, #FDEED9 0%, #E2C9A8 100%)' },
  'silver': { hex: '#E2E4E1', isLight: true, border: '#C2C4C1', gradient: 'linear-gradient(135deg, #F1F2F0 0%, #D0D2CF 100%)' },
  'argent': { hex: '#E2E4E1', isLight: true, border: '#C2C4C1', gradient: 'linear-gradient(135deg, #F1F2F0 0%, #D0D2CF 100%)' },
  'purple': { hex: '#B8AFE6', isLight: true, border: '#9B90D0' },
  'violet': { hex: '#8B5CF6', isLight: false },
  'mauve': { hex: '#C084FC', isLight: true, border: '#A855F7' },
  'pink': { hex: '#FAD0D6', isLight: true, border: '#E4A7B0' },
  'rose': { hex: '#FAD0D6', isLight: true, border: '#E4A7B0' },
  'blue': { hex: '#3B82F6', isLight: false },
  'bleu': { hex: '#3B82F6', isLight: false },
  'yellow': { hex: '#FDE047', isLight: true, border: '#EAB308' },
  'jaune': { hex: '#FDE047', isLight: true, border: '#EAB308' },
  'green': { hex: '#86EFAC', isLight: true, border: '#4ADE80' },
  'vert': { hex: '#22C55E', isLight: false },
  'teal': { hex: '#2DD4BF', isLight: true, border: '#14B8A6' },
  'ultramarine': { hex: '#4F67A2', isLight: false },
  'outremer': { hex: '#4F67A2', isLight: false },

  // --- Samsung specific colors ---
  'phantom black': { hex: '#1C1C1E', isLight: false },
  'phantom silver': { hex: '#D8DBE2', isLight: true, border: '#B4B9C4' },
  'phantom violet': { hex: '#7A6F8B', isLight: false },
  'phantom white': { hex: '#F5F5F7', isLight: true, border: '#D0D0D4' },
  'gris titane': { hex: '#63615E', isLight: false },
  'titanium gray': { hex: '#63615E', isLight: false },
  'titanium violet': { hex: '#534E6B', isLight: false },
  'titanium yellow': { hex: '#E8DFC8', isLight: true, border: '#C7BD9F' },
  'titanium black': { hex: '#2B2B2B', isLight: false },
  'awesome navy': { hex: '#1D2A44', isLight: false },
  'awesome iceblue': { hex: '#D7E6F4', isLight: true, border: '#A5C2DE' },
  'awesome lilac': { hex: '#DFD3E8', isLight: true, border: '#BAA2C9' },
  'awesome lemon': { hex: '#F4F3BE', isLight: true, border: '#D5D37E' },
  'burgundy': { hex: '#5A1F2E', isLight: false },
  'bourgogne': { hex: '#5A1F2E', isLight: false },
  'cream': { hex: '#FDFBF7', isLight: true, border: '#DED9CD' },
  'creme': { hex: '#FDFBF7', isLight: true, border: '#DED9CD' },
  'lavender': { hex: '#E6D7FF', isLight: true, border: '#C0A3F5' },
  'lavande': { hex: '#E6D7FF', isLight: true, border: '#C0A3F5' },
  'lime': { hex: '#D4F171', isLight: true, border: '#A8CC35' },
  'mint': { hex: '#BBF2C8', isLight: true, border: '#81D896' },
  'menthe': { hex: '#BBF2C8', isLight: true, border: '#81D896' },
  'emerald green': { hex: '#1B4034', isLight: false },
  'vert emeraude': { hex: '#1B4034', isLight: false },
  'onyx black': { hex: '#17181C', isLight: false },
  'marble gray': { hex: '#D8D9DE', isLight: true, border: '#AFB2BE' },
  'cobalt violet': { hex: '#413D54', isLight: false },
  'amber yellow': { hex: '#FBE08E', isLight: true, border: '#E4BE52' },
  'bora purple': { hex: '#8E75A0', isLight: false },
  'bronze': { hex: '#A3705C', isLight: false },
  'mystic bronze': { hex: '#A3705C', isLight: false },

  // --- Google Pixel specific colors ---
  'obsidian': { hex: '#202124', isLight: false },
  'obsidienne': { hex: '#202124', isLight: false },
  'porcelain': { hex: '#F1EFEA', isLight: true, border: '#CEC9BD' },
  'porcelaine': { hex: '#F1EFEA', isLight: true, border: '#CEC9BD' },
  'bay': { hex: '#7794A8', isLight: false },
  'hazel': { hex: '#686C60', isLight: false },
  'noisette': { hex: '#686C60', isLight: false },
  'lemongrass': { hex: '#DEE09B', isLight: true, border: '#BFC26B' },
  'snow': { hex: '#F7F7F7', isLight: true, border: '#D4D4D4' },
  'charcoal': { hex: '#3C4043', isLight: false },
  'stormy black': { hex: '#282B2E', isLight: false },
  'kinda coral': { hex: '#EAA592', isLight: true, border: '#CF7B63' },
  'sorta sunny': { hex: '#F4E2C7', isLight: true, border: '#D3BA94' },

  // --- Xiaomi / Poco / Redmi ---
  'midnight black': { hex: '#191A1E', isLight: false },
  'moonlight white': { hex: '#F8F9FA', isLight: true, border: '#D7DAE0' },
  'aurora green': { hex: '#16796F', isLight: false },
  'ocean blue': { hex: '#1F5FA6', isLight: false },
  'glacier blue': { hex: '#B5D5E8', isLight: true, border: '#84B1CE' },
  'star blue': { hex: '#26497B', isLight: false },
  'graphite gray': { hex: '#434449', isLight: false },
  'pearl white': { hex: '#EDEAE6', isLight: true, border: '#C7C2BA' },
  'cosmic black': { hex: '#141518', isLight: false },
  'poco yellow': { hex: '#FFCE00', isLight: true, border: '#D4AA00' },

  // --- Common Standards (FR & EN) ---
  'noir': { hex: '#121212', isLight: false },
  'black': { hex: '#121212', isLight: false },
  'blanc': { hex: '#FFFFFF', isLight: true, border: '#D1D5DB' },
  'white': { hex: '#FFFFFF', isLight: true, border: '#D1D5DB' },
  'gris': { hex: '#6B7280', isLight: false },
  'gray': { hex: '#6B7280', isLight: false },
  'grey': { hex: '#6B7280', isLight: false },
  'anthracite': { hex: '#374151', isLight: false },
  'titane': { hex: '#84827E', isLight: false },
  'titanium': { hex: '#84827E', isLight: false },
  'bleu nuit': { hex: '#1E3A8A', isLight: false },
  'navy': { hex: '#1E3A8A', isLight: false },
  'bleu ciel': { hex: '#38BDF8', isLight: true, border: '#0284C7' },
  'sky blue': { hex: '#38BDF8', isLight: true, border: '#0284C7' },
  'cyan': { hex: '#06B6D4', isLight: false },
  'turquoise': { hex: '#14B8A6', isLight: false },
  'vert foret': { hex: '#14532D', isLight: false },
  'forest green': { hex: '#14532D', isLight: false },
  'kaki': { hex: '#57534E', isLight: false },
  'khaki': { hex: '#57534E', isLight: false },
  'olive': { hex: '#65A30D', isLight: false },
  'rouge': { hex: '#DC2626', isLight: false },
  'red': { hex: '#DC2626', isLight: false },
  'bordeaux': { hex: '#881337', isLight: false },
  'corail': { hex: '#FB7185', isLight: true, border: '#F43F5E' },
  'coral': { hex: '#FB7185', isLight: true, border: '#F43F5E' },
  'orange': { hex: '#EA580C', isLight: false },
  'marron': { hex: '#78350F', isLight: false },
  'brown': { hex: '#78350F', isLight: false },
  'brun': { hex: '#78350F', isLight: false },
  'beige': { hex: '#F5F5DC', isLight: true, border: '#D4D4AA' },
  'cuivre': { hex: '#B45309', isLight: false },
  'copper': { hex: '#B45309', isLight: false },
};

/**
 * Keyword-based color roots for fuzzy matching arbitrary text
 */
const COLOR_KEYWORDS: Array<{ match: RegExp; color: ColorInfo }> = [
  { match: /\b(?:noir|black|dark|sombre|midnight|minuit|night)\b/i, color: { hex: '#1A1A1A', isLight: false } },
  { match: /\b(?:blanc|white|clear|clair|light|snow|pearl|perle)\b/i, color: { hex: '#FFFFFF', isLight: true, border: '#D1D5DB' } },
  { match: /\b(?:pourpre|purple|violet|lavande|lavender|lilac|mauve)\b/i, color: { hex: '#7C3AED', isLight: false } },
  { match: /\b(?:bleu|blue|navy|azure|azur|ocean|sky|ciel)\b/i, color: { hex: '#2563EB', isLight: false } },
  { match: /\b(?:vert|green|emerald|emeraude|mint|menthe|olive|sage)\b/i, color: { hex: '#16A34A', isLight: false } },
  { match: /\b(?:rouge|red|ruby|rubis|crimson|bordeaux|burgundy)\b/i, color: { hex: '#DC2626', isLight: false } },
  { match: /\b(?:rose|pink|corail|coral|salmon|saumon|peach|peche)\b/i, color: { hex: '#EC4899', isLight: true, border: '#DB2777' } },
  { match: /\b(?:jaune|yellow|lemon|citron|amber|ambre)\b/i, color: { hex: '#FACC15', isLight: true, border: '#EAB308' } },
  { match: /\b(?:or|gold|dore|champagne)\b/i, color: { hex: '#F59E0B', isLight: true, border: '#D97706' } },
  { match: /\b(?:argent|silver|titane|titanium|gris|gray|grey|steel|acier)\b/i, color: { hex: '#9CA3AF', isLight: true, border: '#6B7280' } },
  { match: /\b(?:orange|bronze|copper|cuivre|rouille|rust)\b/i, color: { hex: '#EA580C', isLight: false } },
  { match: /\b(?:marron|brown|brun|chocolat|moka|coffee|cafe)\b/i, color: { hex: '#78350F', isLight: false } },
];

/**
 * Removes accents and normalizes text for clean dictionary matching
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Validates if a string is a recognized standard CSS color or hex
 */
function isValidCssColor(str: string): boolean {
  if (typeof window === 'undefined') return false;
  if (/^#([0-9A-F]{3}){1,2}$/i.test(str)) return true;
  const s = new Option().style;
  s.color = str;
  return s.color !== '';
}

/**
 * Generates a deterministic, aesthetically pleasing HSL color from any arbitrary text
 */
function hashToColor(str: string): ColorInfo {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  // Use a metallic/refined smartphone tone: 45% saturation, 50% lightness
  const hex = `hsl(${hue}, 48%, 52%)`;
  return {
    hex,
    isLight: false,
  };
}

/**
 * Resolves ANY user-entered color string to a ColorInfo object with hex, border, and light/dark status.
 */
export function getPhoneColor(colorInput?: string | null): ColorInfo {
  if (!colorInput || !colorInput.trim()) {
    return { hex: '#6B7280', isLight: false }; // Neutral gray default
  }

  const raw = colorInput.trim();
  const normalized = normalizeString(raw);

  // 1. Direct exact phone color match
  if (EXACT_PHONE_COLORS[normalized]) {
    return EXACT_PHONE_COLORS[normalized];
  }

  // 2. Direct hex code entered by user
  if (/^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(raw)) {
    const isLight = isColorLight(raw);
    return {
      hex: raw,
      isLight,
      border: isLight ? '#D1D5DB' : undefined,
    };
  }

  // 3. Keyword matching (e.g. "Bleu Nuit Foncé", "Gris Titane Clair", "Deep Purple Pro")
  for (const { match, color } of COLOR_KEYWORDS) {
    if (match.test(raw)) {
      return color;
    }
  }

  // 4. Valid native CSS color names (e.g. "teal", "plum", "crimson", "ivory")
  if (isValidCssColor(raw)) {
    return {
      hex: raw,
      isLight: isColorLight(raw),
      border: '#D1D5DB',
    };
  }

  // 5. Deterministic fallback for completely unique/unknown words
  return hashToColor(normalized);
}

/**
 * Evaluates whether a hex code is visually light to apply contrast borders
 */
function isColorLight(color: string): boolean {
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 185;
  }
  return false;
}
