import axios from 'axios';

export const BANNED_WORDS = [
  // Mild profanity
  'damn', 'crap', 'piss', 'bitch', 'bastard', 'ass', 'asshole',
  'dammit', 'goddamn', 'crappy', 'shitty',
  'assholes',
  'dumbass', 'jackass', 'smartass', 'lardass', 'badass',
  'fuck', 'fucker', 'fuckers', 'fucking', 'fucked', 'fuckhead', 'fuckface',
  'fck', 'fcked', 'fckin', 'fckn', 'fcker', 'fuk', 'fukk', 'fuc',
  'motherfucker', 'motherfucking', 'clusterfuck',
  'shit', 'shitty', 'shitting', 'shithead', 'bullshit', 'horseshit',
  'dick', 'dickhead', 'dickface',
  'cock', 'cocksucker', 'cocks',
  'cunt', 'cunts',
  'twat', 'wanker', 'tosser', 'minge',

  // Sexual / Porn terms
  'porn', 'porno', 'pornography', 'pornographic',
  'nude', 'nudes', 'naked', 'nudity',
  'sex', 'sexy', 'sexting', 'sexted',
  'nsfw', 'xxx', 'x-rated', 'xrated',
  'penis', 'vagina', 'vulva', 'anus', 'rectum',
  'boob', 'boobs', 'tit', 'tits', 'titties', 'titty', 'boobies',
  'nipple', 'nipples',
  'butt', 'butthole', 'arse',
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

  // Racial & Ethnic Slurs
  'nigga', 'nigger', 'nigguh', 'niggah', 'nig',
  'chink', 'gook', 'jap', 'kraut',
  'paki', 'towelhead', 'raghead', 'camel jockey',
  'wetback', 'beaner', 'spic', 'spick',
  'kike', 'hymie', 'heeb',
  'cracker', 'redneck', 'white trash',
  'coon', 'sambo', 'pickaninny',

  // Homophobic / Transphobic
  'faggot', 'faggots', 'fag', 'fags', 'dyke',
  'homo', 'queer',
  'tranny', 'shemale',

  // Ableist
  'retard', 'retarded', 'tard', 'moron', 'imbecile',

  // Self-harm / Violence
  'kys', 'kms', 'kill yourself', 'neck yourself', 'hang yourself',
  'slit your wrists',

  // Other
  'junkie', 'crackhead', 'meth', 'heroin', 'cocaine'
];

export const BYPASS_PATTERNS = [
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
  /(?<![a-z])(ass)(?:hole|hat|wipe|clown|face|head|bag)(?![a-z])/gi,
  /(?<![a-z])ass(?:es)?(?![a-z])/gi,
  /(?<![a-z])[a@4][s$5]{2}(?![a-z])/gi,

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

export async function loadCustomBannedWords() {
  try {
    const res = await axios.get('/api/admin/banned-words');
    if (res.data) {
      customBannedWords = res.data.map(r => (r.word || r).toLowerCase());
    }
  } catch (err) {
    // Fail silently if not admin
  }
}

export function containsBannedWords(text) {
  if (!text || typeof text !== 'string') return { blocked: false, reason: null };
  const lower = text.toLowerCase();

  for (const pattern of BYPASS_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(lower)) {
      return { blocked: true, reason: 'bypass_pattern' };
    }
  }

  for (const word of BANNED_WORDS) {
    if (lower.includes(word.toLowerCase())) {
      return { blocked: true, reason: `banned_word:${word}` };
    }
  }

  for (const word of customBannedWords) {
    if (lower.includes(word.toLowerCase())) {
      return { blocked: true, reason: `custom_word:${word}` };
    }
  }

  return { blocked: false, reason: null };
}

export function filterContent(text) {
  if (!text || typeof text !== 'string') return text;
  let filtered = text;

  // Filter bypass patterns first
  BYPASS_PATTERNS.forEach(pattern => {
    pattern.lastIndex = 0;
    filtered = filtered.replace(pattern, match => '*'.repeat(match.length));
  });

  // Filter default words
  BANNED_WORDS.forEach(word => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    filtered = filtered.replace(regex, match => '*'.repeat(match.length));
  });

  // Filter custom words
  customBannedWords.forEach(word => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    filtered = filtered.replace(regex, match => '*'.repeat(match.length));
  });

  return filtered;
}
