/**
 * Content Filter — Hardened v2
 * Layer 1: instant keyword + pattern matching (catches 99% of explicit content)
 * Layer 2: AI moderation (async, catches bypass attempts and context)
 */

// ─── BANNED WORD LIST ────────────────────────────────────────────────────────
const BANNED_WORDS = [
  // Mild profanity
  'damn', 'crap', 'piss', 'bitch', 'bastard', 'ass', 'asshole',
  'dammit', 'goddamn', 'crappy', 'shitty',
  // Note: 'hell' removed from standalone list — too many false positives (game difficulty, 'hello' etc.)
  'assholes',
  'dumbass', 'jackass', 'smartass', 'lardass', 'badass',
  'fuck', 'fucker', 'fuckers', 'fucking', 'fucked', 'fuckhead', 'fuckface',
  'fck', 'fcked', 'fckin', 'fckn', 'fcker', 'fuk', 'fukk', 'fuc',
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
  // ── fuck / fck ──
  /(?<![a-z])f[\s\W_]*[*@#$%.~_\-]*[\s\W_]*[u0o*@4v]*[\s\W_]*c*[\s\W_]*k+(?:ing|in|ed|er|s|z)?(?![a-z])/gi,
  /(?<![a-z])f[\s\W_]*[u0o*@4v]+[\s\W_]*c*(?![a-z])/gi,
  /ph[u*]*c*k+(?:ing|in|ed|er|s|z)?/gi,
  /f\*+k+/gi,

  // ── shit / sht ──
  /(?<![a-z])s[\s\W_]*[$5h]*[\s\W_]*[i1!ïí*@#$%.~_\-]*[\s\W_]*t+(?:ting|tin|ted|ty|head|ing|in|s)?(?![a-z])/gi,
  /\$h[i1!][t7]/gi,

  // ── bitch / btch ──
  /(?<![a-z])b[\s\W_]*[i1!ïíy*@#$%.~_\-]*[\s\W_]*t*[\s\W_]*c+[\s\W_]*h+(?:es|ing|in|ed)?(?![a-z])/gi,

  // ── ass variants ──
  /(?:^|[\s,!?.])(ass)(?:hole|hat|wipe|clown|face|head|bag|$|[\s,!?.])/gi,
  /(?<![a-z])[a@4][s$5]{2}(?!ass|in|ign)/gi,

  // ── cunt / cnt ──
  /(?<![a-z])c[\s\W_]*[u0o*@#$%.~_\-]*[\s\W_]*n+[\s\W_]*t+(?:s)?(?![a-z])/gi,
  /k[u*]*n[t]/gi,

  // ── dick / dck ──
  /(?<![a-z])d[\s\W_]*[i1!ïí*@#$%.~_\-]*[\s\W_]*c*[\s\W_]*k+(?:head|face|s)?(?![a-z])/gi,

  // ── cock / cck (NOT cook, book, look, hook, took) ──
  /(?:^|[\s,!?.])c[\s\W_]*[o0*@#$%.~_\-]?[\s\W_]*c+[\s\W_]*k+(?:sucker|head|face|$|[\s,!?.])/gi,
  /c[\s\W_]*o[\s\W_]*c[\s\W_]*k[\s\W_]*s[\s\W_]*u/gi,

  // ── n-word / ngr / nigger ──
  /(?<![a-z])n[\s\W_]*[i1!ïí*@#$%.~_\-]*[\s\W_]*g+[\s\W_]*g*[\s\W_]*[ae@3*uor]+(?:h|s|er)?(?![a-z])/gi,
  /(?<![a-z])n[\s\W_]*g+[\s\W_]*r+(?![a-z])/gi,

  // ── faggot / fag / fgt ──
  /(?<![a-z])f[\s\W_]*[a@4*#$%.~_\-]*[\s\W_]*g+[\s\W_]*g*[\s\W_]*[ot0]+(?:s)?(?![a-z])/gi,
  /(?<![a-z])f[\s\W_]*[a@4*#$%.~_\-]*[\s\W_]*g+(?:s)?(?![a-z])/gi,

  // ── pussy / pssy ──
  /(?<![a-z])p[\s\W_]*[u0*#$%.~_\-]*[\s\W_]*s+[\s\W_]*s*[\s\W_]*[yiie]+(?:s)?(?![a-z])/gi,

  // ── retard / rtd ──
  /(?<![a-z])r[\s\W_]*e*[\s\W_]*t*[\s\W_]*[a@4*]*[\s\W_]*r+[\s\W_]*d+(?:ed|s)?(?![a-z])/gi,
  /(?<![a-z])rtd(?![a-z])/gi,

  // ── slut / whore ──
  /(?<![a-z])s[\s\W_]*l*[\s\W_]*[u0*#$%.~_\-]*[\s\W_]*t+(?:s)?(?![a-z])/gi,
  /(?<![a-z])w[\s\W_]*h+[\s\W_]*[o0*#$%.~_\-]*[\s\W_]*r+[\s\W_]*[e3]*(?:s)?(?![a-z])/gi,

  // ── porn / sex / nude ──
  /(?:^|[\s,!?.])p[\s\W_]*o[\s\W_]*r[\s\W_]*n(?:$|[\s,!?.]|hub|ography|star|site)/gi,
  /p[o0]r[n]/gi,
  /pr[o0][n]/gi,
  /(?:^|[\s,!?.])s[\s\W_]*e[\s\W_]*x(?:$|[\s,!?.]|ting|ted|ual\s+act|cam|tape)/gi,
  /s[3][x]/gi,
  /n[\s\W_]*u[\s\W_]*d[\s\W_]*[e3]/gi,
  /n[o0][o0]d[s]?/gi,
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
    if (pattern.test(normalized)) {
      return { blocked: true, reason: 'bypass_pattern' };
    }
    pattern.lastIndex = 0; // reset stateful regex
    if (pattern.test(lower)) {
      return { blocked: true, reason: 'bypass_pattern' };
    }
  }

  // Check word list on both original and normalized text (includes concatenated words like 'fuckbitch')
  for (const word of BANNED_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (lower.includes(word.toLowerCase()) || normalized.includes(word.toLowerCase())) {
      return { blocked: true, reason: `banned_word:${word}` };
    }
  }

  // Check custom DB words
  for (const word of customBannedWords) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (lower.includes(word.toLowerCase()) || normalized.includes(word.toLowerCase())) {
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

  // Replace word list (includes concatenated words)
  for (const word of BANNED_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    filtered = filtered.replace(regex, (match) => '*'.repeat(match.length));
  }

  // Replace custom words
  for (const word of customBannedWords) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    filtered = filtered.replace(regex, (match) => '*'.repeat(match.length));
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
