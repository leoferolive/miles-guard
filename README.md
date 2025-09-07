# MilesGuard

MilesGuard é um agregador automático que monitora subgrupos específicos do WhatsApp e centraliza ofertas relevantes, eliminando a necessidade de verificar manualmente múltiplos grupos diariamente.

## O Que É

MilesGuard é um sistema que automatiza a coleta de ofertas baseadas em critérios pré-definidos, entregando apenas informações relevantes através de notificações organizadas.

## Problema que Resolve

❌ Ter que entrar em 5+ subgrupos diferentes diariamente
❌ Perder tempo filtrando mentalmente o que é relevante
❌ Falta de histórico organizado das ofertas
❌ Notificações de grupos com 90% de conteúdo irrelevante

## Solução Proposta

✅ Monitor automático e silencioso em background
✅ Agregação de ofertas de múltiplos subgrupos
✅ Notificações centralizadas no Telegram
✅ Histórico organizado em arquivos locais

## 🎯 Características Principais

### Configuração Simples (3 Inputs)
```yaml
Comunidade: "M01 Comunidade Masters"
Subgrupos: ["Passagens SUL", "Compra de Pontos", "Transferências"]
Palavras-chave: ["100%", "bônus", "latam", "smiles"]
```

### Sistema de Notificação Duplo
- **Telegram**: Notificações em tempo real das ofertas encontradas
- **Arquivo Local**: Backup diário organizado por data e subgrupo

### Estrutura de Arquivos
```
logs/
├── 2024-04-20/
│   ├── passagens-sul.json
│   ├── compra-pontos.json
│   └── resumo-diario.txt
├── 2024-04-21/
│   └── ...
```

## 💡 Proposta de Valor

### Simplicidade
- Setup em menos de 5 minutos
- Configuração via wizard interativo
- Não requer conhecimento técnico

### Eficiência
- Você define os critérios uma vez
- Sistema trabalha 24/7 em background
- Recebe apenas o que importa

### Organização
- Histórico pesquisável
- Arquivos organizados por data
- Fácil backup e análise posterior

## 🔧 Stack Técnica
```yaml
Runtime: Node.js
WhatsApp: Baileys (conexão via QR Code)
Notificações: Telegram Bot API
Process Manager: PM2
Storage: Sistema de arquivos local (JSON/TXT)
Futuro: Raspberry Pi deployment
```

## 📊 Caso de Uso Típico

```
Manhã (08:00):
├─ MilesGuard rodando em background
├─ Detecta: "100% bônus transferência Latam"
├─ Envia notificação no Telegram
└─ Salva em: logs/2024-04-20/transferencias.json

Noite (22:00):
├─ Você checa o Telegram
├─ Vê 5 ofertas relevantes do dia
├─ Arquivo de resumo diário gerado
└─ Zero tempo perdido em grupos
```

## 🎯 Métricas de Sucesso

✅ 100% das ofertas com palavras-chave capturadas
✅ 0 minutos/dia gastos verificando grupos manualmente
✅ < 1 min de notificação após mensagem original
✅ 100% de uptime com PM2

## 🔧 Desenvolvimento

### Comandos Básicos
```bash
# Instalar dependências
npm install

# Executar em modo de desenvolvimento
npm start

# Configuração via wizard interativo
npm run config

# Testar filtros
npm run test-filter

# Testar notificações
npm run test-notification

# Executar testes unitários
npm test
```

### Comandos de Produção (PM2)
```bash
# Iniciar em modo produção
npm run prod

# Ver status
npm run status

# Ver logs
npm run logs

# Reiniciar serviço
npm run restart

# Parar serviço
npm run stop

# Monitorar recursos
npm run monit
```

## 🚀 Evolução Planejada

| Fase | Objetivo | Status |
|------|----------|--------|
| 1 | Fundação (Conexão WhatsApp) | ✅ Concluído |
| 2 | Filtros e Configuração | ✅ Concluído |
| 3 | Notificações (Telegram + Arquivos) | ✅ Concluído |
| 4 | PM2 e Estabilidade | ✅ Concluído |
| 5 | Refinamentos | ✅ Concluído |
| 6 | Raspberry Pi | ⏳ Planejado |

**Marco de MVP:** Fase 3 completa = Sistema funcional básico  
**Marco de Produção:** Fase 5 completa = Sistema robusto 24/7  
**Marco de Deploy Dedicado:** Fase 6 completa = Hardware independente

### Roadmap
- **Hoje**: CLI + PM2 no computador pessoal
- **3 meses**: Migração para Raspberry Pi
- **6 meses**: Dashboard web local para consultas
- **Futuro**: Análise de tendências e padrões

## 📦 Dependências Principais

- **@whiskeysockets/baileys**: WhatsApp Web API para conexão e manipulação de mensagens
- **node-telegram-bot-api**: Notificações via Telegram
- **winston**: Sistema de logging estruturado
- **inquirer**: Wizard interativo de configuração
- **qrcode-terminal**: Autenticação via QR Code no WhatsApp
- **zod**: Validação de schema de configuração
- **dotenv**: Gerenciamento de variáveis de ambiente
- **pm2**: Gerenciamento de processos em produção

## 🛠️ Arquitetura do Sistema

O sistema segue uma arquitetura modular em 6 fases:

### Componentes Core
1. **Conexão WhatsApp**: Baseado no Baileys com autenticação QR e persistência de sessão
2. **Motor de Filtros**: Sistema de filtragem baseado em palavras-chave com matching case-insensitive
3. **Sistema de Notificação Dupla**:
   - Notificações em tempo real via Telegram
   - Armazenamento local em arquivos JSON/TXT organizados por data e subgrupo
4. **Wizard de Configuração**: Setup interativo para comunidades, subgrupos e palavras-chave
5. **Integração PM2**: Gerenciamento de processos 24/7 com auto-restart e health checks

### Estrutura Esperada de Arquivos
```
logs/
├── 2024-04-20/
│   ├── passagens-sul.json
│   ├── compra-pontos.json
│   └── resumo-diario.txt
├── 2024-04-21/
│   └── ...
config.json
ecosystem.config.js
```

### Schema de Configuração
```json
{
  "comunidade": "M01 Comunidade Masters",
  "subgrupos": [
    "Passagens SUL",
    "Compra de Pontos"
  ],
  "palavras_chave": [
    "100%",
    "bônus", 
    "latam"
  ],
  "case_sensitive": false
}
```

## 📈 Workflow de Desenvolvimento

1. **Integração WhatsApp**: Implementar conexão com Baileys com autenticação QR
2. **Filtragem de Mensagens**: Criar sistema de matching por palavras-chave
3. **Sistema de Notificações**: Configurar bot do Telegram e armazenamento local
4. **Gerenciamento de Processos**: Configurar PM2 para deploy em produção
5. **Gerenciamento de Configuração**: Construir wizard interativo com Inquirer

## 🎯 Funcionalidades Principais

- **Monitoramento Silencioso em Background**: Monitora múltiplos subgrupos do WhatsApp sem intervenção manual
- **Filtragem Inteligente**: Filtragem baseada em palavras-chave com critérios configuráveis
- **Armazenamento Duplo**: Notificações em tempo real via Telegram + backup organizado em arquivos locais
- **Operação 24/7**: Gerenciado pelo PM2 com auto-restart e monitoramento de saúde
- **Setup Simples**: Configuração em 3 passos via wizard interativo

## 🔮 Futuro Deployment

O sistema é projetado para eventual deploy em Raspberry Pi para operação dedicada 24/7 com uso mínimo de recursos.