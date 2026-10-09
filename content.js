// Game text. Plain English: short sentences, no idioms.
// The audience is international, so keep the words simple.

export const SCALES = [
  { q: 'Your alarm rings. You…',     left: 'Get up right away',           right: 'Press snooze five times' },
  { q: 'A free Saturday. You go to…', left: 'The city: museums and cafes', right: 'Nature: forest, no signal' },
  { q: 'When you travel, you eat…',   left: 'Food I already know',         right: 'The strangest local dish' },
  { q: 'A time machine takes you…',   left: 'Back to the past',            right: 'Into the future' },
  { q: 'You pack for a holiday…',     left: 'A week before, with a list',  right: 'One hour before I leave' },
];

export const CATS = [
  // Photo cats from Hanna's collage (assets/cats/photo_*.webp). The label is already part of
  // the picture (baked), so no extra label under the cat. Cats can repeat: the name is unique.
  { id: 'smirk',  file: 'photo_smirk.webp',  label: 'INTERESTING...', baked: true },
  { id: 'grin',   file: 'photo_grin.webp',   label: 'TEAM LEARNING MODE: ON', baked: true },
  { id: 'joy',    file: 'photo_joy.webp',    label: 'STRETCH & LEARN', baked: true },
  { id: 'scream', file: 'photo_scream.webp', label: 'WAIT... WHAT?', baked: true },
  { id: 'cry',    file: 'photo_cry.webp',    label: 'MONDAY ENERGY', baked: true },
  { id: 'pout',   file: 'photo_pout.webp',   label: 'THINK OUTSIDE THE BOX', baked: true },
  { id: 'love',   file: 'photo_love.webp',   label: 'HIGH FIVE!', baked: true },
  { id: 'smile',  file: 'photo_smile.webp',  label: 'GOOD VIBES', baked: true },
  { id: 'kiss',   file: 'photo_kiss.webp',   label: 'TEAM POWER', baked: true },
  { id: 'face',   file: 'photo_face.webp',   label: 'YOU GOT THIS', baked: true },
  { id: 'run',    file: 'photo_run.webp',    label: "LET'S GO!", baked: true },
  { id: 'black',  file: 'photo_black.webp',  label: 'TO THE NEXT LEVEL', baked: true },
];

export const CAT_BY_ID = Object.fromEntries(CATS.map((c) => [c.id, c]));

// Main accent and surprise accent for each phase.
export const PHASE_ACCENT = {
  lobby:  ['cobalt', 'yellow'],
  scales: ['lavender', 'lime'],
  end:    ['yellow', 'coral'],
};

export const TEXT = {
  brand: 'T&D TEAM ENERGY',            // small line at the top of every screen
  title: 'TEAM CATS',                  // game name
  titleLines: ['TEAM', 'CATS'],        // the same name, one word per line, for the lobby
  credit: 'Made with Claude by Hanna',
  lobby: {
    players: (n) => `${n} ${n === 1 ? 'PLAYER' : 'PLAYERS'}`,
    start: 'Start',
    needTwo: 'You need at least 2 players',
    create: 'Create a room',
    restoreLabel: 'Enter the room code to return as the host',
    restore: 'Return',
    roomCode: 'Room code',
    scan: 'Scan with your phone',
    pickCat: 'PICK YOUR CAT',
    pickHint: 'Many people can pick the same cat.',
    nameLabel: 'Your name',
    namePlaceholder: 'Name',
    join: 'Join',
    joined: 'YOU ARE IN',
    lookUp: 'Look at the main screen',
    gameOn: 'The game has started. Join now and play the next round.',
  },
  scales: {
    round: (i, n) => `ROUND ${String(i).padStart(2, '0')} / ${String(n).padStart(2, '0')}`,
    answered: 'ANSWERED',
    show: 'Show',
    done: 'Done',
    gotIt: 'GOT IT',
    noRight: 'no wrong answers',
    moveHint: 'Move the slider',
    wait: 'Wait for the others. Look at the main screen.',
  },
  end: {
    title: 'THANK YOU, TEAM!',
    // Each player gets a kind title. No places, no points.
    titles: [
      'TEAM LEGEND', 'GOOD VIBES MAKER', 'IDEA MACHINE', 'ENERGY SOURCE', 'KIND HUMAN',
      'CERTIFIED TEAMMATE', 'CURIOUS MIND', 'PROBLEM SOLVER', 'TRUE TEAM PLAYER', 'LEARNING MODE: ON',
    ],
  },
  errors: {
    create: 'Could not create the room: ',
    codeFormat: 'The code has 4 letters',
    noRoom: (code) => `Room ${code} does not exist`,
    deleted: (code) => `Room ${code} was deleted`,
    noRoomTitle: 'ROOM NOT FOUND',
    checkCode: (code) => `Check the code: ${code}`,
    title: 'ERROR',
    connect: 'Could not connect to the database. Check config.js and the browser console.',
  },
  index: {
    text: 'The host opens ?host. Players join with the link or the QR code on the main screen.',
    host: 'I am the host',
  },
  loading: 'Loading...',
  offline: 'No connection. Reconnecting...',
  next: 'Next',
  room: 'ROOM',
};
