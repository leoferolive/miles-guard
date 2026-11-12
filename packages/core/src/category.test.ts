import { describe, expect, it } from 'vitest';

import { classifyProduct, keywordAppliesTo, OTHER_CATEGORY } from './index.js';

describe('classifyProduct (títulos reais)', () => {
  it.each([
    ['AMD Ryzen 5 5500X3D, 4.0GHz Max Turbo, Cache 96MB, AM4, (Novo S/Box)', 'Processador'],
    ['Processador AMD Ryzen 7 7800X3D AM5 (Sem Cooler)', 'Processador'],
    ['RYZEN 5 5500X3D', 'Processador'],
    ['Notebook VAIO FE16 Intel Core i5 8GB RAM 256GB SSD Tela 16” Linux', 'Notebook'],
    ['Samsung Monitor Odyssey OLED G5 27", QHD, 180Hz', 'Monitor'],
    ['Monitor Gamer Pichau Quantum, MiniLED, 27 Pol, IPS, QHD', 'Monitor'],
    ['Smart TV 65" TCL 4K UHD MiniLED 65C6K 120Hz Google TV', 'TV'],
    ['Toshiba Smart Tv MiniLED Qled 4K 55" Polegadas 55M450ss', 'TV'],
    ['Gabinete Gamer Mancer Cv450, Mini-Tower, Lateral de Vidro', 'Gabinete'],
    ['Placa Mãe Asus Tuf Gaming A520m-plus Ii, Amd Am4', 'Placa-mãe'],
    ['Cooler Cpu Thermalright Peerless Assassin 120 Se', 'Cooler'],
    ['Water Cooler Msi Mag Coreliquid A12 360, Argb, Preto', 'Cooler'],
    ['SSD Externo Portátil 1TB Interface USB 3.2 SanDisk SDSSDE30-1T00', 'Armazenamento'],
    ['Aparador de Pelos Philips OneBlade Pente 5 em 1', 'Barbear e aparar'],
    ['2 Lâminas de Reposição Philips OneBlade', 'Barbear e aparar'],
    ['Echo Dot 5ª geração com Alexa', 'Casa inteligente'],
    ['Teclado Sem Fio Mecanico Gamer Attack Shark X87', 'Periféricos'],
    ['Tênis Nike Revolution 7 Masculino', 'Calçados'],
    ['Tênis Masculino Nike Air Max SC', 'Calçados'],
    ['Smartphone Samsung Galaxy A57 5G 256GB', 'Smartphone'],
    ['Celular Samsung A57 128GB', 'Smartphone'],
    ['A57 5G (128Gb) Cinza Samsung', 'Smartphone'],
    ['Motorola Edge 60 Fusion 256GB', 'Smartphone'],
    ['Edge 70 Pro 512GB Azul', 'Smartphone'],
    ['Samsung Galaxy S25 FE 5G 256GB', 'Smartphone'],
    ['Nike Air Max Nuaxis Masculino', 'Calçados'],
    ['Camiseta Dri-fit Nike Bench Press', 'Roupas'],
    ['Mochila Nike Heritage Unissex', 'Bolsas e mochilas'],
    ['Monitor Samsung S24C310 24" Full HD', 'Monitor'],
    ['Placa-mãe Asus Prime A520M-K', 'Placa-mãe'],
  ])('%s → %s', (title, category) => {
    expect(classifyProduct(title)).toBe(category);
  });

  // Revisão do PR #21: menção de compatibilidade/acessório no FIM do título não pode
  // vencer o produto do começo — com restrição, isso cortaria oferta relevante.
  it.each([
    ['SSD Kingston A400 480GB SATA para Desktop e Notebook', 'Armazenamento'],
    ['SSD Externo SanDisk 1TB compatível com iPhone e celular', 'Armazenamento'],
    ['HD Externo Seagate 2TB compatível com PS5 e Smart TV', 'Armazenamento'],
    ['Monitor Gamer Xiaomi Redmi G Pro 27" MiniLED', 'Monitor'],
    ['Monitor Samsung Odyssey OLED G6 27" ideal para PC e Notebook', 'Monitor'],
    ['Aparador Philips OneBlade 360 com Bolsa', 'Barbear e aparar'],
    ['Aparador Philips OneBlade 360 com Necessaire', 'Barbear e aparar'],
    ['Echo Dot 5ª geração com Alexa, controle sua TV', 'Casa inteligente'],
    ['Processador Ryzen 7 5700X3D, AM4, sem cooler e sem gabinete', 'Processador'],
    ['Cooler para Processador DeepCool AK400', 'Cooler'],
    ['Water Cooler MSI 240mm AM5 Ryzen', 'Cooler'],
    ['Processador Ryzen 5 3400G with Radeon RX Vega', 'Processador'],
    ['Samsung Smart Monitor M7 32" 4K com Smart TV', 'Monitor'],
  ])('produto principal vence menção: %s → %s', (title, category) => {
    expect(classifyProduct(title)).toBe(category);
  });

  it('kit: produtos de categorias diferentes juntos', () => {
    expect(classifyProduct('Processador AMD Ryzen 7 7800X3D + Placa-Mâe MSI MAG X870 Tomahawk')).toBe('Kit');
    expect(classifyProduct('Kit Upgrade Ryzen 5 5600')).toBe('Kit');
  });

  it('"Face + Body" não é kit', () => {
    expect(classifyProduct('Philips OneBlade QP2834 Face + Body')).toBe('Barbear e aparar');
  });

  it('sem título ou sem regra → Outros', () => {
    expect(classifyProduct(null)).toBe(OTHER_CATEGORY);
    expect(classifyProduct('Processadores OEM Novos LibreTx')).toBe(OTHER_CATEGORY);
  });
});

describe('keywordAppliesTo', () => {
  const x3dSoProcessador = { term: 'x3d', categories: ['Processador', 'Kit'] };

  it('sem restrição vale para tudo', () => {
    expect(keywordAppliesTo({ term: 'x3d', categories: [] }, 'Gabinete')).toBe(true);
  });

  it('restrita: vale na categoria listada e corta as outras', () => {
    expect(keywordAppliesTo(x3dSoProcessador, 'Processador')).toBe(true);
    expect(keywordAppliesTo(x3dSoProcessador, 'Gabinete')).toBe(false);
  });

  it('categoria desconhecida (Outros) passa: na dúvida, avisa', () => {
    expect(keywordAppliesTo(x3dSoProcessador, OTHER_CATEGORY)).toBe(true);
  });

  it('Kit passa: um combo pode conter o produto ("TV MiniLED + Soundbar")', () => {
    expect(keywordAppliesTo({ term: 'miniled', categories: ['TV', 'Monitor'] }, 'Kit')).toBe(true);
    expect(classifyProduct('Samsung Smart Tv 65" MiniLED 4K M75h + Soundbar Samsung Hw-B400f Combo')).toBe('Kit');
  });
});
