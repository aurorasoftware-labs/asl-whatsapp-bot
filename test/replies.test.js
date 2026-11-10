'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { replyTo, detectTopic } = require('../src/replies');
const { LINKS } = require('../src/knowledge');
const { generateAIAnswer } = require('../src/ai');

test('greeting gives Aurora-branded menu', () => {
  const result = replyTo('hi');
  assert.match(result.text, /Aurora Software Labs/);
  assert.match(result.text, /Crew Hub/);
  assert.match(result.text, /Identity Hub/);
  assert.equal(result.topic, null);
});

test('numbered product selection remembers correct topic', () => {
  assert.equal(replyTo('2').topic, 'rentlog');
  assert.equal(replyTo('3').topic, 'cropguard');
  assert.equal(replyTo('4').topic, 'crew');
  assert.equal(replyTo('5').topic, 'identity');
});

test('RentLog backup answer is grounded in local-storage product behavior', () => {
  const result = replyTo('How do I backup my data?', 'rentlog');
  assert.match(result.text, /backup\/export/i);
  assert.match(result.text, /no automatic cloud sync/i);
});

test('CropGuard answers supported crops and diagnostic limitations', () => {
  const result = replyTo('Is wheat supported?', 'cropguard');
  assert.match(result.text, /Jowar/);
  const scan = replyTo('How do I scan a leaf?', 'cropguard');
  assert.match(scan.text, /agricultural expert/i);
});

test('Crew Hub topics reflect deployed feature and privacy limits', () => {
  const result = replyTo('Tell me about the games', 'crew');
  assert.match(result.text, /online community/i);
  const events = replyTo('event', 'crew');
  assert.match(events.text, /RSVP/);
  const privacy = replyTo('privacy', 'crew');
  assert.match(privacy.text, /cloud backend/);
});

test('company and pricing do not invent custom license prices', () => {
  assert.match(replyTo('1').text, /independent software studio/i);
  const pricing = replyTo('How much does Crew Hub cost?');
  assert.match(pricing.text, /request a quote/i);
  assert.doesNotMatch(pricing.text, /\$\d+/);
});

test('typed product names route to correct product, with context intact', () => {
  assert.equal(detectTopic('rentlog app'), 'rentlog');
  assert.equal(detectTopic('CropGuard leaf scanning'), 'cropguard');
  assert.equal(detectTopic('thecrewid'), 'crew');
  assert.equal(detectTopic('Identity Hub ID cards'), 'identity');
  assert.match(replyTo('cropguard download').text, /cropguard.pages.dev/);
});

test('human handoff includes official contact and no fake ticket creation', () => {
  const result = replyTo('6');
  assert.match(result.text, /Support/);
  assert.ok(result.text.includes(LINKS.contact));
  assert.ok(result.text.includes(LINKS.email));
  assert.match(result.text, /cannot access customer records/i);
});

test('unknown questions are not answered with fabricated information', () => {
  const result = replyTo('Can you access my account and reset the server?', 'crew');
  assert.equal(result.needsAI, true);
  assert.match(result.text, /do not have a confirmed answer/);
  assert.match(result.text, /contact/);
});

test('AI cannot call a provider unless explicitly enabled', async () => {
  const old = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = 'off';
  let called = false;
  const response = await generateAIAnswer('test question', 'rentlog', () => { called = true; });
  if (old === undefined) delete process.env.AI_PROVIDER;
  else process.env.AI_PROVIDER = old;
  assert.equal(response, null);
  assert.equal(called, false);
});

test('ping remains supported after rebranding', () => {
  assert.match(replyTo('ping').text, /pong/);
  assert.match(replyTo('ping').text, /Aurora/);
});
