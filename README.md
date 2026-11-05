# Quiz UI

This is a simple JSON-driven quiz app for single-answer and multiple-choice questions.

## Run locally

From the project folder:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Edit the questions

Update the file:

```text
data/questions.json
```

Example format:

```json
{
  "title": "My Test",
  "questions": [
    {
      "id": "q1",
      "type": "single",
      "prompt": "What is 2 + 2?",
      "options": ["3", "4", "5"],
      "correctAnswer": "4"
    },
    {
      "id": "q2",
      "type": "multiple",
      "prompt": "Select all prime numbers.",
      "options": ["2", "4", "5", "9"],
      "correctAnswers": ["2", "5"]
    }
  ]
}
```

- Use `type: "single"` for one-answer questions.
- Use `type: "multiple"` for multiple-choice questions.
- For single-answer questions, provide `correctAnswer`.
- For multiple-answer questions, provide `correctAnswers`.
