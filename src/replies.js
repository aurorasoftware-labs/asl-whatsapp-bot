'use strict';
const { LINKS, PRODUCTS, FAQS } = require('./knowledge');

const MENU = [
  '*Aurora Software Labs* 🌌',
  'Welcome! I’m Aurora’s automated support assistant.',
  '',
  'Reply with a number:',
  '1. About Aurora Software Labs',
  '2. RentLog PRO 🏠',
  '3. CropGuard 🌿',
  '4. Aurora Crew Hub 🎉',
  '5. Aurora Identity Hub 🪪',
  '6. Contact a human / request a project',
  '',
  'You can also type a question, or *menu* at any time.'
].join('\n');

const TOPICS = { '1': 'studio', '2': 'rentlog', '3': 'cropguard', '4': 'crew', '5': 'identity' };

function normalise(input) {
  return String(input || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function containsPhrase(text, phrase) {
  return (' ' + text + ' ').includes(' ' + normalise(phrase) + ' ');
}

function detectTopic(input) {
  const text = normalise(input);
  const patterns = [
    ['rentlog', /\b(rentlog|tenant|landlord|rent ledger|rent payment|rent receipt)\b/],
    ['cropguard', /\b(cropguard|crop disease|plant disease|leaf|sorghum|jowar)\b/],
    ['crew', /\b(crew hub|crewhub|thecrewid|crew wall|crew game|crew circle|confession|secret santa)\b/],
    ['identity', /\b(identity hub|id cards?|crew directory)\b/]
  ];
  const hits = patterns.filter(([, regex]) => regex.test(text)).map(([topic]) => topic);
  if (hits.length === 1) return hits[0];
  return null;
}

function matchFaq(text, topic) {
  if (!topic) return null;
  const options = FAQS.filter((item) => item.product === topic);
  let best = null;
  let score = 0;
  for (const entry of options) {
    for (const phrase of entry.phrases) {
      if (containsPhrase(text, phrase)) {
        const length = normalise(phrase).length;
        if (length > score) {
          best = entry;
          score = length;
        }
      }
    }
  }
  return best ? best.answer : null;
}

function contactText() {
  return [
    '*Aurora Software Labs — Support*',
    'For a person, bug report, licence question or support ticket:',
    LINKS.contact,
    'Email: ' + LINKS.email,
    'Track an existing ticket: ' + LINKS.tickets,
    'For custom software enquiries: ' + LINKS.intake,
    '',
    'This bot cannot access customer records, tickets or private accounts.'
  ].join('\n');
}

function productText(topic) {
  const p = PRODUCTS[topic];
  return [
    '*' + p.name + '*',
    p.summary,
    '',
    'More information: ' + p.url,
    'Ask me about: ' + p.examples,
    'Reply *menu* to change topics.'
  ].join('\n');
}

function replyTo(input, previousTopic = null) {
  const raw = String(input || '').trim();
  const text = normalise(raw);
  if (!text || /^(hi|hello|hey|start|menu|home|help|0|good morning|good evening)$/.test(text)) {
    return { text: MENU, topic: null, needsAI: false };
  }
  if (TOPICS[text]) {
    const topic = TOPICS[text];
    return { text: productText(topic), topic, needsAI: false };
  }
  if (text === '6' || /\b(human|real person|talk to someone|contact support|raise a ticket|raise ticket|support ticket|talk to agent)\b/.test(text)) {
    return { text: contactText(), topic: previousTopic, needsAI: false };
  }
  if (text === 'ping') {
    return { text: 'pong 🏓 — Aurora Software Labs Bot', topic: previousTopic, needsAI: false };
  }
  if (/\b(price|pricing|cost|subscription|paywall|free|quote)\b/.test(text)) {
    return { text: 'RentLog PRO and CropGuard are free public apps. Aurora Crew Hub and Aurora Identity Hub are custom projects with scope-specific licensing and delivery terms; please request a quote rather than relying on a fixed price.\n' + LINKS.intake, topic: previousTopic, needsAI: false };
  }
  const explicit = detectTopic(text);
  const topic = explicit || previousTopic;
  if (/\b(privacy|data collected|data storage|offline|internet|cloud sync)\b/.test(text) && topic) {
    const details = {
      rentlog: 'RentLog PRO runs offline and keeps tenant/rent records on your Android device; there is no automatic cloud backup.',
      cropguard: 'CropGuard diagnoses supported crop diseases offline; photographs and scan history remain on the device.',
      crew: 'Aurora Crew Hub requires the internet and uses a cloud backend for its shared features. Private circles require membership and account permissions.',
      identity: 'Aurora Identity Hub is offline-first; cloud sync is optional and depends on your custom build.',
      studio: 'Privacy depends on the product. RentLog PRO and CropGuard keep their records locally; Aurora Crew Hub works online, and Identity Hub is offline-first with optional cloud features.'
    };
    return { text: details[topic] + '\nRead the applicable product privacy notice: ' + LINKS.website + 'privacy', topic, needsAI: false };
  }
  if (/\b(what is|who is|overview|features|tell me about|what does)\b/.test(text) && topic) {
    return { text: productText(topic), topic, needsAI: false };
  }
  const faq = matchFaq(text, topic);
  if (faq) return { text: faq, topic, needsAI: false };
  if (topic) {
    return {
      text: 'I can help with ' + PRODUCTS[topic].name + ', but I do not have a confirmed answer to that specific question. Visit ' + PRODUCTS[topic].url + ' or contact a person at ' + LINKS.contact + '. Reply *menu* to switch products.',
      topic, needsAI: true
    };
  }
  return { text: 'Which product is your question about? Reply *menu* and choose a product (1–5), or ask something like “RentLog backup” or “CropGuard scan”.\nFor human help: ' + LINKS.contact, topic: null, needsAI: false };
}

module.exports = { MENU, contactText, replyTo, detectTopic, matchFaq, normalise };
