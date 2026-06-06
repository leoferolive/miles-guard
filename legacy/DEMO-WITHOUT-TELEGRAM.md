# Demonstração do MilesGuard sem Telegram

Este exemplo mostra como o MilesGuard pode funcionar apenas com armazenamento em arquivos locais, sem a necessidade de configurar o Telegram.

## Configuração

Para usar o MilesGuard apenas com armazenamento local:

1. Configure o arquivo `config.json` com:
   ```json
   {
     "notification_enabled": true,
     "telegram_enabled": false,
     "file_storage_enabled": true
   }
   ```

2. Certifique-se de que o arquivo `.env` não contém as variáveis `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` ou que elas estão comentadas.

## Funcionamento

Quando o sistema detecta mensagens relevantes, elas serão salvas automaticamente nos arquivos organizados por data na pasta `logs/`, mesmo sem o Telegram configurado.

O sistema continuará monitorando os grupos do WhatsApp normalmente, apenas não enviará notificações pelo Telegram.