const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, delay } = require('@whiskeysockets/baileys');
const express = require('express');
const QRCode = require('qrcode');
const https = require('https');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
let latestQRCodeImage = '';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL || '';

let SYSTEM_PROMPT = 'You are a helpful assistant.';
try {
    if (fs.existsSync('prompt.txt')) {
        SYSTEM_PROMPT = fs.readFileSync('prompt.txt', 'utf8').trim();
    }
} catch (e) {
    console.log("Using default fallback prompt rules.");
}

// 1. DASHBOARD OVERVIEW
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
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>RentLog Bot Connection</h2>
                    <p>Scan this live code using your WhatsApp Link Device option:</p>
                    <div style="margin: 25px 0;"><img src="${latestQRCodeImage}" /></div>
                    <p style="color: #888; font-size: 11px;">Refreshes every 5 seconds automatically.</p>
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
                <title>RentLog Routing...</title>
                <style>
                    body { font-family: -apple-system, sans-serif; text-align: center; background: #f4f7f6; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>🔄 Fetching Live WhatsApp QR Stream...</h2>
                    <p style="color:#666;">Connecting to WhatsApp server. If this page stays blank, check your Render dashboard terminal log tabs for the text pairing code backup!</p>
                </div>
                <script>setTimeout(() => { location.reload(); }, 5000);</script>
            </body>
            </html>
        `);
    }
});

// 2. GEMINI PIPELINE
function askGemini(userMessage, callback) {
    if (!GEMINI_API_KEY) return callback("Configuration key missing.");
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
            } catch (e) { callback("Service offline."); }
        });
    });
    req.write(requestPayload); req.end();
}

function keepServerAwake() {
    if (!RENDER_EXTERNAL_URL) return;
    setInterval(() => {
        https.get(RENDER_EXTERNAL_URL, (res) => {
            console.log(`🔄 Keep-Alive Ping Status: ${res.statusCode}`);
        }).on('error', (err) => console.error(err.message));
    }, 600000);
}

// 3. WHATSAPP CONNECTION CONTROLLER
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Forces the terminal window on Render to display the text QR backup pattern
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log("🎯 CRYPTO STREAM GENERATED: Syncing with web dashboard canvas...");
            latestQRCodeImage = await QRCode.toDataURL(qr);
        }
        
        if (connection === 'close') {
            latestQRCodeImage = '';
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            latestQRCodeImage = '';
            console.log('🚀 BOOT SUCCESSFUL! Connected to WhatsApp cloud array.');
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
    console.log(`🌐 Server running on port ${PORT}`);
    startBot().catch(err => console.error(err));
    keepServerAwake();
});
