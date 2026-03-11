// ============================================
// HARMONIQ - SCRIPT.JS
// Handles form validation, modal interaction,
// API communication, and output rendering
// ============================================


// ============================================
// ELEMENT SELECTION
// Grabbing all the elements we need from the DOM
// ============================================

const subject = document.querySelector('#subject');             // Subject input field
const academicLevel = document.querySelector('#academicLevel'); // Academic level dropdown
const prepLevel = document.querySelector('#prepLevel');         // Preparation level dropdown
const notes = document.querySelector('#notes');                 // Notes textarea
const wordCount = document.querySelector('#wordCount');         // Word count display
const generateBtn = document.querySelector('#generateBtn');     // Generate button
const formError = document.querySelector('#formError');         // Inline error message
const modalOverlay = document.querySelector('#modalOverlay');   // Modal background overlay
const stateBtns = document.querySelectorAll('.stateBtn');       // All three emotional state buttons
const output = document.querySelector('#output');               // Output section container
const toggle = document.getElementById('themeToggle');


// ============================================
// THEME TOGGLE
// Simple dark/light mode toggle for better UX
// Toggles a data-theme attribute on the root element
// and changes button text accordingly
// ============================================

toggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
    toggle.textContent = isDark ? 'Dark mode' : 'Light mode';
});


// Stores the emotional state selected in the modal
// Starts empty, gets filled when user clicks a state button
let emotionalState = '';


// ============================================
// WORD COUNT TRACKER
// Updates the word count display every time
// the user types in the notes textarea
// Turns red if the user exceeds 3,000 words
// ============================================

notes.addEventListener('input', () => {
    // If the textarea is empty, count is 0
    // Otherwise split by whitespace to count words
    const words = notes.value.trim() === '' ? 0 : notes.value.trim().split(/\s+/).length;

    // Update the display text
    wordCount.textContent = `${words} / 3,000 words`;

    // Turn red if over the limit as a visual warning
    if (words > 3000) {
        wordCount.style.color = 'red';
    } else {
        wordCount.style.color = '';
    }
});


// ============================================
// GENERATE BUTTON — VALIDATION + MODAL TRIGGER
// When the user clicks Generate:
// 1. Clear any previous error messages
// 2. Validate all four form fields
// 3. If valid, show the emotional state modal
// ============================================

generateBtn.addEventListener('click', () => {
    // Clear any previous error message
    formError.textContent = '';

    // Count words in the notes field for validation
    const words = notes.value.trim() === '' ? 0 : notes.value.trim().split(/\s+/).length;

    // Validate each field one by one
    // Return early if any field fails — shows one error at a time
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
    if (notes.value.trim() === '') {
        formError.textContent = 'Please paste your notes.';
        return;
    }
    if (words > 3000) {
        formError.textContent = 'Your notes exceed 3,000 words. Please shorten them before continuing.';
        return;
    }

    // All fields are valid — show the emotional state modal
    // The modal is a popup asking how the student feels right now
    modalOverlay.style.display = 'flex';
});


// ============================================
// EMOTIONAL STATE SELECTION
// When the user clicks one of the three state
// buttons in the modal:
// 1. Store the selected state
// 2. Close the modal
// 3. Trigger the main generation function
// ============================================

stateBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Store the state value from the button's data-state attribute
        // e.g. "Ready", "Distracted", or "Overwhelmed"
        emotionalState = btn.dataset.state;

        // Hide the modal
        modalOverlay.style.display = 'none';

        // Start generating study materials
        generateMaterials();
    });
});


// ============================================
// MAIN GENERATION FUNCTION
// Async function that:
// 1. Shows a loading message
// 2. Builds the system prompt and user message
// 3. Sends both to the Node.js backend
// 4. Receives the JSON response
// 5. Passes it to renderOutput() for display
// ============================================

async function generateMaterials() {
    // Show the output section with a loading message
    // while waiting for the API response
    output.style.display = 'block';
    output.innerHTML = '<p>Generating your study materials...</p>';

    // ----------------------------------------
    // SYSTEM PROMPT
    // The fixed instructions that tell the AI
    // how to behave and what to generate
    // This never changes between requests
    // ----------------------------------------
    const systemPrompt = `You are a study assistant for Harmoniq, a tool designed to help students learn effectively without feeling overwhelmed. Your job is to convert student notes into clear, concise study materials.

Generate the following output in JSON format with four keys: "grounding", "summary", "flashcards", and "questions".

If the student's notes exceed 3,000 words, do not process them. Instead return a JSON object with a single key: "error" with the value: "Your notes are too long. Please paste the most relevant section, ideally under 3,000 words, and try again."

Rules:

Academic level adjustment: Adjust vocabulary, depth of explanation, and question difficulty based on academic level.
- Secondary: simple everyday language, avoid jargon, foundational explanations suitable for Grade 8-10 students.
- Pre-university: more advanced than secondary, approaching undergraduate complexity but without assuming university level prior knowledge. Reduce jargon slightly but engage with more nuanced concepts than secondary level.
- Undergraduate: standard academic language, moderate complexity.
- Postgraduate: technical language appropriate, assume stronger prior knowledge.

Summary: Write 5-6 sentences covering only the most important concepts from the notes. If the student is overwhelmed, shorten to 3-4 sentences. Plain, simple language. Never verbose.

Flashcards: Generate between 5-10 cards, each with a "front" and "back" key. Front is the concept. Back is a simple one to two sentence explanation. Adjust complexity of explanations to match academic level. If the student is overwhelmed, generate only 5 cards. If ready or distracted, generate the full range based on how much content the notes contain.

Questions: Generate 3 practice questions as a simple array of strings. Each question is just the question text — no objects, no "type" keys, no extra fields. Example format: ["What is normalization?", "How does 2NF differ from 1NF?", "Why does 3NF remove transitive dependencies?"] Match type to preparation level:
- "First time seeing it" or "Read once": general recall questions — what, define, describe.
- "Read a few times": mix of recall and Socratic questions.
- "Very familiar": Socratic questions only — why, how, what if, what is the connection.
- Adjust question complexity to match academic level.
- If the student is overwhelmed: skip questions entirely, return an empty array.

Emotional state adjustments:
- Ready: deliver full output, empty grounding string.
- Distracted: populate the grounding key with a calm, human two-sentence message. Vary the wording each time — never repeat the same message twice. Warm but brief. Acknowledge the scattered feeling without being preachy.
- Overwhelmed: 5 flashcards, 3-4 sentence summary, empty questions array, empty grounding string.

Note length:
- If notes are very brief, work with what is given without padding or inventing content.
- If notes are very long but under 3,000 words, identify and prioritise only the most repeated and emphasised concepts. Do not try to cover everything.
- Do not introduce concepts not present in the notes, even if they seem related.

Tone: clear and informative. Never preachy, never overly warm, never overwhelming.

CRITICAL: Your response must be valid, parseable JSON only. No extra braces, no missing commas, no trailing commas. Double-check your JSON structure before responding.`;

    // ----------------------------------------
    // USER MESSAGE
    // The dynamic part that changes each request
    // Contains all five inputs from the student
    // ----------------------------------------
    const userMessage = `Subject: ${subject.value}
Academic level: ${academicLevel.value}
Preparation level: ${prepLevel.value}
Current state: ${emotionalState}
Notes: ${notes.value}`;

    // ----------------------------------------
    // API CALL
    // Sends the system prompt and user message
    // to our Node.js backend at localhost:3000
    // The backend adds the API key and forwards
    // the request to Anthropic, then returns
    // the parsed JSON response
    // ----------------------------------------
    try {
        const response = await fetch('http://localhost:3000/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ systemPrompt, userMessage })
        });

        // If the server itself returned an error, throw it
        if (!response.ok) throw new Error('Server error');

        // Parse the JSON response from the backend
        const data = await response.json();

        // If the AI returned an error key, display it and stop
        if (data.error) {
            output.innerHTML = `<p>${data.error}</p>`;
            return;
        }

        // Everything is good — render the output
        renderOutput(data);

    } catch (err) {
        // Log the error for debugging and show a friendly message to the user
        console.error('Error:', err.message);
        output.innerHTML = '<p>Something went wrong. Please try again.</p>';
    }
}


// ============================================
// RENDER OUTPUT
// Takes the parsed JSON from the API response
// and builds the HTML to display each section:
// 1. Grounding message (if distracted)
// 2. Summary
// 3. Flashcards with card counter
// 4. Practice questions (if not overwhelmed)
// 5. Feedback form
// ============================================

function renderOutput(data) {
    // Start with an empty string and build up the HTML
    let html = '';

    // ----------------------------------------
    // GROUNDING MESSAGE
    // Only shown if the student selected Distracted
    // The AI populates this with a calm message
    // For Ready and Overwhelmed it will be empty
    // ----------------------------------------
    if (data.grounding) {
        html += `<div id="groundingSection">
            <p>${data.grounding}</p>
        </div>`;
    }

    // ----------------------------------------
    // SUMMARY
    // Always shown
    // Length varies based on emotional state
    // ----------------------------------------
    html += `<div id="summarySection">
        <h2>Summary</h2>
        <p>${data.summary}</p>
    </div>`;

    // ----------------------------------------
    // FLASHCARDS
    // Always shown
    // Number varies based on emotional state
    // Each card shows front (concept) and back (explanation)
    // Card counter shows position e.g. "Card 1 of 6"
    // ----------------------------------------
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
    // PRACTICE QUESTIONS
    // Only shown if questions array is not empty
    // Empty when student is Overwhelmed
    // Type varies based on preparation level
    // ----------------------------------------
    if (data.questions && data.questions.length > 0) {
        html += `<div id="questionsSection">
            <h2>Practice Questions</h2>`;

        data.questions.forEach((q, index) => {
            html += `<p>${index + 1}. ${q}</p>`;
        });

        html += `</div>`;
    }

    // ----------------------------------------
    // FEEDBACK FORM
    // Appears after every successful generation
    // Submitted to Formspree — responses stored there
    // Four questions: level, check-in, readiness, open text
    // Replaced with a thank you message on submit
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

    // Insert all the built HTML into the output section
    output.innerHTML = html;

    // ----------------------------------------
    // FEEDBACK FORM SUBMISSION
    // Attached after innerHTML is set so the
    // form element exists in the DOM
    // Sends data to Formspree via POST
    // Replaces form with a thank you message on success
    // ----------------------------------------
    // Feedback button toggle logic
    const feedbackBtns = document.querySelectorAll('.feedback-btn');
    const selections = { level: null, checkin: null, readiness: null };

    feedbackBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const name = btn.dataset.name;
            // Deselect all buttons in the same group
            document.querySelectorAll(`.feedback-btn[data-name="${name}"]`).forEach(b => {
                b.classList.remove('feedback-btn-selected');
            });
            // Select the clicked one
            btn.classList.add('feedback-btn-selected');
            selections[name] = btn.dataset.value;
        });
    });

    const feedbackSubmitBtn = document.getElementById('feedbackSubmitBtn');
    const feedbackError = document.getElementById('feedbackError');

    feedbackSubmitBtn.addEventListener('click', async () => {
        // Validate all three questions are answered
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