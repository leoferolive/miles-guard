const chai = require('chai');
const sinon = require('sinon');
const { getMessageText } = require('../poc-functions');

const { expect } = chai;

describe('poc.js - Funções principais', () => {
  describe('getMessageText', () => {
    it('deve extrair texto de mensagem de conversa simples', () => {
      const message = {
        message: {
          conversation: 'Olá, tudo bem?'
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.equal('Olá, tudo bem?');
    });
    
    it('deve extrair texto de mensagem de texto estendido', () => {
      const message = {
        message: {
          extendedTextMessage: {
            text: 'Esta é uma mensagem de texto estendido'
          }
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.equal('Esta é uma mensagem de texto estendido');
    });
    
    it('deve extrair legenda de imagem', () => {
      const message = {
        message: {
          imageMessage: {
            caption: 'Foto da viagem'
          }
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.equal('[Imagem] Foto da viagem');
    });
    
    it('deve extrair legenda de vídeo', () => {
      const message = {
        message: {
          videoMessage: {
            caption: 'Vídeo do evento'
          }
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.equal('[Vídeo] Vídeo do evento');
    });
    
    it('deve extrair legenda de documento', () => {
      const message = {
        message: {
          documentMessage: {
            caption: 'Documento importante'
          }
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.equal('[Documento] Documento importante');
    });
    
    it('deve retornar null para mensagens sem texto', () => {
      const message = {
        message: {}
      };
      
      const result = getMessageText(message);
      expect(result).to.be.null;
    });
    
    it('deve retornar null para mensagens vazias', () => {
      const message = {};
      
      const result = getMessageText(message);
      expect(result).to.be.null;
    });
    
    it('deve retornar null quando message é null', () => {
      const message = null;
      
      const result = getMessageText(message);
      expect(result).to.be.null;
    });
    
    it('deve retornar null quando message é undefined', () => {
      const message = undefined;
      
      const result = getMessageText(message);
      expect(result).to.be.null;
    });
    
    it('deve retornar null quando message.message é null', () => {
      const message = {
        message: null
      };
      
      const result = getMessageText(message);
      expect(result).to.be.null;
    });
  });
});