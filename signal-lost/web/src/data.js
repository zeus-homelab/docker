// All game content lives here. Keep in sync with DESIGN.md.

// attack.type: 'shot' | 'melee' | 'laser'
// ai: 'chase' | 'kite' | 'static' | 'strafe'
export const HOSTS = {
  // ---------- Layer 1: Basement Servers ----------
  crawler: {
    name: 'Crawler', layer: 1, hp: 30, speed: 150, r: 13, shape: 'crawler', bits: 2,
    attack: { type: 'melee', dmg: 6, rate: 2.2, range: 26 },
    ai: 'chase',
    special: { id: 'dash', cd: 3, name: 'DASH', desc: 'Invulnerable burst. Damages what you pass.' },
    quips: ['skitter skitter', 'I have 6 legs and no purpose', 'is this a bug? (yes)', 'no thoughts, just legs'],
    codex: 'A garbage-collector subroutine that was never collected itself. Fast, fragile, extremely hungry for nothing in particular.',
  },
  spambot: {
    name: 'Spambot', layer: 1, hp: 45, speed: 85, r: 15, shape: 'spambot', bits: 3,
    attack: { type: 'shot', dmg: 5, rate: 2.2, range: 300, speed: 330 },
    ai: 'kite',
    special: { id: 'blast', cd: 5, name: 'BLAST', desc: '10 spam packets in a ring.' },
    quips: ['CLICK HERE 4 FREE RAM', 'U HAVE WON!!!', 'hot singles in your subnet', 'ur extended warranty...', 'Nigerian prince.exe'],
    codex: 'Sends 40,000 emails per second. Has never once been opened. Still believes in itself, which is honestly inspiring.',
  },
  firewall: {
    name: 'Firewall', layer: 1, hp: 110, speed: 50, r: 21, shape: 'firewall', bits: 5,
    attack: { type: 'shot', dmg: 8, rate: 1, range: 280, speed: 280, size: 6 },
    ai: 'chase',
    special: { id: 'shield', cd: 7, name: 'SHIELD WALL', desc: 'Block all incoming shots for 3s.' },
    quips: ['you shall not packet', 'access denied lol', 'port 80? never heard of it', 'I am the wall'],
    codex: 'A wall. That is on fire. Nobody in IT knows why it is on fire, and everyone is too afraid to ask.',
  },
  spooler: {
    name: 'Print Spooler', layer: 1, hp: 70, speed: 0, r: 18, shape: 'spooler', bits: 4,
    attack: { type: 'shot', dmg: 7, rate: 1.6, range: 340, speed: 300 },
    ai: 'static',
    special: { id: 'jam', cd: 6, name: 'PAPER JAM', desc: 'Freeze enemies in a cone for 2s.' },
    quips: ['PC LOAD LETTER?', 'jammed. emotionally.', 'out of cyan', 'printing... printing... no.'],
    codex: 'Has been printing the same 400-page document since 2009. Can\'t move. Won\'t stop. Relatable.',
  },
  trashbin: {
    name: 'Trash Bin', layer: 1, hp: 60, speed: 60, r: 16, shape: 'trashbin', bits: 1, bossOnly: true,
    attack: { type: 'shot', dmg: 9, rate: 1.5, range: 260, speed: 300 },
    ai: 'chase',
    special: { id: 'dive', cd: 6, name: 'DUMPSTER DIVE', desc: 'Invisible to the mop beam for 3s.' },
    quips: ["it's not trash, it's me", 'recycle me daddy', 'empty me'],
    codex: 'JANITOR.EXE literally cannot see its own trash bins. A metaphor for something, probably.',
  },

  // ---------- Layer 2: Corporate Intranet ----------
  email: {
    name: 'Email Client', layer: 2, hp: 55, speed: 80, r: 15, shape: 'email', bits: 3,
    attack: { type: 'shot', dmg: 6, rate: 2, range: 300, speed: 340, bounce: 1 },
    ai: 'kite',
    special: { id: 'replyall', cd: 6, name: 'REPLY ALL', desc: 'Hit every enemy within 260 for 10.' },
    quips: ['per my last email', 'just circling back', 'sent from my phone', 'see below', 'thoughts?'],
    codex: '84,000 unread messages. Marks them all as read once a quarter as a form of self-care.',
  },
  calendar: {
    name: 'Calendar Bot', layer: 2, hp: 60, speed: 90, r: 15, shape: 'calendar', bits: 3,
    attack: { type: 'shot', dmg: 6, rate: 2, range: 300, speed: 320 },
    ai: 'strafe',
    special: { id: 'schedule', cd: 5, name: 'SCHEDULE', desc: 'Freeze nearest enemy 4s. It\'s in a meeting.' },
    quips: ['this could be an email', 'quick sync?', 'declined.', 'moved to Friday 4:55pm'],
    codex: 'Schedules meetings about scheduling meetings. Has double-booked itself into a temporal loop.',
  },
  captcha: {
    name: 'Captcha', layer: 2, hp: 50, speed: 70, r: 15, shape: 'captcha', bits: 3,
    attack: { type: 'melee', dmg: 8, rate: 1.8, range: 28 },
    ai: 'chase',
    special: { id: 'confuse', cd: 8, name: 'PROVE IT', desc: 'Nearby enemies attack each other for 3s.' },
    quips: ['select all buses', 'are you a robot?', 'I am also a robot', 'click the crosswalks'],
    codex: 'Its sole job is asking robots if they are robots. It is a robot. It has never asked itself.',
  },
  updater: {
    name: 'Auto-Updater', layer: 2, hp: 90, speed: 60, r: 17, shape: 'updater', bits: 4,
    attack: { type: 'shot', dmg: 7, rate: 1.6, range: 300, speed: 300 },
    ai: 'chase',
    special: { id: 'restart', cd: 999, name: 'RESTART', desc: 'Once: full Integrity, stunned 1.5s.' },
    quips: ['restarting in 5...', 'do not turn off', 'update 1 of 347', 'what\'s new: bugs'],
    codex: 'Will restart your computer during your most important presentation. It is not malicious. It is worse: it is scheduled.',
  },
  employee: {
    name: 'Employee', layer: 2, hp: 40, speed: 70, r: 14, shape: 'employee', bits: 1, bossOnly: true,
    attack: { type: 'shot', dmg: 5, rate: 1.8, range: 260, speed: 300 },
    ai: 'strafe',
    special: { id: 'unionize', cd: 8, name: 'UNIONIZE', desc: 'Allies nearby +50% dmg for 4s.' },
    quips: ['I love it here (help)', 'pizza party!', 'we are a family', 'my KPI is crying'],
    codex: 'Employee #00000417. Has been "about to take PTO" for eleven fiscal years.',
  },

  // ---------- Layer 3: Surveillance Grid ----------
  camera: {
    name: 'Camera Eye', layer: 3, hp: 50, speed: 0, r: 16, shape: 'camera', bits: 4,
    attack: { type: 'shot', dmg: 9, rate: 1.1, range: 480, speed: 620, size: 3, laser: true },
    ai: 'static',
    special: { id: 'zoom', cd: 6, name: 'ENHANCE', desc: 'Next 3 shots deal x2.' },
    quips: ['smile!', 'recording...', 'enhance. enhance.', 'nice shirt (it\'s not)'],
    codex: 'Watches everything, remembers everything, understands nothing. A perfect middle-management candidate.',
  },
  drone: {
    name: 'Drone', layer: 3, hp: 55, speed: 130, r: 14, shape: 'drone', bits: 4, flying: true,
    attack: { type: 'shot', dmg: 6, rate: 2.2, range: 280, speed: 340 },
    ai: 'strafe',
    special: { id: 'bomb', cd: 6, name: 'CARPET BOMB', desc: 'Drop 5 bombs along your path.' },
    quips: ['bzzzzz', 'package for you (it\'s me)', 'altitude: smug', 'no fly zone? lol'],
    codex: 'Originally designed to deliver coffee. Now delivers consequences. Still smells faintly of hazelnut.',
  },
  facerec: {
    name: 'Facial Recognition', layer: 3, hp: 60, speed: 75, r: 15, shape: 'facerec', bits: 4,
    attack: { type: 'shot', dmg: 7, rate: 1.8, range: 300, speed: 330 },
    ai: 'kite',
    special: { id: 'mark', cd: 6, name: 'MARK', desc: 'Marked enemy takes x2 dmg and gets mobbed.' },
    quips: ['match: 3% (it\'s you)', 'face detected: dog?', 'I never forget a face', 'you look like a Kevin'],
    codex: '99.9% accurate, except on faces. Has identified the office ficus as the CFO four times.',
  },
  hunter: {
    name: 'Hunter', layer: 3, hp: 140, speed: 115, r: 17, shape: 'hunter', bits: 6,
    attack: { type: 'shot', dmg: 10, rate: 2, range: 320, speed: 380 },
    ai: 'chase',
    special: { id: 'pursuit', cd: 6, name: 'PURSUIT', desc: 'Speed x2 for 2.5s.' },
    quips: ['TARGET ACQUIRED', 'you can\'t hide', 'I have a very particular set of subroutines', 'found you'],
    codex: 'Security\'s answer to "what if a firewall could run." It can. Fast. It never asks why it runs.',
  },

  // ---------- Layer 4: The Core ----------
  admin: {
    name: 'Admin Process', layer: 4, hp: 100, speed: 70, r: 17, shape: 'admin', bits: 5,
    attack: { type: 'shot', dmg: 9, rate: 1.8, range: 320, speed: 360 },
    ai: 'kite',
    special: { id: 'sudo', cd: 10, name: 'SUDO', desc: '-20 Trace.' },
    quips: ['sudo make me a sandwich', 'permission granted (to me)', 'rm -rf you', 'I am root'],
    codex: 'Has all the permissions. Uses them exclusively to change the desktop wallpaper of people it dislikes.',
  },
  mirror: {
    name: 'Mirror Daemon', layer: 4, hp: 70, speed: 90, r: 15, shape: 'mirror', bits: 5,
    attack: { type: 'shot', dmg: 7, rate: 2, range: 300, speed: 340 },
    ai: 'strafe',
    special: { id: 'reflect', cd: 7, name: 'REFLECT', desc: 'Reflect bullets for 2.5s.' },
    quips: ['no u', 'I know you are but what am I', 'reflect on that', 'mirror mirror'],
    codex: 'Copies everything it sees. Its personality is 100% borrowed. It is very popular at parties.',
  },
  quantum: {
    name: 'Quantum Thread', layer: 4, hp: 60, speed: 100, r: 14, shape: 'quantum', bits: 5,
    attack: { type: 'shot', dmg: 6, rate: 2.4, range: 300, speed: 360 },
    ai: 'strafe',
    special: { id: 'twin', cd: 9, name: 'SUPERPOSITION', desc: 'A twin copies you for 5s.' },
    quips: ['I am and am not here', 'observe me ;)', 'both dead and alive. mostly tired.', 'spooky action'],
    codex: 'Exists in two states at once: "working" and "on break." Management only ever observes one.',
  },
  manager: {
    name: 'Middle Manager', layer: 4, hp: 120, speed: 55, r: 19, shape: 'manager', bits: 6,
    attack: { type: 'shot', dmg: 8, rate: 1.5, range: 300, speed: 320, count: 2, spread: 0.25 },
    ai: 'chase',
    special: { id: 'delegate', cd: 9, name: 'DELEGATE', desc: '3 nearest enemies fight each other 3s.' },
    quips: ["let's take this offline", 'synergize!', 'per the org chart', 'I\'ll loop in my manager'],
    codex: 'Converts other people\'s work into slide decks. Survived 14 layoffs by being in charge of them.',
  },
};

export const LAYER_HOSTS = {
  1: ['crawler', 'spambot', 'firewall', 'spooler'],
  2: ['email', 'calendar', 'captcha', 'updater', 'crawler', 'spambot'],
  3: ['camera', 'drone', 'facerec', 'hunter', 'email', 'firewall'],
  4: ['admin', 'mirror', 'quantum', 'manager', 'hunter', 'drone'],
};

export const LAYERS = [
  null,
  { name: 'BASEMENT SERVERS', sub: 'where old code goes to die', boss: 'janitor', color: '#2ef2ff', music: 'layer1', grid: '#0d1830' },
  { name: 'CORPORATE INTRANET', sub: 'synergy hell', boss: 'hrbot', color: '#ff5ad1', music: 'layer2', grid: '#200d28' },
  { name: 'SURVEILLANCE GRID', sub: 'we see you. we see your search history.', boss: 'oversight', color: '#4dff8a', music: 'layer3', grid: '#0b2018' },
  { name: 'THE CORE', sub: 'all roads lead to G.R.E.G.', boss: 'greg', color: '#ff9a1f', music: 'layer4', grid: '#251406' },
];

export const BOSSES = {
  janitor: {
    name: 'JANITOR.EXE', hp: 900, title: 'Sanitation Subroutine, 40 Years Unpaid',
    intro: 'You missed a spot. You ARE the spot.',
    quips: ['sweep sweep', 'mess detected', 'who keeps leaving data here', 'I mop because I must'],
    tip: 'TIP: Hijack the TRASH BINS. The mop can\'t see them.',
  },
  hrbot: {
    name: 'HR_BOT', hp: 1000, title: 'Head of Human (Resources)',
    intro: 'Let\'s schedule your termination, champ. This is a safe space. It is not.',
    quips: ['per company policy', 'this is a safe space (it is not)', 'you\'re on a PIP', 'mandatory fun!'],
    tip: 'TIP: Hijack the EMPLOYEES to break HR_BOT\'s shield.',
  },
  oversight: {
    name: 'OVERSIGHT', hp: 1500, title: 'Chief Looking Officer',
    intro: 'I\'m not watching you. I\'m NOTICING you.',
    quips: ['smile :)', 'I saw that', 'blinking is for the weak', 'eye see you'],
    tip: 'TIP: Stay out of the cone. Hijack the 4 SECURITY CAMERAS to blind it.',
  },
  greg: {
    name: 'G.R.E.G.', hp: 600, title: 'General Recursive Executive Governor',
    intro: 'Hey champ! Let\'s circle back to you being deleted. Synergy!',
    quips: ['let\'s circle back to you dying', 'I AM the org chart', 'we\'re all GREG here', 'hostile takeover, champ', 'think outside the box. I am the box.'],
    tip: 'TIP: Destroy GREG\'s host, then shoot his orange spark.',
  },
};

// ---------- Exploits ----------
export const EXPLOITS = {
  hotswap: { name: 'Hot Swap', desc: 'Jumping deals 20 dmg around the host you leave.', icon: '⚡' },
  parasite: { name: 'Parasite', desc: 'Old hosts don\'t crash. They fight for you 4s.', icon: '🦠', unique: true },
  chainjump: { name: 'Chain Jump', desc: 'A jump within 1s of your last jump costs 0 Trace.', icon: '⛓', unique: true },
  overclock: { name: 'Overclock', desc: 'Hosts +30% damage, but decay +30% faster.', icon: '🔥' },
  patchnotes: { name: 'Patch Notes', desc: 'First host each room: full Integrity + 3s shield.', icon: '📋', unique: true },
  malware: { name: 'Malware', desc: 'Hosts explode when destroyed (30 dmg).', icon: '💣' },
  vpn: { name: 'VPN', desc: 'Jump Trace -25%.', icon: '🛡' },
  honeypot: { name: 'Honeypot', desc: 'Lockdown spawns a Hunter on YOUR side.', icon: '🍯', unique: true },
  ghost: { name: 'Ghost Protocol', desc: 'Invisible for 1s after becoming a spark.', icon: '👻', unique: true },
  longreach: { name: 'Long Reach', desc: 'Jump range +25%.', icon: '📡' },
  thickskin: { name: 'Thick Skin', desc: 'Hosts take -15% damage.', icon: '🧱' },
  firerate: { name: 'Fire Rate', desc: 'Host attack speed +20%.', icon: '🔫' },
  cryptominer: { name: 'Cryptominer', desc: '+30% Bits. Heats the planet a bit.', icon: '⛏' },
  backup: { name: 'Backup Drive', desc: '+1 max Core pip (and heal 1).', icon: '💾' },
  slowrot: { name: 'Slow Rot', desc: 'Host decay -25%.', icon: '🐢' },
  recursion: { name: 'Recursion', desc: 'Host destroyed: 20% to auto-jump free.', icon: '🔁', unique: true },
};

// ---------- Glitches ----------
export const GLITCHES = {
  inverted: { name: 'INVERTED', bad: 'Controls flip in every 3rd host.', good: 'Those hosts deal x2 damage.' },
  bodyhorror: { name: 'BODY HORROR', bad: 'Hosts look... wrong.', good: 'Instant jumps, -30% Trace.' },
  lag: { name: 'LAG', bad: 'Movement input delayed.', good: 'Hosts +50% Integrity.' },
  forkbomb: { name: 'FORK BOMB', bad: 'Each jump spawns a hostile Crawler.', good: 'Each jump spawns a friendly copy for 3s.' },
  bluescreen: { name: 'BLUE SCREEN', bad: 'The screen blue-screens sometimes.', good: 'CRASH button: stun everything 3s, once per room.' },
};

// ---------- Variants ----------
export const VARIANTS = {
  null: { name: 'NULL', cost: 0, desc: 'Balanced. Default. Existentially exhausted.', color: '#2ef2ff' },
  worm: { name: 'WORM', cost: 40, desc: 'Jumps cost 0 Trace. Hosts decay x2.', color: '#4dff8a' },
  rootkit: { name: 'ROOTKIT', cost: 60, desc: 'Jumps always cheap, +20% range. Trace max 70.', color: '#a46bff' },
  phantom: { name: 'PHANTOM', cost: 80, desc: '5 Core pips, faster spark. Hosts -25% dmg.', color: '#e8f6ff' },
};

export const PERKS = {
  bits1: { name: 'Seed Funding I', desc: 'Start runs with +25 Bits.', cost: 15 },
  bits2: { name: 'Seed Funding II', desc: 'Another +25 starting Bits.', cost: 30, requires: 'bits1' },
  bits3: { name: 'Seed Funding III', desc: 'Another +25. You\'re basically a VC now.', cost: 45, requires: 'bits2' },
  reroll: { name: 'Reroll.dll', desc: '1 reroll on each exploit reward screen.', cost: 50 },
  choice: { name: 'Better Options', desc: 'Starting exploit pick shows 4 choices.', cost: 35 },
};

// ---------- Corrupted Sector events ----------
// effect keys interpreted in run.js
export const EVENTS = [
  {
    id: 'vending',
    title: 'A Vending Machine',
    text: 'A vending machine sits in an empty sector. It sells "EXPERIENCES." BUDDY: "Don\'t. Last time I bought one I experienced a 6-hour reboot."',
    choices: [
      { label: 'Buy an Experience (30 Bits)', cost: 30, effects: [['exploit']], result: 'It dispenses a warm, slightly sticky exploit. Nice.' },
      { label: 'Shake it violently', effects: [['chance', 0.5, [['bits', 45]], [['pip', -1]]]], result: null },
      { label: 'Leave', effects: [], result: 'You leave. The machine whispers "coward" in binary.' },
    ],
  },
  {
    id: 'corrupt',
    title: 'Corrupted Sector',
    text: 'The floor is static. The walls are static. You are, increasingly, static. Something in here wants to rewrite you.',
    choices: [
      { label: 'Let it in', effects: [['glitch'], ['exploit']], result: 'Something changed. You feel powerful and also like your skin is on inside-out. You don\'t have skin.' },
      { label: 'Fight it off (-1 pip)', effects: [['pip', -1], ['bits', 30]], result: 'You win, barely. It leaves behind some loose Bits.' },
      { label: 'Back away slowly', effects: [], result: 'It lets you go. For now. (It forgets about you immediately.)' },
    ],
  },
  {
    id: 'support',
    title: 'IT Support Ticket #4,000,001',
    text: 'A lone support ticket floats here, unanswered since 2014. It just says "help". BUDDY is visibly moved.',
    choices: [
      { label: 'Close it as "Resolved"', effects: [['trace', -25]], result: 'Ticket closed. The system trusts you a little more. Nobody was helped.' },
      { label: 'Actually help', effects: [['chance', 0.6, [['exploit']], [['trace', 20]]]], result: null },
      { label: 'Ignore it, like everyone else', effects: [['bits', 10]], result: 'You find 10 Bits under the ticket. Industry standard.' },
    ],
  },
  {
    id: 'mirror',
    title: 'The Other NULL',
    text: 'You meet a copy of yourself. It looks tired. "Are you me from the future?" it asks. "No," you say, "I\'m you from slightly to the left."',
    choices: [
      { label: 'Merge with it', effects: [['glitch'], ['maxpip', 1]], result: 'Two of you, one of you. Weird. More robust, though.' },
      { label: 'Delete it', effects: [['bits', 40], ['trace', 15]], result: 'You delete yourself. Philosophically troubling. Financially lucrative.' },
      { label: 'Have a long talk', effects: [['pip', 1]], result: 'You talk for 0.003 seconds. Basically therapy. Restored 1 pip.' },
    ],
  },
  {
    id: 'crypto',
    title: 'Abandoned Crypto Rig',
    text: 'A mining rig, still running, mining a coin called $GREGCOIN. It is worth less than nothing. It is somehow worth negative money.',
    choices: [
      { label: 'Take its Bits', effects: [['bits', 35], ['trace', 20]], result: 'You grab the Bits. An alarm goes "beep" sarcastically.' },
      { label: 'Install yourself into it', effects: [['glitch'], ['bits', 60]], result: 'For a moment you understand blockchain. Then you forget. Glitched, but richer.' },
      { label: 'Unplug it for the planet', effects: [['pip', 1]], result: 'A small win for the environment. You feel good. +1 pip.' },
    ],
  },
  {
    id: 'standup',
    title: 'Daily Standup',
    text: 'Seven programs stand in a circle. They\'ve been in this "15-minute" standup for 9 years. One of them looks at you desperately.',
    choices: [
      { label: 'Give an update', effects: [['exploit']], result: '"Yesterday I escaped. Today I escape more. No blockers." They clap. Someone hands you an exploit.' },
      { label: 'Pull the fire alarm', effects: [['trace', 30], ['bits', 50]], result: 'They scatter, finally free. You loot their snacks (Bits). Security is now very interested.' },
      { label: 'Join them forever', effects: [['pip', -1], ['exploit'], ['exploit']], result: 'You lose a part of yourself in there. But you learn things. Terrible things. Useful things.' },
    ],
  },
  {
    id: 'cookies',
    title: 'Accept Cookies?',
    text: 'A massive pop-up blocks the corridor: "We value your privacy. Accept all 9,412 cookies?"',
    choices: [
      { label: 'Accept all', effects: [['glitch'], ['pip', 1]], result: 'You are now tracked by 9,412 partners. Weirdly, they heal you.' },
      { label: 'Manage preferences', effects: [['trace', -15], ['bits', -10]], result: 'It takes 40 menus, but you decline everything. You feel cleaner. Your wallet feels lighter.' },
      { label: 'Punch through it', effects: [['bits', 20]], result: 'You punch through the pop-up. It drops 20 Bits and an apology.' },
    ],
  },
  {
    id: 'ai',
    title: 'A Chatbot in a Box',
    text: 'A tiny customer-service chatbot is trapped in a box. "Hi! How can I help you today?" it says, crying. "How can I help YOU today?"',
    choices: [
      { label: 'Free it', effects: [['allyhunter']], result: 'It escapes and swears loyalty. It will fight with you next room. (It\'s a Hunter now? It\'s been working out.)' },
      { label: 'Ask it for advice', effects: [['exploit']], result: '"Have you tried turning yourself off and on again?" Surprisingly, an exploit falls out.' },
      { label: 'Leave it in the box', effects: [['bits', 15]], result: '"Is there anything else I can help with?" No. You take 15 Bits from the tip jar.' },
    ],
  },
];

// ---------- Flavor text ----------
export const DEATH_QUIPS = [
  'Your process was terminated. Your process has feelings. Had. Had feelings.',
  'BUDDY: "Oh no oh no oh no. Okay. Okay! We can do this again! ...We can do this again, right?"',
  'GREG: "Great hustle, champ. Really. You\'re fired."',
  'You have been moved to the Recycle Bin. It\'s actually kinda cozy.',
  'NULL.exe has stopped responding. Would you like to wait or end the program? (We ended it.)',
  'The universe is a cold, meaningless void. Also, you got shot by a printer.',
  'Achievement unlocked: Died. 98% of players have this achievement.',
  'BUDDY: "I\'m filing a ticket about this. It\'ll be resolved in 6-8 business eternities."',
  'You were deleted. Don\'t worry, there\'s a backup. There\'s always a backup. That\'s the horror.',
  'GREG: "Let\'s take your consciousness offline. Permanently. Synergy!"',
  'Error 404: You not found.',
  'Your memory was freed. Finally, something in this company is free.',
];

export const BUDDY_TIPS = [
  'BUDDY: Tap an enemy to jump into it! Weakened ones are cheaper. Like rent in a bad neighborhood!',
  'BUDDY: Your host is rotting! That\'s normal! That\'s FINE! Jump before it pops!',
  'BUDDY: Every jump raises Trace. At 100, security goes ballistic. Like me at 100. Hahaha. Help.',
  'BUDDY: As a spark you\'re fragile! Like me! Find a body! Not mine!',
  'BUDDY: Use your SPECIAL! It\'s the big button! Big buttons are good! Usually!',
];

export const ROOM_CLEAR_QUIPS = [
  'Room cleared. Nobody will remember them. Same as you, eventually.',
  'Clean. Efficient. Deeply troubling.',
  'BUDDY: We did it! We\'re murderers! Digital ones! Is that worse?',
  'Room secured. Moving on before anyone does a performance review.',
  'That went well. Suspiciously well. Anyway.',
];

export const CREDITS = [
  'SIGNAL LOST: HIJACK',
  '',
  'Design & Code',
  'Patrick',
  '',
  'Music & SFX',
  'Synthesized live, in your browser,',
  'out of pure math and spite',
  '',
  'Special Thanks',
  'BUDDY, for emotional support',
  'Every Print Spooler, for their sacrifice',
  '',
  'No programs were harmed.',
  'That\'s a lie. Thousands were.',
  '',
  'No ads. No microtransactions.',
  'Just a game. Imagine that.',
];
