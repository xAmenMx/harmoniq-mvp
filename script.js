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
const fileUpload = document.querySelector('#fileUpload');
const fileUploadStatus = document.querySelector('#fileUploadStatus');
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


// ============================================
// PREMIUM BADGE
// ============================================

const premiumBadge = document.getElementById('premiumBadge');
premiumBadge.addEventListener('click', () => {
    showPremiumModal();
});

function showPremiumModal() {
    const premiumModal = document.createElement('div');
    premiumModal.id = 'premiumModalOverlay';
    premiumModal.style.cssText = `
        position: fixed;
        inset: 0;
        background: var(--overlay-bg);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 101;
        padding: 24px;
    `;

    premiumModal.innerHTML = `
        <div style="background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-md); max-width: 420px; width: 100%; padding: 36px 32px; animation: slideUp 0.25s ease;">
            <p style="font-family: 'Lora', serif; font-size: 1.2rem; color: var(--text-primary); margin-bottom: 8px; font-weight: 600;">Harmoniq Premium</p>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 20px;">Coming soon. Here's what's on the way.</p>
            
            <div style="background: var(--accent-light); border-radius: var(--radius-sm); padding: 18px 16px; margin-bottom: 20px;">
                <ul style="list-style: none; font-size: 0.9rem; color: var(--text-primary); line-height: 1.8;">
                    <li style="margin-bottom: 10px;">✓ <strong>Up to 20 sessions per day</strong> — Study as much as you need</li>
                    <li style="margin-bottom: 10px;">✓ <strong>Upload documents</strong> — Work with PDFs, Word files, and more</li>
                    <li>✓ <strong>Saved subjects & history</strong> — Pick up where you left off. Track your progress over time.</li>
                </ul>
            </div>
            
            <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6; margin-bottom: 20px;">Premium pricing will start at <strong>RM 49/month</strong>, with flexible pay-per-session options too.</p>
            
            <button style="width: 100%; background: var(--accent); color: #ffffff; border: none; border-radius: var(--radius-sm); font-family: 'DM Sans', sans-serif; font-size: 0.9rem; font-weight: 500; padding: 12px 20px; cursor: pointer; transition: all 0.2s ease;" onclick="closePremiumModal()">Got it</button>
        </div>
    `;

    document.body.appendChild(premiumModal);
}

function closePremiumModal() {
    const modal = document.getElementById('premiumModalOverlay');
    if (modal) modal.remove();
}


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
// Beta users get a fixed number of generations
// per day per betaCode. Tracked in localStorage
// keyed to betaCode + date, so it survives page
// reloads and persists across devices for the
// same betaCode, but resets naturally the next day.
// ============================================

const DAILY_LIMIT = 3;

// Returns today's date as a simple string, used as the storage key
function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Reads how many generations have been used today
// Keyed by betaCode so limit is per user, not per device
// Returns 0 if nothing is stored yet, or if the stored date isn't today
function getUsageCount() {
    let stored;
    try {
        stored = JSON.parse(localStorage.getItem(`harmoniqUsage_${betaCode}`));
    } catch (e) {
        stored = null;
    }
    if (!stored || stored.date !== getTodayString()) {
        return 0;
    }
    return stored.count;
}

// Increments today's usage count by one
// Keyed by betaCode so limit is per user, not per device
function incrementUsageCount() {
    const current = getUsageCount();
    localStorage.setItem(`harmoniqUsage_${betaCode}`, JSON.stringify({
        date: getTodayString(),
        count: current + 1
    }));
}

// Logs beta session to Formspree for analytics
function logBetaSession(sessionData) {
    const payload = {
        type: 'beta_session_log',
        betaCode: betaCode,
        timestamp: new Date().toISOString(),
        subject: sessionData.subject,
        emotionalState: sessionData.emotionalState,
        sessionType: sessionData.sessionType,
        daysRemaining: sessionData.daysRemaining
    };

    fetch('https://formspree.io/f/xnjgpeqn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).catch(err => {
        console.log('Session log failed (non-critical):', err.message);
    });
}


// ============================================
// FILE UPLOAD — TEXT EXTRACTION
// Runs entirely in the browser. Extracted text
// fills the notes textarea, then flows through
// the exact same word-count check and generation
// pipeline as pasted text — no backend changes.
//
// NOTE: This currently runs on the free tier.
// When accounts/premium exist, gate this behind
// a premium check before calling extractFromFile().
// ============================================

const MAX_FILE_SIZE_MB = 8;

if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

fileUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    fileUploadStatus.className = '';
    fileUploadStatus.textContent = 'Reading file...';

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        fileUploadStatus.className = 'upload-error';
        fileUploadStatus.textContent = `File is too large. Please keep it under ${MAX_FILE_SIZE_MB}MB.`;
        return;
    }

    try {
        let extractedText = '';
        let pdfPageCount = null;
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith('.txt')) {
            extractedText = await extractFromTxt(file);
        } else if (fileName.endsWith('.pdf')) {
            const pdfResult = await extractFromPdf(file);
            extractedText = pdfResult.text;
            pdfPageCount = pdfResult.numPages;
        } else if (fileName.endsWith('.docx')) {
            extractedText = await extractFromDocx(file);
        } else {
            fileUploadStatus.className = 'upload-error';
            fileUploadStatus.textContent = 'Unsupported file type. Please upload a PDF, DOCX, or TXT file.';
            return;
        }

        extractedText = sanitizeExtractedText(extractedText);

        if (extractedText === '') {
            fileUploadStatus.className = 'upload-error';
            fileUploadStatus.textContent = "Couldn't find readable text in this file. It may be scanned or image-based — try pasting your notes manually instead.";
            return;
        }

        notes.value = extractedText;
        notes.dispatchEvent(new Event('input')); // triggers the existing word count update

        const words = extractedText.split(/\s+/).length;

        // Heuristic: a text-based PDF page typically holds well over
        // 15 words. A low words-per-page average usually means most
        // pages are diagrams, charts, or scanned images with only a
        // title or caption actually extracted — common in slide decks
        // exported to PDF. Warn instead of silently under-delivering.
        const wordsPerPage = pdfPageCount ? words / pdfPageCount : null;

        if (wordsPerPage !== null && wordsPerPage < 15) {
            fileUploadStatus.className = 'upload-warning';
            fileUploadStatus.textContent = `Loaded "${file.name}" — but only ${words} words came through across ${pdfPageCount} pages. This often happens with scanned pages or slide decks where content lives in images or diagrams. Please review the notes below before generating.`;
        } else {
            fileUploadStatus.className = 'upload-success';
            fileUploadStatus.textContent = `Loaded "${file.name}" — ${words} words extracted.`;
        }

    } catch (err) {
        console.error('File extraction error:', err.message);
        fileUploadStatus.className = 'upload-error';
        fileUploadStatus.textContent = "Couldn't read that file. Please try a different one or paste your notes manually.";
    }
});

function extractFromTxt(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read text file'));
        reader.readAsText(file);
    });
}

async function extractFromPdf(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ');
        fullText += pageText + '\n\n';
    }

    return { text: fullText, numPages: pdf.numPages };
}

function extractFromDocx(file) {
    return new Promise(async (resolve, reject) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            resolve(result.value);
        } catch (err) {
            reject(err);
        }
    });
}

// Cleans up text pulled from PDFs/DOCX files. PDF exports (Notion
// especially) sometimes render checkboxes/toggles/icons using a
// custom icon font — the extracted "text" for those is a character
// code that only means something in that font, so it shows as a
// broken box (□) everywhere else. There's no way to recover the
// original icon, so we strip it. Real Unicode checkbox characters
// are converted to plain brackets instead, since those do carry
// meaning worth keeping.
function sanitizeExtractedText(text) {
    return text
        .replace(/\u2610/g, '[ ]')   // ☐ empty checkbox
        .replace(/\u2611/g, '[x]')   // ☑ checked checkbox
        .replace(/\u2612/g, '[x]')   // ☒ checked (X) checkbox
        .replace(/[\uE000-\uF8FF]/g, '')   // Private Use Area — broken icon-font glyphs
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '') // stray control characters
        .replace(/[ \t]{2,}/g, ' ')   // collapse leftover repeated spaces/tabs
        .replace(/\n{3,}/g, '\n\n')  // collapse excessive blank lines
        .trim();
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
        showDailyLimitModal();
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
// BETA CODE MANAGEMENT
// ============================================

const VALID_BETA_CODES = [
    'BETA001', 'BETA002', 'BETA003', 'BETA004', 'BETA005',
    'BETA006', 'BETA007', 'BETA008', 'BETA009', 'BETA010',
    'BETA011', 'BETA012', 'BETA013', 'BETA014', 'BETA015',
    'BETA016', 'BETA017', 'BETA018', 'BETA019', 'BETA020'
];

let betaCode = localStorage.getItem('harmoniqBetaCode');

if (!betaCode) {
    showBetaCodeModal();
}

function showBetaCodeModal() {
    const modal = document.createElement('div');
    modal.id = 'betaCodeModalOverlay';
    modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: var(--overlay-bg);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 102;
        padding: 24px;
    `;

    modal.innerHTML = `
        <div style="background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-md); max-width: 380px; width: 100%; padding: 36px 32px; animation: slideUp 0.25s ease;">
            <p style="font-family: 'Lora', serif; font-size: 1.15rem; color: var(--text-primary); margin-bottom: 12px; font-weight: 400;">Beta Test Access</p>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 20px; line-height: 1.6;">Enter your beta code from the sign-up sheet to get started.</p>
            
            <input type="text" id="betaCodeInput" style="width: 100%; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); font-family: 'DM Sans', sans-serif; font-size: 0.95rem; padding: 12px 16px; margin-bottom: 12px; text-transform: uppercase; outline: none; transition: border-color 0.2s ease;" placeholder="e.g. BETA001">
            
            <p id="betaCodeError" style="font-size: 0.8rem; color: var(--error-color); margin-bottom: 12px; display: none;"></p>
            
            <button type="button" id="betaCodeSubmit" style="width: 100%; background: var(--accent); color: #ffffff; border: none; border-radius: var(--radius-sm); font-family: 'DM Sans', sans-serif; font-size: 0.9rem; font-weight: 500; padding: 12px 20px; cursor: pointer; transition: all 0.2s ease;">Continue</button>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('betaCodeSubmit').addEventListener('click', storeBetaCode);
    document.getElementById('betaCodeInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') storeBetaCode();
    });
}

function storeBetaCode() {
    const code = document.getElementById('betaCodeInput').value.trim().toUpperCase();
    const errorEl = document.getElementById('betaCodeError');

    if (!code) {
        errorEl.textContent = 'Please enter a code.';
        errorEl.style.display = 'block';
        return;
    }

    if (!VALID_BETA_CODES.includes(code)) {
        errorEl.textContent = 'Code not recognized. Check the sign-up sheet.';
        errorEl.style.display = 'block';
        return;
    }

    localStorage.setItem('harmoniqBetaCode', code);
    betaCode = code;
    document.getElementById('betaCodeModalOverlay').remove();
}


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
// DAILY LIMIT MODAL
// ============================================

function showDailyLimitModal() {
    const limitModal = document.createElement('div');
    limitModal.id = 'dailyLimitModalOverlay';
    limitModal.style.cssText = `
        position: fixed;
        inset: 0;
        background: var(--overlay-bg);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 101;
        padding: 24px;
    `;

    limitModal.innerHTML = `
        <div style="background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-md); max-width: 420px; width: 100%; padding: 36px 32px; animation: slideUp 0.25s ease;">
            <p style="font-family: 'Lora', serif; font-size: 1.15rem; color: var(--text-primary); margin-bottom: 8px; font-weight: 400;">You've used your ${DAILY_LIMIT} free sessions for today.</p>
            <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 28px; line-height: 1.6;">Come back tomorrow for more, or be among the first to try Harmoniq Premium when it launches.</p>
            
            <div style="background: var(--accent-light); border-left: 3px solid var(--accent); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; padding: 14px 16px; margin-bottom: 24px;">
                <p style="font-size: 0.8rem; font-weight: 500; color: var(--accent); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Coming Soon — Premium includes:</p>
                <ul style="list-style: none; font-size: 0.85rem; color: var(--text-primary); line-height: 1.7;">
                    <li>✓ Up to 20 sessions per day</li>
                    <li>✓ Upload files & documents</li>
                    <li>✓ Save subjects & study history</li>
                </ul>
            </div>
            
            <div style="display: flex; gap: 10px; flex-direction: column;">
                <button class="dailyLimitBtn dailyLimitUpgrade" type="button">Interested? Tell us</button>
                <button class="dailyLimitBtn dailyLimitWait" type="button">Wait Until Tomorrow</button>
            </div>
        </div>
    `;

    document.body.appendChild(limitModal);

    limitModal.querySelector('.dailyLimitUpgrade').addEventListener('click', () => {
        // TODO: navigate to interest form or early access signup
        console.log('Interest signaled');
        alert("Thanks for your interest! We'll reach out when Premium launches.");
        limitModal.remove();
    });

    limitModal.querySelector('.dailyLimitWait').addEventListener('click', () => {
        limitModal.remove();
    });
};


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
    // PAYLOAD
    // Prompt construction now lives in api/generate.js,
    // since it needs to build two different prompts —
    // one for DeepSeek, one for Claude. The frontend
    // just sends the raw inputs.
    // ----------------------------------------
    const payload = {
        subject: subject.value,
        academicLevel: academicLevel.value,
        prepLevel: prepLevel.value,
        emotionalState: emotionalState,
        sessionType: sessionType,
        daysRemaining: daysRemaining,
        notes: notes.value
    };

    // ----------------------------------------
    // API CALL
    // ----------------------------------------
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Server error');

        const data = await response.json();

        if (data.error) {
            output.innerHTML = `<p>${data.error}</p>`;
            return;
        }

        // Only count successful generations toward the daily limit
        incrementUsageCount();

        // Log session for beta analytics
        logBetaSession({
            subject: subject.value,
            emotionalState: emotionalState,
            sessionType: sessionType,
            daysRemaining: sessionType === 'exam' ? daysRemaining : null
        });

        renderOutput(data, daysRemaining);

    } catch (err) {
        console.error('Error:', err.message);
        output.innerHTML = '<p>Something went wrong. Please try again.</p>';
    }
}


// ============================================
// FORMAT SUMMARY TEXT
// The AI is instructed to use "- " for bullets
// and "1. " for numbered lines when the content
// is genuinely a short list. This converts those
// plain-text markers into real <ul>/<ol> HTML
// instead of dumping raw dashes into a paragraph.
// Plain prose lines become normal <p> paragraphs.
// ============================================

function formatSummaryText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l !== '');

    let html = '';
    let listBuffer = [];
    let listType = null; // 'ul' or 'ol'

    function flushList() {
        if (listBuffer.length === 0) return;
        const tag = listType === 'ol' ? 'ol' : 'ul';
        html += `<${tag}>` + listBuffer.map(item => `<li>${item}</li>`).join('') + `</${tag}>`;
        listBuffer = [];
        listType = null;
    }

    lines.forEach(line => {
        const bulletMatch = line.match(/^-\s+(.*)/);
        const numberedMatch = line.match(/^\d+\.\s+(.*)/);

        if (bulletMatch) {
            if (listType && listType !== 'ul') flushList();
            listType = 'ul';
            listBuffer.push(bulletMatch[1]);
        } else if (numberedMatch) {
            if (listType && listType !== 'ol') flushList();
            listType = 'ol';
            listBuffer.push(numberedMatch[1]);
        } else {
            flushList();
            html += `<p>${line}</p>`;
        }
    });

    flushList();
    return html;
}
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
        ${formatSummaryText(data.summary)}
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
    // MCQuestions (interactive) + Concept Boosters
    // (reflective questions) + comeback message
    // ----------------------------------------
    if (sessionType === 'normal') {
        if (data.mcquestions && data.mcquestions.length > 0) {
            html += `<div id="mcquestionsSection">
                <h2>Check Your Understanding</h2>`;
            data.mcquestions.forEach((q, index) => {
                html += `<div class="mcquestion" data-index="${index}" data-correct="${q.correctAnswer}" data-explanation="${q.explanation.replace(/"/g, '&quot;')}">
                    <p class="mcquestion-text"><strong>${index + 1}. ${q.question}</strong></p>
                    <div class="mcquestion-options">`;
                q.options.forEach(opt => {
                    html += `<button type="button" class="mcquestion-option" data-option="${opt}">${opt}</button>`;
                });
                html += `</div><div class="mcquestion-result" style="display:none;"></div></div>`;
            });
            html += `</div>`;
        }
        if (data.questions && data.questions.length > 0) {
            html += `<div id="bonusQuestionsSection">
                <h2>Concept Boosters</h2>
                <p style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:14px;">Reflect on these questions to deepen your understanding.</p>`;
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

    // ----------------------------------------
    // MCQ INTERACTION (Normal session type)
    // ----------------------------------------
    if (sessionType === 'normal' && data.mcquestions && data.mcquestions.length > 0) {
        document.querySelectorAll('.mcquestion').forEach(qEl => {
            const optionBtns = qEl.querySelectorAll('.mcquestion-option');
            const resultDiv = qEl.querySelector('.mcquestion-result');
            const correctAnswer = qEl.dataset.correct;
            const explanation = qEl.dataset.explanation;
            let answered = false;

            optionBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    if (answered) return;
                    answered = true;

                    const selected = btn.dataset.option;
                    const isCorrect = selected === correctAnswer;

                    optionBtns.forEach(b => {
                        b.disabled = true;
                        if (b.dataset.option === correctAnswer) {
                            b.classList.add('mcquestion-correct');
                            b.innerHTML = `✓ ${b.textContent}`;
                        }
                        if (b.dataset.option === selected && !isCorrect) {
                            b.classList.add('mcquestion-incorrect');
                            b.innerHTML = `✗ ${b.textContent}`;
                        }
                    });

                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = `
                        <div style="margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border);">
                            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px;"><strong>${isCorrect ? '✓ Correct!' : '✗ Not quite.'}</strong></p>
                            <p style="font-size: 0.85rem; color: var(--text-primary); line-height: 1.6;">${explanation}</p>
                        </div>
                    `;
                });
            });
        });
    }

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
            type: 'beta_feedback',
            betaCode: betaCode,
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
                    btn.innerHTML = `✓ ${btn.textContent}`;
                }
                if (i === selected && selected !== correctIndex) {
                    btn.classList.add('quiz-option-incorrect');
                    btn.innerHTML = `✗ ${btn.textContent}`;
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