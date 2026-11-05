const form = document.getElementById('quiz-form');
const titleEl = document.getElementById('quiz-title');
const statusEl = document.getElementById('status');
const homeView = document.getElementById('home-view');
const quizView = document.getElementById('quiz-view');
const testList = document.getElementById('test-list');
const testSearch = document.getElementById('test-search');
const resetBtn = document.getElementById('reset-btn');
const backBtn = document.getElementById('back-btn');
const generateRandomBtn = document.getElementById('generate-random-btn');

const storageKey = 'completed-tests';

const state = {
  title: 'Quiz',
  tests: [],
  currentQuestions: [],
  selectedTestId: null,
  completedTests: new Set(loadCompletedTests()),
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
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCompletedTests() {
  localStorage.setItem(storageKey, JSON.stringify([...state.completedTests]));
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
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'test-card';

    const isCompleted = state.completedTests.has(test.id);
    if (isCompleted) {
      button.classList.add('completed');
    }

    button.innerHTML = `
      <span class="test-card-main">
        <strong>${test.label}</strong>
        <span class="test-card-meta">${test.questions.length} questions</span>
      </span>
      <span class="test-badge ${isCompleted ? 'completed' : ''}">${isCompleted ? 'Completed' : 'Open'}</span>
    `;

    button.addEventListener('click', () => startTest(test.id));
    testList.appendChild(button);
  });
}

function startTest(testId) {
  state.selectedTestId = testId;
  state.currentQuestions = getFixedQuestions(testId);

  titleEl.textContent = state.tests.find((test) => test.id === testId)?.label || 'Quiz';
  renderQuestions(state.currentQuestions);
  statusEl.textContent = '';
  statusEl.className = 'status';
  showQuizScreen();
}

function startRandomTest() {
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

    question.options.forEach((option) => {
      const label = document.createElement('label');
      label.className = 'option';

      const input = document.createElement('input');
      input.type = question.type === 'multiple' ? 'checkbox' : 'radio';
      input.name = `question-${question.id}`;
      input.value = option;
      input.dataset.questionId = question.id;

      const text = document.createElement('span');
      text.textContent = option;

      label.appendChild(input);
      label.appendChild(text);
      optionsWrapper.appendChild(label);
    });

    fieldset.appendChild(optionsWrapper);
    form.appendChild(fieldset);
  });
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

function markTestCompleted() {
  if (state.selectedTestId && state.selectedTestId !== 'random') {
    state.completedTests.add(state.selectedTestId);
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

    if (isCorrect) {
      correctCount += 1;
    }

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
  markTestCompleted();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

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
    return;
  }

  renderResults();
});

resetBtn.addEventListener('click', () => {
  form.reset();
  statusEl.textContent = '';
  statusEl.className = 'status';

  form.querySelectorAll('.question-card').forEach((fieldset) => {
    fieldset.classList.remove('correct', 'incorrect');
    const feedback = fieldset.querySelector('.feedback');
    if (feedback) feedback.remove();
    fieldset.querySelectorAll('.option').forEach((label) => {
      label.classList.remove('correct', 'incorrect');
    });
  });

  if (state.selectedTestId === 'random') {
    state.currentQuestions = getRandomQuestions();
    renderQuestions(state.currentQuestions);
  }
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
