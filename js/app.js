const MODES = {
  2: [
    {
      id: 'mcq',
      label: 'Mock exam',
      desc: '50 multiple choice questions · 60 minutes · 55% pass mark',
      minutes: 60,
      sections: ['mcq'],
    },
  ],
  3: [
    {
      id: 'full',
      label: 'Full Unit 1 mock',
      desc: '50 MCQ + 4 short written answer questions · 120 minutes total · 55% pass mark on each part',
      minutes: 120,
      sections: ['mcq', 'swa'],
      note: 'Timing matches the published exam shape exactly.',
    },
    {
      id: 'mcq',
      label: 'MCQ theory practice',
      desc: '50 multiple choice questions · 60 minutes',
      minutes: 60,
      sections: ['mcq'],
      note: "WSET doesn't publish a sub-split for this portion — 60 minutes is a practice pacing estimate.",
    },
    {
      id: 'swa',
      label: 'Short written answer practice',
      desc: '4 questions, 100 marks total · 90 minutes',
      minutes: 90,
      sections: ['swa'],
      note: "WSET doesn't publish a sub-split for this portion — 90 minutes is a practice pacing estimate.",
    },
  ],
};

const state = {
  level: null,
  mode: null,
  levelData: null,
  items: [],
  answers: {},
  flags: {},
  currentIndex: 0,
  remainingSeconds: 0,
  timerId: null,
  submitted: false,
  swaMarks: {},
};

const views = {
  home: document.getElementById('view-home'),
  exam: document.getElementById('view-exam'),
  marking: document.getElementById('view-marking'),
  results: document.getElementById('view-results'),
};

function showView(name) {
  for (const key of Object.keys(views)) {
    views[key].classList.toggle('hidden', key !== name);
  }
  window.scrollTo(0, 0);
}

function formatClock(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

// ---------- Home ----------

function renderHome() {
  const levelCards = document.getElementById('level-cards');
  levelCards.querySelectorAll('.level-card').forEach((card) => {
    card.addEventListener('click', () => selectLevel(Number(card.dataset.level)));
  });
  renderModePicker(null);
}

let selectedLevel = null;

function selectLevel(level) {
  selectedLevel = level;
  document.querySelectorAll('.level-card').forEach((card) => {
    card.classList.toggle('selected', Number(card.dataset.level) === level);
  });
  renderModePicker(level);
}

function renderModePicker(level) {
  const container = document.getElementById('mode-picker');
  container.innerHTML = '';
  if (!level) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  const heading = document.createElement('h3');
  heading.textContent = `Level ${level} — choose a mock`;
  container.appendChild(heading);

  const list = document.createElement('div');
  list.className = 'mode-list';

  MODES[level].forEach((mode) => {
    const card = document.createElement('button');
    card.className = 'mode-card';
    card.type = 'button';
    card.innerHTML = `
      <div class="mode-card-title">${mode.label}</div>
      <div class="mode-card-desc">${mode.desc}</div>
      ${mode.note ? `<div class="mode-card-note">${mode.note}</div>` : ''}
    `;
    card.addEventListener('click', () => startExam(level, mode));
    list.appendChild(card);
  });

  container.appendChild(list);
}

// ---------- Exam setup ----------

async function startExam(level, mode) {
  const container = document.getElementById('mode-picker');
  container.classList.add('loading');
  try {
    const levelData = loadLevelData(level);

    const items = [];
    if (mode.sections.includes('mcq')) {
      for (const q of assembleMcqPaper(levelData)) {
        items.push({ type: 'mcq', data: q });
      }
    }
    if (mode.sections.includes('swa')) {
      for (const q of assembleSwaPaper(levelData)) {
        items.push({ type: 'swa', data: q });
      }
    }

    state.level = level;
    state.mode = mode;
    state.levelData = levelData;
    state.items = items;
    state.answers = {};
    state.flags = {};
    state.currentIndex = 0;
    state.remainingSeconds = mode.minutes * 60;
    state.submitted = false;
    state.swaMarks = {};

    renderExamShell();
    renderQuestion();
    startTimer();
    window.addEventListener('beforeunload', beforeUnloadGuard);
    showView('exam');
  } catch (err) {
    alert(`Could not start the exam: ${err.message}`);
  } finally {
    container.classList.remove('loading');
  }
}

function beforeUnloadGuard(e) {
  if (state.submitted) return;
  e.preventDefault();
  e.returnValue = '';
}

// ---------- Timer ----------

function startTimer() {
  clearInterval(state.timerId);
  updateTimerDisplay();
  state.timerId = setInterval(() => {
    state.remainingSeconds--;
    updateTimerDisplay();
    if (state.remainingSeconds <= 0) {
      clearInterval(state.timerId);
      submitExam(true);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const el = document.getElementById('exam-timer');
  el.textContent = formatClock(state.remainingSeconds);
  el.classList.toggle('timer-low', state.remainingSeconds <= 300 && state.remainingSeconds > 0);
}

// ---------- Exam shell & navigation ----------

function renderExamShell() {
  document.getElementById('exam-mode-label').textContent =
    `Level ${state.level} — ${state.mode.label}`;

  const nav = document.getElementById('question-nav');
  nav.innerHTML = '';
  state.items.forEach((item, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-btn';
    btn.textContent = String(i + 1);
    btn.addEventListener('click', () => {
      state.currentIndex = i;
      renderQuestion();
    });
    nav.appendChild(btn);
  });
  updateNavStates();

  document.getElementById('prev-btn').onclick = () => {
    if (state.currentIndex > 0) {
      state.currentIndex--;
      renderQuestion();
    }
  };
  document.getElementById('next-btn').onclick = () => {
    if (state.currentIndex < state.items.length - 1) {
      state.currentIndex++;
      renderQuestion();
    }
  };
  document.getElementById('submit-btn').onclick = () => confirmSubmit();
}

function updateNavStates() {
  const buttons = document.querySelectorAll('#question-nav .nav-btn');
  buttons.forEach((btn, i) => {
    const item = state.items[i];
    const answered = isAnswered(item);
    btn.classList.toggle('current', i === state.currentIndex);
    btn.classList.toggle('answered', answered);
    btn.classList.toggle('flagged', !!state.flags[item.data.id]);
  });
}

function isAnswered(item) {
  const ans = state.answers[item.data.id];
  if (item.type === 'mcq') return !!ans;
  if (item.type === 'swa') {
    return !!ans && item.data.parts.every((p) => (ans[p.ref] || '').trim().length > 0);
  }
  return false;
}

// ---------- Question rendering ----------

function renderQuestion() {
  const item = state.items[state.currentIndex];
  const panel = document.getElementById('question-panel');
  panel.innerHTML = '';

  const progress = document.getElementById('exam-progress');
  progress.textContent = `Question ${state.currentIndex + 1} of ${state.items.length}`;

  const section = document.createElement('div');
  section.className = 'question-section-label';
  section.textContent = item.type === 'mcq' ? 'Section A — Multiple choice' : 'Section B — Short written answer';
  panel.appendChild(section);

  if (item.type === 'mcq') {
    panel.appendChild(renderMcqQuestion(item.data));
  } else {
    panel.appendChild(renderSwaQuestion(item.data));
  }

  const flagRow = document.createElement('label');
  flagRow.className = 'flag-row';
  const flagCheckbox = document.createElement('input');
  flagCheckbox.type = 'checkbox';
  flagCheckbox.checked = !!state.flags[item.data.id];
  flagCheckbox.addEventListener('change', () => {
    state.flags[item.data.id] = flagCheckbox.checked;
    updateNavStates();
  });
  flagRow.appendChild(flagCheckbox);
  flagRow.appendChild(document.createTextNode(' Flag this question for review'));
  panel.appendChild(flagRow);

  document.getElementById('prev-btn').disabled = state.currentIndex === 0;
  document.getElementById('next-btn').disabled = state.currentIndex === state.items.length - 1;

  updateNavStates();
}

function renderMcqQuestion(q) {
  const wrap = document.createElement('div');

  const stem = document.createElement('p');
  stem.className = 'question-stem';
  stem.textContent = q.question;
  wrap.appendChild(stem);

  const optionsWrap = document.createElement('div');
  optionsWrap.className = 'options';

  Object.entries(q.options).forEach(([key, text]) => {
    const optBtn = document.createElement('button');
    optBtn.type = 'button';
    optBtn.className = 'option-btn';
    if (state.answers[q.id] === key) optBtn.classList.add('selected');
    optBtn.innerHTML = `<span class="option-key">${key.toUpperCase()}</span><span>${text}</span>`;
    optBtn.addEventListener('click', () => {
      state.answers[q.id] = key;
      renderQuestion();
    });
    optionsWrap.appendChild(optBtn);
  });

  wrap.appendChild(optionsWrap);
  return wrap;
}

function renderSwaQuestion(q) {
  const wrap = document.createElement('div');

  const stem = document.createElement('p');
  stem.className = 'question-stem';
  stem.textContent = `${q.question} (${q.total_marks} marks)`;
  wrap.appendChild(stem);

  if (!state.answers[q.id]) state.answers[q.id] = {};

  q.parts.forEach((part) => {
    const partWrap = document.createElement('div');
    partWrap.className = 'swa-part';

    const label = document.createElement('label');
    label.className = 'swa-part-label';
    label.textContent = `${part.ref}) ${part.prompt} [${part.marks} marks]`;
    partWrap.appendChild(label);

    const textarea = document.createElement('textarea');
    textarea.rows = 4;
    textarea.value = state.answers[q.id][part.ref] || '';
    textarea.addEventListener('input', () => {
      state.answers[q.id][part.ref] = textarea.value;
      updateNavStates();
    });
    partWrap.appendChild(textarea);

    wrap.appendChild(partWrap);
  });

  return wrap;
}

// ---------- Submit ----------

function confirmSubmit() {
  const unanswered = state.items.filter((item) => !isAnswered(item)).length;
  const msg =
    unanswered > 0
      ? `You have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}. Submit anyway?`
      : 'Submit your paper now?';
  if (confirm(msg)) submitExam(false);
}

function submitExam(timedOut) {
  clearInterval(state.timerId);
  state.submitted = true;
  window.removeEventListener('beforeunload', beforeUnloadGuard);

  const swaItems = state.items.filter((i) => i.type === 'swa');
  if (timedOut) {
    // Time's up — jump straight to results/marking, no further edits.
  }

  if (swaItems.length > 0) {
    renderMarkingView(swaItems);
    showView('marking');
  } else {
    renderResults();
    showView('results');
  }
}

// ---------- Self-marking (SWA) ----------

function renderMarkingView(swaItems) {
  const container = document.getElementById('marking-content');
  container.innerHTML = '';

  const intro = document.createElement('p');
  intro.className = 'marking-intro';
  intro.textContent =
    'Short written answers need human judgement to mark. Compare your answer against each mark scheme point below and enter the marks you believe it earns.';
  container.appendChild(intro);

  swaItems.forEach((item) => {
    const q = item.data;
    const qWrap = document.createElement('div');
    qWrap.className = 'marking-question';

    const title = document.createElement('h4');
    title.textContent = `${q.id} — ${q.topic} (${q.total_marks} marks)`;
    qWrap.appendChild(title);

    q.parts.forEach((part) => {
      const partWrap = document.createElement('div');
      partWrap.className = 'marking-part';

      const prompt = document.createElement('p');
      prompt.className = 'marking-prompt';
      prompt.innerHTML = `<strong>${part.ref})</strong> ${part.prompt} <em>(${part.marks} marks)</em>`;
      partWrap.appendChild(prompt);

      const yourAnswer = document.createElement('div');
      yourAnswer.className = 'your-answer';
      const answerText = (state.answers[q.id] && state.answers[q.id][part.ref]) || '';
      yourAnswer.innerHTML = `<span class="label">Your answer</span><p>${
        answerText.trim() ? escapeHtml(answerText) : '<em>No answer given</em>'
      }</p>`;
      partWrap.appendChild(yourAnswer);

      const scheme = document.createElement('div');
      scheme.className = 'mark-scheme';
      scheme.innerHTML =
        '<span class="label">Mark scheme</span><ul>' +
        part.mark_scheme.map((point) => `<li>${escapeHtml(point)}</li>`).join('') +
        '</ul>';
      partWrap.appendChild(scheme);

      const markRow = document.createElement('label');
      markRow.className = 'mark-input-row';
      markRow.textContent = 'Marks awarded: ';
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.max = String(part.marks);
      input.value = state.swaMarks[`${q.id}:${part.ref}`] ?? '';
      input.addEventListener('input', () => {
        let val = Number(input.value);
        if (Number.isNaN(val)) val = 0;
        val = Math.min(Math.max(val, 0), part.marks);
        state.swaMarks[`${q.id}:${part.ref}`] = val;
      });
      markRow.appendChild(input);
      markRow.appendChild(document.createTextNode(` / ${part.marks}`));
      partWrap.appendChild(markRow);

      qWrap.appendChild(partWrap);
    });

    container.appendChild(qWrap);
  });

  document.getElementById('finish-marking-btn').onclick = () => {
    swaItems.forEach((item) => {
      item.data.parts.forEach((part) => {
        const key = `${item.data.id}:${part.ref}`;
        if (state.swaMarks[key] === undefined) state.swaMarks[key] = 0;
      });
    });
    renderResults();
    showView('results');
  };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Results ----------

function renderResults() {
  const container = document.getElementById('results-content');
  container.innerHTML = '';

  const mcqItems = state.items.filter((i) => i.type === 'mcq');
  const swaItems = state.items.filter((i) => i.type === 'swa');

  const header = document.createElement('div');
  header.className = 'results-header';
  header.innerHTML = `<h2>Results — Level ${state.level}, ${state.mode.label}</h2>`;
  container.appendChild(header);

  if (mcqItems.length > 0) {
    container.appendChild(renderMcqResults(mcqItems));
  }
  if (swaItems.length > 0) {
    container.appendChild(renderSwaResults(swaItems));
  }

  const restartBtn = document.getElementById('restart-btn');
  restartBtn.onclick = () => {
    showView('home');
  };
}

function renderMcqResults(mcqItems) {
  const wrap = document.createElement('div');
  wrap.className = 'results-block';

  let correct = 0;
  const loStats = {};
  mcqItems.forEach((item) => {
    const q = item.data;
    const given = state.answers[q.id];
    const isCorrect = given === q.answer;
    if (isCorrect) correct++;
    if (!loStats[q.lo]) loStats[q.lo] = { correct: 0, total: 0 };
    loStats[q.lo].total++;
    if (isCorrect) loStats[q.lo].correct++;
  });

  const pct = Math.round((correct / mcqItems.length) * 100);
  const pass = pct >= state.levelData.exam.pass_mark_pct;

  const summary = document.createElement('div');
  summary.className = `score-summary ${pass ? 'pass' : 'fail'}`;
  summary.innerHTML = `
    <div class="score-big">${correct} / ${mcqItems.length}</div>
    <div class="score-pct">${pct}%</div>
    <div class="score-badge">${pass ? 'PASS' : 'FAIL'} · pass mark ${state.levelData.exam.pass_mark_pct}%</div>
  `;
  wrap.appendChild(summary);

  const loTitles = state.levelData.exam.lo_titles;
  const loBreakdown = document.createElement('div');
  loBreakdown.className = 'lo-breakdown';
  loBreakdown.innerHTML = '<h3>By Learning Outcome</h3>';
  Object.entries(loStats)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .forEach(([lo, stat]) => {
      const row = document.createElement('div');
      row.className = 'lo-row';
      row.innerHTML = `
        <span class="lo-name">LO${lo} — ${loTitles[lo] || ''}</span>
        <span class="lo-score">${stat.correct}/${stat.total}</span>
      `;
      loBreakdown.appendChild(row);
    });
  wrap.appendChild(loBreakdown);

  const reviewHeading = document.createElement('h3');
  reviewHeading.textContent = 'Question review';
  wrap.appendChild(reviewHeading);

  const mistakeCount = mcqItems.filter((item) => state.answers[item.data.id] !== item.data.answer).length;

  const filterRow = document.createElement('div');
  filterRow.className = 'review-filter';
  const filters = [
    { id: 'all', label: `All (${mcqItems.length})` },
    { id: 'wrong', label: `Mistakes only (${mistakeCount})` },
  ];
  filters.forEach((f) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter-btn';
    btn.textContent = f.label;
    btn.dataset.filter = f.id;
    if (f.id === 'wrong' && mistakeCount === 0) btn.disabled = true;
    btn.addEventListener('click', () => {
      filterRow.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      wrap.querySelectorAll('.review-card').forEach((card) => {
        card.classList.toggle('hidden', f.id === 'wrong' && card.classList.contains('correct'));
      });
    });
    filterRow.appendChild(btn);
  });
  filterRow.querySelector(`[data-filter="${mistakeCount > 0 ? 'wrong' : 'all'}"]`).classList.add('active');
  wrap.appendChild(filterRow);

  mcqItems.forEach((item, i) => {
    const q = item.data;
    const given = state.answers[q.id];
    const isCorrect = given === q.answer;

    const card = document.createElement('div');
    card.className = `review-card ${isCorrect ? 'correct' : 'incorrect'}`;
    if (isCorrect && mistakeCount > 0) card.classList.add('hidden');
    card.innerHTML = `
      <div class="review-header">
        <span>Q${i + 1} · LO${q.lo}${state.flags[q.id] ? ' · flagged' : ''}</span>
        <span>${isCorrect ? 'Correct' : 'Incorrect'}</span>
      </div>
      <p class="review-stem">${escapeHtml(q.question)}</p>
      <ul class="review-options">
        ${Object.entries(q.options)
          .map(([key, text]) => {
            const classes = [];
            if (key === q.answer) classes.push('right-answer');
            if (key === given && key !== q.answer) classes.push('your-wrong-answer');
            return `<li class="${classes.join(' ')}">${key.toUpperCase()}) ${escapeHtml(text)}</li>`;
          })
          .join('')}
      </ul>
      <p class="review-explanation"><strong>Explanation:</strong> ${escapeHtml(q.explanation)}</p>
    `;
    wrap.appendChild(card);
  });

  return wrap;
}

function renderSwaResults(swaItems) {
  const wrap = document.createElement('div');
  wrap.className = 'results-block';

  let totalEarned = 0;
  let totalPossible = 0;
  swaItems.forEach((item) => {
    item.data.parts.forEach((part) => {
      totalPossible += part.marks;
      totalEarned += state.swaMarks[`${item.data.id}:${part.ref}`] || 0;
    });
  });

  const pct = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;
  const pass = pct >= state.levelData.exam.pass_mark_pct;

  const heading = document.createElement('h3');
  heading.textContent = 'Short written answer — self-marked score';
  wrap.appendChild(heading);

  const summary = document.createElement('div');
  summary.className = `score-summary ${pass ? 'pass' : 'fail'}`;
  summary.innerHTML = `
    <div class="score-big">${totalEarned} / ${totalPossible}</div>
    <div class="score-pct">${pct}%</div>
    <div class="score-badge">${pass ? 'PASS' : 'FAIL'} · pass mark ${state.levelData.exam.pass_mark_pct}%</div>
  `;
  wrap.appendChild(summary);

  const note = document.createElement('p');
  note.className = 'marking-note';
  note.textContent = 'This score reflects your own self-marking against the published mark scheme, not an official grade.';
  wrap.appendChild(note);

  return wrap;
}

// ---------- Init ----------

renderHome();
showView('home');
