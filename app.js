const form = document.getElementById('quiz-form');
const titleEl = document.getElementById('quiz-title');
const statusEl = document.getElementById('status');
const homeView = document.getElementById('home-view');
const quizView = document.getElementById('quiz-view');
const testList = document.getElementById('test-list');
const testSearch = document.getElementById('test-search');
const backBtn = document.getElementById('back-btn');
const generateRandomBtn = document.getElementById('generate-random-btn');

const storageKey = 'completed-tests';

const state = {
  title: 'Quiz',
  tests: [],
  currentQuestions: [],
  selectedTestId: null,
  reviewMode: false,
  lastCompleted: null,
  completedTests: new Map(Object.entries(loadCompletedTests())),
};

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Could not load ${url} (${response.status})`);
  }

  return response.json();
}

function loadCompletedTests() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return Object.fromEntries(parsed.map((testId) => [testId, { score: 24, total: 24 }]));
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([testId, value]) => {
        const score = typeof value === 'object' && value !== null && Number.isFinite(Number(value.score))
          ? Number(value.score)
          : 0;
        const total = typeof value === 'object' && value !== null && Number.isFinite(Number(value.total))
          ? Number(value.total)
          : 24;

        return [testId, { score, total }];
      })
    );
  } catch {
    return {};
  }
}

function saveCompletedTests() {
  localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(state.completedTests.entries())));
}

function shuffle(items) {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[swapIndex]] = [nextItems[swapIndex], nextItems[index]];
  }

  return nextItems;
}

async function loadQuestions() {
  try {
    const indexData = await fetchJson('data/tests/index.json');
    state.title = indexData.title || 'Quiz';

    const testFiles = indexData.tests || [];
    const loadedTests = [];

    for (const testConfig of testFiles) {
      const testData = await fetchJson(`data/tests/${testConfig.file}`);
      loadedTests.push({
        id: testData.id,
        label: testData.label || testConfig.label,
        questions: testData.questions || [],
      });
    }

    state.tests = loadedTests;

    if (!state.tests.length) {
      throw new Error('No tests were found in the JSON index file.');
    }

    const allQuestions = state.tests.flatMap((test) => test.questions || []);

    if (!allQuestions.length) {
      throw new Error('No questions were found across the test files.');
    }

    titleEl.textContent = state.title;
    renderTestList();
    showHomeScreen();
  } catch (error) {
    titleEl.textContent = 'Quiz unavailable';
    statusEl.textContent = error.message;
    statusEl.className = 'status error';
    showHomeScreen();
  }
}

function showHomeScreen() {
  state.hasAttemptedSubmit = false;
  homeView.hidden = false;
  quizView.hidden = true;
  titleEl.textContent = state.title;
}

function showQuizScreen() {
  homeView.hidden = true;
  quizView.hidden = false;
}

function getFixedQuestions(testId) {
  const test = state.tests.find((item) => item.id === testId);
  return test ? test.questions : [];
}

function getRandomQuestions() {
  const questionsFromTests = state.tests.flatMap((test) => test.questions || []);
  const uniqueQuestions = questionsFromTests.filter(
    (question, index, array) => array.findIndex((item) => item.id === question.id) === index
  );

  return shuffle(uniqueQuestions).slice(0, 24);
}

function renderTestList() {
  const searchText = testSearch.value.trim().toLowerCase();
  const filteredTests = state.tests.filter((test) => {
    const text = `${test.label} ${test.id}`.toLowerCase();
    return text.includes(searchText);
  });

  testList.innerHTML = '';

  if (!filteredTests.length) {
    testList.innerHTML = '<p class="empty-state">No tests match your search.</p>';
    return;
  }

  filteredTests.forEach((test) => {
    const card = document.createElement('div');
    card.className = 'test-card';

    const isCompleted = state.completedTests.has(test.id);
    const completionData = state.completedTests.get(test.id);

    if (isCompleted) {
      card.classList.add('completed');
    }

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'test-card-main-button';
    const passed = completionData ? completionData.score >= 18 : false;
    main.innerHTML = `
      <span class="test-card-main">
        <strong>${test.label}</strong>
        <span class="test-card-meta">${test.questions.length} questions</span>
      </span>
      <span class="test-badge ${isCompleted ? (passed ? 'completed' : 'failed') : ''}">${isCompleted ? `Completed ${completionData.score}/${completionData.total}` : 'Open'}</span>
    `;
    main.addEventListener('click', () => startTest(test.id));

    card.appendChild(main);

    if (isCompleted) {
      const resetButton = document.createElement('button');
      resetButton.type = 'button';
      resetButton.className = 'reset-progress-btn';
      resetButton.textContent = 'Reset';
      resetButton.addEventListener('click', (event) => {
        event.stopPropagation();
        state.completedTests.delete(test.id);
        if (state.lastCompleted && state.lastCompleted.testId === test.id) {
          state.lastCompleted = null;
        }
        saveCompletedTests();
        renderTestList();
      });
      card.appendChild(resetButton);
    }

    testList.appendChild(card);
  });
}

function startTest(testId, options = {}) {
  state.hasAttemptedSubmit = false;
  state.selectedTestId = testId;
  state.reviewMode = Boolean(options.reviewMode);
  state.currentQuestions = getFixedQuestions(testId);

  if (state.reviewMode && state.completedTests.has(testId)) {
    const completedData = state.completedTests.get(testId);
    const answers = completedData && completedData.answers ? completedData.answers : {};
    const failedQuestions = state.currentQuestions.filter((question) => {
      const selected = answers[question.id];
      return !compareAnswers(question, selected || (question.type === 'multiple' ? [] : null));
    });
    state.currentQuestions = failedQuestions;
  }

  titleEl.textContent = state.tests.find((test) => test.id === testId)?.label || 'Quiz';
  renderQuestions(state.currentQuestions);
  statusEl.textContent = '';
  statusEl.className = 'status';
  showQuizScreen();
}

function startRandomTest() {
  state.hasAttemptedSubmit = false;
  state.selectedTestId = 'random';
  state.currentQuestions = getRandomQuestions();

  titleEl.textContent = 'Random 24-question test';
  renderQuestions(state.currentQuestions);
  statusEl.textContent = '';
  statusEl.className = 'status';
  showQuizScreen();
}

function renderQuestions(questionsToRender) {
  form.innerHTML = '';

  if (!questionsToRender.length) {
    form.innerHTML = '<p>No questions available for this test.</p>';
    return;
  }

  questionsToRender.forEach((question, questionIndex) => {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'question-card';

    const header = document.createElement('div');
    header.className = 'question-header';

    const number = document.createElement('span');
    number.className = 'question-number';
    number.textContent = `Question ${questionIndex + 1}`;

    const prompt = document.createElement('h2');
    prompt.textContent = question.prompt;

    header.appendChild(number);
    fieldset.appendChild(header);
    fieldset.appendChild(prompt);

    const optionsWrapper = document.createElement('div');
    optionsWrapper.className = 'options';

    const savedAnswers = state.reviewMode && state.completedTests.has(state.selectedTestId)
      ? state.completedTests.get(state.selectedTestId).answers?.[question.id]
      : undefined;

    question.options.forEach((option) => {
      const label = document.createElement('label');
      label.className = 'option';

      const input = document.createElement('input');
      input.type = question.type === 'multiple' ? 'checkbox' : 'radio';
      input.name = `question-${question.id}`;
      input.value = option;
      input.dataset.questionId = question.id;

      if (state.reviewMode && savedAnswers !== undefined) {
        const selectedValues = Array.isArray(savedAnswers) ? savedAnswers : [savedAnswers];
        input.checked = selectedValues.includes(option);
      }

      const text = document.createElement('span');
      text.textContent = option;

      label.appendChild(input);
      label.appendChild(text);
      optionsWrapper.appendChild(label);
    });

    fieldset.appendChild(optionsWrapper);
    form.appendChild(fieldset);
  });

  if (state.reviewMode && state.completedTests.has(state.selectedTestId)) {
    const completedData = state.completedTests.get(state.selectedTestId);
    const answers = completedData && completedData.answers ? completedData.answers : {};
    state.currentQuestions.forEach((question) => {
      const fieldset = form.querySelectorAll('.question-card')[state.currentQuestions.indexOf(question)];
      if (!fieldset) return;

      const selected = answers[question.id];
      const isCorrect = compareAnswers(question, selected);
      fieldset.classList.toggle('correct', isCorrect);
      fieldset.classList.toggle('incorrect', !isCorrect);

      const feedback = document.createElement('div');
      feedback.className = `feedback ${isCorrect ? 'correct' : 'incorrect'}`;
      feedback.textContent = isCorrect
        ? 'Correct answer.'
        : `Incorrect. ${question.type === 'multiple' ? 'Correct answers: ' : 'Correct answer: '} ${question.type === 'multiple' ? (question.correctAnswers || []).join(', ') : question.correctAnswer}`;
      fieldset.appendChild(feedback);

      fieldset.querySelectorAll('.option').forEach((optionLabel) => {
        const input = optionLabel.querySelector('input');
        const optionValue = input.value;
        const isOptionCorrect = question.type === 'multiple'
          ? (question.correctAnswers || []).includes(optionValue)
          : optionValue === question.correctAnswer;
        const isSelected = question.type === 'multiple'
          ? (selected || []).includes(optionValue)
          : selected === optionValue;

        optionLabel.classList.toggle('correct', isOptionCorrect);
        optionLabel.classList.toggle('incorrect', isSelected && !isOptionCorrect);
      });
    });
  }
}

function getSelectedValues(question) {
  const selected = [...form.querySelectorAll(`input[name="question-${question.id}"]:checked`)]
    .map((input) => input.value);

  return question.type === 'multiple' ? selected : selected[0] || null;
}

function compareAnswers(question, selected) {
  if (question.type === 'multiple') {
    const sortedSelected = [...selected].sort();
    const sortedCorrect = [...(question.correctAnswers || [])].sort();
    return sortedSelected.length === sortedCorrect.length &&
      sortedSelected.every((value, index) => value === sortedCorrect[index]);
  }

  return selected === question.correctAnswer;
}

function getCurrentAnswers() {
  const answers = {};

  state.currentQuestions.forEach((question) => {
    const selected = getSelectedValues(question);
    answers[question.id] = selected;
  });

  return answers;
}

function markTestCompleted(correctCount, totalQuestions) {
  if (state.selectedTestId && state.selectedTestId !== 'random') {
    const answers = getCurrentAnswers();
    const failedQuestionIds = state.currentQuestions
      .filter((question) => !compareAnswers(question, answers[question.id]))
      .map((question) => question.id);

    state.completedTests.set(state.selectedTestId, {
      score: correctCount,
      total: totalQuestions,
      answers,
      failedQuestionIds,
    });
    state.lastCompleted = { testId: state.selectedTestId, score: correctCount, total: totalQuestions };
    saveCompletedTests();
    renderTestList();
  }
}

function renderResults() {
  let correctCount = 0;

  state.currentQuestions.forEach((question) => {
    const fieldset = form.querySelectorAll('.question-card')[state.currentQuestions.indexOf(question)];
    if (!fieldset) return;

    const selected = getSelectedValues(question);
    const isCorrect = compareAnswers(question, selected);
    const isUnanswered = question.type === 'multiple'
      ? Array.isArray(selected) && selected.length === 0
      : selected === null;

    if (isCorrect) {
      correctCount += 1;
    }

    fieldset.classList.toggle('unanswered', isUnanswered && !state.reviewMode);

    fieldset.classList.toggle('correct', isCorrect);
    fieldset.classList.toggle('incorrect', !isCorrect);

    const existingFeedback = fieldset.querySelector('.feedback');
    if (existingFeedback) {
      existingFeedback.remove();
    }

    const feedback = document.createElement('div');
    feedback.className = `feedback ${isCorrect ? 'correct' : 'incorrect'}`;
    feedback.textContent = isCorrect
      ? 'Correct answer.'
      : `Incorrect. ${question.type === 'multiple' ? 'Correct answers: ' : 'Correct answer: '} ${question.type === 'multiple' ? (question.correctAnswers || []).join(', ') : question.correctAnswer}`;

    fieldset.appendChild(feedback);

    fieldset.querySelectorAll('.option').forEach((optionLabel) => {
      const input = optionLabel.querySelector('input');
      const optionValue = input.value;
      const isOptionCorrect = question.type === 'multiple'
        ? (question.correctAnswers || []).includes(optionValue)
        : optionValue === question.correctAnswer;
      const isSelected = question.type === 'multiple'
        ? (selected || []).includes(optionValue)
        : selected === optionValue;

      optionLabel.classList.toggle('correct', isOptionCorrect);
      optionLabel.classList.toggle('incorrect', isSelected && !isOptionCorrect);
    });
  });

  const totalQuestions = state.currentQuestions.length;
  statusEl.textContent = `You scored ${correctCount} out of ${totalQuestions}.`;
  statusEl.className = 'status success';
  markTestCompleted(correctCount, totalQuestions);
  showHomeScreen();
  return { correctCount, totalQuestions };
}

function updateUnansweredState() {
  form.querySelectorAll('.question-card').forEach((fieldset) => {
    const questionId = fieldset.querySelector('input')?.name?.replace('question-', '');
    const question = state.currentQuestions.find((item) => item.id === questionId);
    if (!question) return;

    const selected = getSelectedValues(question);
    const isUnanswered = question.type === 'multiple'
      ? Array.isArray(selected) && selected.length === 0
      : selected === null;

    fieldset.classList.toggle('unanswered', isUnanswered && !state.reviewMode && state.hasAttemptedSubmit);
  });
}

state.hasAttemptedSubmit = false;

form.addEventListener('input', () => {
  if (state.hasAttemptedSubmit) {
    updateUnansweredState();
  }
});
form.addEventListener('change', () => {
  if (state.hasAttemptedSubmit) {
    updateUnansweredState();
  }
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  state.hasAttemptedSubmit = true;

  const unanswered = state.currentQuestions.filter((question) => {
    const selected = getSelectedValues(question);
    if (question.type === 'multiple') {
      return Array.isArray(selected) && selected.length === 0;
    }
    return selected === null;
  });

  if (unanswered.length) {
    statusEl.textContent = 'Please answer all questions before submitting.';
    statusEl.className = 'status error';
    updateUnansweredState();

    const firstSkipped = unanswered[0];
    const targetIndex = state.currentQuestions.findIndex((question) => question.id === firstSkipped.id);
    const targetFieldset = form.querySelectorAll('.question-card')[targetIndex];
    if (targetFieldset) {
      targetFieldset.scrollIntoView({ behavior: 'smooth', block: 'start' });
      targetFieldset.focus?.();
    }
    return;
  }

  renderResults();
});

backBtn.addEventListener('click', () => {
  showHomeScreen();
  renderTestList();
});

generateRandomBtn.addEventListener('click', () => {
  startRandomTest();
});

testSearch.addEventListener('input', renderTestList);

loadQuestions();
