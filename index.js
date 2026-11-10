'use strict';

const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const pino = require('pino');
const path = require('node:path');
const http = require('node:http');
const { replyTo } = require('./src/replies');
const { generateAIAnswer } = require('./src/ai');

const AUTH_DIR = path.resolve(
  process.env.AUTH_DIR ||
  (process.env.RENDER_DISK_MOUNT_PATH
    ? path.join(process.env.RENDER_DISK_MOUNT_PATH, 'auth_info')
    : path.join(__dirname, 'auth_info'))
);

const logger = pino({ level: process.env.LOG_LEVEL || 'warn' });
const contexts = new Map();
const processedIds = new Map();
const CONTEXT_TTL_MS = 45 * 60 * 1000;
const DEDUPE_TTL_MS = 20 * 60 * 1000;
const allowedNumbers = new Set(
  (process.env.ALLOWED_NUMBERS || '').split(',').map((v) => v.replace(/\D/g, '')).filter(Boolean)
);

let socket = null;
let active = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
let shuttingDown = false;

function getText(message) {
  const inner = message?.ephemeralMessage?.message ||
    message?.viewOnceMessage?.message || message;
  return inner?.conversation || inner?.extendedTextMessage?.text || null;
}

function acceptMessage(msg, type) {
  if (type !== 'notify' || !msg?.message || msg?.key?.fromMe) return false;
  const jid = msg.key.remoteJid || '';
  // Never auto-reply in groups, broadcasts, channels, or to status updates.
  if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@lid')) return false;
  if (allowedNumbers.size) {
    // A @lid is not a verified phone-number mapping. Reject it while testing
    // with a number allowlist instead of guessing the sender's identity.
    if (!jid.endsWith('@s.whatsapp.net') || !allowedNumbers.has(jid.split('@')[0])) return false;
  }
  const id = String(msg.key.id || '');
  if (!id) return false;
  const lookup = jid + ':' + id;
  const now = Date.now();
  if (processedIds.has(lookup)) return false;
  processedIds.set(lookup, now);
  if (processedIds.size > 1500) {
    for (const [key, timestamp] of processedIds) {
      if (now - timestamp > DEDUPE_TTL_MS || processedIds.size > 1500) processedIds.delete(key);
      if (processedIds.size <= 1000) break;
    }
  }
  return true;
}

async function onMessage(message) {
  const jid = message.key.remoteJid;
  const raw = getText(message.message);
  const prior = contexts.get(jid);
  const topic = prior && Date.now() - prior.updatedAt < CONTEXT_TTL_MS ? prior.topic : null;
  let answer;

  if (typeof raw !== 'string') {
    answer = 'I’m the Aurora Software Labs *text support* bot. I cannot inspect pictures, documents, voice messages or videos yet. Please type your question, or type *menu*.';
  } else if (raw.trim().length > 1600) {
    answer = 'Please shorten your message to 1,600 characters or fewer, or contact ' +
      'https://aurorasoftwarelabs.pages.dev/contact for detailed assistance.';
  } else {
    const result = replyTo(raw, topic);
    contexts.set(jid, { topic: result.topic, updatedAt: Date.now() });
    answer = result.text;
    if (result.needsAI) {
      const fromAI = await generateAIAnswer(raw, result.topic);
      if (fromAI) answer = fromAI + '\n\n— Aurora Software Labs Assistant 🤖';
    }
  }
  if (contexts.size > 1000) {
    for (const [id, value] of contexts) {
      if (Date.now() - value.updatedAt > CONTEXT_TTL_MS) contexts.delete(id);
    }
  }
  await socket.sendMessage(jid, { text: answer });
}

function healthServer() {
  const port = Number(process.env.PORT || process.env.HEALTH_PORT);
  if (!port) return;
  const server = http.createServer((request, response) => {
    if (request.url !== '/health' && request.url !== '/ready') {
      response.writeHead(404).end('Not found');
      return;
    }
    const ready = active;
    response.writeHead(request.url === '/ready' && !ready ? 503 : 200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ service: 'aurora-whatsapp-bot', alive: true, whatsappConnected: ready }));
  });
  server.listen(port, '0.0.0.0', () => console.log('Health endpoint listening on port ' + port));
}

function scheduleReconnect(statusCode) {
  if (shuttingDown || reconnectTimer) return;
  if (statusCode === DisconnectReason.loggedOut) {
    console.error('WhatsApp linked device was logged out. Remove the local or persistent session only if you intend to pair again.');
    return;
  }
  reconnectAttempts += 1;
  const backoff = statusCode === DisconnectReason.restartRequired
    ? 1000
    : Math.min(60000, 2000 * Math.pow(2, Math.min(reconnectAttempts, 5)));
  console.warn('WhatsApp disconnected (status ' + (statusCode ?? 'unknown') +
    '). Reconnecting in ' + Math.ceil(backoff / 1000) + ' seconds.');
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect().catch((error) => {
      console.error('Connection failed:', error?.message || 'unknown error');
      scheduleReconnect();
    });
  }, backoff);
}

async function connect() {
  if (shuttingDown) return;
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const currentSocket = makeWASocket({
    auth: state,
    logger,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    browser: ['Aurora Software Labs', 'Chrome', '1.0']
  });
  socket = currentSocket;
  let pairingRequested = false;

  currentSocket.ev.on('creds.update', saveCreds);

  currentSocket.ev.on('messages.upsert', async ({ messages, type }) => {
    for (const msg of messages || []) {
      if (!acceptMessage(msg, type)) continue;
      try {
        await onMessage(msg);
      } catch (error) {
        // Never print incoming messages, raw chat payloads or credentials.
        console.error('Failed to process or send a response (' + (error?.name || 'error') + ').');
      }
    }
  });

  currentSocket.ev.on('connection.update', async ({ connection, qr, lastDisconnect }) => {
    if (qr && !state.creds.registered) {
      const phone = (process.env.PAIRING_PHONE_NUMBER || '').replace(/\D/g, '');
      if (phone && !pairingRequested) {
        pairingRequested = true;
        try {
          const code = await currentSocket.requestPairingCode(phone);
          console.log('WhatsApp pairing code (enter it in Linked Devices): ' + code);
        } catch {
          pairingRequested = false;
          console.warn('Could not request pairing code; consider using QR pairing instead.');
        }
      } else if (!phone) {
        try {
          console.log('Scan this QR from WhatsApp > Linked devices > Link a device:');
          console.log(await qrcode.toString(qr, { type: 'terminal', small: true }));
        } catch {
          console.error('Unable to display pairing QR. Configure PAIRING_PHONE_NUMBER for code pairing.');
        }
      }
    }

    if (socket !== currentSocket) return;
    if (connection === 'open') {
      active = true;
      reconnectAttempts = 0;
      console.log('✅ Aurora Software Labs WhatsApp Bot connected.');
    } else if (connection === 'close') {
      active = false;
      currentSocket.ev.removeAllListeners();
      const status = lastDisconnect?.error?.output?.statusCode;
      scheduleReconnect(status);
    }
  });
}

function shutdown(signal) {
  shuttingDown = true;
  active = false;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  console.log('Stopping Aurora bot (' + signal + ')');
  try { socket?.end?.(); } catch { /* closing */ }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('Unexpected async error:', reason?.message || 'unhandled rejection');
});
process.on('uncaughtException', (error) => {
  console.error('Fatal error:', error?.message || 'uncaught exception');
  process.exit(1);
});

healthServer();
connect().catch((error) => {
  console.error('Initial connection error:', error?.message || 'unknown error');
  scheduleReconnect();
});
