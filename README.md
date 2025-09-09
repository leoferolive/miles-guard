/# MilesGuard

M/ilesGuard é um agregador automático que monitora subgrupos específicos do WhatsApp e centraliza ofertas relevantes, eliminando a necessidade de verificar manualmente múltiplos grupos diariamente.

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

## 🔧 Setup e Desenvolvimento

### Setup Automático (Recomendado)
```bash
# Setup completo do projeto
node scripts/setup.js

# Ou via npm
npm run setup
```
**O script de setup irá:**
- Verificar pré-requisitos (Node.js 16+, npm, git)
- Instalar dependências automaticamente
- Criar diretórios necessários (logs, data, temp)
- Configurar arquivo de ambiente (.env)
- Executar suite completa de testes
- Validar funcionamento da aplicação

### Comandos Básicos
```bash
# Instalar dependências manualmente
npm install

# Executar em modo de desenvolvimento
npm start

# Executar com wizard de configuração
npm run config

# Testar conexão WhatsApp (POC)
npm run poc
```

### Sistema de Testes

MilesGuard possui uma suíte completa de testes para garantir qualidade e confiabilidade:

#### Executar Todos os Testes
```bash
# Suite completa de testes (recomendado)
node scripts/test.js

# Ou via npm
npm test
```

#### Testes Específicos
```bash
# Apenas testes unitários
npm run test:unit
node scripts/test.js unit

# Apenas testes de integração
npm run test:integration
node scripts/test.js integration

# Testes em modo watch (desenvolvimento)
node scripts/test.js watch
```

#### Validação da Aplicação
```bash
# Validar estrutura e funcionalidade
node scripts/validate.js

# Verificar dependências e configuração
npm run validate
```

#### Relatórios de Teste
Após executar os testes, você encontrará:
- `test-results.json` - Relatório detalhado dos testes
- `validation-report.json` - Relatório de validação da aplicação

#### Cobertura Atual
- **143+ testes** implementados
- **Testes unitários**: Services, Models, Utils, Repositories
- **Testes de integração**: Fluxo completo Config → Filter → Notification
- **Meta de cobertura**: 95%+ (configurada no TEST_ROADMAP.md)

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

## 🚀 Status Atual do Projeto

| Fase | Objetivo | Status |
|------|----------|--------|
| 1 | Fundação (Conexão WhatsApp) | ✅ Implementado |
| 2 | Filtros e Configuração | ✅ Implementado |
| 3 | Notificações (Telegram + Arquivos) | ✅ Implementado |
| 4 | PM2 e Estabilidade | ✅ Implementado |
| 5 | Refinamentos e Arquitetura Limpa | ✅ Implementado |
| 6 | Testes e Validação | ✅ **Implementado** |
| 7 | Raspberry Pi Deployment | ⏳ Planejado |

**Status Atual:** Sistema completo com arquitetura limpa e cobertura extensiva de testes  
**Próximos Passos:** Deployment em Raspberry Pi

### Fase 6 - Testes Implementados ✅
- **143+ testes** cobrindo toda a aplicação
- **Testes unitários** para Services, Models, Utils e Repositories
- **Testes de integração** validando fluxo completo
- **Scripts automatizados** de setup, teste e validação
- **Relatórios detalhados** de cobertura e performance
- **CI/CD Pipeline** com GitHub Actions (planejado)

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

O sistema implementa **Clean Architecture** com separação clara de responsabilidades:

### Estrutura Completa do Projeto
```
MilesGuard/
├── src/                        # Código fonte principal
│   ├── index.js               # Entry point da aplicação
│   ├── config/                # Configurações de ambiente
│   ├── core/                  # Lógica central do domínio
│   │   └── whatsapp/         # Módulos específicos do WhatsApp
│   ├── services/              # Serviços de aplicação
│   ├── models/                # Modelos de dados
│   ├── repositories/          # Camada de acesso a dados
│   └── utils/                 # Utilitários compartilhados
├── tests/                      # Suite completa de testes
│   ├── unit/                  # Testes unitários
│   │   ├── services/          # Testes de serviços
│   │   ├── models/            # Testes de modelos
│   │   └── utils/             # Testes de utilitários
│   ├── integration/           # Testes de integração
│   ├── fixtures/              # Dados de teste
│   └── helpers/               # Utilitários de teste
├── scripts/                    # Scripts de automação
│   ├── setup.js               # Setup automático do projeto
│   ├── test.js                # Runner de testes
│   └── validate.js            # Validador da aplicação
├── logs/                       # Logs organizados por data
├── data/                       # Dados da aplicação
└── temp/                       # Arquivos temporários
```

### Componentes Principais
1. **WhatsApp Connection**: Sistema robusto de conexão usando Baileys
2. **Message Handler**: Processamento inteligente de mensagens
3. **Filter Service**: Sistema de filtros por palavras-chave configurável
4. **Notification Dispatcher**: Orquestração de notificações
5. **Dual Storage**: Telegram + arquivos locais organizados
6. **Session Manager**: Gerenciamento de sessões WhatsApp

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

## 🧪 Qualidade e Confiabilidade

### Testes Implementados
- **Unit Tests**: 100+ testes cobrindo Services, Models, Utils
- **Integration Tests**: 12+ testes validando fluxo completo
- **Performance Tests**: Validação de eficiência com 100+ mensagens
- **Error Handling**: Cenários de falha e recuperação
- **Mock & Fixtures**: Dados de teste realistas

### Automação
- **Setup Script**: Configuração automática do ambiente
- **Test Runner**: Execução automatizada com relatórios
- **Validator**: Verificação contínua da estrutura e funcionalidade
- **CI/CD Ready**: Preparado para pipelines automatizados

### Métricas de Qualidade
- **>95% Test Coverage** (meta definida)
- **<1s response time** para filtros
- **100% uptime** com PM2
- **Zero manual intervention** em produção

## 📋 Checklist de Setup

Para iniciar o MilesGuard:

1. **Pré-requisitos** ✓
   - [ ] Node.js 16+ instalado
   - [ ] npm disponível
   - [ ] Git configurado (opcional)

2. **Instalação** ✓
   ```bash
   git clone <repository>
   cd MilesGuard
   node scripts/setup.js
   ```

3. **Configuração** ✓
   - [ ] Editar arquivo `.env` criado
   - [ ] Configurar bot do Telegram
   - [ ] Definir grupos e palavras-chave

4. **Validação** ✓
   ```bash
   node scripts/validate.js
   npm test
   ```

5. **Execução** ✓
   ```bash
   npm start          # Desenvolvimento
   npm run prod       # Produção
   ```

## 🔮 Futuro Deployment

O sistema é projetado para eventual deploy em Raspberry Pi para operação dedicada 24/7 com uso mínimo de recursos.

### Próximas Melhorias
- **Dashboard Web**: Interface para consulta de ofertas
- **API REST**: Endpoints para integração externa
- **Machine Learning**: Classificação automática de relevância
- **Multi-tenant**: Suporte a múltiplas comunidades
- **Mobile App**: Aplicativo para consulta móvel