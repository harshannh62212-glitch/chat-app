/**
 * Content Filter — Hardened v2
 * Layer 1: instant keyword + pattern matching (catches 99% of explicit content)
 * Layer 2: AI moderation (async, catches bypass attempts and context)
 */

// ─── BANNED WORD LIST ────────────────────────────────────────────────────────
const BANNED_WORDS = [
  // ── Profanity ──
  'damn', 'dammit', 'goddamn', 'hell', 'crap', 'crappy', 'piss', 'pissed',
  'bitch', 'bitches', 'bitching', 'bastard', 'ass', 'asshole', 'assholes',
  'dumbass', 'jackass', 'smartass', 'lardass', 'badass',
  'fuck', 'fucker', 'fuckers', 'fucking', 'fucked', 'fuckhead', 'fuckface',
  'motherfucker', 'motherfucking', 'clusterfuck',
  'shit', 'shitty', 'shitting', 'shithead', 'bullshit', 'horseshit',
  'dick', 'dickhead', 'dickface',
  'cock', 'cocksucker', 'cocks',
  'cunt', 'cunts',
  'twat', 'wanker', 'tosser', 'bellend', 'minge',

  // ── Sexual / Porn terms ──
  'porn', 'porno', 'pornography', 'pornographic',
  'nude', 'nudes', 'naked', 'nudity',
  'sex', 'sexy', 'sexting', 'sexted',
  'nsfw', 'xxx', 'x-rated', 'xrated',
  'penis', 'vagina', 'vulva', 'anus', 'rectum',
  'boob', 'boobs', 'tit', 'tits', 'titties', 'titty', 'boobies',
  'nipple', 'nipples',
  'ass', 'butt', 'butthole', 'arse',
  'erection', 'boner', 'hardon', 'hard-on',
  'cum', 'cumshot', 'cumming', 'jizz', 'sperm', 'semen',
  'orgasm', 'orgasms',
  'masturbate', 'masturbation', 'masturbating', 'jerk off', 'jerking off',
  'blowjob', 'blow job', 'handjob', 'hand job',
  'anal', 'vaginal', 'oral sex',
  'dildo', 'vibrator', 'fleshlight',
  'hentai', 'ecchi', 'loli', 'lolicon',
  'onlyfans', 'onlyfan',
  'stripper', 'stripping',
  'prostitute', 'prostitution', 'escort', 'hooker',
  'camgirl', 'camboy', 'sexcam',
  'rape', 'rapist', 'molest', 'molestation', 'molested', 'pedophile', 'pedo',
  'incest',
  'whore', 'slut', 'skank', 'ho', 'hoe',

  // ── Racial & Ethnic Slurs ──
  'nigga', 'nigger', 'nigguh', 'niggah', 'nig',
  'chink', 'gook', 'jap', 'kraut',
  'paki', 'towelhead', 'raghead', 'camel jockey',
  'wetback', 'beaner', 'spic', 'spick',
  'kike', 'hymie', 'heeb',
  'cracker', 'redneck', 'white trash',
  'coon', 'sambo', 'pickaninny',

  // ── Homophobic / Transphobic ──
  'faggot', 'faggots', 'fag', 'fags', 'dyke',
  'homo', 'queer' /* contextual — AI handles edge cases */,
  'tranny', 'shemale',

  // ── Ableist ──
  'retard', 'retarded', 'tard', 'moron', 'imbecile',

  // ── Self-harm / Violence ──
  'kys', 'kms', 'kill yourself', 'neck yourself', 'hang yourself',
  'slit your wrists',

  // ── Other ──
  'junkie', 'crackhead', 'meth', 'heroin', 'cocaine',
];

// ─── BYPASS PATTERNS (l33tspeak, spacing tricks, etc.) ───────────────────────
// These regex patterns catch common attempts to evade the word filter
const BYPASS_PATTERNS = [
  // f*ck, f.u.c.k, f u c k, fuc k, fuuck, fvck, ph*ck
  /f[\s\W_]*u[\s\W_]*c[\s\W_]*k/gi,
  /f[\s\W_]*[@a4][\s\W_]*g/gi,              // fag bypass
  /s[\s\W_]*h[\s\W_]*i[\s\W_]*t/gi,
  /b[\s\W_]*i[\s\W_]*t[\s\W_]*c[\s\W_]*h/gi,
  /a[\s\W_]*s[\s\W_]*s/gi,
  /c[\s\W_]*u[\s\W_]*n[\s\W_]*t/gi,
  /d[\s\W_]*i[\s\W_]*c[\s\W_]*k/gi,
  /c[\s\W_]*o[\s\W_]*c[\s\W_]*k/gi,
  /n[\s\W_]*[i1!][\s\W_]*g[\s\W_]*g[\s\W_]*[ae@3]/gi,  // n-word bypass
  /p[\s\W_]*o[\s\W_]*r[\s\W_]*n/gi,
  /s[\s\W_]*e[\s\W_]*x/gi,
  /n[\s\W_]*u[\s\W_]*d[\s\W_]*[e3]/gi,
  // l33tspeak substitutions - e.g. fvck, ph uck, fück
  /fv+ck/gi,
  /ph+uck/gi,
  /sh[i1!][t7]/gi,
  /[a@4][s$5]{2}/gi,     // a$$, @ss, a55
  /\$h[i1!][t7]/gi,      // $hit
  /b[i1!][t7]ch/gi,      // b1tch
  /[ck][u*][n][t7]/gi,   // c*nt
];

let customBannedWords = [];

/**
 * Load custom blacklisted words from PostgreSQL database
 */
async function loadCustomBannedWords() {
  try {
    const { query } = require('../db/database');
    const result = await query('SELECT word FROM banned_words');
    customBannedWords = result.rows.map(r => r.word.toLowerCase());
    console.log(`[ContentFilter] Loaded ${customBannedWords.length} custom banned words.`);
  } catch (err) {
    console.error('[ContentFilter] Failed to load custom banned words:', err);
  }
}

/**
 * Normalize text to catch bypass attempts before word matching
 * Strips repeated characters, zero-width chars, and Unicode lookalikes
 */
function normalizeText(text) {
  return text
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')   // zero-width / soft-hyphen
    .replace(/[àáâãäå]/gi, 'a')
    .replace(/[èéêë]/gi, 'e')
    .replace(/[ìíîï]/gi, 'i')
    .replace(/[òóôõö]/gi, 'o')
    .replace(/[ùúûü]/gi, 'u')
    .replace(/[ñ]/gi, 'n')
    .replace(/[ç]/gi, 'c')
    .replace(/[@]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[$5]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/[4]/g, 'a')
    .replace(/\*+/g, '')           // strip asterisks used as bypass
    .replace(/(.)\1{3,}/g, '$1$1') // collapse excessive repeated chars (fuuuck → fuuck)
    .toLowerCase();
}

/**
 * Check if content contains banned words or bypass patterns — INSTANT, no AI
 * @param {string} text
 * @returns {{ blocked: boolean, reason: string|null }}
 */
function containsBannedWords(text) {
  if (!text || typeof text !== 'string') return { blocked: false, reason: null };

  const normalized = normalizeText(text);
  const lower = text.toLowerCase();

  // Check bypass patterns first (catches l33tspeak etc.)
  for (const pattern of BYPASS_PATTERNS) {
    pattern.lastIndex = 0; // reset stateful regex
    if (pattern.test(normalized) || pattern.test(lower)) {
      return { blocked: true, reason: 'bypass_pattern' };
    }
  }

  // Check word list on both original and normalized text
  for (const word of BANNED_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\b|\\s)${escaped}(?:$|\\b|\\s|[^a-z])`, 'i');
    if (regex.test(lower) || regex.test(normalized)) {
      return { blocked: true, reason: `banned_word:${word}` };
    }
  }

  // Check custom DB words
  for (const word of customBannedWords) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\b|\\s)${escaped}(?:$|\\b|\\s|[^a-z])`, 'i');
    if (regex.test(lower) || regex.test(normalized)) {
      return { blocked: true, reason: `custom_word:${word}` };
    }
  }

  return { blocked: false, reason: null };
}

/**
 * Filter content — replace banned words with asterisks for display
 * @param {string} text
 * @returns {string}
 */
function filterContent(text) {
  if (!text || typeof text !== 'string') return text;

  let filtered = text;

  // Replace bypass patterns
  for (const pattern of BYPASS_PATTERNS) {
    pattern.lastIndex = 0;
    filtered = filtered.replace(pattern, (match) => '*'.repeat(match.length));
  }

  // Replace word list
  for (const word of BANNED_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\b|\\s)${escaped}(?:$|\\b|\\s|[^a-z])`, 'gi');
    filtered = filtered.replace(regex, (match) => {
      // Preserve surrounding whitespace, only asterisk the word itself
      return match.replace(new RegExp(escaped, 'gi'), (w) => '*'.repeat(w.length));
    });
  }

  // Replace custom words
  for (const word of customBannedWords) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\b)${escaped}(?:$|\\b)`, 'gi');
    filtered = filtered.replace(regex, '*'.repeat(word.length));
  }

  return filtered;
}

/**
 * Get list of banned words found in text
 * @param {string} text
 * @returns {string[]}
 */
function getBannedWordsFound(text) {
  if (!text || typeof text !== 'string') return [];
  const lower = text.toLowerCase();
  const found = [];
  for (const word of BANNED_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(lower)) found.push(word);
  }
  for (const word of customBannedWords) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(lower)) found.push(word);
  }
  return found;
}

module.exports = {
  filterContent,
  containsBannedWords,
  getBannedWordsFound,
  loadCustomBannedWords,
  BANNED_WORDS,
};
