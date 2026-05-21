const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const express = require('express');
const https = require('https');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL || '';

// Put your real phone number here with country code (e.g., 919892758104)
const MY_PHONE = "919892758104"; 

let SYSTEM_PROMPT = 'You are a helpful assistant.';
try {
    if (fs.existsSync('prompt.txt')) {
        SYSTEM_PROMPT = fs.readFileSync('prompt.txt', 'utf8').trim();
    }
} catch (e) {
    console.log("Using default fallback prompt rules.");
}

let globalSock = null;
let generatedCode = '';
let connectionErrorLog = 'System initialized. Waiting for web hook event...';

// 1. DYNAMIC DASHBOARD (Shows code on screen without reliance on logs)
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>RentLog Engine Room</title>
            <style>
                body { font-family: -apple-system, sans-serif; text-align: center; background: #f4f7f6; margin: 0; padding: 20px; }
                .card { background: white; max-width: 450px; margin: 40px auto; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
                .btn { background: #25D366; color: white; border: none; padding: 12px 24px; font-size: 16px; font-weight: bold; border-radius: 6px; cursor: pointer; text-decoration: none; display: inline-block; }
                .btn:hover { background: #1ebd58; }
                .code-box { font-size: 32px; font-family: monospace; background: #eef9f3; color: #075E54; padding: 15px; border-radius: 8px; letter-spacing: 4px; font-weight: bold; margin: 20px 0; border: 2px dashed #25D366; }
                .status { font-size: 13px; color: #666; background: #eee; padding: 10px; border-radius: 6px; text-align: left; overflow-x: auto; white-space: pre-wrap; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>RentLog WhatsApp Bot Portal</h2>
                <p>Target Phone: <strong>+${MY_PHONE}</strong></p>
                
                ${generatedCode ? `
                    <p style="color: green; font-weight: bold;">🎯 CODE GENERATED SUCCESSFULLY!</p>
                    <div class="code-box">${generatedCode}</div>
                    <p style="font-size: 14px; text-align: left; color: #444;"><strong>How to link:</strong><br>1. Open WhatsApp on phone.<br>2. Tap Settings > Linked Devices > Link a Device.<br>3. Select "Link with phone number instead".<br>4. Type the code above.</p>
                ` : `
                    <p style="color: #555;">Click below to send a fresh request to WhatsApp servers:</p>
                    <a href="/request-code" class="btn">🔑 Fetch Link Code</a>
                `}
                
                <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="text-align: left; font-size: 12px; font-weight: bold; margin-bottom: 5px; color: #333;">Live Diagnostics Log:</p>
                <div class="status">${connectionErrorLog}</div>
            </div>
        </body>
        </html>
    `);
});

// TRIGGER ROUTE FOR GETTING LINK CODE
app.get('/request-code', async (req, res) => {
    if (!globalSock) {
        connectionErrorLog = "Socket interface offline. Try again in 5 seconds.";
        return res.redirect('/');
    }
    try {
        connectionErrorLog = "Contacting WhatsApp infrastructure arrays...";
        const code = await globalSock.requestPairingCode(MY_PHONE);
        generatedCode = code;
        connectionErrorLog = `Code successfully rendered: ${code}`;
    } catch (err) {
        connectionErrorLog = `Failed to generate code: ${err.message}. Try clicking again.`;
    }
    res.redirect('/');
});

// 2. BACKEND CONNECTIONS
function askGemini(userMessage, callback) {
    if (!GEMINI_API_KEY) return callback("Error: Key configuration missing.");
    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const requestPayload = JSON.stringify({ contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\nUser Question: "${userMessage}"\nAnswer:` }] }] });

    const req = https.request(targetUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(requestPayload) } }, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
            try {
                const parsed = JSON.parse(responseData);
                if (parsed.candidates && parsed.candidates[0].content.parts[0].text) {
                    callback(parsed.candidates[0].content.parts[0].text);
                }
            } catch (e) { callback("Pipeline busy."); }
        });
    });
    req.write(requestPayload); req.end();
}

function keepServerAwake() {
    if (!RENDER_EXTERNAL_URL) return;
    setInterval(() => {
        https.get(RENDER_EXTERNAL_URL, (res) => {}).on('error', (err) => {});
    }, 600000);
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    globalSock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    globalSock.ev.on('creds.update', saveCreds);

    globalSock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            generatedCode = '';
            connectionErrorLog = `Closed: ${lastDisconnect?.error?.message || 'Re-establishing socket...'}`;
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            generatedCode = '';
            connectionErrorLog = '🚀 Live! Authenticated and linked successfully.';
            console.log('Bot fully running.');
        }
    });

    globalSock.ev.on('messages.upsert', async (msgUpdate) => {
        const chatMessage = msgUpdate.messages[0];
        if (!chatMessage.message || chatMessage.key.fromMe) return;
        const remoteJid = chatMessage.key.remoteJid;
        const incomingText = chatMessage.message.conversation || (chatMessage.message.extendedTextMessage && chatMessage.message.extendedTextMessage.text) || '';
        if (!incomingText) return;

        askGemini(incomingText, async (aiReply) => {
            await globalSock.sendMessage(remoteJid, { text: aiReply });
        });
    });
}

app.listen(PORT, () => {
    startBot().catch(err => console.error(err));
    keepServerAwake();
});
