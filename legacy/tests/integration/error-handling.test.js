const chai = require('chai');
const sinon = require('sinon');
const { getMessageText } = require('../../poc-functions');

const { expect } = chai;

describe('Integração - Tratamento de Erros', () => {
  describe('Erros ao acessar propriedades da mensagem', () => {
    it('deve retornar null quando ocorre erro ao acessar message.conversation', () => {
      const message = {
        message: {
          get conversation() {
            throw new Error('Erro ao acessar conversation');
          }
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.be.null;
    });
    
    it('deve retornar null quando ocorre erro ao acessar message.extendedTextMessage', () => {
      const message = {
        message: {
          get extendedTextMessage() {
            throw new Error('Erro ao acessar extendedTextMessage');
          }
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.be.null;
    });
    
    it('deve retornar null quando ocorre erro ao acessar message.imageMessage.caption', () => {
      const message = {
        message: {
          imageMessage: {
            get caption() {
              throw new Error('Erro ao acessar caption');
            }
          }
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.be.null;
    });
    
    it('deve retornar null quando ocorre erro ao acessar message.videoMessage.caption', () => {
      const message = {
        message: {
          videoMessage: {
            get caption() {
              throw new Error('Erro ao acessar caption');
            }
          }
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.be.null;
    });
    
    it('deve retornar null quando ocorre erro ao acessar message.documentMessage.caption', () => {
      const message = {
        message: {
          documentMessage: {
            get caption() {
              throw new Error('Erro ao acessar caption');
            }
          }
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.be.null;
    });
  });
  
  describe('Erros em mensagens malformadas', () => {
    it('deve retornar null quando message é um array', () => {
      const message = [];
      
      const result = getMessageText(message);
      expect(result).to.be.null;
    });
    
    it('deve retornar null quando message é um número', () => {
      const message = 123;
      
      const result = getMessageText(message);
      expect(result).to.be.null;
    });
    
    it('deve retornar null quando message é uma string', () => {
      const message = 'mensagem de teste';
      
      const result = getMessageText(message);
      expect(result).to.be.null;
    });
    
    it('deve retornar null quando message é um booleano', () => {
      const message = true;
      
      const result = getMessageText(message);
      expect(result).to.be.null;
    });
    
    it('deve retornar null quando message.message é um array', () => {
      const message = {
        message: []
      };
      
      const result = getMessageText(message);
      expect(result).to.be.null;
    });
  });
});