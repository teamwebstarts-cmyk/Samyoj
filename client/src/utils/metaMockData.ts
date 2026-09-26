import type { Conversation, Message, ServiceWindowInfo } from '../types';

export const META_MOCK_STORAGE_KEY = 'samyoj_meta_mock_preview';
export const META_MOCK_EVENT = 'samyoj-meta-mock-change';
export const META_MOCK_ID_PREFIX = 'mock-meta-';

const t0 = Date.now();
const ago = (mins: number) => new Date(t0 - mins * 60_000).toISOString();

export function isMetaMockId(id: string): boolean {
  return id.startsWith(META_MOCK_ID_PREFIX);
}

export function readMetaMockEnabled(): boolean {
  try {
    return localStorage.getItem(META_MOCK_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeMetaMockEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(META_MOCK_STORAGE_KEY, enabled ? '1' : '0');
    window.dispatchEvent(new Event(META_MOCK_EVENT));
  } catch {
    /* ignore */
  }
}

/** Real rows first; sample rows only when id is not already live. */
export function mergeById<T extends { id: string }>(real: T[], mock: T[]): T[] {
  const seen = new Set(real.map((row) => row.id));
  const extra = mock.filter((row) => !seen.has(row.id));
  return [...real, ...extra];
}

export function mergeInboxConversations(real: Conversation[], mock: Conversation[]): Conversation[] {
  const merged = mergeById(real, mock);
  return merged.sort((a, b) => {
    const ta = new Date(a.lastMessageAt || a.createdAt || 0).getTime();
    const tb = new Date(b.lastMessageAt || b.createdAt || 0).getTime();
    return tb - ta;
  });
}

const OPEN_WINDOW: ServiceWindowInfo = {
  open: true,
  lastInboundAt: ago(12),
  expiresAt: new Date(t0 + 20 * 60 * 60_000).toISOString(),
};

type ThreadLine = { direction: 'INBOUND' | 'OUTBOUND'; content: string; minsBeforeLast: number };

type InboxPersona = {
  key: string;
  name: string;
  phone: string;
  preview: string;
  minsAgo: number;
  unread: number;
  status: 'OPEN' | 'PENDING';
  thread: ThreadLine[];
};

function contact(id: string, name: string, phone: string): Conversation['contact'] {
  return { id, phone, name, tags: [], source: 'INBOUND' };
}

function buildInboxConversation(platform: 'fb' | 'ig', persona: InboxPersona): Conversation {
  const suffix = `${platform}-${persona.key}`;
  const id = `${META_MOCK_ID_PREFIX}conv-${suffix}`;
  return {
    id,
    status: persona.status,
    unreadCount: persona.unread,
    lastMessageAt: ago(persona.minsAgo),
    createdAt: ago(persona.minsAgo + 240),
    contact: contact(`${META_MOCK_ID_PREFIX}contact-${suffix}`, persona.name, persona.phone),
    messages: [
      {
        id: `${META_MOCK_ID_PREFIX}msg-${suffix}-last`,
        conversationId: id,
        direction: 'INBOUND',
        type: 'text',
        content: persona.preview,
        status: 'delivered',
        createdAt: ago(persona.minsAgo),
      },
    ],
  };
}

function buildThreadMessages(convId: string, suffix: string, persona: InboxPersona): Message[] {
  const lastAt = persona.minsAgo;
  const lines = persona.thread.length ? persona.thread : [{ direction: 'INBOUND' as const, content: persona.preview, minsBeforeLast: 0 }];
  return lines.map((line, index) => ({
    id: `${META_MOCK_ID_PREFIX}msg-${suffix}-${index + 1}`,
    conversationId: convId,
    direction: line.direction,
    type: 'text',
    content: line.content,
    status: 'delivered',
    createdAt: ago(lastAt + line.minsBeforeLast),
  }));
}

const FB_PERSONAS: InboxPersona[] = [
  {
    key: '01',
    name: 'Priya Sharma',
    phone: '+919876543210',
    preview: 'Is the blue variant still in stock?',
    minsAgo: 8,
    unread: 2,
    status: 'OPEN',
    thread: [
      { direction: 'INBOUND', content: 'Hi, I saw your ad yesterday.', minsBeforeLast: 45 },
      { direction: 'OUTBOUND', content: 'Hello Priya — happy to help. Which product?', minsBeforeLast: 40 },
      { direction: 'INBOUND', content: 'The wireless earbuds in blue.', minsBeforeLast: 20 },
      { direction: 'OUTBOUND', content: 'Blue is in stock. Want me to reserve a pair?', minsBeforeLast: 15 },
      { direction: 'INBOUND', content: 'Is the blue variant still in stock?', minsBeforeLast: 0 },
    ],
  },
  {
    key: '02',
    name: 'Rahul Mehta',
    phone: '+919812345678',
    preview: 'Please send the PDF brochure on Messenger.',
    minsAgo: 22,
    unread: 0,
    status: 'OPEN',
    thread: [
      { direction: 'INBOUND', content: 'We are comparing vendors for Q2.', minsBeforeLast: 60 },
      { direction: 'OUTBOUND', content: 'I can share specs and pricing — what is your team size?', minsBeforeLast: 50 },
      { direction: 'INBOUND', content: 'Please send the PDF brochure on Messenger.', minsBeforeLast: 0 },
    ],
  },
  {
    key: '03',
    name: 'Anita Desai',
    phone: '+919900112233',
    preview: 'My order #4821 shows delivered but I did not receive it.',
    minsAgo: 35,
    unread: 1,
    status: 'PENDING',
    thread: [
      { direction: 'INBOUND', content: 'My order #4821 shows delivered but I did not receive it.', minsBeforeLast: 0 },
    ],
  },
  {
    key: '04',
    name: 'Vikram Singh',
    phone: '+919711223344',
    preview: 'Can I get GST invoice on this purchase?',
    minsAgo: 55,
    unread: 0,
    status: 'OPEN',
    thread: [
      { direction: 'INBOUND', content: 'Need invoice with GSTIN 27AABCU9603R1ZM', minsBeforeLast: 0 },
    ],
  },
  {
    key: '05',
    name: 'Sneha Kapoor',
    phone: '+919822334455',
    preview: 'Do you offer COD in Indore?',
    minsAgo: 70,
    unread: 1,
    status: 'OPEN',
    thread: [
      { direction: 'INBOUND', content: 'Do you offer COD in Indore?', minsBeforeLast: 0 },
    ],
  },
  {
    key: '06',
    name: 'Arjun Nair',
    phone: '+919833445566',
    preview: 'Thanks! Team loved the demo.',
    minsAgo: 95,
    unread: 0,
    status: 'OPEN',
    thread: [
      { direction: 'OUTBOUND', content: 'Here is the onboarding checklist we discussed.', minsBeforeLast: 120 },
      { direction: 'INBOUND', content: 'Thanks! Team loved the demo.', minsBeforeLast: 0 },
    ],
  },
  {
    key: '07',
    name: 'Meera Joshi',
    phone: '+919844556677',
    preview: 'Is there a student discount?',
    minsAgo: 130,
    unread: 0,
    status: 'OPEN',
    thread: [
      { direction: 'INBOUND', content: 'Is there a student discount?', minsBeforeLast: 0 },
    ],
  },
  {
    key: '08',
    name: 'Karan Malhotra',
    phone: '+919855667788',
    preview: 'Call me after 6 pm — need bulk pricing for 200 units.',
    minsAgo: 180,
    unread: 1,
    status: 'OPEN',
    thread: [
      { direction: 'INBOUND', content: 'Call me after 6 pm — need bulk pricing for 200 units.', minsBeforeLast: 0 },
    ],
  },
  {
    key: '09',
    name: 'Divya Iyer',
    phone: '+919866778899',
    preview: '👍',
    minsAgo: 210,
    unread: 0,
    status: 'OPEN',
    thread: [
      { direction: 'OUTBOUND', content: 'Your replacement is shipped. Tracking: SF4829102', minsBeforeLast: 240 },
      { direction: 'INBOUND', content: '👍', minsBeforeLast: 0 },
    ],
  },
  {
    key: '10',
    name: 'Harsh Patel',
    phone: '+919877889900',
    preview: 'Why was I charged twice on UPI?',
    minsAgo: 300,
    unread: 1,
    status: 'PENDING',
    thread: [
      { direction: 'INBOUND', content: 'Why was I charged twice on UPI?', minsBeforeLast: 0 },
    ],
  },
  {
    key: '11',
    name: 'Lakshmi Reddy',
    phone: '+919888990011',
    preview: 'Share return policy for sale items?',
    minsAgo: 420,
    unread: 0,
    status: 'OPEN',
    thread: [
      { direction: 'INBOUND', content: 'Share return policy for sale items?', minsBeforeLast: 0 },
    ],
  },
  {
    key: '12',
    name: 'Imran Khan',
    phone: '+919899001122',
    preview: 'Is the workshop on Saturday still on?',
    minsAgo: 540,
    unread: 0,
    status: 'OPEN',
    thread: [
      { direction: 'INBOUND', content: 'Is the workshop on Saturday still on?', minsBeforeLast: 0 },
    ],
  },
  {
    key: '13',
    name: 'Pooja Bansal',
    phone: '+919910112233',
    preview: 'Can you customise the hamper for a wedding?',
    minsAgo: 720,
    unread: 1,
    status: 'OPEN',
    thread: [
      { direction: 'INBOUND', content: 'Can you customise the hamper for a wedding?', minsBeforeLast: 0 },
    ],
  },
  {
    key: '14',
    name: 'Rohit Verma',
    phone: '+919921223344',
    preview: 'Not interested anymore, please stop messages.',
    minsAgo: 900,
    unread: 0,
    status: 'OPEN',
    thread: [
      { direction: 'OUTBOUND', content: 'Following up on your cart — still want help?', minsBeforeLast: 960 },
      { direction: 'INBOUND', content: 'Not interested anymore, please stop messages.', minsBeforeLast: 0 },
    ],
  },
  {
    key: '15',
    name: 'Neha Gupta',
    phone: '+919932334455',
    preview: 'Do you integrate with Shopify?',
    minsAgo: 1200,
    unread: 0,
    status: 'OPEN',
    thread: [
      { direction: 'INBOUND', content: 'Do you integrate with Shopify?', minsBeforeLast: 0 },
    ],
  },
];

const IG_PERSONAS: InboxPersona[] = [
  {
    key: '01',
    name: 'ananya.style',
    phone: '+910000000101',
    preview: 'Saw your Reel — what time do you open on Sunday?',
    minsAgo: 12,
    unread: 1,
    status: 'OPEN',
    thread: [
      { direction: 'INBOUND', content: 'Saw your Reel — what time do you open on Sunday?', minsBeforeLast: 0 },
    ],
  },
  {
    key: '02',
    name: 'dev_crafts',
    phone: '+910000000102',
    preview: 'Can you ship to Pune by Friday?',
    minsAgo: 28,
    unread: 0,
    status: 'OPEN',
    thread: [
      { direction: 'OUTBOUND', content: 'Share pincode and I will check express slots.', minsBeforeLast: 18 },
      { direction: 'INBOUND', content: 'Can you ship to Pune by Friday?', minsBeforeLast: 0 },
    ],
  },
  {
    key: '03',
    name: 'mumbai_foodie',
    phone: '+910000000103',
    preview: 'Is the tasting menu vegetarian-friendly?',
    minsAgo: 40,
    unread: 1,
    status: 'OPEN',
    thread: [
      { direction: 'INBOUND', content: 'Is the tasting menu vegetarian-friendly?', minsBeforeLast: 0 },
    ],
  },
  {
    key: '04',
    name: 'fit.with.riya',
    phone: '+910000000104',
    preview: 'Link to the program you mentioned?',
    minsAgo: 65,
    unread: 0,
    status: 'OPEN',
    thread: [
      { direction: 'OUTBOUND', content: 'DMing you the starter plan details.', minsBeforeLast: 90 },
      { direction: 'INBOUND', content: 'Link to the program you mentioned?', minsBeforeLast: 0 },
    ],
  },
  {
    key: '05',
    name: 'home.decor.ahm',
    phone: '+910000000105',
    preview: 'Price for the lamp in your last post?',
    minsAgo: 88,
    unread: 1,
    status: 'OPEN',
    thread: [
      { direction: 'INBOUND', content: 'Price for the lamp in your last post?', minsBeforeLast: 0 },
    ],
  },
  {
    key: '06',
    name: 'travel_diaries_in',
    phone: '+910000000106',
    preview: 'Still have slots for the Goa batch?',
    minsAgo: 110,
    unread: 0,
    status: 'PENDING',
    thread: [
      { direction: 'INBOUND', content: 'Still have slots for the Goa batch?', minsBeforeLast: 0 },
    ],
  },
  {
    key: '07',
    name: 'studio.kavya',
    phone: '+910000000107',
    preview: 'Love the colour palette on this drop 🔥',
    minsAgo: 150,
    unread: 0,
    status: 'OPEN',
    thread: [
      { direction: 'INBOUND', content: 'Love the colour palette on this drop 🔥', minsBeforeLast: 0 },
    ],
  },
  {
    key: '08',
    name: 'techbytes_daily',
    phone: '+910000000108',
    preview: 'Does warranty cover water damage?',
    minsAgo: 200,
    unread: 1,
    status: 'OPEN',
    thread: [
      { direction: 'INBOUND', content: 'Does warranty cover water damage?', minsBeforeLast: 0 },
    ],
  },
  {
    key: '09',
    name: 'bakehouse.pune',
    phone: '+910000000109',
    preview: 'Need 40 cupcakes for Friday — possible?',
    minsAgo: 260,
    unread: 1,
    status: 'OPEN',
    thread: [
      { direction: 'INBOUND', content: 'Need 40 cupcakes for Friday — possible?', minsBeforeLast: 0 },
    ],
  },
  {
    key: '10',
    name: 'yoga.with.sara',
    phone: '+910000000110',
    preview: 'Sent payment on GPay — please confirm.',
    minsAgo: 320,
    unread: 0,
    status: 'OPEN',
    thread: [
      { direction: 'INBOUND', content: 'Sent payment on GPay — please confirm.', minsBeforeLast: 0 },
    ],
  },
  {
    key: '11',
    name: 'streetwear.colab',
    phone: '+910000000111',
    preview: 'Collab inquiry — who handles partnerships?',
    minsAgo: 400,
    unread: 0,
    status: 'OPEN',
    thread: [
      { direction: 'INBOUND', content: 'Collab inquiry — who handles partnerships?', minsBeforeLast: 0 },
    ],
  },
  {
    key: '12',
    name: 'plants.and.peace',
    phone: '+910000000112',
    preview: 'My monstera arrived damaged 😞',
    minsAgo: 480,
    unread: 1,
    status: 'PENDING',
    thread: [
      { direction: 'INBOUND', content: 'My monstera arrived damaged 😞', minsBeforeLast: 0 },
    ],
  },
  {
    key: '13',
    name: 'dancefloor.delhi',
    phone: '+910000000113',
    preview: 'Age limit for the workshop?',
    minsAgo: 600,
    unread: 0,
    status: 'OPEN',
    thread: [
      { direction: 'INBOUND', content: 'Age limit for the workshop?', minsBeforeLast: 0 },
    ],
  },
  {
    key: '14',
    name: 'minimal.closet',
    phone: '+910000000114',
    preview: 'Restock alert when?',
    minsAgo: 840,
    unread: 0,
    status: 'OPEN',
    thread: [
      { direction: 'INBOUND', content: 'Restock alert when?', minsBeforeLast: 0 },
    ],
  },
  {
    key: '15',
    name: 'photo.by.avi',
    phone: '+910000000115',
    preview: 'Can I book you for a brand shoot in March?',
    minsAgo: 1100,
    unread: 0,
    status: 'OPEN',
    thread: [
      { direction: 'INBOUND', content: 'Can I book you for a brand shoot in March?', minsBeforeLast: 0 },
    ],
  },
];

const FB_MOCK_CONVS = FB_PERSONAS.map((p) => buildInboxConversation('fb', p));
const IG_MOCK_CONVS = IG_PERSONAS.map((p) => buildInboxConversation('ig', p));

const THREAD_MESSAGES: Record<string, Message[]> = {};
for (const p of FB_PERSONAS) {
  const suffix = `fb-${p.key}`;
  const convId = `${META_MOCK_ID_PREFIX}conv-${suffix}`;
  THREAD_MESSAGES[convId] = buildThreadMessages(convId, suffix, p);
}
for (const p of IG_PERSONAS) {
  const suffix = `ig-${p.key}`;
  const convId = `${META_MOCK_ID_PREFIX}conv-${suffix}`;
  THREAD_MESSAGES[convId] = buildThreadMessages(convId, suffix, p);
}

export type MockCommentRow = {
  id: string;
  igCommentId?: string;
  igMediaId?: string | null;
  media?: {
    igMediaId?: string;
    mediaType?: string | null;
    thumbnailUrl?: string | null;
    permalink?: string | null;
    caption?: string | null;
  } | null;
  fromUsername: string | null;
  text: string;
  commentedAt: string;
  hidden: boolean;
  privateReplySentAt: string | null;
  privateReplyOpen: boolean;
};

function mockCommentMedia(
  igMediaId: string,
  mediaType: string,
  seed: string,
  caption?: string
): MockCommentRow['media'] {
  return {
    igMediaId,
    mediaType,
    thumbnailUrl: `https://picsum.photos/seed/${seed}/200/200`,
    permalink: `https://www.instagram.com/p/${seed}/`,
    caption: caption || null,
  };
}

const IG_MOCK_COMMENTS: MockCommentRow[] = [
  {
    id: `${META_MOCK_ID_PREFIX}comment-01`,
    igMediaId: 'mock-media-reel-1',
    media: mockCommentMedia('mock-media-reel-1', 'REELS', 'ig-reel-1', 'New drop — comment PRICE for the link'),
    fromUsername: 'stylebykia',
    text: 'Price for the bundle please?',
    commentedAt: ago(25),
    hidden: false,
    privateReplySentAt: null,
    privateReplyOpen: true,
  },
  {
    id: `${META_MOCK_ID_PREFIX}comment-02`,
    igMediaId: 'mock-media-reel-2',
    media: mockCommentMedia('mock-media-reel-2', 'REELS', 'ig-reel-2'),
    fromUsername: 'mumbai_foodie',
    text: 'Do you deliver on Sunday?',
    commentedAt: ago(90),
    hidden: false,
    privateReplySentAt: ago(60),
    privateReplyOpen: false,
  },
  {
    id: `${META_MOCK_ID_PREFIX}comment-03`,
    fromUsername: 'spam_bot_99',
    text: 'Check my profile for deals!!!',
    commentedAt: ago(200),
    hidden: true,
    privateReplySentAt: null,
    privateReplyOpen: false,
  },
  {
    id: `${META_MOCK_ID_PREFIX}comment-04`,
    igMediaId: 'mock-media-carousel',
    media: mockCommentMedia('mock-media-carousel', 'CAROUSEL_ALBUM', 'ig-carousel'),
    fromUsername: 'wholesale.hub',
    text: 'MOQ for resellers? We need 500 pcs.',
    commentedAt: ago(45),
    hidden: false,
    privateReplySentAt: null,
    privateReplyOpen: true,
  },
  {
    id: `${META_MOCK_ID_PREFIX}comment-05`,
    igMediaId: 'mock-media-reel-3',
    fromUsername: 'priya.looks',
    text: 'This colour looks amazing on you ✨',
    commentedAt: ago(120),
    hidden: false,
    privateReplySentAt: null,
    privateReplyOpen: true,
  },
  {
    id: `${META_MOCK_ID_PREFIX}comment-06`,
    igMediaId: 'mock-media-live',
    fromUsername: 'angry_customer_x',
    text: 'Still waiting for my refund from last week.',
    commentedAt: ago(55),
    hidden: false,
    privateReplySentAt: null,
    privateReplyOpen: true,
  },
  {
    id: `${META_MOCK_ID_PREFIX}comment-07`,
    fromUsername: 'link_dropper',
    text: 'www.fake-deals.example.com',
    commentedAt: ago(300),
    hidden: true,
    privateReplySentAt: null,
    privateReplyOpen: false,
  },
  {
    id: `${META_MOCK_ID_PREFIX}comment-08`,
    igMediaId: 'mock-media-reel-4',
    fromUsername: 'confused_buyer',
    text: '???',
    commentedAt: ago(15),
    hidden: false,
    privateReplySentAt: null,
    privateReplyOpen: true,
  },
  {
    id: `${META_MOCK_ID_PREFIX}comment-09`,
    igMediaId: 'mock-media-reel-5',
    fromUsername: 'tag_friend_demo',
    text: '@neha.shops we need this for the trip',
    commentedAt: ago(70),
    hidden: false,
    privateReplySentAt: ago(40),
    privateReplyOpen: false,
  },
  {
    id: `${META_MOCK_ID_PREFIX}comment-10`,
    igMediaId: 'mock-media-post-1',
    fromUsername: 'old_commenter',
    text: 'Is this offer still valid?',
    commentedAt: ago(8 * 24 * 60),
    hidden: false,
    privateReplySentAt: null,
    privateReplyOpen: false,
  },
  {
    id: `${META_MOCK_ID_PREFIX}comment-11`,
    igMediaId: 'mock-media-reel-6',
    fromUsername: 'cod_only_please',
    text: 'COD available for Jaipur?',
    commentedAt: ago(180),
    hidden: false,
    privateReplySentAt: null,
    privateReplyOpen: true,
  },
  {
    id: `${META_MOCK_ID_PREFIX}comment-12`,
    igMediaId: 'mock-media-reel-7',
    fromUsername: 'influencer.mail',
    text: 'Open for gifted collaboration — DM rates?',
    commentedAt: ago(240),
    hidden: false,
    privateReplySentAt: null,
    privateReplyOpen: true,
  },
  {
    id: `${META_MOCK_ID_PREFIX}comment-13`,
    fromUsername: 'offensive_handle',
    text: '[hidden abusive text]',
    commentedAt: ago(400),
    hidden: true,
    privateReplySentAt: null,
    privateReplyOpen: false,
  },
  {
    id: `${META_MOCK_ID_PREFIX}comment-14`,
    igMediaId: 'mock-media-reel-8',
    fromUsername: 'long_question_ig',
    text: 'Hi, I ordered size M but the chart says different measurements — can you confirm chest width and length before I exchange?',
    commentedAt: ago(320),
    hidden: false,
    privateReplySentAt: ago(280),
    privateReplyOpen: false,
  },
  {
    id: `${META_MOCK_ID_PREFIX}comment-15`,
    igMediaId: 'mock-media-reel-9',
    fromUsername: 'flash_sale_hunter',
    text: 'Link?',
    commentedAt: ago(5),
    hidden: false,
    privateReplySentAt: null,
    privateReplyOpen: true,
  },
];

export function getFacebookMockInboxConversations(): Conversation[] {
  return FB_MOCK_CONVS;
}

export function getInstagramMockInboxConversations(): Conversation[] {
  return IG_MOCK_CONVS;
}

export function getMockInboxConversation(id: string): (Conversation & { serviceWindow?: ServiceWindowInfo }) | null {
  const row = [...FB_MOCK_CONVS, ...IG_MOCK_CONVS].find((c) => c.id === id);
  if (!row) return null;
  return { ...row, serviceWindow: OPEN_WINDOW, labels: [], internalNotes: [] };
}

export function getMockInboxMessages(conversationId: string): Message[] {
  const stored = THREAD_MESSAGES[conversationId];
  return stored ? [...stored] : [];
}

export function getInstagramMockComments(): MockCommentRow[] {
  return IG_MOCK_COMMENTS.map((row) => {
    if (!row.igMediaId || row.media) return row;
    const id = row.igMediaId;
    let mediaType = 'REELS';
    if (id.includes('carousel')) mediaType = 'CAROUSEL_ALBUM';
    else if (id.includes('post')) mediaType = 'IMAGE';
    else if (id.includes('live')) mediaType = 'VIDEO';
    return { ...row, media: mockCommentMedia(id, mediaType, id) };
  });
}

export type MockAdsSnapshot = {
  adAccountId: string;
  currency: string;
  spend: string;
  impressions: number;
  clicks: number;
  leads: number;
  cpl: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  attributionLabel: string;
  fetchedAt: string;
};

export function getFacebookAdsMockSnapshot(): MockAdsSnapshot {
  return {
    adAccountId: 'act_123456789012345',
    currency: 'INR',
    spend: '12540.00',
    impressions: 145320,
    clicks: 3620,
    leads: 214,
    cpl: '58.60',
    periodStart: ago(7 * 24 * 60),
    periodEnd: ago(0),
    attributionLabel: '7-day click / 1-day view',
    fetchedAt: new Date(t0).toISOString(),
  };
}

export function getFacebookAdsMockAccounts() {
  return {
    status: 'ready' as const,
    selectedAccountId: 'act_123456789012345',
    accounts: [
      {
        id: 'act_123456789012345',
        name: 'Samyoj Marketing',
        currency: 'INR',
        accountStatus: 1,
      },
      {
        id: 'act_987654321098765',
        name: 'Samyoj Retargeting',
        currency: 'INR',
        accountStatus: 1,
      },
    ],
  };
}

export type MockAdsCampaign = {
  id: string;
  name: string;
  status: 'Active' | 'Paused' | 'Learning';
  spend: string;
  impressions: string;
  clicks: string;
  leads: string;
  cpl: string;
  hue: string;
};

const MOCK_ADS_CAMPAIGNS: MockAdsCampaign[] = [
  { id: `${META_MOCK_ID_PREFIX}camp-01`, name: 'Summer Sale – Conversions', status: 'Active', spend: '₹4,230', impressions: '52,340', clicks: '1,240', leads: '86', cpl: '₹49.19', hue: '#5B9CF6' },
  { id: `${META_MOCK_ID_PREFIX}camp-02`, name: 'New Product Launch', status: 'Active', spend: '₹3,890', impressions: '38,120', clicks: '980', leads: '62', cpl: '₹62.74', hue: '#34D399' },
  { id: `${META_MOCK_ID_PREFIX}camp-03`, name: 'Lead Gen – Instant Form', status: 'Active', spend: '₹2,760', impressions: '31,450', clicks: '780', leads: '48', cpl: '₹57.50', hue: '#FB923C' },
  { id: `${META_MOCK_ID_PREFIX}camp-04`, name: 'Brand Awareness – Reels', status: 'Paused', spend: '₹1,660', impressions: '16,980', clicks: '420', leads: '18', cpl: '₹92.22', hue: '#A78BFA' },
  { id: `${META_MOCK_ID_PREFIX}camp-05`, name: 'Cart Abandoners – 7 day', status: 'Active', spend: '₹1,420', impressions: '12,800', clicks: '610', leads: '34', cpl: '₹41.76', hue: '#F472B6' },
  { id: `${META_MOCK_ID_PREFIX}camp-06`, name: 'WhatsApp Click – Starter', status: 'Learning', spend: '₹980', impressions: '9,240', clicks: '390', leads: '22', cpl: '₹44.55', hue: '#2DD4BF' },
  { id: `${META_MOCK_ID_PREFIX}camp-07`, name: 'Diwali Preview – Broad', status: 'Paused', spend: '₹870', impressions: '22,100', clicks: '310', leads: '9', cpl: '₹96.67', hue: '#FBBF24' },
  { id: `${META_MOCK_ID_PREFIX}camp-08`, name: 'Lookalike – Purchasers 1%', status: 'Active', spend: '₹2,110', impressions: '18,600', clicks: '720', leads: '41', cpl: '₹51.46', hue: '#60A5FA' },
  { id: `${META_MOCK_ID_PREFIX}camp-09`, name: 'Video Views – Top Reels', status: 'Active', spend: '₹640', impressions: '41,200', clicks: '180', leads: '4', cpl: '₹160.00', hue: '#C084FC' },
  { id: `${META_MOCK_ID_PREFIX}camp-10`, name: 'Enterprise Demo – B2B', status: 'Active', spend: '₹3,050', impressions: '8,900', clicks: '540', leads: '28', cpl: '₹108.93', hue: '#4ADE80' },
  { id: `${META_MOCK_ID_PREFIX}camp-11`, name: 'Store Visits – Mumbai', status: 'Learning', spend: '₹1,190', impressions: '14,300', clicks: '460', leads: '19', cpl: '₹62.63', hue: '#F87171' },
  { id: `${META_MOCK_ID_PREFIX}camp-12`, name: 'Catalog Sales – Dynamic', status: 'Active', spend: '₹2,540', impressions: '27,800', clicks: '890', leads: '55', cpl: '₹46.18', hue: '#38BDF8' },
];

export function getFacebookAdsMockCampaigns(): MockAdsCampaign[] {
  return MOCK_ADS_CAMPAIGNS;
}
