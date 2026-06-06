# Guia de Uso Rápido - MilesGuard

## Modo Rápido: Usar apenas com armazenamento local (sem Telegram)

1. **Instale as dependências**:
   ```bash
   npm install
   ```

2. **Configure para usar apenas arquivos locais**:
   ```bash
   npm run config
   ```
   - Escolha "Arquivos locais" como método de notificação
   - Não é necessário configurar o Telegram

3. **Inicie o sistema**:
   ```bash
   npm start
   ```

4. **Escaneie o QR Code** com o WhatsApp para autenticar

5. **Verifique os arquivos gerados** na pasta `logs/`

## Modo Completo: Com Telegram e arquivos locais

1. **Crie um bot no Telegram**:
   - Inicie uma conversa com @BotFather
   - Use `/newbot` para criar um novo bot
   - Anote o token fornecido

2. **Obtenha seu Chat ID**:
   - Inicie uma conversa com o bot
   - Envie uma mensagem qualquer
   - Acesse `https://api.telegram.org/bot<SEU_TOKEN>/getUpdates`
   - Anote o ID do chat

3. **Execute a configuração**:
   ```bash
   npm run config
   ```
   - Escolha ambos os métodos de notificação (Telegram e arquivos)
   - Informe o token do bot e o chat ID

4. **Inicie o sistema**:
   ```bash
   npm start
   ```

5. **Receba notificações no Telegram e arquivos locais**