# Categoria de produto e Palavra-chave restrita por categoria

Cada Detecção ganha uma **Categoria** de produto (Processador, Monitor, TV, Calçados, …),
derivada do **título** do anúncio por regras determinísticas (`classifyProduct`, em
`packages/core`). Uma **Palavra-chave** pode, opcionalmente, valer só em algumas
Categorias (ex.: `x3d` → Processador e Kit). Isso **não** cria a entidade "Regra" que o
glossário rejeita: o critério continua sendo Grupo Monitorado + suas Palavras-chave; a
Palavra-chave só ganhou um atributo.

Motivo: o casamento por substring no texto todo pegava anúncios que apenas **citam** o
termo. Nos dados reais (472 Detecções): `x3d` trouxe 239 processadores, mas também 9
gabinetes, 8 monitores, 2 coolers e 2 placas-mãe ("ideal para 5800x3d"); `SSD` trouxe 9
notebooks e nenhum SSD; `miniled` mistura TVs e monitores. Exclusões por termo resolveriam
caso a caso; a categoria separa "o que é o que" de forma legível e reaproveitável no Painel.

## Decisão

- **Categoria** = primeira regra que casa no título normalizado, em ordem (Notebook antes
  de Processador; Processador antes de Cooler, por "Sem Cooler"). Partes de categorias
  diferentes unidas por `+` (ou "kit"/"combo") = **Kit**. Sem regra = **Outros**.
- **Falha aberta (recall acima de precisão)**: Palavra-chave sem categorias vale para
  tudo; Categoria **Outros** (desconhecida) passa por qualquer restrição. A restrição só
  corta o que sabidamente é *outra coisa* — perder oferta é pior que um alerta a mais.
- O corte é observável: desfecho `out_of_category` na métrica de mensagens monitoradas e
  log INFO com termo, categoria e título.
- A categoria é gravada na Detecção (`detections.category`) e entra no versionamento da
  extração (`OFFER_EXTRACTION_VERSION`): mudar as regras reprocessa o histórico no boot.

## Consequências

- Classificação errada pode cortar uma oferta relevante de uma Palavra-chave restrita;
  mitigado pela falha aberta e pelo log de auditoria. Regras evoluem subindo a versão.
- Palavras-chave existentes continuam sem restrição (comportamento idêntico ao anterior)
  até o Usuário definir categorias.
