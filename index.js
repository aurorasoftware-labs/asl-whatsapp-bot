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
        console.log("📝 Successfully read system rules from prompt.txt");
    }
} catch (e) {
    console.log("⚠️ Reading prompt.txt failed, using basic profile rules.");
}

// 1. DASHBOARD WEB INTERFACE (To securely scan the valid QR connection link)
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
                    <p style="color: #888; font-size: 11px;">This page refreshes automatically every 10 seconds.</p>
                </div>
                <script>setTimeout(() => { location.reload(); }, 10000);</script>
            </body>
            </html>
        `);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>RentLog Engine Active</title>
                <style>
                    body { font-family: -apple-system, sans-serif; text-align: center; background: #f4f7f6; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
                    .status { color: #25D366; font-size: 50px; margin-bottom: 10px; animation: blink 2s infinite; }
                    @keyframes blink { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="status">●</div>
                    <h2>RentLog Support Engine</h2>
                    <p>🟢 Connected and monitoring incoming chats 24/7 in the cloud.</p>
                </div>
            </body>
            </html>
        `);
    }
});

// 2. CONNECT PIPELINE LOGIC TO GEMINI BACKEND REST ENDPOINTS
function askGemini(userMessage, callback) {
    if (!GEMINI_API_KEY) {
        callback("Error: The server environment is missing the GEMINI_API_KEY setup variable.");
        return;
    }

    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const requestPayload = JSON.stringify({
        contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\nUser Question: "${userMessage}"\nAnswer:` }] }]
    });

    const req = https.request(targetUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestPayload)
        }
    }, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
            try {
                const parsed = JSON.parse(responseData);
                if (parsed.candidates && parsed.candidates[0].content.parts[0].text) {
                    callback(parsed.candidates[0].content.parts[0].text);
                } else {
                    callback("I encountered an issue verifying that feature query. Let me look into it.");
                }
            } catch (e) {
                callback("Service temporary latency. Please drop your query again in a moment.");
            }
        });
    });

    req.on('error', () => callback("Network pathway error. Please try again."));
    req.write(requestPayload);
    req.end();
}

// 3. INTERNAL KEEP-ALIVE SYSTEM PING LOOP (Bypasses Render's Free tier sleeping limits)
function keepServerAwake() {
    if (!RENDER_EXTERNAL_URL) return;
    setInterval(() => {
        https.get(RENDER_EXTERNAL_URL, (res) => {
            console.log(`🔄 Keep-Alive tick sent. Response Status: ${res.statusCode}`);
        }).on('error', (err) => console.error("Keep alive loop encountered ping block:", err.message));
    }, 600000); // Trigger ping cleanly every 10 minutes (600000 ms)
}

// 4. MAIN WHATSAPP RUNTIME CONNECTION CORE
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ["RentLog Cloud Server", "Safari", "3.0.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            // Encode authentic session key strings straight into a visual clean layout
            latestQRCodeImage = await QRCode.toDataURL(qr);
            console.log("✨ A fresh scannable WhatsApp token was generated and pushed to UI.");
        }
        if (connection === 'close') {
            latestQRCodeImage = '';
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            latestQRCodeImage = '';
            console.log('🚀 SUCCESS! The Cloud Server is paired to your WhatsApp channel!');
        }
    });

    sock.ev.on('messages.upsert', async (msgUpdate) => {
        const chatMessage = msgUpdate.messages[0];
        if (!chatMessage.message || chatMessage.key.fromMe) return;

        const remoteJid = chatMessage.key.remoteJid;
        const incomingText = chatMessage.message.conversation || 
                             (chatMessage.message.extendedTextMessage && chatMessage.message.extendedTextMessage.text) || '';
        
        if (!incomingText) return;

        console.log(`📩 Chat received from ${remoteJid}: "${incomingText}"`);

        // Pass message text buffer over to the live Gemini function mapping pipeline
        askGemini(incomingText, async (aiReply) => {
            await sock.sendMessage(remoteJid, { text: aiReply });
            console.log(`📤 Outbound support message dispatched back successfully.`);
        });
    });
}

app.listen(PORT, () => {
    console.log(`🌐 Server active on operational port ${PORT}`);
    startBot().catch(err => console.error("Initialization error:", err));
    keepServerAwake();
});
