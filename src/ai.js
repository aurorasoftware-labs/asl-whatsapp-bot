'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { FAQS, LINKS, PRODUCTS } = require('./knowledge');

const SYSTEM_RULES = fs.readFileSync(path.join(__dirname, '..', 'prompt.txt'), 'utf8');
const FACTS = Object.entries(PRODUCTS)
  .map(([key, p]) => key + ': ' + p.name + '. ' + p.summary + ' Official page: ' + p.url)
  .join('\n');
const ANSWERS = FAQS.map((entry) => entry.product + ': ' + entry.answer).join('\n');
const SYSTEM_MESSAGE = [
  SYSTEM_RULES,
  'Approved product information (from official Aurora repositories):',
  FACTS,
  'Approved help answers:',
  ANSWERS,
  'Company links: ' + JSON.stringify(LINKS)
].join('\n\n');

async function generateAIAnswer(question, topic, fetchImpl = fetch) {
  const provider = String(process.env.AI_PROVIDER || 'off').toLowerCase();
  if (provider === 'off' || provider === 'none' || !provider) return null;
  const providers = {
    groq: { url: 'https://api.groq.com/openai/v1/chat/completions', key: process.env.GROQ_API_KEY },
    openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', key: process.env.OPENROUTER_API_KEY }
  };
  const chosen = providers[provider];
  const model = process.env.AI_MODEL;
  if (!chosen || !chosen.key || !model) {
    console.warn('AI fallback unavailable: check AI_PROVIDER, AI_MODEL and the provider API key.');
    return null;
  }

  try {
    // Only the question and selected product are sent; never send chat IDs, phone
    // numbers, message history, auth credentials, customer or database records.
    const response = await fetchImpl(chosen.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + chosen.key,
        ...(provider === 'openrouter' ? { 'HTTP-Referer': LINKS.website, 'X-Title': 'Aurora Software Labs Support' } : {})
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 350,
        messages: [
          { role: 'system', content: SYSTEM_MESSAGE },
          { role: 'user', content: 'Product context: ' + (PRODUCTS[topic]?.name || 'unknown') + '\nQuestion: ' + String(question).slice(0, 1400) }
        ]
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      console.warn('AI provider responded with HTTP status ' + response.status + '.');
      return null;
    }
    const payload = await response.json();
    const result = payload?.choices?.[0]?.message?.content;
    return typeof result === 'string' && result.trim() ? result.trim().slice(0, 1800) : null;
  } catch (error) {
    console.warn('AI fallback unavailable (' + (error?.name || 'request error') + ').');
    return null;
  }
}

module.exports = { generateAIAnswer };
