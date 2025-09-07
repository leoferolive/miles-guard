# FASE 2 - Filtros e Configuração 🔍

**Duração:** 3-4 dias  
**Objetivo:** Implementar sistema de filtros e wizard de configuração

## 1. Wizard Interativo

### Dependencies
```json
{
  "dependencies": {
    "inquirer": "^12.9.4",
    "zod": "^4.1.5",
    "chalk": "^5.6.0"
  }
}
```

### Implementação (`src/core/wizard.js`)
```javascript
// Fluxo do wizard:
1. Detectar grupos disponíveis no WhatsApp
2. Permitir seleção de comunidade principal
3. Multi-select de subgrupos para monitorar
4. Input de palavras-chave (separadas por vírgula)
5. Confirmação visual das configurações
6. Geração de config.json validado
```

### Prompts Structure
```javascript
const prompts = [
  {
    type: 'list',
    name: 'comunidade',
    message: 'Selecione a comunidade principal:',
    choices: ['M01 Comunidade Masters', 'Outro...']
  },
  {
    type: 'checkbox',
    name: 'subgrupos',
    message: 'Selecione os subgrupos para monitorar:',
    choices: [
      'Passagens SUL',
      'Compra de Pontos', 
      'Transferências',
      'Ofertas Gerais'
    ]
  },
  {
    type: 'input',
    name: 'palavras_chave',
    message: 'Digite as palavras-chave (separadas por vírgula):',
    default: '100%, bônus, latam, smiles'
  }
];
```

## 2. Motor de Filtros

### Filter Engine (`src/core/filter.js`)
```javascript
class FilterEngine {
  constructor(config) {
    this.config = config;
    this.keywords = this.normalizeKeywords();
  }

  // Principais métodos:
  shouldProcessMessage(message, groupName)
  matchesKeywords(text)
  isTargetGroup(groupName)
  normalizeText(text) // case insensitive, acentos
  logFilterMatch(message, reason)
}
```

### Algoritmo de Match
```javascript
// Critérios de filtro:
1. Grupo deve estar na lista de subgrupos monitorados
2. Mensagem deve conter pelo menos uma palavra-chave
3. Aplicar normalização (case insensitive, acentos)
4. Excluir mensagens de sistema/admin
5. Rate limiting para evitar spam de notificações
```

### Normalização de Texto
```javascript
// Processamento de texto:
- Converter para lowercase
- Remover acentos (á → a, ç → c)
- Remover caracteres especiais extras
- Manter apenas letras, números e espaços
- Trim de espaços em branco
```

## 3. Arquivo de Configuração

### Schema Validation (`src/schemas/config.js`)
```javascript
import { z } from 'zod';

const ConfigSchema = z.object({
  comunidade: z.string().min(1),
  subgrupos: z.array(z.string()).min(1),
  palavras_chave: z.array(z.string()).min(1),
  case_sensitive: z.boolean().default(false),
  rate_limit: z.number().default(60), // segundos
  created_at: z.string().datetime(),
  version: z.string().default('1.0')
});
```

### Config Manager (`src/core/config.js`)
```javascript
class ConfigManager {
  static CONFIG_PATH = './config.json';
  
  // Métodos principais:
  static async create(wizardData)
  static async load()
  static async validate(config)
  static async reload() // hot reload sem restart
  static async backup()
}
```

### Exemplo de Configuração Final
```json
{
  "comunidade": "M01 Comunidade Masters",
  "subgrupos": [
    "Passagens SUL",
    "Compra de Pontos",
    "Transferências"
  ],
  "palavras_chave": [
    "100%",
    "bônus",
    "latam",
    "smiles",
    "transferência"
  ],
  "case_sensitive": false,
  "rate_limit": 60,
  "created_at": "2024-01-20T14:30:00.000Z",
  "version": "1.0"
}
```

## 4. Integração com WhatsApp

### Message Handler Update (`src/core/whatsapp.js`)
```javascript
// Modificar event handler messages.upsert:
sock.ev.on('messages.upsert', async ({ messages }) => {
  for (const message of messages) {
    const groupName = getGroupName(message);
    const messageText = getMessageText(message);
    
    // NOVO: Aplicar filtros
    if (filterEngine.shouldProcessMessage(message, groupName)) {
      logger.info('Mensagem relevante encontrada', {
        group: groupName,
        keywords: filterEngine.getMatchedKeywords(messageText),
        sender: message.pushName
      });
      
      // Preparar para Fase 3 (notificações)
      await processRelevantMessage(message);
    }
  }
});
```

### Group Detection
```javascript
// Detectar grupos automaticamente:
const groups = await sock.groupFetchAllParticipating();
const groupList = Object.values(groups).map(group => ({
  id: group.id,
  name: group.subject,
  participants: group.participants.length
}));
```

## 5. CLI Commands

### Scripts Update
```json
{
  "scripts": {
    "start": "node src/index.js",
    "config": "node src/wizard.js",
    "test-filter": "node src/test/filter.js",
    "validate-config": "node src/utils/validate-config.js"
  }
}
```

### Wizard Command (`src/wizard.js`)
```javascript
// Entry point para configuração:
#!/usr/bin/env node
import { ConfigWizard } from './core/wizard.js';
import { ConfigManager } from './core/config.js';

async function main() {
  console.log('🎯 MilesGuard - Wizard de Configuração');
  
  const config = await ConfigWizard.run();
  await ConfigManager.create(config);
  
  console.log('✅ Configuração salva em config.json');
  console.log('🚀 Execute npm start para iniciar o monitoramento');
}

main().catch(console.error);
```

## 6. Testes e Validação

### Test Suite (`src/test/filter.js`)
```javascript
// Testes automatizados:
1. Teste de match de palavras-chave exato
2. Teste de case insensitivity  
3. Teste de normalização de acentos
4. Teste de filtro de grupos
5. Teste de rate limiting
6. Teste de config schema validation
```

### Validação Manual
```bash
# Executar wizard
$ npm run config
> Wizard completo → config.json gerado

# Testar filtros
$ npm run test-filter
> Casos de teste passam → Filtros funcionais

# Validar schema
$ npm run validate-config
> Schema válido → Configuração OK
```

## 7. Debug e Monitoring

### Debug Output
```javascript
// Logs detalhados de filtro:
[14:32:15] DEBUG Filter checking message
           └─ Group: Passagens SUL ✓
           └─ Keywords: ["100%", "latam"] ✓
           └─ Sender: João Silva
           └─ Action: PROCESS
           
[14:33:02] DEBUG Filter rejecting message  
           └─ Group: Chat Geral ✗
           └─ Reason: Group not monitored
           └─ Action: IGNORE
```

### Performance Metrics
```javascript
// Métricas de filtro:
- Mensagens processadas/hora
- Taxa de match (mensagens relevantes/total)
- Tempo médio de processamento por mensagem
- Rate limit hits
```

## 8. Outputs da Fase

### Arquivos Criados
- `config.json` - Configuração validada
- `src/core/wizard.js` - Wizard interativo
- `src/core/filter.js` - Motor de filtros
- `src/core/config.js` - Gerenciador de configuração
- `src/schemas/config.js` - Schema de validação

### Funcionalidades
- ✅ Wizard de configuração em 3 passos
- ✅ Filtros por palavra-chave case-insensitive
- ✅ Seleção de grupos específicos
- ✅ Validação de schema com Zod
- ✅ Hot reload de configuração
- ✅ Debug detalhado de filtros

## 9. Preparação para Fase 3

### Handoffs
- Método `processRelevantMessage()` preparado para receber notificações
- Estrutura de dados de mensagem normalizada
- Logger configurado para rastrear notificações enviadas
- Rate limiting implementado para evitar spam

### Dados Disponíveis para Notificação
```javascript
const relevantMessage = {
  id: message.key.id,
  groupName: groupName,
  senderName: message.pushName,
  text: messageText,
  timestamp: new Date(message.messageTimestamp * 1000),
  matchedKeywords: filterEngine.getMatchedKeywords(messageText)
};
```