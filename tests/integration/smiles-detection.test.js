const chai = require('chai');
const { getMessageText } = require('../../poc-functions');

const { expect } = chai;

describe('Integração - Detecção de Conteúdo "Smiles"', () => {
  describe('Mensagens com palavra-chave "Smiles"', () => {
    it('deve extrair corretamente mensagens que contêm "Smiles"', () => {
      const message = {
        message: {
          conversation: 'Oferta imperdível de transferência Smiles 100% bônus!'
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.equal('Oferta imperdível de transferência Smiles 100% bônus!');
    });
    
    it('deve extrair corretamente mensagens com "smiles" em minúsculo', () => {
      const message = {
        message: {
          conversation: 'Promoção de compra de pontos smiles com 50% de desconto'
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.equal('Promoção de compra de pontos smiles com 50% de desconto');
    });
    
    it('deve extrair corretamente mensagens com "SMILES" em maiúsculo', () => {
      const message = {
        message: {
          conversation: 'Últimas unidades de transferência SMILES 100% bônus'
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.equal('Últimas unidades de transferência SMILES 100% bônus');
    });
    
    it('deve extrair corretamente mensagens com "Smiles" no meio do texto', () => {
      const message = {
        message: {
          conversation: 'Hoje temos várias ofertas de Smiles e TAM'
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.equal('Hoje temos várias ofertas de Smiles e TAM');
    });
    
    it('deve extrair corretamente mensagens com "Smiles" no início do texto', () => {
      const message = {
        message: {
          conversation: 'Smiles 100% bônus para transferências acima de 20.000 pontos'
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.equal('Smiles 100% bônus para transferências acima de 20.000 pontos');
    });
    
    it('deve extrair corretamente mensagens com "Smiles" no final do texto', () => {
      const message = {
        message: {
          conversation: 'Transferências com 100% bônus Smiles'
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.equal('Transferências com 100% bônus Smiles');
    });
  });
  
  describe('Mensagens de mídia com "Smiles" na legenda', () => {
    it('deve extrair corretamente legendas de imagens com "Smiles"', () => {
      const message = {
        message: {
          imageMessage: {
            caption: 'Oferta exclusiva de transferência Smiles 100% bônus!'
          }
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.equal('[Imagem] Oferta exclusiva de transferência Smiles 100% bônus!');
    });
    
    it('deve extrair corretamente legendas de vídeos com "Smiles"', () => {
      const message = {
        message: {
          videoMessage: {
            caption: 'Tutorial de como aproveitar a promoção Smiles'
          }
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.equal('[Vídeo] Tutorial de como aproveitar a promoção Smiles');
    });
    
    it('deve extrair corretamente legendas de documentos com "Smiles"', () => {
      const message = {
        message: {
          documentMessage: {
            caption: 'Tabela de valores das transferências Smiles'
          }
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.equal('[Documento] Tabela de valores das transferências Smiles');
    });
  });
  
  describe('Mensagens sem a palavra-chave "Smiles"', () => {
    it('deve extrair corretamente mensagens que não contêm "Smiles"', () => {
      const message = {
        message: {
          conversation: 'Oferta imperdível de transferência Latam 100% bônus!'
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.equal('Oferta imperdível de transferência Latam 100% bônus!');
    });
    
    it('deve extrair corretamente mensagens com palavras similares mas não "Smiles"', () => {
      const message = {
        message: {
          conversation: 'Oferta de transferência Smile com 50% de desconto'
        }
      };
      
      const result = getMessageText(message);
      expect(result).to.equal('Oferta de transferência Smile com 50% de desconto');
    });
  });
});