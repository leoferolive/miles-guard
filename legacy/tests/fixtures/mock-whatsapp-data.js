/**
 * Mock WhatsApp data structures for testing
 */

// Mock group data as returned by Baileys
const mockGroups = {
  'group1@g.us': {
    id: 'group1@g.us',
    subject: 'M01 Comunidade Masters ✈️',
    subjectOwner: 'owner@s.whatsapp.net',
    subjectTime: 1640995200,
    size: 156,
    creation: 1640995200,
    owner: 'owner@s.whatsapp.net',
    desc: 'Grupo principal da comunidade de milhas',
    descId: 'desc123',
    participants: [
      {
        id: 'user1@s.whatsapp.net',
        admin: null
      },
      {
        id: 'user2@s.whatsapp.net',
        admin: 'admin'
      },
      {
        id: 'owner@s.whatsapp.net',
        admin: 'superadmin'
      }
    ],
    ephemeralDuration: 0,
    inviteCode: 'test_invite_code_123'
  },
  
  'group2@g.us': {
    id: 'group2@g.us',
    subject: '♻️ M01 - Transferências Bonificadas',
    subjectOwner: 'owner@s.whatsapp.net',
    subjectTime: 1640995300,
    size: 89,
    creation: 1640995300,
    owner: 'owner@s.whatsapp.net',
    desc: 'Grupo focado em transferências com bônus',
    participants: [
      {
        id: 'user1@s.whatsapp.net',
        admin: null
      },
      {
        id: 'user3@s.whatsapp.net',
        admin: 'admin'
      }
    ]
  },
  
  'group3@g.us': {
    id: 'group3@g.us',
    subject: 'Passagens SUL',
    subjectOwner: 'admin@s.whatsapp.net',
    subjectTime: 1640995400,
    size: 234,
    creation: 1640995400,
    owner: 'admin@s.whatsapp.net',
    desc: 'Ofertas de passagens para região Sul',
    participants: [
      {
        id: 'user4@s.whatsapp.net',
        admin: null
      },
      {
        id: 'user5@s.whatsapp.net',
        admin: null
      }
    ]
  },
  
  'group4@g.us': {
    id: 'group4@g.us',
    subject: 'Grupo Não Monitorado',
    subjectOwner: 'other@s.whatsapp.net',
    subjectTime: 1640995500,
    size: 45,
    creation: 1640995500,
    owner: 'other@s.whatsapp.net',
    desc: 'Este grupo não deve ser monitorado',
    participants: [
      {
        id: 'user6@s.whatsapp.net',
        admin: null
      }
    ]
  }
};

// Mock connection states
const connectionStates = {
  connecting: {
    connection: 'connecting',
    lastDisconnect: undefined,
    qr: undefined
  },
  
  open: {
    connection: 'open',
    lastDisconnect: undefined,
    qr: undefined
  },
  
  close: {
    connection: 'close',
    lastDisconnect: {
      error: {
        output: {
          statusCode: 428,
          payload: {
            message: 'Connection lost'
          }
        }
      }
    },
    qr: undefined
  },
  
  qrGenerated: {
    connection: 'connecting',
    lastDisconnect: undefined,
    qr: 'mock_qr_code_data_12345'
  },
  
  conflict: {
    connection: 'close',
    lastDisconnect: {
      error: {
        output: {
          statusCode: 409,
          payload: {
            message: 'Session conflict detected'
          }
        }
      }
    },
    qr: undefined
  },
  
  loggedOut: {
    connection: 'close',
    lastDisconnect: {
      error: {
        output: {
          statusCode: 401
        }
      }
    },
    qr: undefined
  }
};

// Mock auth state
const mockAuthState = {
  state: {
    creds: {
      noiseKey: Buffer.from('mock_noise_key'),
      signedIdentityKey: Buffer.from('mock_signed_identity_key'),
      registrationId: 12345,
      advSecretKey: 'mock_adv_secret_key',
      me: {
        id: '5511999999999:1@s.whatsapp.net',
        name: 'MilesGuard Bot'
      }
    },
    keys: {
      preKeys: {},
      sessions: {},
      senderKeys: {},
      appStateSyncKeys: {},
      appStateVersions: {}
    }
  },
  saveCreds: () => Promise.resolve()
};

// Mock message structures as received from WhatsApp
const mockMessageStructures = {
  textMessage: {
    key: {
      id: 'msg_001',
      remoteJid: 'group1@g.us',
      fromMe: false,
      participant: 'user1@s.whatsapp.net'
    },
    message: {
      conversation: 'Oferta de 100% bônus na LATAM!'
    },
    messageTimestamp: Math.floor(Date.now() / 1000),
    pushName: 'João Silva'
  },
  
  extendedTextMessage: {
    key: {
      id: 'msg_002',
      remoteJid: 'group2@g.us',
      fromMe: false,
      participant: 'user2@s.whatsapp.net'
    },
    message: {
      extendedTextMessage: {
        text: 'Pessoal, consegui Smiles com bônus de 150%!\n\nDetalhes no link: https://example.com',
        previewType: 'NONE'
      }
    },
    messageTimestamp: Math.floor(Date.now() / 1000),
    pushName: 'Maria Santos'
  },
  
  imageMessage: {
    key: {
      id: 'msg_003',
      remoteJid: 'group3@g.us',
      fromMe: false,
      participant: 'user3@s.whatsapp.net'
    },
    message: {
      imageMessage: {
        caption: 'Screenshot da promoção Smiles 100% bônus!',
        url: 'https://mock.whatsapp.net/image.jpg',
        mimetype: 'image/jpeg',
        fileSha256: Buffer.from('mock_sha256'),
        fileLength: 45231
      }
    },
    messageTimestamp: Math.floor(Date.now() / 1000),
    pushName: 'Pedro Costa'
  },
  
  videoMessage: {
    key: {
      id: 'msg_004',
      remoteJid: 'group1@g.us',
      fromMe: false,
      participant: 'user4@s.whatsapp.net'
    },
    message: {
      videoMessage: {
        caption: 'Tutorial: Como aproveitar bônus LATAM',
        url: 'https://mock.whatsapp.net/video.mp4',
        mimetype: 'video/mp4',
        fileSha256: Buffer.from('mock_video_sha256'),
        fileLength: 1024567
      }
    },
    messageTimestamp: Math.floor(Date.now() / 1000),
    pushName: 'Ana Lima'
  },
  
  documentMessage: {
    key: {
      id: 'msg_005',
      remoteJid: 'group2@g.us',
      fromMe: false,
      participant: 'user5@s.whatsapp.net'
    },
    message: {
      documentMessage: {
        caption: 'Planilha com preços Smiles atualizados',
        url: 'https://mock.whatsapp.net/document.pdf',
        mimetype: 'application/pdf',
        fileName: 'precos_smiles.pdf',
        fileSha256: Buffer.from('mock_doc_sha256'),
        fileLength: 234567
      }
    },
    messageTimestamp: Math.floor(Date.now() / 1000),
    pushName: 'Carlos Oliveira'
  },
  
  systemMessage: {
    key: {
      id: 'msg_006',
      remoteJid: 'group1@g.us',
      fromMe: false,
      participant: undefined
    },
    message: {
      protocolMessage: {
        type: 'GROUP_PARTICIPANT_ADD'
      }
    },
    messageTimestamp: Math.floor(Date.now() / 1000)
  },
  
  emptyMessage: {
    key: {
      id: 'msg_007',
      remoteJid: 'group3@g.us',
      fromMe: false,
      participant: 'user6@s.whatsapp.net'
    },
    message: {},
    messageTimestamp: Math.floor(Date.now() / 1000),
    pushName: 'Empty User'
  }
};

// Mock connection statistics
const mockConnectionStats = {
  isConnected: true,
  groupsCount: 4,
  targetGroupsCount: 3,
  lastConnected: Date.now(),
  reconnectAttempts: 0,
  messagesProcessed: 145,
  relevantMessagesFound: 23,
  connectionUptime: 3600000 // 1 hour
};

// Mock session data
const mockSessionData = {
  sessionExists: true,
  sessionPath: './test_auth_info',
  lastAccess: Date.now(),
  credentialsValid: true,
  sessionSize: 2048, // bytes
  keysCount: 15
};

// Helper functions for creating mock data
const mockHelpers = {
  createMockGroup: (overrides = {}) => ({
    id: `test_group_${Date.now()}@g.us`,
    subject: 'Test Group',
    size: 10,
    creation: Date.now(),
    owner: 'owner@s.whatsapp.net',
    participants: [
      { id: 'user1@s.whatsapp.net', admin: null },
      { id: 'user2@s.whatsapp.net', admin: 'admin' }
    ],
    ...overrides
  }),
  
  createMockMessage: (type = 'text', overrides = {}) => {
    const baseMessage = {
      key: {
        id: `test_msg_${Date.now()}`,
        remoteJid: 'test_group@g.us',
        fromMe: false,
        participant: 'test_user@s.whatsapp.net'
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      pushName: 'Test User'
    };
    
    switch (type) {
      case 'text':
        baseMessage.message = { conversation: 'Test message' };
        break;
      case 'extended':
        baseMessage.message = { 
          extendedTextMessage: { text: 'Extended test message' } 
        };
        break;
      case 'image':
        baseMessage.message = { 
          imageMessage: { 
            caption: 'Test image', 
            url: 'https://example.com/image.jpg' 
          } 
        };
        break;
      default:
        baseMessage.message = { conversation: 'Test message' };
    }
    
    return { ...baseMessage, ...overrides };
  },
  
  createMockConnectionUpdate: (state = 'open') => {
    return connectionStates[state] || connectionStates.open;
  }
};

module.exports = {
  mockGroups,
  connectionStates,
  mockAuthState,
  mockMessageStructures,
  mockConnectionStats,
  mockSessionData,
  mockHelpers,
  
  // Easy access arrays
  targetGroups: ['group1@g.us', 'group2@g.us', 'group3@g.us'],
  nonTargetGroups: ['group4@g.us'],
  allGroupIds: Object.keys(mockGroups),
  
  // Helper methods
  getTargetGroups: () => Object.values(mockGroups).slice(0, 3),
  getNonTargetGroups: () => [mockGroups['group4@g.us']],
  getAllGroups: () => Object.values(mockGroups),
  
  getGroupById: (id) => mockGroups[id],
  getGroupByName: (name) => Object.values(mockGroups).find(g => g.subject === name)
};