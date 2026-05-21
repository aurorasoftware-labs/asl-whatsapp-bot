const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, delay } = require('@whiskeysockets/baileys');
const express = require('express');
const https = require('https');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Securely load environment settings from Render dashboard panels
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL || '';

// IMPORTANT: Put your real phone number here with country code (e.g., "91" for India), no spaces, no + signs
// Example: "919876543210"
const PAIRING_PHONE_NUMBER = "919892758104"; 

let SYSTEM_PROMPT = 'You are a helpful assistant.';
try {
    if (fs.existsSync('prompt.txt')) {
        SYSTEM_PROMPT = fs.readFileSync('prompt.txt', 'utf8').trim();
        console.log("📝 Successfully read system rules from prompt.txt");
    }
} catch (e) {
    console.log("⚠️ Reading prompt.txt failed, using basic profile rules.");
}

// Simple health dashboard page so Render knows the service is up and active
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>RentLog Live Monitor</title></head>
        <body style="font-family:sans-serif; text-align:center; padding:50px; background:#f4f7f6;">
            <h2>RentLog AI Support Router Engine</h2>
            <p>🟢 Cloud server is active. Check your Render Terminal Logs tab to view your authentication pairing steps!</p>
        </body>
        </html>
    `);
});

// Process pipeline matching logic directly out to Gemini core servers
function askGemini(userMessage, callback) {
    if (!GEMINI_API_KEY) return callback("Error: Missing API key.");
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
            } catch (e) { callback("Temporary server latency."); }
        });
    });
    req.write(requestPayload); req.end();
}

function keepServerAwake() {
    if (!RENDER_EXTERNAL_URL) return;
    setInterval(() => {
        https.get(RENDER_EXTERNAL_URL, (res) => {
            console.log(`🔄 Ping sync status: ${res.statusCode}`);
        }).on('error', (err) => console.error("Ping error:", err.message));
    }, 600000);
}

// Core connection initialization framework
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, 
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    sock.ev.on('creds.update', saveCreds);

    // If not authenticated yet, wait for initialization and request a solid code explicitly
    if (!sock.authState.creds.registered) {
        if (PAIRING_PHONE_NUMBER === "91XXXXXXXXXX") {
            console.log("\n⚠️ ERROR: You forgot to replace '91XXXXXXXXXX' with your real phone number in index.js!");
            return;
        }
        
        console.log(`\n⏳ Holding link channel open for phone target: ${PAIRING_PHONE_NUMBER}...`);
        await delay(6000); // Gives the network layer a 6-second delay gap to bypass the drop loops safely
        
        try {
            const code = await sock.requestPairingCode(PAIRING_PHONE_NUMBER);
            console.log("\n==================================================");
            console.log(`🔑 YOUR WHATSAPP PAIRING CODE IS: ${code}`);
            console.log("==================================================\n");
            console.log("📲 HOW TO USE IT:\n1. Open WhatsApp on your mobile phone.\n2. Go to Settings > Linked Devices > Link a Device.\n3. Choose 'Link with phone number instead'.\n4. Type this code into your phone screen!\n");
        } catch (err) {
            console.error("❌ Link generation failed. Retrying cycle...", err.message);
        }
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('🚀 SUCCESS! Cloud system is linked to your account active and listening!');
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
            console.log(`📤 Message sent back to client channel successfully.`);
        });
    });
}

app.listen(PORT, () => {
    console.log(`🌐 System layer processing on port ${PORT}`);
    startBot().catch(err => console.error(err));
    keepServerAwake();
});
