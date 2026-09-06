// ============================================
// HARMONIQ - API/GENERATE.JS (Vercel serverless)
// Hybrid provider setup:
//   - DeepSeek V4-Flash generates summary,
//     flashcards, mcquestions, and questions
//     (high volume, fast, cheap)
//   - Claude Sonnet generates the exam quiz
//     (needs precise concept tagging for
//     weak-area detection — only called when
//     session type is "Exam")
// The two results are merged into the same
// six-key JSON shape the frontend expects, so
// script.js and renderOutput() don't need to
// know which provider produced which part.
// ============================================

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

// TODO: Confirm this against the exact model name shown in your
// DeepSeek dashboard/docs — model naming has changed over time.
const DEEPSEEK_MODEL = 'deepseek-v4-flash';


module.exports = async (req, res) => {
    try {
        const {
            subject,
            academicLevel,
            prepLevel,
            emotionalState,
            sessionType,
            daysRemaining,
            notes
        } = req.body;

        // ----------------------------------------
        // WORD COUNT GUARD
        // Moved here since this file now owns all
        // prompt construction and validation logic.
        // ----------------------------------------
        const wordCount = notes.trim() === '' ? 0 : notes.trim().split(/\s+/).length;
        if (wordCount > 3000) {
            return res.status(200).json({
                error: "Your notes are too long. Please paste the most relevant section, ideally under 3,000 words, and try again."
            });
        }

        // ----------------------------------------
        // DEEPSEEK — CONTENT GENERATION
        // Always called. Produces grounding,
        // summary, flashcards, mcquestions, questions.
        // ----------------------------------------
        const deepseekSystemPrompt = buildDeepSeekPrompt(sessionType, daysRemaining);
        const userMessage = buildUserMessage(subject, academicLevel, prepLevel, emotionalState, sessionType, daysRemaining, notes);

        const deepseekResult = await callDeepSeek(deepseekSystemPrompt, userMessage);

        if (deepseekResult.error) {
            return res.status(200).json({ error: deepseekResult.error });
        }

        // ----------------------------------------
        // CLAUDE — EXAM QUIZ ONLY
        // Only called when session type is "Exam".
        // Handles quiz generation, which needs
        // reliable concept tagging for weak-area
        // detection on the frontend.
        // ----------------------------------------
        let quiz = [];
        if (sessionType === 'exam') {
            const claudeSystemPrompt = buildClaudeQuizPrompt(academicLevel, emotionalState, daysRemaining);
            const claudeResult = await callClaude(claudeSystemPrompt, userMessage);
            quiz = claudeResult.quiz || [];
        }

        // ----------------------------------------
        // MERGE — same six-key shape as before
        // ----------------------------------------
        const merged = {
            grounding: deepseekResult.grounding || '',
            summary: deepseekResult.summary || '',
            flashcards: deepseekResult.flashcards || [],
            mcquestions: deepseekResult.mcquestions || [],
            questions: deepseekResult.questions || [],
            quiz: quiz
        };

        res.status(200).json(merged);

    } catch (err) {
        console.error('Generate error:', err.message);
        res.status(200).json({ error: "Something went wrong. Please try again." });
    }
};


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
// Content generation only — no quiz logic here.
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

Summary: Write 5-6 sentences covering only the most important concepts from the notes. If the student is overwhelmed, shorten to 3-4 sentences. Plain, simple language. Never verbose.

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
- Distracted: populate the grounding key with a calm, human two-sentence message. Vary the wording each time — never repeat the same message twice. Warm but brief.
- Overwhelmed: 5 flashcards, 3-4 sentence summary, empty questions array, empty grounding string.

${sessionType === 'exam' ? `Exam urgency: The student has ${daysRemaining} day(s) until their exam. Let this inform the tone and focus of the summary and flashcards without being alarming — fewer days remaining means prioritising only the most essential concepts.` : ''}

Note length:
- If notes are very brief, work with what is given without padding or inventing content.
- If notes are very long but under 3,000 words, identify and prioritise only the most repeated and emphasised concepts.
- Do not introduce concepts not present in the notes.

Tone: clear and informative. Never preachy, never overly warm, never overwhelming.

CRITICAL: Your response must be valid, parseable JSON only. No extra braces, no missing commas, no trailing commas, no markdown code fences. Double-check your JSON structure before responding.`;
}


// ============================================
// BUILD CLAUDE QUIZ PROMPT
// Exam session type only. Focused purely on
// generating a well-tagged multiple-choice quiz.
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
// OpenAI-compatible chat completions endpoint
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
// Anthropic messages API
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