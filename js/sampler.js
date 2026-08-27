const LEVEL_DATA = {
  2: window.WSET_DATA_2,
  3: window.WSET_DATA_3,
};

function loadLevelData(level) {
  const data = LEVEL_DATA[level];
  if (!data) throw new Error(`No embedded dataset found for level ${level}`);
  return data;
}

function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Draws a paper at the dataset's official per-LO weighting, taking at most one
// question per topic|subtopic concept so a paper never repeats the same fact twice.
function assembleMcqPaper(levelData) {
  const weighting = levelData.exam.lo_weighting;
  const pool = levelData.questions.filter((q) => q.format === 'mcq' && !q.review_flag);

  const byLo = new Map();
  for (const q of pool) {
    if (!byLo.has(q.lo)) byLo.set(q.lo, []);
    byLo.get(q.lo).push(q);
  }

  const usedConcepts = new Set();
  const usedIds = new Set();
  const paper = [];

  for (const [loKey, count] of Object.entries(weighting)) {
    const lo = Number(loKey);
    const candidates = shuffle(byLo.get(lo) || []);
    let picked = 0;

    for (const q of candidates) {
      if (picked >= count) break;
      const conceptKey = `${q.topic}|${q.subtopic}`;
      if (usedConcepts.has(conceptKey)) continue;
      usedConcepts.add(conceptKey);
      usedIds.add(q.id);
      paper.push(q);
      picked++;
    }

    if (picked < count) {
      for (const q of candidates) {
        if (picked >= count) break;
        if (usedIds.has(q.id)) continue;
        usedIds.add(q.id);
        paper.push(q);
        picked++;
      }
    }
  }

  return shuffle(paper);
}

// Level 3 short written answer papers have four fixed slots with a defined
// assessment mix; a real paper takes exactly one question per slot.
function assembleSwaPaper(levelData) {
  const pool = levelData.questions.filter(
    (q) => q.format === 'swa' && !q.review_flag && q.paper_slot
  );

  const bySlot = new Map();
  for (const q of pool) {
    if (!bySlot.has(q.paper_slot)) bySlot.set(q.paper_slot, []);
    bySlot.get(q.paper_slot).push(q);
  }

  const paper = [];
  for (const slot of [1, 2, 3, 4]) {
    const candidates = bySlot.get(slot) || [];
    if (candidates.length) {
      paper.push(candidates[Math.floor(Math.random() * candidates.length)]);
    }
  }
  return paper;
}
