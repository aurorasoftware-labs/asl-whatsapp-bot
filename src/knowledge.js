'use strict';

// Public facts checked against the Aurora Software Labs, RentLog PRO,
// CropGuard and thecrewid repositories (November 2026).
// Never add customer data, private repository configuration or API secrets here.
const LINKS = Object.freeze({
  website: 'https://aurorasoftwarelabs.pages.dev/',
  products: 'https://aurorasoftwarelabs.pages.dev/products',
  contact: 'https://aurorasoftwarelabs.pages.dev/contact',
  faq: 'https://aurorasoftwarelabs.pages.dev/faq',
  tickets: 'https://aurorasoftwarelabs.pages.dev/ticket-status',
  rentlog: 'https://rentlogpro.pages.dev/',
  rentlogHelp: 'https://rentlogpro.pages.dev/manual.html',
  cropguard: 'https://cropguard.pages.dev/',
  cropguardHelp: 'https://cropguard.pages.dev/guide.html',
  crew: 'https://aurorasoftwarelabs.pages.dev/products/aurora-crew-hub',
  identity: 'https://aurorasoftwarelabs.pages.dev/products/aurora-identity-hub',
  channel: 'https://whatsapp.com/channel/0029VbCfCra0LKZL0QHD1I2D',
  intake: 'https://docs.google.com/forms/d/e/1FAIpQLSeHtgTcdpgXIkw3wPNsEkCizknqQ8X_fjS8Zhe-w6b0_u731Q/viewform?usp=dialog',
  email: 'support.aurorasoftwarelabs@gmail.com'
});

const PRODUCTS = Object.freeze({
  studio: {
    name: 'Aurora Software Labs',
    summary: 'An independent software studio building privacy-first apps and personalised software for organisations and communities. Public releases include RentLog PRO and CropGuard; custom products include Aurora Crew Hub and Aurora Identity Hub.',
    url: LINKS.website,
    examples: 'products, contact, custom project'
  },
  rentlog: {
    name: 'RentLog PRO',
    summary: 'An Android 6.0+ offline-first property and tenant ledger. Manage properties, tenants, rent, utilities, balances and local backups. Records stay on the device; there is no automatic cloud sync or online payment collection. The public app is free.',
    url: LINKS.rentlog,
    examples: 'install, backup, tenants, rent, offline'
  },
  cropguard: {
    name: 'CropGuard',
    summary: 'An offline-first Android plant-health assistant with on-device AI for Wheat, Rice, Tomato, Jowar/Sorghum, Apple, Cherry and Corn. Select a crop, photograph a leaf, and review a diagnostic report. Requires Android 6.0+, camera access and about 500 MB free space. The public app is free.',
    url: LINKS.cropguard,
    examples: 'scan, supported crops, offline, diagnosis'
  },
  crew: {
    name: 'Aurora Crew Hub',
    summary: 'A personalised online community hub for teams and groups, with Crew Wall, confessions, polls, profiles, events, private circles, trips, tasks, expense tracking, XP, games, notifications and staff tools. Custom builds require internet; enabled modules vary by deployment.',
    url: LINKS.crew,
    examples: 'games, events, privacy, custom build'
  },
  identity: {
    name: 'Aurora Identity Hub',
    summary: 'A bespoke Android app for ID cards and a searchable crew directory. Offline-first with optional cloud sync; each branded build is requested rather than downloaded publicly.',
    url: LINKS.identity,
    examples: 'ID cards, directory, custom app'
  }
});

// Match phrases carefully; unrelated questions must not receive guessed answers.
const FAQS = Object.freeze([
  { product: 'studio', phrases: ['custom software', 'custom app', 'build an app', 'commission', 'project request', 'project intake'], answer: 'For a custom build, describe your group or organisation, features and branding in the project intake form:\n' + LINKS.intake + '\nYou can also contact ' + LINKS.email + '.' },
  { product: 'studio', phrases: ['products', 'apps available', 'your apps', 'what do you make'], answer: 'Aurora Software Labs offers RentLog PRO and CropGuard as public Android apps, plus Aurora Crew Hub and Aurora Identity Hub as personalised builds.\n' + LINKS.products },
  { product: 'studio', phrases: ['channel', 'updates', 'announcements'], answer: 'Join the official Aurora Software Labs WhatsApp channel for product news:\n' + LINKS.channel },
  { product: 'rentlog', phrases: ['install', 'download', 'apk', 'android requirement'], answer: 'Download RentLog PRO only from its official site: ' + LINKS.rentlog + '\nIt supports Android 6.0+. If Android prompts you, allow installing the APK from the browser or file manager you used.' },
  { product: 'rentlog', phrases: ['backup', 'restore', 'export', 'move phone', 'new phone', 'transfer data'], answer: 'RentLog PRO keeps records locally. Use its in-app backup/export before changing phones, then restore that backup on the new device. There is no automatic cloud sync.\nUser manual: ' + LINKS.rentlogHelp },
  { product: 'rentlog', phrases: ['tenant', 'multiple properties', 'property', 'landlord', 'house', 'building'], answer: 'RentLog PRO supports multiple properties and tenant records, with per-tenant rent histories and balances. You can manage the records entirely offline.\n' + LINKS.rentlogHelp },
  { product: 'rentlog', phrases: ['rent', 'balance', 'overpayment', 'underpayment', 'dues', 'rent receipt'], answer: 'Use RentLog PRO’s guided three-step rent logging flow to record payments. It calculates carried balances and overpayment credits. The app does not collect online payments.\n' + LINKS.rentlogHelp },
  { product: 'rentlog', phrases: ['utility', 'water charges', 'meter', 'electricity'], answer: 'RentLog PRO can track utility readings and charges alongside rent. See the official manual for the controls in your app version:\n' + LINKS.rentlogHelp },
  { product: 'rentlog', phrases: ['pin', 'locked out', 'forgot password', 'authentication'], answer: 'RentLog PRO works locally. For login or PIN help, open the Help option on the authentication screen. Do not send anyone your PIN or a private backup file.\n' + LINKS.rentlogHelp },
  { product: 'cropguard', phrases: ['supported crop', 'crop list', 'wheat', 'rice', 'tomato', 'jowar', 'sorghum', 'apple', 'cherry', 'corn'], answer: 'CropGuard currently supports Wheat, Rice, Tomato, Jowar (Sorghum), Apple, Cherry and Corn. Detection is limited to trained crop and disease classes.\n' + LINKS.cropguard },
  { product: 'cropguard', phrases: ['scan', 'leaf photo', 'diagnose', 'disease', 'detection', 'treatment'], answer: 'In CropGuard: select a crop, photograph one clear, well-lit leaf against a simple background, then review the on-device diagnosis and guidance. AI output is advisory; confirm unusual or high-stakes cases with an agricultural expert.\nGuide: ' + LINKS.cropguardHelp },
  { product: 'cropguard', phrases: ['install', 'download', 'apk', 'android requirement', 'storage', 'space'], answer: 'Install CropGuard through its official website: ' + LINKS.cropguard + '\nAndroid 6.0+, camera access and around 500 MB of free storage are recommended for its local models.' },
  { product: 'cropguard', phrases: ['history', 'share report', 'whatsapp sharing', 'sms'], answer: 'CropGuard keeps local scan history and can share diagnostic reports using WhatsApp or SMS. The analysis itself runs on your phone.\n' + LINKS.cropguardHelp },
  { product: 'crew', phrases: ['games', 'quiz', 'bingo', 'activities', 'xp', 'leaderboard'], answer: 'Aurora Crew Hub documents 24 host-led Quick Games plus nine local mini games, along with XP, missions, challenges, badges and achievements. Actual availability depends on the deployed release and enabled permissions.\n' + LINKS.crew },
  { product: 'crew', phrases: ['event', 'rsvp', 'ticket', 'waitlist', 'calendar'], answer: 'Crew Hub can run managed events with RSVP, capacity, waitlists, reminders, QR tickets, check-in and feedback. Calendar export uses .ics files, not two-way continuous calendar sync.\n' + LINKS.crew },
  { product: 'crew', phrases: ['trip', 'expenses', 'expense splitter', 'split payments', 'travel'], answer: 'Crew Hub can plan trips, share tasks and track expense splits and external settlements. It does not process payments or connect to bank accounts.\n' + LINKS.crew },
  { product: 'crew', phrases: ['anonymous', 'confession', 'privacy', 'circle', 'moderation'], answer: 'Crew Hub has moderated anonymous submissions and invitation-only private circles. Anonymous posts remain subject to moderation; staff roles alone do not grant access to someone else’s private circle.\n' + LINKS.crew },
  { product: 'crew', phrases: ['spotify', 'photos', 'album'], answer: 'Custom Aurora Crew Hub builds include linked Google Photos shared albums and Spotify Blend playlists. Crew Hub organises the links but does not itself stream music or media.\n' + LINKS.crew },
  { product: 'identity', phrases: ['id cards', 'id card', 'identity', 'crew directory', 'staff directory', 'badge printing'], answer: 'Aurora Identity Hub generates branded ID cards and maintains a searchable directory. Each offline-first Android build is scoped per client, with optional cloud sync.\nRequest details: ' + LINKS.identity }
]);

module.exports = { LINKS, PRODUCTS, FAQS };
