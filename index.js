const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const express = require('express');
const QRCode = require('qrcode');
const https = require('https');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
let latestQRCodeImage = '';

// Securely load environment variables configured on Render's side
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL || '';

let SYSTEM_PROMPT = 'You are a helpful assistant.';
try {
    if (fs.existsSync('prompt.txt')) {
        SYSTEM_PROMPT = fs.readFileSync('prompt.txt', 'utf8').trim();
        console.log("📝 Loaded prompt.txt successfully");
    }
} catch (e) {
    console.log("⚠️ Using default fallback prompt rules.");
}

// 1. IMPROVED WEB DASHBOARD (Always shows the QR if it exists, auto-reloads quickly)
app.get('/', (req, res) => {
    if (latestQRCodeImage) {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>RentLog Link Portal</title>
                <style>
                    body { font-family: -apple-system, sans-serif; text-align: center; background: #f4f7f6; margin: 0; padding: 20px; }
                    .card { background: white; max-width: 400px; margin: 40px auto; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
                    img { border: 3px solid #25D366; padding: 10px; border-radius: 12px; background: white; max-width: 100%; height: auto; }
                    h2 { color: #075E54; margin-top: 0; }
                    p { color: #555; font-size: 14px; line-height: 1.5; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>RentLog Bot Connection</h2>
                    <p>Open <strong>WhatsApp &gt; Linked Devices &gt; Link a Device</strong> on your primary phone and scan this live code:</p>
                    <div style="margin: 25px 0;"><img src="${latestQRCodeImage}" /></div>
                    <p style="color: #888; font-size: 11px;">This page refreshes automatically every 5 seconds.</p>
                </div>
                <script>setTimeout(() => { location.reload(); }, 5000);</script>
            </body>
            </html>
        `);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>RentLog Booting...</title>
                <style>
                    body { font-family: -apple-system, sans-serif; text-align: center; background: #f4f7f6; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
                    .loading { font-size: 24px; color: #666; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="loading">🔄 Fetching Live WhatsApp QR Stream...</div>
                    <p style="color:#888; font-size:12px;">Page will load the code in a few seconds.</p>
                </div>
                <script>setTimeout(() => { location.reload(); }, 4000);</script>
            </body>
            </html>
        `);
    }
});

// 2. GEMINI RECONCILIATION API
function askGemini(userMessage, callback) {
    if (!GEMINI_API_KEY) return callback("Error: Missing API key config.");
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
                } else { callback("Could not process message."); }
            } catch (e) { callback("Service offline."); }
        });
    });
    req.write(requestPayload); req.end();
}

// 3. KEEP ALIVE PING
function keepServerAwake() {
    if (!RENDER_EXTERNAL_URL) return;
    setInterval(() => {
        https.get(RENDER_EXTERNAL_URL, (res) => {
            console.log(`🔄 Heartbeat ping status: ${res.statusCode}`);
        }).on('error', (err) => console.error("Ping error:", err.message));
    }, 600000);
}

// 4. WHATSAPP CORE RUNTIME
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Also prints it as text in your Render terminal log!
        browser: ["RentLog Cloud Server", "Safari", "3.0.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log("🎯 A true dynamic login token has dropped! Updating dashboard layout...");
            latestQRCodeImage = await QRCode.toDataURL(qr);
        }
        
        if (connection === 'close') {
            latestQRCodeImage = '';
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            latestQRCodeImage = '';
            console.log('🚀 SUCCESS! Linked to WhatsApp account.');
        }
    });

    sock.ev.on('messages.upsert', async (msgUpdate) => {
        const chatMessage = msgUpdate.messages[0];
        if (!chatMessage.message || chatMessage.key.fromMe) return;
        const remoteJid = chatMessage.key.remoteJid;
        const incomingText = chatMessage.message.conversation || (chatMessage.message.extendedTextMessage && chatMessage.message.extendedTextMessage.text) || '';
        if (!incomingText) return;

        askGemini(incomingText, async (aiReply) => {
            await sock.sendMessage(remoteJid, { text: aiReply });
        });
    });
}

app.listen(PORT, () => {
    console.log(`🌐 Infrastructure open on port ${PORT}`);
    startBot().catch(err => console.error(err));
    keepServerAwake();
});
