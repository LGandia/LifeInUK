# Quiz UI

This quiz app supports multiple test modes:

- Fixed numbered tests, e.g. Test 1 and Test 2
- A random test that generates 24 unique questions
- Both single-answer and multiple-choice question types

## Run locally

From the project folder:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Edit the question data

Update the file:

```text
data/questions.json
```

The JSON structure includes a `tests` section and a `questions` bank.

```json
{
  "title": "My Tests",
  "tests": [
    {
      "id": "test-1",
      "label": "Test 1",
      "questionIds": ["q-1", "q-2", "q-3"]
    },
    {
      "id": "test-2",
      "label": "Test 2",
      "questionIds": ["q-4", "q-5", "q-6"]
    }
  ],
  "questions": [
    {
      "id": "q-1",
      "type": "single",
      "pool": "test-1",
      "prompt": "What is 2 + 2?",
      "options": ["3", "4", "5"],
      "correctAnswer": "4"
    },
    {
      "id": "q-4",
      "type": "multiple",
      "pool": "random",
      "prompt": "Select all prime numbers.",
      "options": ["2", "4", "5", "9"],
      "correctAnswers": ["2", "5"]
    }
  ]
}
```

Notes:
- Use `type: "single"` for one-answer questions.
- Use `type: "multiple"` for multiple-choice questions.
- Fixed tests always keep the same questions.
- The random mode pulls 24 unique questions from the `random` pool.
