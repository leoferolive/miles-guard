import { describe, expect, it } from 'vitest';

import { extractOffer } from './index.js';

// Mensagens reais (encurtadas) dos 4 grupos monitorados.
const IURI_5800 = `Processador Amd Ryzen 7 5800x3d, 4.5ghz Turbo,cache 96 MB Am4

💵 R$ 1701
🎟️ Cupom: \`MP1011\`
✅ https://meli.la/1oC4FmR

🤑 Grupos de ofertas: https://iuriindica.com.br`;

const IURI_5800_V2 = `*Processador AMD Ryzen 7 5800X3D (4.5GHz Max Turbo) Cache 96MB AM4*

💵  R$ 1.919,00
✅  https://meli.la/abc`;

const IURI_7800_PART = `Processador Amd Ryzen 7 7800X3d, 4.2GHz (5.0GHz Max Turbo), Cache 104Mb, 8 Núcleos, 16 Threads, Am5, Com Vídeo Integrado - 100-100000910Wof

💵  R$ 1768
🎟  Cupom: AQUITEM
✅  https://meli.la/1GRawbW`;

const IURI_SHOPEE_OFF = `AMD Ryzen 5 5500X3D, 4.0GHz Max Turbo, Cache 96MB, AM4, (Novo S/Box)

💵 R$ 993

🎟️ Resgate todos os cupons desta página:
R$ 100 OFF: https://s.shopee.com.br/4VacOIgh4a

✅ Link do produto:
https://s.shopee.com.br/3B5Enqbnlk`;

const IURI_COOLER = `Cooler Cpu Thermalright Peerless Assassin 120 Se

Se você não gosta de Water Cooler, esse aqui é tão forte quanto, segura 9800x3d sorrindo.

💵  R$ 233,10
🎟  Cupom: TECHEMCASA
✅  https://meli.la/27Dd3Rj`;

const IURI_PARCELADO = `Samsung Monitor Odyssey OLED G5 27", QHD, 180Hz, 0.03ms, G-sync, FreeSync, DP, HDMI

💵  R$ 3099 EM 12X SEM JUROS!
✅  https://www.amazon.com.br/dp/B0GVPH7`;

const IURI_MULTI = `Processadores OEM Novos LibreTx (Direto do Brasil 🇧🇷)

Processador AMD Ryzen 7 9700X (Novo)
💵 R$ 1.394
🎟 Cupom: LIBRETX9700X + PDF07 + Moedas no APP
✅ Link: https://a.aliexpress.com/_c4XM4nRv

Processador AMD Ryzen 5 9600X (Novo)
💵 R$ 982
✅ Link: https://a.aliexpress.com/_c4XM4n`;

const OFCPROMO = `*ONEBLADE EM PROMO VIROU RARIDADE*
_Loja Oficial_

*Aparador De Pelos Philips Oneblade QP1425/10 5V*

De R$ 229 por *R$ 113* no Pix
Cupom: *BOLSOCHEIO + TODOOSITE0709* 🎟️

https://meli.la/1yUyZgB`;

const OFCPROMO_SEM_CODIGO = `*AINDA DA TEMPO*

*Aparador De Pelos Philips Oneblade*

De R$ 226 por *R$ 106* no Pix
Cupom: *FULL1309* 🎟️

https://meli.la/1yUyZgB`;

const PROMOZONE = `A BARBA DO SEU PAI SEMPRE IMPECÁVEL

✅ Philips OneBlade QP1425

🔥 DE ~R$ 212,38~ | POR *124,89*

🎟️ Use o cupom: *MELHORCUPOM*

🔗 https://meli.la/1skYQ4G`;

const PROMOZONE_TV = `TELA DE CINEMA PELO PREÇO DE TV COMUM

✅ Smart TV 55 TCL 4K QLED

🔥 DE ~6.205,00~ | POR *2.364,05*

🔗 https://go.promozone.ai/magalu/lnvh3E`;

const RBSTORE = `🥷 Kabum! 🥷

✅ Processador AMD Ryzen 7 7800X3D, 5.0GHz Max Turbo, Cache 104MB, AM5, 8 Núcleos, Vídeo Integrado - 100-100000910WOF

🔗 https://rbstore.net/s/1b8c46a2_wh

💲 R$ 1.799,00

🏷 Cupom CREATORS10

_#b572a8a6_`;

const RBSTORE_KIT = `🥷 Kabum! 🥷

✅ Kit Upgrade AMD Ryzen 7 7800X3D + Placa-Mãe X870

💲 R$ 3.095,00`;

const IURI_ALIEXPRESS = `Previsão para hoje 23:59 (ainda não está ativo, somente quando virar o dia)

RYZEN 5 5500X3D

Selecione a primeira opção na aba de Moedas ou na aba "BRASIL" somente pelo APP!

💵  R$ 1028 EM 12X SEM JUROS!
🎟  Cupom: LIBRETX55X3D + JUL6
✅  https://s.click.aliexpress.com/e/_c3adr7aD`;

const IURI_TV = `*Smart TV 65" TCL 4K UHD MiniLED 65C6K 120Hz Google TV AiPQ Google Assistente 4 HDMI 2 USB 65 C6K*

*Selecione a primeira opção na aba de Moedas*

💵 R$ 3841
✅ https://s.click.aliexpress.com/e/_x`;

const IURI_R5 = `Processador AMD R5 5500X3D, 4.0GHz Max Turbo, Cache 96MB, AM4

💵 R$ 1187
✅ https://meli.la/x`;

const IURI_SLOGAN_COM_CODIGO = `MEU DEUS MENOR PREÇO HISTORICO, AGUENTA ATÉ 5800X3D

Placa Mãe Asus Tuf Gaming A520m-plus Ii, Amd Am4, Matx, Ddr4 Preto

So assinar MELI+ e ser feliz!

💵  R$ 376
🎟  Cupom: BARATINHO + MELIMAIS7DO8
✅  https://meli.la/14LsAFe`;

describe('extractOffer — preço', () => {
  it.each([
    ['IURI simples', IURI_5800, 1701],
    ['IURI com milhar e centavos', IURI_5800_V2, 1919],
    ['IURI ignora "R$ 100 OFF" do cupom', IURI_SHOPEE_OFF, 993],
    ['IURI com centavos', IURI_COOLER, 233.1],
    ['IURI parcelado usa o valor, não as parcelas', IURI_PARCELADO, 3099],
    ['Ofcpromo "De … por"', OFCPROMO, 113],
    ['Promozone ignora o riscado e usa o POR sem R$', PROMOZONE, 124.89],
    ['Promozone com milhar', PROMOZONE_TV, 2364.05],
    ['RB Store 💲', RBSTORE, 1799],
  ])('%s', (_, text, price) => {
    expect(extractOffer(text).price).toBe(price);
  });

  it('mensagem com vários produtos é ambígua: sem preço e sem produto', () => {
    expect(extractOffer(IURI_MULTI)).toMatchObject({ price: null, productKey: null });
  });

  it('sem preço identificável → null', () => {
    expect(extractOffer('Oferta relâmpago de Ryzen 5800X3D, corre!').price).toBeNull();
  });
});

describe('extractOffer — título', () => {
  it.each([
    ['IURI: 1ª linha', IURI_5800, 'Processador Amd Ryzen 7 5800x3d, 4.5ghz Turbo,cache 96 MB Am4'],
    ['Ofcpromo: pula o slogan em CAPS e a loja', OFCPROMO, 'Aparador De Pelos Philips Oneblade QP1425/10 5V'],
    ['Promozone: linha ✅', PROMOZONE, 'Philips OneBlade QP1425'],
    ['RB Store: pula o cabeçalho da loja', RBSTORE, 'Processador AMD Ryzen 7 7800X3D, 5.0GHz Max Turbo, Cache 104MB, AM5, 8 Núcleos, Vídeo Integrado - 100-100000910WOF'],
  ])('%s', (_, text, title) => {
    expect(extractOffer(text).title).toBe(title);
  });
});

describe('extractOffer — chave do produto', () => {
  it('o mesmo modelo em lojas/formatos diferentes cai na mesma chave', () => {
    expect(extractOffer(IURI_5800).productKey).toBe('c:5800x3d');
    expect(extractOffer(IURI_5800_V2).productKey).toBe('c:5800x3d');

    // Part number some quando há código de modelo mais curto.
    expect(extractOffer(IURI_7800_PART).productKey).toBe('c:7800x3d');
    expect(extractOffer(RBSTORE).productKey).toBe('c:7800x3d');

    // "/10" e "5V" não fazem parte do modelo; Promozone e Ofcpromo juntam.
    expect(extractOffer(OFCPROMO).productKey).toBe('c:qp1425');
    expect(extractOffer(PROMOZONE).productKey).toBe('c:qp1425');
  });

  it('kit (CPU + placa) NÃO se mistura com a CPU avulsa (kit fica sem chave)', () => {
    expect(extractOffer(RBSTORE_KIT).productKey).toBeNull();
  });

  it('código citado na descrição não vira produto (só o título conta)', () => {
    expect(extractOffer(IURI_COOLER).productKey).not.toContain('9800x3d');
  });

  it('tecnologia de tela entra na chave (G5 OLED ≠ G5 comum)', () => {
    expect(extractOffer(IURI_PARCELADO).productKey).toBe('c:27pol+g5+oled');
  });

  it('instrução de app não vira título; linha em CAPS com código é produto', () => {
    expect(extractOffer(IURI_ALIEXPRESS)).toMatchObject({
      title: 'RYZEN 5 5500X3D',
      price: 1028,
      productKey: 'c:5500x3d',
    });
  });

  it('slogan em CAPS que cita outro modelo não vira o produto', () => {
    const offer = extractOffer(IURI_SLOGAN_COM_CODIGO);
    expect(offer.title).toBe('Placa Mãe Asus Tuf Gaming A520m-plus Ii, Amd Am4, Matx, Ddr4 Preto');
    expect(offer.productKey).toBe('c:a520m-plus');
  });

  it('código repetido em partes ("65C6K … 65 C6K") não cria chave nova', () => {
    expect(extractOffer(IURI_TV).productKey).toBe('c:65c6k+65pol+miniled');
  });

  it('abreviação de linha (R5/i7) não separa do mesmo modelo', () => {
    expect(extractOffer(IURI_R5).productKey).toBe('c:5500x3d');
  });

  it('sem código de modelo, usa o conjunto exato de palavras do título', () => {
    expect(extractOffer(OFCPROMO_SEM_CODIGO).productKey).toBe('w:aparador+oneblade+pelos+philips');
    expect(extractOffer(PROMOZONE_TV).productKey).toBe('w:4k+55+qled+smart+tcl+tv');
  });
});

// --- Achados da revisão do PR #18 ---
describe('extractOffer — preço (endurecimento)', () => {
  it.each([
    ['número de Pix na linha 💵 não é preço', '*Produto X Y Z*\n\n💵 Pix 11987654321', null],
    ['valor absurdo vira null (não estoura a coluna)', 'Produto X Y Z\n\n💵 R$ 99999999999', null],
    ['"R$ 100 OFF" sozinho não vira R$ 10', 'Produto X Y Z\n\nCupom R$ 100 OFF', null],
    ['"por" em prosa não vence a linha 💵', 'Produto X Y Z\n\n💵 R$ 299\nAssinatura de teste por 30 dias', 299],
    ['"de … por" sem R$/negrito não é preço', 'Leve 12 de 3 por 2 unidades', null],
    ['💰 (cashback) não é a linha de preço', 'Produto X Y Z\n\nR$ 299\n💰 10% de cashback', 299],
    ['parcela na linha 💵 não é o preço', 'Produto X Y Z\n\n💵 10x de R$ 89,90', null],
    ['parcela + total na linha 💵 → total', 'Produto X Y Z\n\n💵 R$ 899 em 10x de R$ 89,90', 899],
    ['ponto como separador decimal', 'Produto X Y Z\n\n💵 R$ 99.90', 99.9],
  ])('%s', (_, text, price) => {
    expect(extractOffer(text).price).toBe(price);
  });
});

describe('extractOffer — chave (endurecimento contra junções erradas)', () => {
  const key = (title: string) => extractOffer(`${title}\n\n💵 R$ 1000`).productKey;

  it('só abreviação de linha (i5/r7) não vira chave de código', () => {
    expect(key('Notebook Dell Inspiron Intel Core i5 8GB')).not.toBe(key('Notebook Lenovo IdeaPad i5 16GB'));
    expect(key('Notebook Dell Inspiron Intel Core i5')).not.toMatch(/^c:/);
  });

  it('código genérico (5g, ps5, m.2, 4l, 5in1) não vira chave nem junta produtos', () => {
    expect(key('Smartphone Motorola Moto G 5G 128GB')).not.toMatch(/^c:/);
    expect(key('Smartphone Motorola Moto G 5G 128GB')).not.toBe(key('Smartphone Redmi Note 13 5G 128GB'));
    expect(key('Console PlayStation PS5 Slim')).not.toBe(key('Controle DualSense PS5'));
    expect(key('Air Fryer Mondial 4L Preta')).not.toMatch(/^c:/);
    expect(key('Carregador Turbo 5in1 Universal')).not.toMatch(/^c:/);
  });

  it('m.2 não substitui o modelo real com hífen', () => {
    expect(key('Placa-mãe MSI A520m-a Pro, AMD AM4, DDR4, M.2')).toBe('c:a520m-a+pro');
  });

  it('configuração diferente do mesmo modelo não junta (CPU do notebook)', () => {
    expect(key('Notebook Positivo Vision R15M Ryzen 3-7330U 8GB')).not.toBe(
      key('Notebook Positivo Vision R15M Ryzen 5-7520U 8GB'),
    );
  });

  it('capacidade entra na chave (1TB ≠ 2TB)', () => {
    expect(key('SSD Kingston NV3 1TB M.2 NVMe')).not.toBe(key('SSD Kingston NV3 2TB M.2 NVMe'));
  });

  it('sufixo do modelo entra na chave (S24 ≠ S24 Ultra), "Max Turbo" de CPU não', () => {
    expect(key('Samsung Galaxy S24 256GB')).not.toBe(key('Samsung Galaxy S24 Ultra 256GB'));
    expect(key('Ryzen 7 5800X3D 4.5GHz Max Turbo')).toBe('c:5800x3d');
  });

  it('kit com item extra sem código não se mistura com o avulso', () => {
    expect(key('Processador AMD Ryzen 5 5500X3D + Water Cooler')).toBeNull();
    expect(key('Processador AMD Ryzen 5 5500X3D')).toBe('c:5500x3d');
  });

  it('variação só por quantidade (2 ≠ 3 lâminas) não junta', () => {
    expect(key('Lâminas de Reposição Philips OneBlade 2 unidades')).not.toBe(
      key('Lâminas de Reposição Philips OneBlade 3 unidades'),
    );
  });
});
