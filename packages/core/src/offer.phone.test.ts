import { describe, expect, it } from "vitest";

import { OFFER_EXTRACTION_VERSION, extractOffer } from "./offer.js";

/** Mensagem no formato Be!Tech / Mercado Livre: "Por: R$ X (à vista)" + "ou R$ Y em até Nx". */
const betechMl = (
  title: string,
  avista: string,
  parcelado: string,
  parcelas = 10,
): string =>
  `🔥${title}\n\n✅ Por: R$ ${avista} (à vista)\nou R$ ${parcelado} em até ${parcelas}x 💳\n\n🔗 https://exemplo.com/x\n\n*Ofertas limitadas!`;

/** Mensagem no formato Be!Tech / Amazon: "Por: R$ X em até Nx". */
const betechAmazon = (title: string, preco: string, parcelas = 12): string =>
  `🔥${title}\n\n✅ Por: R$ ${preco} em até ${parcelas}x 💳\n\n🔗 https://exemplo.com/x\n\n*Ofertas limitadas!`;

/** Mensagem curta estilo Iuri (título + 💵), para montar celulares com título realista. */
const iuri = (title: string, preco = "1500"): string =>
  `${title}\n\n💵  R$ ${preco}\n🎟  Cupom: EXEMPLO\n✅  https://exemplo.com/x\n\n🤑 Grupos de promoções: https://exemplo.com/x`;

const key = (title: string): string | null =>
  extractOffer(iuri(title)).productKey;

describe("R1 — versão de extração", () => {
  it("OFFER_EXTRACTION_VERSION foi subida para 4 (reprocessa o histórico)", () => {
    expect(OFFER_EXTRACTION_VERSION).toBe(4);
  });
});

describe("P1/P2 — preço no formato Be!Tech", () => {
  it('Mercado Livre: "Por: R$ X (à vista)" + "ou R$ Y em até 10x" → X', () => {
    const o = extractOffer(
      betechMl(
        "Smartphone Motorola Edge 70 Fusion 5g - 256gb 24gb (8gb Ram + 16gb Ram Boost), Camera 50mp Sony Lytia 710, Tela 1.5k Extreme Amoled 144hz - Verde",
        "1.999,00",
        "2.221,11",
      ),
    );
    expect(o.price).toBe(1999);
    expect(o.category).toBe("Smartphone");
    expect(o.title).toBeTruthy();
  });

  it("Mercado Livre: outro valor (parcela nunca vira o preço)", () => {
    const o = extractOffer(
      betechMl(
        "Smartphone Motorola Edge 70 Fusion 5g - 256gb 24gb (8gb Ram + 16gb Ram Boost), Camera 50mp Sony Lytia 710, Tela 1.5k Extreme Amoled 144hz - Roxo",
        "2.112,71",
        "2.347,46",
      ),
    );
    expect(o.price).toBe(2112.71);
  });

  it('Amazon: "Por: R$ X (à vista)" + "ou R$ Y em até 12x" → X', () => {
    const o = extractOffer(
      betechMl(
        'Celular Samsung Galaxy A57 5G 128GB, 8GB RAM, Câmera 50MP, IP68, Super AMOLED 6.7", Recursos AI (Azul Escuro)',
        "1.791,99",
        "1.991,10",
        12,
      ),
    );
    expect(o.price).toBe(1791.99);
  });

  it('Amazon: "Por: R$ X em até 12x" → X (já funciona hoje)', () => {
    const o = extractOffer(
      betechAmazon(
        "Smartphone Motorola Edge 60 Fusion 5G - 256GB 16GB (8GB RAM+8GB Ram Boost) 50MP Sony AI Camera IP68 NFC - Rosa",
        "1.789,90",
      ),
    );
    expect(o.price).toBe(1789.9);
  });

  it("Amazon: Edge 70 Crystals e Edge 70 Fusion", () => {
    expect(
      extractOffer(
        betechAmazon(
          "Smartphone Motorola Edge 70 5G Crystals by Swarovski - 512GB 12GB RAM + 12GB RAM Boost, Ultrafino, 3 cameras 50MP e tela extreme Amoled 120hz - Cloud Dancer",
          "3.099,00",
        ),
      ).price,
    ).toBe(3099);
    expect(
      extractOffer(
        betechAmazon(
          "Smartphone Motorola Edge 70 Fusion 5G 256GB 12GB RAM, Camera 50MP Sony Lytia 710, Tela 1.5K Extreme AMOLED 144Hz, Branco",
          "1.999,00",
        ),
      ).price,
    ).toBe(1999);
  });

  it('P1: "Por:" sem ✅, sem "(à vista)" e com negrito', () => {
    const t = "Smartphone Motorola Edge 60 Fusion 5G 256GB 8GB RAM Cinza";
    expect(
      extractOffer(`${t}\n\nPor: R$ 1.500,00\n\nhttps://exemplo.com/x`).price,
    ).toBe(1500);
    expect(
      extractOffer(
        `${t}\n\n✅ *Por: R$ 1.500,00* (à vista)\n\nhttps://exemplo.com/x`,
      ).price,
    ).toBe(1500);
    expect(
      extractOffer(`${t}\n\n✅ Por: *R$ 1.500,00*\n\nhttps://exemplo.com/x`)
        .price,
    ).toBe(1500);
  });

  it('P2: parcela "R$ Y em Nx" / "em até Nx" nunca vira o preço', () => {
    const t = "Smartphone Motorola Edge 60 Fusion 5G 256GB 8GB RAM Cinza";
    expect(
      extractOffer(
        `${t}\n\n✅ Por: R$ 1.500,00\nou R$ 1.700,00 em 10x\n\nhttps://exemplo.com/x`,
      ).price,
    ).toBe(1500);
    expect(
      extractOffer(
        `${t}\n\n✅ Por: R$ 1.500,00\nou R$ 1.700,00 em até 10x\n\nhttps://exemplo.com/x`,
      ).price,
    ).toBe(1500);
  });

  it('ambiguidade: duas linhas "Por: R$" → price null', () => {
    const o = extractOffer(
      `🔥Smartphone Motorola Edge 60 Fusion 5G 256GB 8GB RAM Cinza\n\n✅ Por: R$ 1.999,00 (à vista)\n✅ Por: R$ 1.799,00 (à vista)\nou R$ 2.221,11 em até 10x 💳\n\n🔗 https://exemplo.com/x`,
    );
    expect(o.price).toBeNull();
  });
});

describe("P3 — regressão de preço nos formatos dos outros grupos", () => {
  it("Iuri 💵 com cupom", () => {
    const o = extractOffer(
      'Monitor Gamer ASUS ROG Strix 27", QHD, 180Hz, 1ms, Fast IPS, VRR, G-Sync, FreeSync, HDR 400, USB-C, Altura Ajustável\n\n💵  R$ 1290\n🎟  Cupom: CUPOMLIVE150\n✅  https://exemplo.com/x',
    );
    expect(o.price).toBe(1290);
  });

  it('Iuri 💵 com parcelamento "em 12x sem juros"', () => {
    const o = extractOffer(
      'Smartphone Samsung Galaxy A57 128GB 5G 8GB RAM Cinza 6,7" Câm Tripla + Selfie 12MP\n\nSelecione a primeira opção na aba de Moedas ou na aba "BRASIL" somente pelo APP!\n\n💵 R$ 1676 em 12x sem juros\n🎟️ Cupom: EXEMPLO\n✅ https://exemplo.com/x',
    );
    expect(o.price).toBe(1676);
  });

  it('Ofcpromo "De R$ … Por R$ …"', () => {
    const o = extractOffer(
      "Aparador De Pelos Philips Oneblade Qp1425/10\n\nDe R$ 226 Por R$ 111 pix 💵\n\ncupom: BELEZASURPRESA 📌\n\nhttps://exemplo.com/x",
    );
    expect(o.price).toBe(111);
  });

  it('Ofcpromo "De R$ … por *R$ …*" em celular', () => {
    const o = extractOffer(
      "*PERFEITO PRA ENVIAR FAKENEWS NO ZAP*\n_Loja Oficial *Samsung* no ML_\n\n*Celular Samsung Galaxy A57 5G 128GB*\n\nDe R$ 3.799 por *R$ 1.587* no Pix \nCupom: *HOJEPRATEC* 🎟️\n\nhttps://exemplo.com/x",
    );
    expect(o.price).toBe(1587);
  });

  it('Ofcpromo "Por *R$ …*" sem "De"', () => {
    const o = extractOffer(
      "*HORA DE TROCAR DE CELULAR*\n_Loja Oficial *Samsung* no ML_\n\n*Celular Samsung Galaxy A57 5G 128GB*\n\nPor *R$ 1.583* no Pix \nCupom: *MODOTECH* 🎟️\n\nhttps://exemplo.com/x",
    );
    expect(o.price).toBe(1583);
  });

  it('Promozone "DE ~…~ | POR *…*"', () => {
    const o = extractOffer(
      "A QUALIDADE VISUAL QUE SUAS SÉRIES MERECEM\n\n✅ Smart TV TCL QLED 40 Polegadas\n\n🔥 DE ~2.299,00~ | POR *1.298,60*\n\n🎟️ CUPOM: PROMOZONE100\n\n🔗 https://exemplo.com/x",
    );
    expect(o.price).toBe(1298.6);
  });

  it("RB Store ✅ título + 💲 preço", () => {
    const o = extractOffer(
      "🤝 Mercado Livre 🤝\n\n✅ Monitor Portátil 15.6 Fyhxele 1080p Hdr Hdmi Ips\n\n🔗 https://exemplo.com/x\n\n💲 R$ 278,00\n\n🏷 Cupom  DESCONTOMELIMAIS (meli+) ou MENOSHOJE\n\n_#fd60509c_",
    );
    expect(o.price).toBe(278);
  });
});

describe("K1/K2 — mesmo celular, mesma chave", () => {
  const a57 = [
    'Smartphone Samsung Galaxy A57 128GB 5G 8GB RAM Cinza 6,7" Câm Tripla + Selfie 12MP',
    "Celular Samsung Galaxy A57 5G 128GB, 8GB RAM, Câmera 50MP, IP68, Super AMOLED 6.7",
    'Celular Samsung Galaxy A57 5G 128GB, 8GB RAM, Câmera 50MP, IP68, Super AMOLED 6.7", Recursos AI - Lilás',
    "Celular Samsung Galaxy A57 5g 128gb, 8gb Ram, Recursos Ai",
    "Celular Samsung Galaxy A57 5G 128GB",
  ];
  const edge70Fusion = [
    "Smartphone Motorola Edge 70 Fusion 5g - 256gb 12gb Ram + 12gb Ram Boost, Camera 50mp Sony Lytia 710, Tela 1.5k Extreme Amoled 144hz - Branco",
    "Smartphone Motorola Edge 70 Fusion 5G 256GB 12GB RAM, Camera 50MP Sony Lytia 710, Tela 1.5K Extreme AMOLED 144Hz, Branco",
    "Smartphone Motorola Edge 70 Fusion 5g - 256gb 24gb (8gb Ram + 16gb Ram Boost), Camera 50mp Sony Lytia 710, Tela 1.5k Extreme Amoled 144hz - Roxo",
  ];

  it("categoria Smartphone nos títulos usados", () => {
    for (const t of [...a57, ...edge70Fusion])
      expect(extractOffer(iuri(t)).category).toBe("Smartphone");
  });

  it("Galaxy A57 128GB: todas as variantes de título têm a mesma chave não-nula", () => {
    const keys = a57.map(key);
    expect(keys[0]).not.toBeNull();
    expect(new Set(keys).size).toBe(1);
  });

  it("Edge 70 Fusion 256GB: variantes (inclusive RAM diferente) têm a mesma chave não-nula", () => {
    const keys = edge70Fusion.map(key);
    expect(keys[0]).not.toBeNull();
    expect(new Set(keys).size).toBe(1);
  });

  it("a chave independe do formato da mensagem (Be!Tech vs Iuri)", () => {
    const t = edge70Fusion[1]!;
    const k1 = extractOffer(betechAmazon(t, "1.999,00")).productKey;
    const k2 = key(t);
    expect(k1).not.toBeNull();
    expect(k1).toBe(k2);
  });
});

describe("K3 — celulares diferentes, chaves diferentes", () => {
  it("Edge 70 Fusion × Pro × Crystals, Edge 60 Fusion × Pro (modelos distintos)", () => {
    const titles = [
      "Smartphone Motorola Edge 70 Fusion 5g - 256gb 12gb Ram, Camera 50mp - Branco",
      "Smartphone Motorola Edge 70 Pro 5g - 256gb 12gb Ram+12gb Ram Boost, 4 Câmeras De 50mp, Ip68/ip69 - Azul Escuro",
      "Smartphone Motorola Edge 70 5G Crystals by Swarovski - 512GB 12GB RAM + 12GB RAM Boost, Ultrafino, 3 cameras 50MP e tela extreme Amoled 120hz - Cloud Dancer",
      "Smartphone Motorola Edge 60 Fusion 5G - 256GB 16GB (8GB RAM+8GB Ram Boost) 50MP Sony AI Camera IP68 NFC - Rosa",
      "Smartphone Motorola Edge 60 PRO 5G - 256GB 12GB RAM+12GB Ram Boost Tela Quad-Curve moto AI 50MP Sony Camera",
    ];
    const keys = titles.map(key);
    for (const k of keys) expect(k).not.toBeNull();
    expect(new Set(keys).size).toBe(titles.length);
  });

  it("Galaxy S25 FE 128GB × Galaxy S25 128GB", () => {
    const fe = key(
      "Celular Samsung Galaxy S25 Fe 5g, 128gb, 8gb Ram, Câmera Tripla De 50+12+8, Tela Grande De 6.7 Jetblack",
    );
    const s25 = key(
      "Celular Samsung Galaxy S25 5G 128GB, 8GB RAM, Câmera Tripla, Tela 6.2 Azul",
    );
    expect(fe).not.toBeNull();
    expect(s25).not.toBeNull();
    expect(fe).not.toBe(s25);
  });

  it("Galaxy A57 128GB × Galaxy A57 256GB (armazenamento separa)", () => {
    const a = key("Celular Samsung Galaxy A57 5G 128GB, 8GB RAM, Câmera 50MP");
    const b = key("Celular Samsung Galaxy A57 5G 256GB, 8GB RAM, Câmera 50MP");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a).not.toBe(b);
  });

  it('Edge 70 Fusion × edição especial "Fifa World Cup Collection"', () => {
    const normal = key(
      "Smartphone Motorola Edge 70 Fusion 5g - 256gb 24gb (8gb Ram + 16gb Ram Boost), Camera 50mp Sony Lytia 710 - Roxo",
    );
    const fifa = key(
      "Smartphone Motorola Edge 70 Fusion 5g Fifa World Cup Collection - 256gb 24gb (8gb Ram + 16gb Ram Boost), Camera 50mp Sony Lytia 710",
    );
    expect(normal).not.toBeNull();
    expect(fifa).not.toBeNull();
    expect(normal).not.toBe(fifa);
  });
});

describe("K4 — kit/combo de celular continua sem chave", () => {
  const kits: Array<[string, string]> = [
    ["A57 + Watch9", "A57 5G (128GB) Cinza + Watch9 BT 40 mm Grafite Samsung"],
    [
      "Galaxy A57 + Watch8",
      "Galaxy A57 5G (128GB) - Cinza + Galaxy Watch8 BT 40mm - Grafite",
    ],
    [
      "A57 + Ultra2",
      "A57 5G (128Gb) Cinza + Watch Ultra2 47mm Lte Titânio Preto",
    ],
    [
      "Kit Edge 70 Fusion + Moto Buds",
      "Kit Smartphone Motorola Edge 70 Fusion 5g 12 Gb Ram Grafite + Moto Buds 2 Preto",
    ],
    [
      "Kit Edge 70 Pro + Moto Buds",
      "Kit Smartphone Motorola Edge 70 Pro 5g 256gb Azul Escuro + Fone Moto Buds 2 Preto",
    ],
    [
      "Combo Galaxy A57",
      "Combo Samsung Galaxy A57 5G 128GB + Smart Watch9 BT 40 mm",
    ],
  ];
  it.each(kits)("%s → productKey null", (_nome, titulo) => {
    expect(extractOffer(iuri(titulo)).productKey).toBeNull();
  });
});

describe("K5 — celular sem modelo/armazenamento não ganha chave nova de modelo+armazenamento", () => {
  it("sem armazenamento: não compartilha chave com o mesmo modelo com armazenamento", () => {
    const semArmaz = key("Celular Samsung Galaxy A57 5G Cinza");
    const comArmaz = key("Celular Samsung Galaxy A57 5G 128GB");
    expect(comArmaz).not.toBeNull();
    expect(semArmaz).not.toBe(comArmaz);
  });

  it("sem armazenamento: não é igual à chave de outro armazenamento do mesmo modelo", () => {
    const semArmaz = key(
      "Smartphone Motorola Edge 70 Fusion 5G 12GB RAM Branco",
    );
    const a = key(
      "Smartphone Motorola Edge 70 Fusion 5G 256GB 12GB RAM Branco",
    );
    expect(semArmaz).not.toBe(a);
  });
});

describe("K6/P3 — fora de Smartphone nada muda (chave e preço)", () => {
  const casos = [
    {
      categoria: "Monitor",
      texto:
        "🤝 Mercado Livre 🤝\n\n✅ Monitor Portátil 15.6 Fyhxele 1080p Hdr Hdmi Ips\n\n🔗 https://exemplo.com/x\n\n💲 R$ 278,00\n\n🏷 Cupom  DESCONTOMELIMAIS (meli+) ou MENOSHOJE\n\n_#fd60509c_",
      price: 278.0,
      productKey: "w:1080p+15.6+fyhxele+hdmi+hdr+ips+monitor+portatil",
    },
    {
      categoria: "Monitor",
      texto:
        "🛍 Shopee 🛍\n\n✅ Monitor Gamer 27 UltraGear 27G411A-B 144Hz Full HD 1MS MBR G-SYNC FreeSync LG\n\n🔗 https://exemplo.com/x\n\n💲 R$ 603,00\n\n🏷 Cupom https://exemplo.com/x  - sacola laranja app\n\n_#ae9fc647_",
      price: 603.0,
      productKey: "c:27g411a-b",
    },
    {
      categoria: "Processador",
      texto:
        "🥷 Kabum! 🥷\n\n✅ Processador AMD Ryzen 7 7800x3d, 4.2GHz, 5.0GHz Max Turbo, Cache 104MB, Am5, C/ Vídeo E Sem Cooler - 100-100000910wof\n\n🔗 https://exemplo.com/x\n\n💲 R$ 1.879,00\n\n🏷 Cupom CPUNINJA\n\n_#2e488dd2_",
      price: 1879.0,
      productKey: "c:7800x3d",
    },
    {
      categoria: "Processador",
      texto:
        "🇨🇳 AliExpress 🇧🇷\n\n✅ Processador AMD Ryzen 5 5500X3D\n\n🔗 https://exemplo.com/x\n\n💲 R$ 1.049,00\n\n🏷 Cupom LIBRETX55X3D ou AEBR6 ou MEGABR06 ou IFPADZSK + 400 Moedas no APP\n\nlink app: https://exemplo.com/x\n\n_#d436f5d2_",
      price: 1049.0,
      productKey: "c:5500x3d",
    },
    {
      categoria: "Barbear e aparar",
      texto:
        "Aparador De Pelos Philips Oneblade Qp1425/10\n\nDe R$ 226 Por R$ 111 pix 💵\n\ncupom: BELEZASURPRESA 📌\n\nhttps://exemplo.com/x",
      price: 111.0,
      productKey: "c:qp1425",
    },
    {
      categoria: "Barbear e aparar",
      texto:
        "Aparador e Raspador Oneblade Intimate Philips Bivolt\n\nDe R$ 224 Por R$ 135 💵\nCupom: BELEZA 📌\n\nhttps://exemplo.com/x",
      price: 135.0,
      productKey: "w:aparador+bivolt+intimate+oneblade+philips+raspador",
    },
    {
      categoria: "TV",
      texto:
        "A QUALIDADE VISUAL QUE SUAS SÉRIES MERECEM\n\n✅ Smart TV TCL QLED 40 Polegadas\n\n🔥 DE ~2.299,00~ | POR *1.298,60*\n\n🎟️ CUPOM: PROMOZONE100\n\n🔗 https://exemplo.com/x",
      price: 1298.6,
      productKey: "w:40pol+qled+smart+tcl+tv",
    },
    {
      categoria: "TV",
      texto:
        "Smart Tv Tcl 85 Polegadas Qled 4k P7k Wifi Bluetooth Google Tv Hdr10+ Dolby Atmos Dolby Vision 85p7k\n\n💵 R$ 5232 no PIX\n🎟️ Resgate o cupom no anúncio\n\n✅ Link do produto:\nhttps://exemplo.com/x",
      price: 5232.0,
      productKey: "c:85p7k+85pol+qled",
    },
    {
      categoria: "Kit",
      texto:
        "Processador AMD Ryzen 7 7800X3D + Placa-Mâe MSI MAG X870 Tomahawk WiFi\n\n💵  R$ 3095\n🎟  Cupom: 10OFFNOKIT\n✅  https://exemplo.com/x",
      price: 3095.0,
      productKey: null,
    },
    {
      categoria: "Armazenamento",
      texto:
        "Ssd Externo Portátil 1Tb Interface Usb 3.2 SanDisk Sdssde30-1T00 Velocidade de Leitura Até 800Mb/s Preto\n\n💵  R$ 879\n🎟  Cupom: MEUCUPOM\n✅  https://exemplo.com/x",
      price: 879.0,
      productKey: "c:1tb+sdssde30-1t00",
    },
    {
      categoria: "Notebook",
      texto:
        "*ESSE NUNCA FICOU NESSE PREÇO ANTES*\n\n*Notebook ASUS TUF F16, Core i5 210H, RTX 4050, 16GB RAM, 512GB SSD*\n\nDe R$ 8.190 por *R$ 5.983* no Pix \nCupom: *ACHADOSMELI* 🎟️\n\nhttps://exemplo.com/x",
      price: 5983.0,
      productKey: "c:16gb+210h+512gb+f16",
    },
    {
      categoria: "Gabinete",
      texto:
        "Gabinete Gamer Mancer Cv450, Mini-Tower, Lateral de Vidro, Com 9 Fans, Preto, Mcr-Cv4509f-Bk\n\nRESGATE TODOS CUPONS DESSA PAGINA: https://exemplo.com/x\n\n💵  R$ 319\n✅  https://exemplo.com/x\n\n🤑 Grupos de promoções: https://exemplo.com/x",
      price: 319.0,
      productKey: "c:cv450",
    },
    {
      categoria: "Calçados",
      texto:
        "*NIKE DE QUEM ODEIA LAVAR O TÊNIS*\n\n*Tênis Nike Ebernon Low Preto*\n\nDe R$ 699 por *R$ 297* \nCupom: *MODASEMPREML* 🎟️\n\nhttps://exemplo.com/x",
      price: 297.0,
      productKey: "w:ebernon+low+nike+preto+tenis",
    },
    {
      categoria: "Outros",
      texto:
        "*DESPENCOU O PREÇO DO NIKE DE TREINO*\n_Loja Oficial *Nike* no MELI_\n\n*Nike Court Lite 4*\n\nDe R$599 por *R$369* \nCupom: *MAISDESCONTOHOJE* 🎟️\n\nhttps://exemplo.com/x",
      price: 369.0,
      productKey: "w:4+court+lite+nike",
    },
    {
      categoria: "Casa inteligente",
      texto:
        "🔥Amazon Echo Dot Max (Geração mais recente), smart speaker com Alexa, som envolvente e hub de casa inteligente integrado, ideal para sua sala de estar, Cor Grafite, com Acesso Antecipado à Alexa+\n\n✅ Por: R$ 759,00 (à vista)\nou R$ 807,45 em até 12x 💳\n\n🔗 https://exemplo.com/x\n\n*Ofertas limitadas!",
      price: null,
      productKey:
        "w:acesso+alexa+amazon+antecipado+casa+cor+dot+echo+envolvente+estar+geracao+grafite+hub+ideal+integrado+inteligente+mais+max+recente+sala+smart+som+speaker+sua",
    },
  ];

  it.each(casos.map((c) => [c.categoria, c] as const))(
    "%s: preço e productKey inalterados",
    (_cat, c) => {
      const o = extractOffer(c.texto);
      expect(o.category).toBe(c.categoria);
      expect(o.category).not.toBe("Smartphone");
      expect(o.price).toBe(c.price);
      expect(o.productKey).toBe(c.productKey);
    },
  );
});
