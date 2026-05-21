const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');

// 1. Configure Persistent Storage Path
// If running on Render with a persistent disk attached at /var/data, use it.
// Otherwise, fall back to a local folder named 'auth_info'
const AUTH_DIR = process.env.RENDER_DISK_MOUNT_PATH 
    ? path.join(process.env.RENDER_DISK_MOUNT_PATH, 'auth_info') 
    : path.join(__dirname, 'auth_info');

async function startWhatsAppBot() {
    console.log(`Initializing authentication from: ${AUTH_DIR}`);
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    // 2. Initialize Baileys Socket
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        // Set logger level to 'silent' or 'error' in production to clean up log streams
        logger: pino({ level: 'info' }), 
        browser: ['Ubuntu', 'Chrome', '20.0.04']
    });

    // 3. Handle Connection Status Updates
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('New QR Code generated. Please scan it in WhatsApp.');
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            
            console.log(`Connection closed. Reason Status Code: ${statusCode}`);

            if (shouldReconnect) {
                // Determine backoff delay based on the failure reason
                // If it's a conflict/multidevice boot during rolling deployment, wait longer (10s)
                const delay = statusCode === DisconnectReason.connectionReplaced ? 10000 : 5000;
                
                console.log(`Attempting reconnection in ${delay / 1000} seconds...`);
                setTimeout(() => {
                    startWhatsAppBot();
                }, delay);
            } else {
                console.log('Device logged out. Terminal stopped. Please delete auth folder and re-scan.');
            }
        } else if (connection === 'open') {
            console.log('🎉 RentLog Bot is securely connected to WhatsApp!');
        }
    });

    // 4. Save Credentials on Update
    sock.ev.on('creds.update', saveCreds);

    // 5. Sample Message Handler
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const msg = chatUpdate.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
            const from = msg.key.remoteJid;

            if (text && text.toLowerCase() === 'ping') {
                await sock.sendMessage(from, { text: 'pong 🏓' });
            }
        } catch (error) {
            console.error('Error handling incoming message:', error);
        }
    });
}

// Global error tracking to prevent unhandled node script crashes
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception caught:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Run the bot
startWhatsAppBot();
