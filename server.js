// ============================================
// HARMONIQ - SERVER.JS
// Simple Node.js backend that:
// 1. Receives requests from the frontend
// 2. Adds the API key securely
// 3. Forwards the request to Anthropic
// 4. Returns the parsed JSON response
// ============================================


// ============================================
// IMPORTS
// http - built into Node.js, creates the server
// Anthropic - the SDK we installed earlier
// ============================================

const http = require('http');
const Anthropic = require('@anthropic-ai/sdk');


// ============================================
// API CLIENT
// The API key is read from an environment variable
// For local development: set it in a .env file
// For Vercel: set it in the Vercel dashboard
// Never hardcode the key directly in this file
// ============================================

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});


// ============================================
// SERVER
// Listens for POST requests from the frontend
// at http://localhost:3000/generate
// ============================================

const server = http.createServer(async (req, res) => {

    // Allow the frontend to communicate with this server
    // These headers prevent CORS errors in the browser
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests sent by the browser
    // before the actual POST request
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Only handle POST requests to /generate
    // Ignore anything else
    if (req.method === 'POST' && req.url === '/generate') {

        // ----------------------------------------
        // COLLECT REQUEST BODY
        // The frontend sends data in chunks
        // We collect them all then parse as JSON
        // ----------------------------------------
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                // Parse the incoming JSON from the frontend
                // Contains systemPrompt and userMessage
                const { systemPrompt, userMessage } = JSON.parse(body);

                // ----------------------------------------
                // ANTHROPIC API CALL
                // Send both the system prompt and user
                // message to Claude and await the response
                // ----------------------------------------
                const message = await client.messages.create({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 1500,
                    system: systemPrompt,
                    messages: [
                        { role: 'user', content: userMessage }
                    ]
                });

                // ----------------------------------------
                // PARSE RESPONSE
                // Extract the text from the API response
                // Strip any markdown code fences if present
                // Attempt to parse as JSON
                // If parsing fails, return a friendly error
                // rather than crashing or showing nothing
                // ----------------------------------------
                const rawText = message.content[0].text;

                // Remove ```json and ``` markers if the AI
                // wraps its response in markdown code blocks
                const cleaned = rawText.replace(/```json|```/g, '').trim();

                // Attempt to parse the cleaned text as JSON
                // If the AI returns malformed JSON, catch it
                // and return a friendly error to the frontend
                let parsed;
                try {
                    parsed = JSON.parse(cleaned);
                } catch (parseErr) {
                    // Log exactly what failed and why for debugging
                    console.error('JSON parse failed:', parseErr.message);
                    console.error('Cleaned text was:', cleaned);

                    // Send a friendly error back to the frontend
                    // instead of crashing or showing a blank screen
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: 'The AI returned malformed data. Please try again.'
                    }));
                    return;
                }

                // Send the successfully parsed JSON back to the frontend
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(parsed));

            } catch (err) {
                // Log the error for debugging
                console.error('Server error:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Something went wrong on the server.' }));
            }
        });
    } else {
        // For any requests that are not POST to /generate,
        // return a 404 Not Found response
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint not found.' }));
    }
});

// ============================================
// START SERVER
// Listens on port 3000
// You should see a confirmation message below
// ============================================

server.listen(3000, () => {
    console.log('Harmoniq server running at http://localhost:3000');
});