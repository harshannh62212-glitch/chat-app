import { supabase } from '../supabase';

export const BANNED_WORDS = [
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

let customBannedWords = [];

// Load custom banned words from Supabase
export async function loadCustomBannedWords() {
  try {
    const { data, error } = await supabase.from('banned_words').select('word');
    if (error) throw error;
    customBannedWords = data.map(r => r.word.toLowerCase());
  } catch (err) {
    console.error('Failed to load custom banned words:', err);
  }
}

export function filterContent(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let filtered = text;

  // Filter default words
  BANNED_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filtered = filtered.replace(regex, '*'.repeat(word.length));
  });

  // Filter custom words
  customBannedWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filtered = filtered.replace(regex, '*'.repeat(word.length));
  });

  return filtered;
}
