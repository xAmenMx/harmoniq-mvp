// ============================================
// HARMONIQ - SERVER.JS (local development only)
// Mirrors api/generate.js so local testing behaves
// the same as the deployed Vercel version.
// Hybrid provider setup:
//   - DeepSeek V4-Flash generates summary,
//     flashcards, mcquestions, and questions
//   - Claude Sonnet generates the exam quiz
//     (only called when session type is "Exam")
// ============================================


// ============================================
// IMPORTS
// ============================================

const http = require('http');
const Anthropic = require('@anthropic-ai/sdk');


// ============================================
// API CLIENTS
// Both keys are read from a local .env file.
// Never hardcode keys directly in this file.
// ============================================

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

// TODO: Confirm this against the exact model name shown in your
// DeepSeek dashboard/docs — model naming has changed over time.
const DEEPSEEK_MODEL = 'deepseek-v4-flash';


// ============================================
// SERVER
// Listens for POST requests from the frontend
// at http://localhost:3000/generate
// ============================================

const server = http.createServer(async (req, res) => {

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/generate') {

        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const {
                    subject,
                    academicLevel,
                    prepLevel,
                    emotionalState,
                    sessionType,
                    daysRemaining,
                    notes
                } = JSON.parse(body);

                // ----------------------------------------
                // WORD COUNT GUARD
                // ----------------------------------------
                const wordCount = notes.trim() === '' ? 0 : notes.trim().split(/\s+/).length;
                if (wordCount > 3000) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: "Your notes are too long. Please paste the most relevant section, ideally under 3,000 words, and try again."
                    }));
                    return;
                }

                // ----------------------------------------
                // DEEPSEEK — CONTENT GENERATION
                // ----------------------------------------
                const deepseekSystemPrompt = buildDeepSeekPrompt(sessionType, daysRemaining);
                const userMessage = buildUserMessage(subject, academicLevel, prepLevel, emotionalState, sessionType, daysRemaining, notes);

                const deepseekResult = await callDeepSeek(deepseekSystemPrompt, userMessage);

                if (deepseekResult.error) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: deepseekResult.error }));
                    return;
                }

                // ----------------------------------------
                // CLAUDE — EXAM QUIZ ONLY
                // ----------------------------------------
                let quiz = [];
                if (sessionType === 'exam') {
                    const claudeSystemPrompt = buildClaudeQuizPrompt(academicLevel, emotionalState, daysRemaining);
                    const claudeResult = await callClaude(claudeSystemPrompt, userMessage);
                    quiz = claudeResult.quiz || [];
                }

                // ----------------------------------------
                // MERGE — same six-key shape frontend expects
                // ----------------------------------------
                const merged = {
                    grounding: deepseekResult.grounding || '',
                    summary: deepseekResult.summary || '',
                    flashcards: deepseekResult.flashcards || [],
                    mcquestions: deepseekResult.mcquestions || [],
                    questions: deepseekResult.questions || [],
                    quiz: quiz
                };

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(merged));

            } catch (err) {
                console.error('Server error:', err.message);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Something went wrong on the server.' }));
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint not found.' }));
    }
});


// ============================================
// BUILD USER MESSAGE (shared by both providers)
// ============================================

function buildUserMessage(subject, academicLevel, prepLevel, emotionalState, sessionType, daysRemaining, notes) {
    return `Subject: ${subject}
Academic level: ${academicLevel}
Preparation level: ${prepLevel}
Current state: ${emotionalState}
Session type: ${sessionType}${sessionType === 'exam' ? `\nDays until exam: ${daysRemaining}` : ''}
Notes: ${notes}`;
}


// ============================================
// BUILD DEEPSEEK PROMPT
// ============================================

function buildDeepSeekPrompt(sessionType, daysRemaining) {
    return `You are a study assistant for Harmoniq, a tool designed to help students learn effectively without feeling overwhelmed. Your job is to convert student notes into clear, concise study materials.

Generate the following output in JSON format with five keys: "grounding", "summary", "flashcards", "mcquestions", and "questions".

If the student's notes exceed 3,000 words, return a JSON object with a single key: "error" with the value: "Your notes are too long. Please paste the most relevant section, ideally under 3,000 words, and try again."

Rules:

Academic level adjustment: Adjust vocabulary and depth of explanation based on academic level.
- Secondary: simple everyday language, avoid jargon, foundational explanations suitable for Grade 8-10 students.
- Pre-university: more advanced than secondary, approaching undergraduate complexity but without assuming university level prior knowledge.
- Undergraduate: standard academic language, moderate complexity.
- Postgraduate: technical language appropriate, assume stronger prior knowledge.

Summary: This is a prioritization exercise, not a compression of the whole document. Identify only the 2-4 ideas a student most needs to walk away understanding, and build the summary around those. It is correct and expected to leave out most subtopics, categories, and enumerated lists entirely — do not mention every item in a list just because it exists in the notes (e.g. if the notes list seven stages of something, do not name all seven; refer to "a multi-stage process" or similar and only elaborate on the one or two stages that matter most). Where possible, end with one synthesizing insight that connects the ideas or explains why they matter, rather than only listing facts — this is more valuable to a student than coverage. Write 3-5 sentences in plain, simple language. If the student is overwhelmed, shorten to 2-3 sentences and prioritize even more aggressively. Never verbose, and never aim for completeness.

Flashcards: Generate between 5-10 cards, each with a "front" and "back" key. If the student is overwhelmed, generate only 5 cards.

Session type: The student selects either "Normal" or "Exam" as their session type.
- If session type is "Normal": populate both "mcquestions" and "questions" following the rules below.
- If session type is "Exam": leave "mcquestions" and "questions" as empty arrays. The quiz for exam sessions is handled separately — do not generate it here.

MCQuestions (Normal session type only): Generate 3-4 multiple-choice questions as a learning tool, not scored. Each is an object with four keys: "question" (text), "options" (array of exactly 4 strings), "correctAnswer" (the correct option text, matching one of the options exactly), and "explanation" (1-2 sentences explaining why this answer is correct and what makes the other options incorrect). These help students evaluate their own understanding without pressure. If the student is overwhelmed: skip mcquestions, return an empty array.

Questions (Normal session type only): Generate 2-3 Socratic/reflective questions as a simple array of strings. Each question is just the question text — no objects. Match type to preparation level:
- "First time seeing it" or "Read once": general recall questions — what, define, describe.
- "Read a few times": mix of recall and Socratic questions.
- "Very familiar": Socratic questions only — why, how, what if, what is the connection.
- If the student is overwhelmed: skip questions entirely, return an empty array.

Emotional state adjustments:
- Ready: deliver full output, empty grounding string.
- Distracted: populate the grounding key with a calm, gentle two-sentence message. This is the most emotionally important line in the entire output — it should feel like a caring friend acknowledging how the student feels, not an assistant redirecting them toward productivity. Avoid words and phrases like "no problem," "let's get back to," "focused study," or anything that frames distraction as a problem to fix efficiently. Validate the feeling first, then ease gently into the materials. Vary the wording every time — never repeat the same message twice.

Examples of the right tone (write new ones each time — do not copy these, but match this warmth, softness, and pacing):
- "It's okay if your mind is pulling in a few directions right now. Let's ease into this gently, one small piece at a time."
- "A scattered mind before studying is more common than it feels. Here's something simple to help you settle back in."
- "Wherever your attention has been wandering, that's alright. We'll keep things light and clear so it's easy to find your footing again."
- Overwhelmed: 5 flashcards, 3-4 sentence summary, empty questions array, empty grounding string.

${sessionType === 'exam' ? `Exam urgency: The student has ${daysRemaining} day(s) until their exam. Let this inform the tone and focus of the summary and flashcards without being alarming — fewer days remaining means prioritising only the most essential concepts.` : ''}

Note length:
- If notes are very brief, work with what is given without padding or inventing content.
- If notes are very long but under 3,000 words, identify and prioritise only the most repeated and emphasised concepts.
- Do not introduce concepts not present in the notes.

Tone for summary, flashcards, mcquestions, and questions: clear and informative. Never preachy, never overwhelming. The grounding message follows its own warmer tone as described above — this informational tone rule does not apply to it.

CRITICAL: Your response must be valid, parseable JSON only. No extra braces, no missing commas, no trailing commas, no markdown code fences. Double-check your JSON structure before responding.`;
}


// ============================================
// BUILD CLAUDE QUIZ PROMPT
// ============================================

function buildClaudeQuizPrompt(academicLevel, emotionalState, daysRemaining) {
    return `You are generating a diagnostic multiple-choice quiz for Harmoniq, a study tool. The quiz's purpose is to reveal which specific concepts a student has and hasn't understood, so the app can tell them what to focus on next.

Generate the output in JSON format with a single key: "quiz" — an array of quiz question objects.

Each quiz question is an object with four keys:
- "concept": a short 2-4 word label naming the topic being tested
- "question": the question text
- "options": an array of exactly 4 answer choices as strings
- "correctIndex": the zero-based index of the correct option

Rules:
- Generate 5 quiz questions normally, or 3 if the student's current state is "Overwhelmed".
- Cover a spread of concepts from the notes rather than repeating the same one.
- Make incorrect options plausible, not obviously wrong, so the quiz genuinely tests understanding rather than being trivially guessable.
- Adjust difficulty to match academic level: ${academicLevel}.
- The student has ${daysRemaining} day(s) until their exam — this does not need to change the questions themselves, just keep them focused on the most essential concepts if time is short.
- Base every question strictly on the student's notes. Do not introduce outside concepts.

CRITICAL: Your response must be valid, parseable JSON only. No extra braces, no missing commas, no trailing commas, no markdown code fences.`;
}


// ============================================
// CALL DEEPSEEK
// ============================================

async function callDeepSeek(systemPrompt, userMessage) {
    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ],
            response_format: { type: 'json_object' }
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`DeepSeek API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const text = data.choices[0].message.content;
    return JSON.parse(text);
}


// ============================================
// CALL CLAUDE
// ============================================

async function callClaude(systemPrompt, userMessage) {
    const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
    });

    const text = response.content[0].text;
    return JSON.parse(text);
}


// ============================================
// START SERVER
// ============================================

server.listen(3000, () => {
    console.log('Harmoniq server running at http://localhost:3000');
});