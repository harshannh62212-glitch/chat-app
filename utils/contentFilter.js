/**
 * Content Filter
 * Filters profanity, swearwords, and racist slurs
 * Replaces filtered content with asterisks
 */

const BANNED_WORDS = [
  // Mild profanity
  'damn', 'hell', 'crap', 'piss', 'bitch', 'bastard', 'ass', 'asshole',
  'dammit', 'goddamn', 'crappy', 'shitty',
  
  // Stronger profanity
  'fuck', 'fucking', 'fucked', 'fuckhead', 'motherfucker',
  'shit', 'shithead', 'bullshit', 'horseshit',
  'dick', 'dickhead', 'cock', 'cocksucker',
  'pussy', 'cunt',
  'whore', 'slut', 'skank',
  'twat', 'wanker', 'tosser',
  
  // Ethnic/nationality slurs
  'chink', 'gook', 'jap', 'kraut',
  'paki', 'towelhead', 'raghead', 'wetback', 'beaner',
  
  // Other derogatory terms
  'retard', 'retarded', 'tard',
  'faggot', 'fag', 'dyke', 'homo',
  'tranny', 'shemale',
  
  // Racial slurs (censored entries)
  'nigga', 'nigger', 'nigguh', 'niggah',
  'spic', 'spick',
  
  // Hate speech / Harm
  'kys', 'kms', 'neckyourself',
  
  // Additional offensive terms
  'prostitute', 'junkie', 'addict', 'druggie',
  'moron', 'idiot', 'imbecile', 'dumbass',
  'stupid', 'idiotic'
];

/**
 * Filter content and replace banned words
 * @param {string} text - The text to filter
 * @returns {string} - The filtered text
 */
function filterContent(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let filtered = text;

  BANNED_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filtered = filtered.replace(regex, '*'.repeat(word.length));
  });

  return filtered;
}

/**
 * Check if content contains banned words
 * @param {string} text - The text to check
 * @returns {boolean} - True if content contains banned words
 */
function containsBannedWords(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const lowerText = text.toLowerCase();
  return BANNED_WORDS.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(lowerText);
  });
}

/**
 * Get banned words that appear in text
 * @param {string} text - The text to check
 * @returns {Array} - Array of banned words found
 */
function getBannedWordsFound(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const found = [];
  const lowerText = text.toLowerCase();

  BANNED_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(lowerText)) {
      found.push(word);
    }
  });

  return found;
}

module.exports = {
  filterContent,
  containsBannedWords,
  getBannedWordsFound,
  BANNED_WORDS
};
