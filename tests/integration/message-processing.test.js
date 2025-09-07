const chai = require('chai');
const { getMessageText } = require('../../poc-functions');

const { expect } = chai;

describe('Integração - getMessageText', () => {
  describe('Mensagens de texto simples', () => {
    it('deve extrair corretamente mensagens de conversa direta', () => {
      const message = {
        message: {
          conversation: 'Olá, como posso ajudar?'
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.equal('Olá, como posso ajudar?');
    });
    
    it('deve extrair corretamente mensagens de texto estendido', () => {
      const message = {
        message: {
          extendedTextMessage: {
            text: 'Esta é uma mensagem mais longa com formatação especial'
          }
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.equal('Esta é uma mensagem mais longa com formatação especial');
    });
  });
  
  describe('Mensagens de mídia com legendas', () => {
    it('deve extrair corretamente legendas de imagens', () => {
      const message = {
        message: {
          imageMessage: {
            caption: 'Foto do pôr do sol na praia'
          }
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.equal('[Imagem] Foto do pôr do sol na praia');
    });
    
    it('deve extrair corretamente legendas de vídeos', () => {
      const message = {
        message: {
          videoMessage: {
            caption: 'Vídeo da apresentação do show'
          }
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.equal('[Vídeo] Vídeo da apresentação do show');
    });
    
    it('deve extrair corretamente legendas de documentos', () => {
      const message = {
        message: {
          documentMessage: {
            caption: 'Contrato de prestação de serviços'
          }
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.equal('[Documento] Contrato de prestação de serviços');
    });
  });
  
  describe('Casos especiais e mensagens sem conteúdo', () => {
    it('deve retornar null para mensagens de chamada', () => {
      const message = {
        message: {
          call: {
            callKey: 'abcdef123456'
          }
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.be.null;
    });
    
    it('deve retornar null para mensagens de sistema', () => {
      const message = {
        message: {
          protocolMessage: {
            type: 'REVOKE'
          }
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.be.null;
    });
    
    it('deve retornar null para mensagens de reação', () => {
      const message = {
        message: {
          reactionMessage: {
            text: '👍',
            key: {
              remoteJid: '5521999999999@s.whatsapp.net',
              fromMe: false,
              id: 'ABCDEF123456789'
            }
          }
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.be.null;
    });
  });
  
  describe('Mensagens com conteúdo misto', () => {
    it('deve priorizar o texto de conversa quando múltiplos tipos estão presentes', () => {
      const message = {
        message: {
          conversation: 'Texto principal da mensagem',
          imageMessage: {
            caption: 'Legenda da imagem'
          }
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.equal('Texto principal da mensagem');
    });
    
    it('deve extrair texto estendido quando não há conversa direta', () => {
      const message = {
        message: {
          extendedTextMessage: {
            text: 'Mensagem de texto estendido'
          },
          imageMessage: {
            caption: 'Legenda da imagem'
          }
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.equal('Mensagem de texto estendido');
    });
  });
});