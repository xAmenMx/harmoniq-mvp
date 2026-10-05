# Harmoniq

An AI study tool that turns hard-to-digest material into simpler,
more manageable study content, for learners who get overwhelmed.

**Live demo:** https://harmoniq-mvp.vercel.app

![Screenshot](<img width="661" height="1028" alt="Screenshot 2026-10-03 182333" src="https://github.com/user-attachments/assets/986300e6-bd2e-4599-a027-6dc4fde35af1" />
)

## What it does
- The user chooses their type of study session, and inputs their topic name, level of study, preparation level with the material, and then can upload their said materials (text-based materials are preferred). The user can also choose whether to generate new & simplified notes. In "Exam Prep", the user also inputs their exam date to help them prepare accordingly with the remaining days. After they click "Generate Study Materials", a pop-up appears, asking the user to choose their current mental state.
- Harmoniq then generates a grounding message (if distracted), a summary, simplified notes (if checked), flashcards, MCQs and bonus questions.
- Other features like dark mode and a feedback form are also implemeneted.

## How it works
Frontend in HTML, CSS, and JavaScript. Requests go to a Vercel serverless
function in `/api`, which calls the DeepSeek and Claude APIs and returns
the generated material. API keys are stored as environment variables.

## Run locally
1. `git clone https://github.com/xAmenMx/harmoniq-mvp`
2. `npm install`
3. Add your API keys to a `.env` file (see below)
4. `node server.js`

## Status
MVP. Built with AI-assisted development.

## Roadmap
- [one or two things you want to add next]
