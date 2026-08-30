// ============================================
// HARMONIQ - API/GENERATE.JS
// Vercel serverless function
// Replaces server.js for the deployed version
// Receives requests from the frontend,
// calls the Anthropic API, returns JSON
// ============================================

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

module.exports = async (req, res) => {
    // Allow the frontend to communicate with this function
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    // Only handle POST requests
    if (req.method !== 'POST') {
        res.status(404).json({ error: 'Endpoint not found.' });
        return;
    }

    try {
        const { systemPrompt, userMessage } = req.body;

        // Call the Anthropic API
        const message = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1500,
            system: systemPrompt,
            messages: [
                { role: 'user', content: userMessage }
            ]
        });

        // Extract and clean the response
        const rawText = message.content[0].text;
        const cleaned = rawText.replace(/```json|```/g, '').trim();

        // Parse the JSON
        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        } catch (parseErr) {
            console.error('JSON parse failed:', parseErr.message);
            res.status(500).json({
                error: 'The AI returned malformed data. Please try again.'
            });
            return;
        }

        // Return the parsed JSON to the frontend
        res.status(200).json(parsed);

    } catch (err) {
        console.error('Server error:', err.message);
        res.status(500).json({ error: 'Something went wrong on the server.' });
    }
};