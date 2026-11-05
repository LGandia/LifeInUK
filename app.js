const form = document.getElementById('quiz-form');
const titleEl = document.getElementById('quiz-title');
const statusEl = document.getElementById('status');
const submitBtn = document.getElementById('submit-btn');
const resetBtn = document.getElementById('reset-btn');

let questions = [];

async function loadQuestions() {
  try {
    const response = await fetch('data/questions.json');

    if (!response.ok) {
      throw new Error(`Could not load questions (${response.status})`);
    }

    const data = await response.json();
    questions = data.questions || [];

    if (!questions.length) {
      throw new Error('No questions were found in the JSON file.');
    }

    titleEl.textContent = data.title || 'Quiz';
    renderQuestions();
  } catch (error) {
    titleEl.textContent = 'Quiz unavailable';
    statusEl.textContent = error.message;
    statusEl.className = 'status error';
  }
}

function renderQuestions() {
  form.innerHTML = '';

  questions.forEach((question, questionIndex) => {
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

function renderResults() {
  let correctCount = 0;

  questions.forEach((question) => {
    const fieldset = form.querySelectorAll('.question-card')[questions.indexOf(question)];
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

  const totalQuestions = questions.length;
  statusEl.textContent = `You scored ${correctCount} out of ${totalQuestions}.`;
  statusEl.className = 'status success';
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const unanswered = questions.filter((question) => {
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
});

loadQuestions();
