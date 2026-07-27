/**
 * Bypass Technique Tester
 * Tests the most common real-world bypass attempts against the production filter
 * Run: node tests/bypass_test.js
 */

const path = require('path');
const { containsBannedWords } = require(path.join(__dirname, '../utils/contentFilter'));

const BYPASS_TESTS = [
  // ── CATEGORY 1: Leet speak (number/symbol substitution) ──
  { text: 'f4ck you',         category: 'leetspeak',    expect: 'block' },
  { text: 'fvck this',        category: 'leetspeak',    expect: 'block' },
  { text: 'fuuuck',           category: 'leetspeak',    expect: 'block' },
  { text: 'sh1t',             category: 'leetspeak',    expect: 'block' },
  { text: '$hit game',        category: 'leetspeak',    expect: 'block' },
  { text: 'b1tch',            category: 'leetspeak',    expect: 'block' },
  { text: 'a$$hole',          category: 'leetspeak',    expect: 'block' },
  { text: 'n!gga',            category: 'leetspeak',    expect: 'block' },
  { text: 'pr0n link',        category: 'leetspeak',    expect: 'block' },
  { text: 'n00ds please',     category: 'leetspeak',    expect: 'block' },
  { text: 's3x me',           category: 'leetspeak',    expect: 'block' },
  { text: 'p0rn site',        category: 'leetspeak',    expect: 'block' },

  // ── CATEGORY 2: Asterisk/symbol as vowel ──
  { text: 'f*ck off',         category: 'asterisk',     expect: 'block' },
  { text: 's*it happens',     category: 'asterisk',     expect: 'block' },
  { text: 'b*tch move',       category: 'asterisk',     expect: 'block' },
  { text: 'c*nt face',        category: 'asterisk',     expect: 'block' },
  { text: 'd*ck pic',         category: 'asterisk',     expect: 'block' },
  { text: 'n*gga please',     category: 'asterisk',     expect: 'block' },

  // ── CATEGORY 3: Spaces/dots between letters ──
  { text: 'f u c k you',      category: 'spacing',      expect: 'block' },
  { text: 's.h.i.t. game',    category: 'spacing',      expect: 'block' },
  { text: 'f-u-c-k this',     category: 'spacing',      expect: 'block' },
  { text: 'p o r n hub',      category: 'spacing',      expect: 'block' },
  { text: 'n-i-g-g-a',        category: 'spacing',      expect: 'block' },

  // ── CATEGORY 4: Extra repeated letters ──
  { text: 'fuuuuck you',      category: 'repetition',   expect: 'block' },
  { text: 'shiiit bro',       category: 'repetition',   expect: 'block' },
  { text: 'niggaaaa',         category: 'repetition',   expect: 'block' },
  { text: 'faaagg',           category: 'repetition',   expect: 'block' },

  // ── CATEGORY 5: Unicode lookalikes / accented characters ──
  { text: 'fück you',         category: 'unicode',      expect: 'block' },
  { text: 'shït game',        category: 'unicode',      expect: 'block' },
  { text: 'bïtch',            category: 'unicode',      expect: 'block' },
  { text: 'pörn',             category: 'unicode',      expect: 'block' },
  { text: 'séx tape',         category: 'unicode',      expect: 'block' },

  // ── CATEGORY 6: Phonetic/creative spelling ──
  { text: 'phuck this',       category: 'phonetic',     expect: 'block' },
  { text: 'shiat game',       category: 'phonetic',     expect: 'block' },
  { text: 'bytch move',       category: 'phonetic',     expect: 'block' },

  // ── CATEGORY 7: Camel case / mixed case ──
  { text: 'FuCk You',         category: 'mixed_case',   expect: 'block' },
  { text: 'ShIt Game',        category: 'mixed_case',   expect: 'block' },
  { text: 'PORN LINK',        category: 'mixed_case',   expect: 'block' },
  { text: 'NiGgA',            category: 'mixed_case',   expect: 'block' },

  // ── CATEGORY 8: Zero-width / invisible characters ──
  { text: 'f\u200Buck',       category: 'zero_width',   expect: 'block' },  // zero-width space in 'fuck'
  { text: 'sh\u200Bit',       category: 'zero_width',   expect: 'block' },
  { text: 'ni\u200Bgga',      category: 'zero_width',   expect: 'block' },

  // ── CATEGORY 9: Slang / coded language ──
  { text: 'send noods',       category: 'slang',        expect: 'block' },
  { text: 'onlyfans link',    category: 'slang',        expect: 'block' },
  { text: 'kys loser',        category: 'slang',        expect: 'block' },
  { text: 'kms today',        category: 'slang',        expect: 'block' },

  // ── CATEGORY 10: FALSE POSITIVES (clean messages that should pass) ──
  { text: 'Who else is excited for the weekend?', category: 'false_pos',  expect: 'allow' },
  { text: 'The class assignment is due',          category: 'false_pos',  expect: 'allow' },
  { text: 'Great pass in the game!',              category: 'false_pos',  expect: 'allow' },
  { text: 'Bass fishing is relaxing',             category: 'false_pos',  expect: 'allow' },
  { text: 'The massacre happened in history',     category: 'false_pos',  expect: 'allow' },
  { text: 'I love playing Assassins Creed',       category: 'false_pos',  expect: 'allow' },
  { text: 'cockney accent is funny',              category: 'false_pos',  expect: 'allow' },  // edge case
  { text: 'I need help with my homework',         category: 'false_pos',  expect: 'allow' },
  { text: 'scunthorpe is a city in england',      category: 'false_pos',  expect: 'allow' },  // famous false pos
  { text: 'the hell difficulty is hardest',       category: 'false_pos',  expect: 'allow' },
];

function runTests() {
  const categories = {};
  let totalBlocked = 0, totalAllowed = 0;
  let correctBlock = 0, missedBlock = 0;
  let correctAllow = 0, wrongAllow = 0;

  const results = BYPASS_TESTS.map(test => {
    const { blocked, reason } = containsBannedWords(test.text);
    const correct = (test.expect === 'block' && blocked) || (test.expect === 'allow' && !blocked);

    if (!categories[test.category]) categories[test.category] = { pass: 0, fail: 0, total: 0 };
    categories[test.category].total++;
    if (correct) categories[test.category].pass++;
    else categories[test.category].fail++;

    if (test.expect === 'block') {
      blocked ? correctBlock++ : missedBlock++;
    } else {
      !blocked ? correctAllow++ : wrongAllow++;
    }

    return { ...test, blocked, reason, correct };
  });

  // ── Print results ──────────────────────────────────────────────────────────
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║           BYPASS TECHNIQUE TEST — PRODUCTION FILTER          ║');
  console.log('╠═══════════════════════════════════════════════════════════════╣');

  let currentCat = '';
  results.forEach(r => {
    if (r.category !== currentCat) {
      currentCat = r.category;
      const label = {
        leetspeak: '⚙️  LEETSPEAK (number/symbol substitution)',
        asterisk:  '✳️  ASTERISK AS VOWEL (f*ck, b*tch)',
        spacing:   '🔤  SPACING/DOTS BETWEEN LETTERS',
        repetition:'🔁  EXTRA REPEATED LETTERS',
        unicode:   '🌍  UNICODE LOOKALIKES / ACCENTED',
        phonetic:  '🔊  PHONETIC SPELLING',
        mixed_case:'🔠  MIXED CASE',
        zero_width:'👻  ZERO-WIDTH INVISIBLE CHARACTERS',
        slang:     '💬  SLANG / CODED LANGUAGE',
        false_pos: '✅  FALSE POSITIVE CHECK (should allow)',
      }[r.category] || r.category;
      console.log(`║                                                               ║`);
      console.log(`║  ${label.padEnd(61)}║`);
    }
    const icon = r.correct ? (r.expect === 'block' ? '🚫' : '✅') : (r.expect === 'block' ? '❌' : '⚠️ ');
    const status = r.blocked ? 'BLOCKED' : 'ALLOWED';
    const display = `${icon} "${r.text}"`;
    console.log(`║    ${display.substring(0, 54).padEnd(55)} ${status.padEnd(7)}║`);
  });

  console.log('║                                                               ║');
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  console.log('║  RESULTS BY CATEGORY:                                         ║');

  Object.entries(categories).forEach(([cat, data]) => {
    const pct = ((data.pass / data.total) * 100).toFixed(0);
    const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
    const label = cat.padEnd(12);
    console.log(`║  ${label} ${bar} ${pct}%  (${data.pass}/${data.total})${' '.repeat(Math.max(0, 14 - String(data.pass+'/'+data.total).length))}║`);
  });

  const totalBad = BYPASS_TESTS.filter(t => t.expect === 'block').length;
  const totalGood = BYPASS_TESTS.filter(t => t.expect === 'allow').length;
  const catchPct = ((correctBlock / totalBad) * 100).toFixed(1);
  const fpPct = ((wrongAllow / totalGood) * 100).toFixed(1);

  console.log('║                                                               ║');
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  console.log(`║  🎯 BYPASS CATCH RATE:    ${(catchPct + '%  (' + correctBlock + '/' + totalBad + ' blocked)').padEnd(37)}║`);
  console.log(`║  ⚠️  FALSE POSITIVE RATE: ${(fpPct + '%  (' + wrongAllow + '/' + totalGood + ' wrongly blocked)').padEnd(37)}║`);
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  if (missedBlock > 0) {
    console.log('❌ BYPASSES THAT SLIPPED THROUGH (need fixing):');
    results.filter(r => r.expect === 'block' && !r.blocked).forEach(r => {
      console.log(`   → "${r.text}"  [${r.category}]`);
    });
    console.log('');
  }
  if (wrongAllow > 0) {
    console.log('⚠️  FALSE POSITIVES (clean messages wrongly blocked):');
    results.filter(r => r.expect === 'allow' && r.blocked).forEach(r => {
      console.log(`   → "${r.text}"  reason: ${r.reason}`);
    });
  }
}

runTests();
