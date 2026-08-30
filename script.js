// ============================================
// HARMONIQ - SCRIPT.JS
// Handles form validation, modal interaction,
// API communication, output rendering,
// session types (Normal / Exam), daily limits,
// and the interactive exam quiz
// ============================================


// ============================================
// ELEMENT SELECTION
// ============================================

const subject = document.querySelector('#subject');
const academicLevel = document.querySelector('#academicLevel');
const prepLevel = document.querySelector('#prepLevel');
const examDateGroup = document.querySelector('#examDateGroup');
const examDate = document.querySelector('#examDate');
const notes = document.querySelector('#notes');
const wordCount = document.querySelector('#wordCount');
const generateBtn = document.querySelector('#generateBtn');
const formError = document.querySelector('#formError');
const modalOverlay = document.querySelector('#modalOverlay');
const stateBtns = document.querySelectorAll('.stateBtn');
const output = document.querySelector('#output');
const toggle = document.getElementById('themeToggle');
const sessionTypeBtns = document.querySelectorAll('.sessionTypeBtn');


// ============================================
// API URL
// ============================================

const apiUrl = window.location.hostname === 'localhost'
    ? 'http://localhost:3000/generate'
    : '/api/generate';


// ============================================
// THEME TOGGLE
// ============================================

toggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
    toggle.textContent = isDark ? 'Dark mode' : 'Light mode';
});


// Stores the emotional state selected in the modal
let emotionalState = '';

// Stores the current session type — 'normal' or 'exam'
let sessionType = 'normal';


// ============================================
// SESSION TYPE TOGGLE
// Switching to "Exam Prep" reveals the exam
// date field. Switching back to "Normal Study"
// hides it and clears any value entered.
// ============================================

sessionTypeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        sessionTypeBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        sessionType = btn.dataset.type;

        if (sessionType === 'exam') {
            examDateGroup.style.display = 'flex';
        } else {
            examDateGroup.style.display = 'none';
            examDate.value = '';
        }
    });
});


// ============================================
// DAILY FREE LIMIT
// Free users get a fixed number of generations
// per day. Tracked in localStorage keyed to
// today's date, so it survives page reloads
// but resets naturally the next day.
// ============================================

const DAILY_LIMIT = 2;

// Returns today's date as a simple string, used as the storage key
function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Reads how many generations have been used today
// Returns 0 if nothing is stored yet, or if the stored date isn't today
function getUsageCount() {
    let stored;
    try {
        stored = JSON.parse(localStorage.getItem('harmoniqUsage'));
    } catch (e) {
        stored = null;
    }
    if (!stored || stored.date !== getTodayString()) {
        return 0;
    }
    return stored.count;
}

// Increments today's usage count by one
function incrementUsageCount() {
    const current = getUsageCount();
    localStorage.setItem('harmoniqUsage', JSON.stringify({
        date: getTodayString(),
        count: current + 1
    }));
}


// ============================================
// WORD COUNT TRACKER
// ============================================

notes.addEventListener('input', () => {
    const words = notes.value.trim() === '' ? 0 : notes.value.trim().split(/\s+/).length;
    wordCount.textContent = `${words} / 3,000 words`;

    if (words > 3000) {
        wordCount.style.color = 'red';
    } else {
        wordCount.style.color = '';
    }
});


// ============================================
// GENERATE BUTTON — VALIDATION + MODAL TRIGGER
// ============================================

generateBtn.addEventListener('click', () => {
    formError.textContent = '';

    // Check the daily free limit before anything else
    if (getUsageCount() >= DAILY_LIMIT) {
        formError.textContent = `You've used your ${DAILY_LIMIT} free sessions for today. Come back tomorrow for more.`;
        return;
    }

    const words = notes.value.trim() === '' ? 0 : notes.value.trim().split(/\s+/).length;

    if (subject.value.trim() === '') {
        formError.textContent = 'Please enter a subject.';
        return;
    }
    if (academicLevel.value === '') {
        formError.textContent = 'Please select an academic level.';
        return;
    }
    if (prepLevel.value === '') {
        formError.textContent = 'Please select a preparation level.';
        return;
    }
    if (sessionType === 'exam' && examDate.value === '') {
        formError.textContent = 'Please select your exam date.';
        return;
    }
    if (notes.value.trim() === '') {
        formError.textContent = 'Please paste your notes.';
        return;
    }
    if (words > 3000) {
        formError.textContent = 'Your notes exceed 3,000 words. Please shorten them before continuing.';
        return;
    }

    modalOverlay.style.display = 'flex';
});


// ============================================
// EMOTIONAL STATE SELECTION
// ============================================

stateBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        emotionalState = btn.dataset.state;
        modalOverlay.style.display = 'none';
        generateMaterials();
    });
});


// ============================================
// DAYS REMAINING HELPER
// Calculates whole days between today and the
// selected exam date. Used only in exam mode.
// ============================================

function calculateDaysRemaining(dateStr) {
    const exam = new Date(dateStr);
    const today = new Date();
    exam.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = exam - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}


// ============================================
// MAIN GENERATION FUNCTION
// ============================================

async function generateMaterials() {
    output.style.display = 'block';
    output.innerHTML = '<p>Generating your study materials...</p>';

    const daysRemaining = sessionType === 'exam' ? calculateDaysRemaining(examDate.value) : null;

    // ----------------------------------------
    // SYSTEM PROMPT
    // ----------------------------------------
    const systemPrompt = `You are a study assistant for Harmoniq, a tool designed to help students learn effectively without feeling overwhelmed. Your job is to convert student notes into clear, concise study materials.

Generate the following output in JSON format with five keys: "grounding", "summary", "flashcards", "questions", and "quiz".

If the student's notes exceed 3,000 words, do not process them. Instead return a JSON object with a single key: "error" with the value: "Your notes are too long. Please paste the most relevant section, ideally under 3,000 words, and try again."

Rules:

Academic level adjustment: Adjust vocabulary, depth of explanation, and question difficulty based on academic level.
- Secondary: simple everyday language, avoid jargon, foundational explanations suitable for Grade 8-10 students.
- Pre-university: more advanced than secondary, approaching undergraduate complexity but without assuming university level prior knowledge.
- Undergraduate: standard academic language, moderate complexity.
- Postgraduate: technical language appropriate, assume stronger prior knowledge.

Summary: Write 5-6 sentences covering only the most important concepts from the notes. If the student is overwhelmed, shorten to 3-4 sentences. Plain, simple language. Never verbose.

Flashcards: Generate between 5-10 cards, each with a "front" and "back" key. If the student is overwhelmed, generate only 5 cards.

Session type: The student selects either "Normal" or "Exam" as their session type.
- If session type is "Normal": populate the "questions" key following the Questions rules below. Leave "quiz" as an empty array.
- If session type is "Exam": populate the "quiz" key following the Quiz rules below. Leave "questions" as an empty array.

Questions (Normal session type only): Generate 3 practice questions as a simple array of strings. Each question is just the question text — no objects, no "type" keys. Match type to preparation level:
- "First time seeing it" or "Read once": general recall questions — what, define, describe.
- "Read a few times": mix of recall and Socratic questions.
- "Very familiar": Socratic questions only — why, how, what if, what is the connection.
- If the student is overwhelmed: skip questions entirely, return an empty array.

Quiz (Exam session type only): Generate multiple-choice quiz questions designed to reveal which concepts the student has and hasn't understood.
- Each quiz question is an object with four keys: "concept" (a short 2-4 word label naming the topic being tested, ideally matching a flashcard front), "question" (the question text), "options" (an array of exactly 4 answer choices as strings), and "correctIndex" (the zero-based index of the correct option).
- Generate 5 quiz questions normally, or 3 if the student is overwhelmed.
- Cover a spread of concepts from the notes rather than repeating the same one.
- Make incorrect options plausible, not obviously wrong, so the quiz genuinely tests understanding.
- Adjust difficulty to match academic level.

Emotional state adjustments:
- Ready: deliver full output, empty grounding string.
- Distracted: populate the grounding key with a calm, human two-sentence message. Vary the wording each time — never repeat the same message twice. Warm but brief.
- Overwhelmed: 5 flashcards, 3-4 sentence summary, empty questions array, 3 quiz questions instead of 5, empty grounding string.

${sessionType === 'exam' ? `Exam urgency: The student has ${daysRemaining} day(s) until their exam. Let this inform the tone and focus of the session without being alarming — fewer days remaining means the summary and flashcards should prioritise only the most essential concepts.` : ''}

Note length:
- If notes are very brief, work with what is given without padding or inventing content.
- If notes are very long but under 3,000 words, identify and prioritise only the most repeated and emphasised concepts.
- Do not introduce concepts not present in the notes.

Tone: clear and informative. Never preachy, never overly warm, never overwhelming.

CRITICAL: Your response must be valid, parseable JSON only. No extra braces, no missing commas, no trailing commas. Double-check your JSON structure before responding.`;

    // ----------------------------------------
    // USER MESSAGE
    // ----------------------------------------
    const userMessage = `Subject: ${subject.value}
Academic level: ${academicLevel.value}
Preparation level: ${prepLevel.value}
Current state: ${emotionalState}
Session type: ${sessionType}${sessionType === 'exam' ? `\nDays until exam: ${daysRemaining}` : ''}
Notes: ${notes.value}`;

    // ----------------------------------------
    // API CALL
    // ----------------------------------------
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ systemPrompt, userMessage })
        });

        if (!response.ok) throw new Error('Server error');

        const data = await response.json();

        if (data.error) {
            output.innerHTML = `<p>${data.error}</p>`;
            return;
        }

        // Only count successful generations toward the daily limit
        incrementUsageCount();

        renderOutput(data, daysRemaining);

    } catch (err) {
        console.error('Error:', err.message);
        output.innerHTML = '<p>Something went wrong. Please try again.</p>';
    }
}


// ============================================
// RENDER OUTPUT
// Builds the shared sections (grounding, summary,
// flashcards), then branches based on session type:
// Normal gets the reflective questions + a simple
// comeback line. Exam gets a placeholder container
// that the interactive quiz is injected into after
// the HTML is in the DOM.
// ============================================

function renderOutput(data, daysRemaining) {
    let html = '';

    if (data.grounding) {
        html += `<div id="groundingSection">
            <p>${data.grounding}</p>
        </div>`;
    }

    html += `<div id="summarySection">
        <h2>Summary</h2>
        <p>${data.summary}</p>
    </div>`;

    html += `<div id="flashcardsSection">
        <h2>Flashcards</h2>`;
    data.flashcards.forEach((card, index) => {
        html += `<div class="flashcard">
            <p class="cardNumber">Card ${index + 1} of ${data.flashcards.length}</p>
            <p class="cardFront"><strong>${card.front}</strong></p>
            <p class="cardBack">${card.back}</p>
        </div>`;
    });
    html += `</div>`;

    // ----------------------------------------
    // NORMAL SESSION TYPE
    // Reflective questions + a gentle, generic
    // comeback line (no scoring, so no specifics)
    // ----------------------------------------
    if (sessionType === 'normal') {
        if (data.questions && data.questions.length > 0) {
            html += `<div id="questionsSection">
                <h2>Practice Questions</h2>`;
            data.questions.forEach((q, index) => {
                html += `<p>${index + 1}. ${q}</p>`;
            });
            html += `</div>`;
        }
        html += `<div id="comebackSection"><p>Even ten minutes tomorrow keeps this fresh — come back whenever you're ready.</p></div>`;
    }

    // ----------------------------------------
    // EXAM SESSION TYPE
    // Empty placeholder — the interactive quiz
    // gets built into this after innerHTML is set
    // ----------------------------------------
    if (sessionType === 'exam') {
        html += `<div id="examSection"></div>`;
    }

    // ----------------------------------------
    // FEEDBACK FORM (both session types)
    // ----------------------------------------
    html += `<div id="feedbackSection">
        <h2>How did that feel?</h2>
        <form id="feedbackForm">
            <div class="feedback-group">
                <label class="feedback-label">Were the materials at the right level for you?</label>
                <div class="feedback-btn-group">
                    <button type="button" class="feedback-btn" data-name="level" data-value="Yes">Yes</button>
                    <button type="button" class="feedback-btn" data-name="level" data-value="Somewhat">Somewhat</button>
                    <button type="button" class="feedback-btn" data-name="level" data-value="No">No</button>
                </div>
            </div>
            <div class="feedback-group">
                <label class="feedback-label">Did the emotional check-in feel useful?</label>
                <div class="feedback-btn-group">
                    <button type="button" class="feedback-btn" data-name="checkin" data-value="Yes">Yes</button>
                    <button type="button" class="feedback-btn" data-name="checkin" data-value="Somewhat">Somewhat</button>
                    <button type="button" class="feedback-btn" data-name="checkin" data-value="No">No</button>
                </div>
            </div>
            <div class="feedback-group">
                <label class="feedback-label">How ready do you feel to study now compared to before?</label>
                <div class="feedback-btn-group">
                    <button type="button" class="feedback-btn" data-name="readiness" data-value="More ready">More ready</button>
                    <button type="button" class="feedback-btn" data-name="readiness" data-value="About the same">About the same</button>
                    <button type="button" class="feedback-btn" data-name="readiness" data-value="Less ready">Less ready</button>
                </div>
            </div>
            <div class="feedback-group">
                <label class="feedback-label">Anything missing or that could be better? <span class="feedback-optional">(optional)</span></label>
                <textarea name="suggestions" class="feedback-textarea" placeholder="Your thoughts help us improve..."></textarea>
            </div>
            <p class="feedback-error" id="feedbackError" style="display:none;">Please answer the first three questions before submitting.</p>
            <button type="button" id="feedbackSubmitBtn">Send feedback</button>
        </form>
    </div>`;

    output.innerHTML = html;

    // Build the interactive quiz now that #examSection exists in the DOM
    if (sessionType === 'exam' && data.quiz && data.quiz.length > 0) {
        renderQuiz(data.quiz, daysRemaining);
    }

    // ----------------------------------------
    // FEEDBACK FORM SUBMISSION
    // ----------------------------------------
    const feedbackBtns = document.querySelectorAll('.feedback-btn');
    const selections = { level: null, checkin: null, readiness: null };

    feedbackBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const name = btn.dataset.name;
            document.querySelectorAll(`.feedback-btn[data-name="${name}"]`).forEach(b => {
                b.classList.remove('feedback-btn-selected');
            });
            btn.classList.add('feedback-btn-selected');
            selections[name] = btn.dataset.value;
        });
    });

    const feedbackSubmitBtn = document.getElementById('feedbackSubmitBtn');
    const feedbackError = document.getElementById('feedbackError');

    feedbackSubmitBtn.addEventListener('click', async () => {
        if (!selections.level || !selections.checkin || !selections.readiness) {
            feedbackError.style.display = 'block';
            return;
        }

        feedbackError.style.display = 'none';
        feedbackSubmitBtn.textContent = 'Sending...';
        feedbackSubmitBtn.disabled = true;

        const formData = {
            subject: subject.value,
            academicLevel: academicLevel.value,
            prepLevel: prepLevel.value,
            sessionType: sessionType,
            emotionalState: emotionalState,
            level: selections.level,
            checkin: selections.checkin,
            readiness: selections.readiness,
            suggestions: document.querySelector('textarea[name="suggestions"]').value || 'None'
        };

        try {
            const res = await fetch('https://formspree.io/f/xnjgpeqn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                document.getElementById('feedbackSection').innerHTML = `
                    <div id="feedbackThanks">
                        <p>You're doing great — thanks for taking a moment to share how it went. Every response helps make Harmoniq better for students like you.</p>
                    </div>`;
            } else {
                feedbackSubmitBtn.textContent = 'Send feedback';
                feedbackSubmitBtn.disabled = false;
                feedbackError.textContent = 'Something went wrong. Please try again.';
                feedbackError.style.display = 'block';
            }
        } catch (err) {
            console.error('Feedback error:', err.message);
            feedbackSubmitBtn.textContent = 'Send feedback';
            feedbackSubmitBtn.disabled = false;
        }
    });
}


// ============================================
// RENDER QUIZ (Exam session type)
// Builds the interactive multiple-choice quiz,
// tracks the student's selections, and on submit:
// scores it, reveals correct/incorrect answers,
// collects weak concepts, and shows a comeback
// message built from local logic (no extra AI call).
// ============================================

function renderQuiz(quiz, daysRemaining) {
    const examSection = document.getElementById('examSection');

    let quizHtml = `<div id="quizSection"><h2>Quiz</h2><div id="quizQuestions">`;

    quiz.forEach((q, qIndex) => {
        quizHtml += `<div class="quiz-question" data-index="${qIndex}" data-correct="${q.correctIndex}" data-concept="${q.concept}">
            <p class="quiz-question-text">${qIndex + 1}. ${q.question}</p>
            <div class="quiz-options">`;
        q.options.forEach((opt, oIndex) => {
            quizHtml += `<button type="button" class="quiz-option" data-option-index="${oIndex}">${opt}</button>`;
        });
        quizHtml += `</div></div>`;
    });

    quizHtml += `</div><button type="button" id="submitQuizBtn">Submit Quiz</button></div>`;

    examSection.innerHTML = quizHtml;

    // Tracks which option index the student picked, per question
    const selections = {};

    document.querySelectorAll('.quiz-question').forEach(qEl => {
        const qIndex = qEl.dataset.index;
        qEl.querySelectorAll('.quiz-option').forEach(optBtn => {
            optBtn.addEventListener('click', () => {
                qEl.querySelectorAll('.quiz-option').forEach(b => b.classList.remove('quiz-option-selected'));
                optBtn.classList.add('quiz-option-selected');
                selections[qIndex] = parseInt(optBtn.dataset.optionIndex);
            });
        });
    });

    document.getElementById('submitQuizBtn').addEventListener('click', () => {
        let score = 0;
        const weakConcepts = [];

        document.querySelectorAll('.quiz-question').forEach(qEl => {
            const qIndex = qEl.dataset.index;
            const correctIndex = parseInt(qEl.dataset.correct);
            const concept = qEl.dataset.concept;
            const selected = selections[qIndex];
            const optionButtons = qEl.querySelectorAll('.quiz-option');

            optionButtons.forEach((btn, i) => {
                if (i === correctIndex) {
                    btn.classList.add('quiz-option-correct');
                }
                if (i === selected && selected !== correctIndex) {
                    btn.classList.add('quiz-option-incorrect');
                }
                btn.disabled = true;
            });

            if (selected === correctIndex) {
                score++;
            } else {
                weakConcepts.push(concept);
            }
        });

        // Remove duplicate concepts while keeping the first occurrence's order
        const uniqueWeakConcepts = [...new Set(weakConcepts)];

        let resultsHtml = `<div id="quizResults">
            <h2>Results</h2>
            <p>You got ${score} out of ${quiz.length} correct.</p>`;

        if (uniqueWeakConcepts.length > 0) {
            resultsHtml += `<div id="weakAreas">
                <span class="label">Focus on next</span>
                <ul>${uniqueWeakConcepts.map(c => `<li>${c}</li>`).join('')}</ul>
            </div>`;
        }

        resultsHtml += buildComebackMessage(daysRemaining, uniqueWeakConcepts);
        resultsHtml += `</div>`;

        document.getElementById('submitQuizBtn').style.display = 'none';
        document.getElementById('quizSection').insertAdjacentHTML('beforeend', resultsHtml);
    });
}


// ============================================
// BUILD COMEBACK MESSAGE
// Generated entirely from local data — no extra
// AI call needed. Combines the exam countdown
// with the weakest concept from this session.
// ============================================

function buildComebackMessage(daysRemaining, weakConcepts) {
    let message = '';

    if (daysRemaining !== null && daysRemaining > 0) {
        message += daysRemaining === 1
            ? `Your exam is tomorrow. `
            : `${daysRemaining} days until your exam. `;
    }

    if (weakConcepts.length > 0) {
        message += `Come back and we'll start with ${weakConcepts[0]}.`;
    } else {
        message += `Strong session — come back tomorrow to keep it fresh.`;
    }

    return `<div id="comebackSection"><p>${message}</p></div>`;
}