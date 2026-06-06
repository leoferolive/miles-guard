/**
 * Mock messages for testing different scenarios
 */

// Basic relevant message
const basicRelevantMessage = {
  id: 'test_message_001',
  groupId: 'test_group_001@g.us',
  groupName: 'Passagens SUL',
  sender: 'João Silva',
  text: 'Oferta imperdível! 100% bônus na transferência para LATAM! Aproveitem!',
  timestamp: Date.now(),
  matchedKeywords: ['100%', 'bônus', 'latam'],
  isRelevant: true
};

// Message with Smiles keyword
const smilesMessage = {
  id: 'test_message_002',
  groupId: 'test_group_002@g.us',
  groupName: 'Compra de Pontos',
  sender: 'Maria Santos',
  text: 'Vendo 50.000 pontos Smiles com desconto de 20%. Interessados chamar no PV.',
  timestamp: Date.now() - 3600000, // 1 hour ago
  matchedKeywords: ['smiles'],
  isRelevant: true
};

// Case sensitive message
const caseSensitiveMessage = {
  id: 'test_message_003',
  groupId: 'test_group_003@g.us',
  groupName: 'Transferências',
  sender: 'Pedro Costa',
  text: 'BONUS de 150% na LATAM apenas hoje! Não percam essa oportunidade única!',
  timestamp: Date.now() - 1800000, // 30 minutes ago
  matchedKeywords: ['BONUS', 'LATAM'],
  isRelevant: true
};

// Message with multiple keywords
const multipleKeywordsMessage = {
  id: 'test_message_004',
  groupId: 'test_group_001@g.us',
  groupName: 'Passagens SUL',
  sender: 'Ana Lima',
  text: 'Galera, consegui 100% de bônus na compra de pontos Smiles para LATAM! Vale muito a pena!',
  timestamp: Date.now() - 7200000, // 2 hours ago
  matchedKeywords: ['100%', 'bônus', 'smiles', 'latam'],
  isRelevant: true
};

// Non-relevant message (no keywords)
const nonRelevantMessage = {
  id: 'test_message_005',
  groupId: 'test_group_001@g.us',
  groupName: 'Passagens SUL',
  sender: 'Carlos Oliveira',
  text: 'Bom dia pessoal! Como está o clima aí na cidade de vocês?',
  timestamp: Date.now() - 10800000, // 3 hours ago
  matchedKeywords: [],
  isRelevant: false
};

// Message with image caption
const messageWithImageCaption = {
  id: 'test_message_006',
  groupId: 'test_group_002@g.us',
  groupName: 'Compra de Pontos',
  sender: 'Fernanda Rocha',
  text: '[Imagem] Screenshot da promoção 100% bônus Smiles!',
  timestamp: Date.now() - 5400000, // 1.5 hours ago
  matchedKeywords: ['100%', 'bônus', 'smiles'],
  isRelevant: true
};

// Message with video caption
const messageWithVideoCaption = {
  id: 'test_message_007',
  groupId: 'test_group_003@g.us',
  groupName: 'Transferências',
  sender: 'Ricardo Mendes',
  text: '[Vídeo] Tutorial de como aproveitar o bônus de 150% na LATAM',
  timestamp: Date.now() - 9000000, // 2.5 hours ago
  matchedKeywords: ['bônus', 'latam'],
  isRelevant: true
};

// Message with document caption
const messageWithDocumentCaption = {
  id: 'test_message_008',
  groupId: 'test_group_002@g.us',
  groupName: 'Compra de Pontos',
  sender: 'Lucia Ferreira',
  text: '[Documento] Planilha com preços atualizados Smiles e LATAM',
  timestamp: Date.now() - 14400000, // 4 hours ago
  matchedKeywords: ['smiles', 'latam'],
  isRelevant: true
};

// Very long message
const longMessage = {
  id: 'test_message_009',
  groupId: 'test_group_001@g.us',
  groupName: 'Passagens SUL',
  sender: 'Roberto Silva',
  text: 'Pessoal, quero compartilhar uma experiência incrível que tive ontem! Consegui uma promoção fantástica de 100% de bônus na transferência de pontos para a LATAM. Foi realmente uma oportunidade única que não podia deixar passar. O processo foi super rápido e fácil, e agora tenho pontos suficientes para aquela viagem dos sonhos que estava planejando há meses. Recomendo muito ficarem de olho nessas promoções porque aparecem de vez em quando e valem muito a pena. Para quem tem dúvidas sobre como funciona, posso explicar melhor no privado. Espero que vocês também consigam aproveitar ofertas como essa!',
  timestamp: Date.now() - 18000000, // 5 hours ago
  matchedKeywords: ['100%', 'bônus', 'latam'],
  isRelevant: true
};

// Empty or system message
const emptyMessage = {
  id: 'test_message_010',
  groupId: 'test_group_001@g.us',
  groupName: 'Passagens SUL',
  sender: '',
  text: '',
  timestamp: Date.now() - 21600000, // 6 hours ago
  matchedKeywords: [],
  isRelevant: false
};

// WhatsApp message structure (as received from Baileys)
const rawWhatsAppMessage = {
  key: {
    id: 'test_message_011',
    remoteJid: 'test_group_001@g.us',
    fromMe: false,
    participant: 'user123@s.whatsapp.net'
  },
  message: {
    conversation: 'Galera, achei uma promoção de 100% bônus na Smiles!'
  },
  messageTimestamp: Math.floor(Date.now() / 1000),
  pushName: 'João da Silva'
};

// WhatsApp message with extended text
const rawWhatsAppExtendedMessage = {
  key: {
    id: 'test_message_012',
    remoteJid: 'test_group_002@g.us',
    fromMe: false,
    participant: 'user456@s.whatsapp.net'
  },
  message: {
    extendedTextMessage: {
      text: 'Oportunidade única! Transferência com bônus de 200% para LATAM. Link: https://example.com'
    }
  },
  messageTimestamp: Math.floor(Date.now() / 1000),
  pushName: 'Maria Oliveira'
};

// WhatsApp message with image and caption
const rawWhatsAppImageMessage = {
  key: {
    id: 'test_message_013',
    remoteJid: 'test_group_003@g.us',
    fromMe: false,
    participant: 'user789@s.whatsapp.net'
  },
  message: {
    imageMessage: {
      caption: 'Screenshot da promoção Smiles com 100% de bônus!',
      url: 'https://example.com/image.jpg',
      mimetype: 'image/jpeg'
    }
  },
  messageTimestamp: Math.floor(Date.now() / 1000),
  pushName: 'Pedro Santos'
};

// Collections for easy testing
const relevantMessages = [
  basicRelevantMessage,
  smilesMessage,
  caseSensitiveMessage,
  multipleKeywordsMessage,
  messageWithImageCaption,
  messageWithVideoCaption,
  messageWithDocumentCaption,
  longMessage
];

const nonRelevantMessages = [
  nonRelevantMessage,
  emptyMessage
];

const allMessages = [
  ...relevantMessages,
  ...nonRelevantMessages
];

const rawWhatsAppMessages = [
  rawWhatsAppMessage,
  rawWhatsAppExtendedMessage,
  rawWhatsAppImageMessage
];

module.exports = {
  // Individual messages
  basicRelevantMessage,
  smilesMessage,
  caseSensitiveMessage,
  multipleKeywordsMessage,
  nonRelevantMessage,
  messageWithImageCaption,
  messageWithVideoCaption,
  messageWithDocumentCaption,
  longMessage,
  emptyMessage,
  rawWhatsAppMessage,
  rawWhatsAppExtendedMessage,
  rawWhatsAppImageMessage,
  
  // Collections
  relevantMessages,
  nonRelevantMessages,
  allMessages,
  rawWhatsAppMessages,
  
  // Helper functions
  createTestMessage: (overrides = {}) => ({
    id: `test_message_${Date.now()}`,
    groupId: 'default_group@g.us',
    groupName: 'Test Group',
    sender: 'Test User',
    text: 'Test message with keyword',
    timestamp: Date.now(),
    matchedKeywords: ['test'],
    isRelevant: true,
    ...overrides
  }),
  
  createRawWhatsAppMessage: (overrides = {}) => ({
    key: {
      id: `test_raw_${Date.now()}`,
      remoteJid: 'test_group@g.us',
      fromMe: false,
      participant: 'user@s.whatsapp.net',
      ...overrides.key
    },
    message: {
      conversation: 'Test message',
      ...overrides.message
    },
    messageTimestamp: Math.floor(Date.now() / 1000),
    pushName: 'Test User',
    ...overrides
  }),
  
  getMessagesByKeyword: (keyword) => {
    return allMessages.filter(msg => 
      msg.matchedKeywords.includes(keyword)
    );
  },
  
  getMessagesByGroup: (groupName) => {
    return allMessages.filter(msg => 
      msg.groupName === groupName
    );
  }
};