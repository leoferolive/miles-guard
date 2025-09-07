/**
 * Funções utilitárias da POC do MilesGuard
 */

function getMessageText(message) {
  try {
    if (message.message.conversation) {
      return message.message.conversation;
    }
    
    if (message.message.extendedTextMessage?.text) {
      return message.message.extendedTextMessage.text;
    }
    
    if (message.message.imageMessage?.caption) {
      return `[Imagem] ${message.message.imageMessage.caption}`;
    }
    
    if (message.message.videoMessage?.caption) {
      return `[Vídeo] ${message.message.videoMessage.caption}`;
    }
    
    if (message.message.documentMessage?.caption) {
      return `[Documento] ${message.message.documentMessage.caption}`;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// Exportar as funções para uso na aplicação e nos testes
module.exports = { getMessageText };