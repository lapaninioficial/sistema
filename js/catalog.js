'use strict';

/* =====================================================================
   La Panini — catálogo completo (versão protótipo).
   Cada produto tem: id (usado como nome do arquivo de imagem em
   assets/img/<id>.jpg), categoria, preço base, descrição curta e longa,
   ingredientes (com remoção opcional com abatimento), grupo de adicionais,
   tamanhos e marcas.
   ===================================================================== */

function P(id, cat, name, base, desc, long, extra) {
  return Object.assign({
    id: id, cat: cat, name: name, base: base, desc: desc, long: long,
    old: null, sizes: SIZE_SAVORY, type: 'reg',
    addonGroup: 'salgado', ingredients: [], tags: [], obsNote: '',
    encomenda: false, freteGratis: false, badge: '', min: 0, maxPerFlavor: 0,
    pool: [], sizeLabel: '', discount: 0, time: '25–35 min de forno'
  }, extra || {});
}

var PRODUCTS = [

  /* ==================== Seleções Especiais Fechadas ==================== */

  P('mesa-farta', 'selecoes-fechadas', 'Mesa Farta', 356.90,
    '4 Lasanhas de 1,5kg Congeladas',
    'São 4 sabores diferentes, cada um servindo até 3 pessoas com conforto: Bolonhesa com molho vermelho, Frango com requeijão, Carne de panela com molho madeira e champignon, 5 queijos com gorgonzola. Prontas para ir do freezer ao forno, mantendo textura e padrão em cada porção.',
    { type: 'kit', old: 405.60, freteGratis: true, badge: '−12% OFF',
      sizes: SIZE_KIT, sizeLabel: '4 unidades de 1,5kg',
      comp: ['Bolonhesa com molho vermelho', 'Frango com requeijão', 'Carne de panela com molho madeira e champignon', '5 queijos com gorgonzola'],
      obsNote: 'Seleção fechada (1 unidade de cada sabor). Desconto automático, não cumulativo com cupons. Não válido para cartão alimentação/refeição. Oferta por tempo limitado e sujeita à disponibilidade.' }),

  P('experiencia-mesa', 'selecoes-fechadas', 'Experiência à Mesa', 256.15,
    '4 lasanhas de 1kg + 10% OFF',
    'São 4 sabores diferentes, prontos para ir do freezer ao forno: Presunto e queijo com molho branco, Frango com requeijão, Bolonhesa com molho branco e Carne de panela com molho madeira e champignon.',
    { type: 'kit', old: 284.60, badge: '−10% OFF', sizes: SIZE_KIT, sizeLabel: '4 unidades de 1kg',
      comp: ['Presunto e queijo com molho branco', 'Frango com requeijão', 'Bolonhesa com molho branco', 'Carne de panela com molho madeira e champignon'],
      obsNote: 'Seleção fechada (1 unidade de cada sabor). Desconto automático, não cumulativo com cupons. Não válido para VR/VA. Aceitamos PIX, crédito, débito e dinheiro. Oferta por tempo limitado e sujeita à disponibilidade.' }),

  P('curadoria-casa', 'selecoes-fechadas', 'Curadoria da Casa', 179.00,
    '5 lasanhas individuais de 500g + 7% OFF.',
    'São 5 sabores diferentes, prontos para ir do freezer ao forno: Bolonhesa com molho vermelho, 5 Queijos com gorgonzola, Frango com molho branco, Carne de panela com gorgonzola e Presunto com molho branco. Prontas para ir do freezer ao forno, mantendo textura, sabor e padrão. Cada unidade serve 1 pessoa.',
    { type: 'kit', old: 192.50, badge: '−7% OFF', sizes: SIZE_KIT, sizeLabel: '5 unidades de 500g',
      comp: ['Bolonhesa com molho vermelho', '5 Queijos com gorgonzola', 'Frango com molho branco', 'Carne de panela com gorgonzola', 'Presunto com molho branco'],
      obsNote: 'Seleção fechada (1 unidade de cada sabor). Desconto automático, não cumulativo com cupons. Não válido para VR/VA. Oferta por tempo limitado e sujeita à disponibilidade.' }),

  /* ==================== Seleções Personalizadas ==================== */

  P('selecao-generosa', 'selecoes-personalizadas', 'Seleção Generosa – 1,5kg', 242.73,
    'Monte seu kit de lasanhas de 1,5kg + 10% OFF.',
    'Escolha os sabores que preferir e componha sua própria seleção. Pensada para servir com tranquilidade, dividir à mesa e manter a semana organizada com mais previsibilidade.',
    { type: 'selection', min: 3, maxPerFlavor: 2, discount: 0.10, sizeLabel: '1,5kg',
      obsNote: 'OBS: Mínimo de 3 unidades. Até 2 unidades por sabor. Desconto automático, não cumulativo com cupons.',
      pool: ['cogumelos', 'queijos-gorgonzola', 'gorgonzola-bacon', 'bolonhesa-branca', 'bolonhesa-vermelha', 'brocolis-bacon-cream-cheese', 'brocolis-cream-cheese', 'carne-madeira', 'carne-gorgonzola', 'file-mignon', 'frango-branca', 'frango-vermelha', 'frango-requeijao', 'presunto-branca', 'presunto-vermelha'] }),

  P('selecao-compartilhar', 'selecoes-personalizadas', 'Seleção Compartilhar', 215.40,
    'Monte seu kit de lasanhas de 1kg + 7% OFF.',
    'Escolha os sabores que preferir e componha sua própria seleção. Pensada para dividir à mesa ou organizar a semana com mais previsibilidade e variedade.',
    { type: 'selection', min: 4, maxPerFlavor: 2, discount: 0.07, sizeLabel: '1kg',
      obsNote: 'Mínimo de 4 unidades. Até 2 unidades por sabor. Desconto automático, não cumulativo com cupons.',
      pool: ['bolonhesa-branca', 'bolonhesa-vermelha', 'brocolis-cream-cheese', 'frango-branca', 'frango-vermelha', 'presunto-branca', 'presunto-vermelha'] }),

  P('selecao-essencial', 'selecoes-personalizadas', 'Seleção Essencial', 163.90,
    'Monte seu kit de lasanhas individuais de 500g + 5% OFF.',
    'Escolha os sabores que preferir e componha sua própria seleção. Ideal para organizar a rotina com variedade e manter o freezer bem resolvido.',
    { type: 'selection', min: 5, maxPerFlavor: 2, discount: 0.05, sizeLabel: '500g',
      obsNote: 'Mínimo de 5 unidades. Até 2 unidades por sabor. Desconto automático, não cumulativo com cupons.',
      pool: ['bolonhesa-branca', 'bolonhesa-vermelha', 'brocolis-cream-cheese', 'frango-branca', 'frango-vermelha', 'presunto-branca', 'presunto-vermelha'] }),

  /* ==================== Lasanhas Sabores Clássicos ==================== */

  P('bolonhesa-branca', 'classicos', 'Bolonhesa com Molho Branco', 38.90,
    'Carne bovina moída, pomarola e especiarias ao molho branco.',
    'Lasanha caseira de carne bovina moída salteada com cebolinha na manteiga, molho pomarola da casa e especiarias como orégano, manjericão, tomilho e manjerona. Montada com massa fresca, queijo muçarela e molho branco.',
    { tags: ['Clássico'], ingredients: [
      { label: 'Carne bovina moída' }, { label: 'Molho pomarola da casa' },
      { label: 'Massa fresca' }, { label: 'Muçarela premium', rem: -2.90 },
      { label: 'Molho branco da casa', rem: -2.40 } ] }),

  P('bolonhesa-vermelha', 'classicos', 'Bolonhesa com Molho Vermelho', 38.90,
    'Carne bovina moída no molho de tomate caseiro.',
    'Lasanha caseira de carne bovina moída salteada com cebolinha na manteiga e molho pomarola da casa. Montada com massa fresca, queijo muçarela e molho de tomate caseiro. Ideal para quem não gosta de molho branco.',
    { tags: ['Clássico'], ingredients: [
      { label: 'Carne bovina moída' }, { label: 'Molho pomarola da casa' },
      { label: 'Massa fresca' }, { label: 'Muçarela premium', rem: -2.90 },
      { label: 'Molho de tomate caseiro' } ] }),

  P('brocolis-cream-cheese', 'classicos', 'Brócolis com Cream Cheese', 36.90,
    'Brócolis fresco com cream cheese e molho branco.',
    'Lasanha vegetariana nada clássica onde a estrela é o brócolis com cream cheese. Brócolis fresco, misturado ao creme secreto. Montada com massa fresca, brócolis, queijo muçarela e molho branco da casa.',
    { tags: ['Vegetariana'], ingredients: [
      { label: 'Brócolis fresco' }, { label: 'Creme secreto' },
      { label: 'Massa fresca' }, { label: 'Muçarela premium', rem: -2.90 },
      { label: 'Molho branco da casa', rem: -2.40 } ] }),

  P('brocolis-bacon-cream-cheese', 'classicos', 'Brócolis com Bacon e Cream Cheese', 36.90,
    'Brócolis fresco, bacon crocante e cream cheese.',
    'Lasanha nada clássica onde a estrela é o brócolis com cream cheese e bacon crocante. Brócolis fresco cozido e picado, misturado ao creme secreto, com o defumado do bacon. Montada com massa fresca, brócolis com cream cheese, bacon crocante, queijo muçarela e molho branco.',
    { tags: ['Clássico'], ingredients: [
      { label: 'Brócolis fresco' }, { label: 'Bacon crocante', rem: -4.50 },
      { label: 'Creme secreto' }, { label: 'Massa fresca' },
      { label: 'Muçarela premium', rem: -2.90 },
      { label: 'Molho branco da casa', rem: -2.40 } ] }),

  P('frango-branca', 'classicos', 'Frango com Molho Branco', 36.90,
    'Frango desfiado temperado ao molho branco.',
    'Lasanha caseira de frango desfiado com molho vermelho, feito com especiarias, alho, cebola e tomate italiano. Na montagem usamos massa fresca, queijo muçarela premium e molho branco.',
    { tags: ['Clássico'], ingredients: [
      { label: 'Frango desfiado' }, { label: 'Tomate italiano' },
      { label: 'Massa fresca' }, { label: 'Muçarela premium', rem: -2.90 },
      { label: 'Molho branco da casa', rem: -2.40 } ] }),

  P('frango-vermelha', 'classicos', 'Frango com Molho Vermelho', 36.90,
    'Frango desfiado no molho de tomate caseiro.',
    'Lasanha caseira de frango desfiado com molho de tomate caseiro. Montada com massa fresca, queijo muçarela e mais molho de tomate. Ideal para quem não gosta de molho branco.',
    { tags: ['Clássico'], ingredients: [
      { label: 'Frango desfiado' }, { label: 'Massa fresca' },
      { label: 'Muçarela premium', rem: -2.90 }, { label: 'Molho de tomate caseiro' } ] }),

  P('presunto-branca', 'classicos', 'Presunto e Queijo com Molho Branco', 33.90,
    'Presunto premium com molho branco da casa.',
    'Uma lasanha bem brasileira, assim é a lasanha de presunto e queijo da La Panini. O diferencial está na escolha do presunto premium. Montada com massa fresca, presunto, queijo e molho branco.',
    { tags: ['Clássico'], ingredients: [
      { label: 'Presunto premium' }, { label: 'Massa fresca' },
      { label: 'Queijo muçarela', rem: -2.90 }, { label: 'Molho branco da casa', rem: -2.40 } ] }),

  P('presunto-vermelha', 'classicos', 'Presunto e Queijo com Molho Vermelho', 33.90,
    'Presunto premium no molho vermelho.',
    'Uma versão bem brasileira para quem não gosta de molho branco: lasanha de presunto com molho vermelho. O diferencial está no presunto premium. Montada com massa fresca, presunto, queijo e molho vermelho.',
    { tags: ['Clássico'], ingredients: [
      { label: 'Presunto premium' }, { label: 'Massa fresca' },
      { label: 'Queijo muçarela', rem: -2.90 }, { label: 'Molho vermelho' } ] }),

  /* ==================== Lasanhas Sabores Deluxe ==================== */

  P('queijos-gorgonzola', 'deluxe', 'Queijos com Gorgonzola', 37.90,
    'Muçarela, provolone, parmesão e gorgonzola.',
    'Lasanha perfeita para amantes de queijo. A receita autoral leva muçarela, provolone e parmesão. Na montagem, usamos molho branco caseiro, creme especial de cream cheese, requeijão e molho bechamel.',
    { tags: ['Deluxe'], ingredients: [
      { label: 'Gorgonzola' }, { label: 'Muçarela' }, { label: 'Provolone' },
      { label: 'Parmesão' }, { label: 'Massa fresca' }, { label: 'Molho bechamel', rem: -2.40 } ] }),

  P('gorgonzola-bacon', 'deluxe', 'Queijos Gorgonzola e Bacon', 37.90,
    'Queijos e bacon crocante. Para quem quer mais.',
    'Lasanha perfeita para amantes de queijo e bacon! Receita autoral com muçarela, provolone, parmesão e bacon crocante. Montada com molho branco caseiro, cream cheese, requeijão e molho bechamel.',
    { tags: ['Deluxe'], ingredients: [
      { label: 'Gorgonzola' }, { label: 'Muçarela' }, { label: 'Provolone' },
      { label: 'Bacon crocante', rem: -4.50 }, { label: 'Massa fresca' }, { label: 'Molho bechamel', rem: -2.40 } ] }),

  P('carne-madeira', 'deluxe', 'Carne de Panela ao Molho Madeira', 41.90,
    'Carne desfiada, madeira e champignon.',
    'A lasanha de carne de panela é um sucesso na La Panini. Carne temperada com especiarias, cozida até desfiar, com molho madeira especial. Montada com molho branco, queijo muçarela e champignon.',
    { tags: ['Deluxe'], ingredients: [
      { label: 'Carne de panela desfiada' }, { label: 'Molho madeira' },
      { label: 'Champignon' }, { label: 'Massa fresca' }, { label: 'Muçarela premium', rem: -2.90 } ] }),

  P('frango-requeijao', 'deluxe', 'Frango com Requeijão', 37.90,
    'Frango cremoso com o toque do requeijão.',
    'Quer uma lasanha mais cremosa? A de frango com requeijão une o molho vermelho, a suavidade do molho branco e a cremosidade do requeijão. Montada com massa fresca, queijo muçarela e molho branco.',
    { tags: ['Deluxe'], ingredients: [
      { label: 'Frango desfiado' }, { label: 'Requeijão' }, { label: 'Molho vermelho' },
      { label: 'Queijo muçarela', rem: -2.90 }, { label: 'Molho branco da casa', rem: -2.40 } ] }),

  /* ==================== Lasanhas Sabores Especiais ==================== */

  P('cogumelos', 'especiais', 'Cogumelos', 46.90,
    'Shitake, shimeji e paris em molho especial.',
    'Uma deliciosa mistura de cogumelos: shitake, shimeji e paris. Tudo em um único produto com um molho caseiro especial. Na montagem, usamos massa fresca, muçarela, molho especial de cogumelos e molho branco.',
    { tags: ['Especial'], ingredients: [
      { label: 'Shitake' }, { label: 'Shimeji' }, { label: 'Paris' },
      { label: 'Molho especial de cogumelos' }, { label: 'Massa fresca' }, { label: 'Muçarela premium', rem: -2.90 } ] }),

  P('carne-gorgonzola', 'especiais', 'Carne de Panela com Gorgonzola', 44.90,
    'Madeira, champignon e um toque de gorgonzola.',
    'Lasanha de carne de panela ao molho madeira, champignons e um toque de queijo gorgonzola. A junção de duas favoritas da casa. Montada com massa fresca, carne de panela, gorgonzola, champignon, muçarela e molho branco.',
    { tags: ['Especial'], ingredients: [
      { label: 'Carne de panela' }, { label: 'Molho madeira' },
      { label: 'Gorgonzola', rem: -3.50 }, { label: 'Champignon' },
      { label: 'Massa fresca' }, { label: 'Muçarela premium', rem: -2.90 } ] }),

  P('file-mignon', 'especiais', 'Filé Mignon aos 4 Queijos', 54.90,
    'Filé mignon com gorgonzola, provolone, parmesão e muçarela.',
    'Lasanha de Filé Mignon com 4 queijos: gorgonzola, provolone, parmesão e muçarela. Tempero especial no filé e uma mistura de sabores sensacionais. Sabor inconfundível. Receita 100% autoral.',
    { tags: ['Premium', 'Especial'], ingredients: [
      { label: 'Filé mignon' }, { label: 'Gorgonzola' }, { label: 'Provolone' },
      { label: 'Parmesão' }, { label: 'Massa fresca' }, { label: 'Muçarela', rem: -2.90 } ] }),

  /* ==================== Lasanhas Low Carb ==================== */

  P('abobrinha-frango', 'lowcarb', 'Abobrinha com Frango Cremoso', 39.90,
    'Massa trocada por abobrinha, recheio de frango cremoso.',
    'Lasanha Low Carb. A massa tradicional é substituída por abobrinha, com recheio de frango cremoso e queijo muçarela, e cobertura de queijo parmesão. Uma opção leve e deliciosa para sua dieta.',
    { tags: ['Low Carb', 'Light'], ingredients: [
      { label: 'Abobrinha' }, { label: 'Frango cremoso' },
      { label: 'Queijo muçarela', rem: -2.90 }, { label: 'Parmesão' } ] }),

  /* ==================== Frutos do Mar ==================== */

  P('camarao-branco', 'frutosdormar', 'Camarão com Molho Branco', 119.90,
    'Camarão graúdo premium no molho branco da casa.',
    'Lasanha de camarão com molho branco da casa, generosa dose de queijo muçarela e massa fresca. O camarão é graúdo e premium, cuidadosamente limpo e passado na frigideira, criando uma combinação deliciosa e única.',
    { tags: ['Premium'], ingredients: [
      { label: 'Camarão graúdo' }, { label: 'Molho branco da casa' },
      { label: 'Queijo muçarela', rem: -2.90 }, { label: 'Massa fresca' } ] }),

  P('bacalhau', 'frutosdormar', 'Bacalhau com Molho Branco', 119.90,
    'Bacalhau desfiado e temperado com ervas.',
    'Lasanha de bacalhau com molho misto (branco e vermelho), generosa dose de queijo muçarela e massa fresca. O bacalhau é desfiado e temperado com ervas, criando uma combinação deliciosa e única.',
    { tags: ['Premium'], ingredients: [
      { label: 'Bacalhau desfiado' }, { label: 'Ervas frescas' },
      { label: 'Molho misto' }, { label: 'Queijo muçarela', rem: -2.90 }, { label: 'Massa fresca' } ] }),

  /* ==================== Lasanhas Mini (Eventos) ==================== */

  P('mini-bolonhesa', 'doces', 'Kit Mini Bolonhesa', 179.00,
    '25 unidades de 300g. Perfeita para eventos.',
    'Lasanha mini de bolonhesa, kit com 25 unidades de 300g. Ideal para festas, aniversários e eventos. Forno rápido, sabor garantido.',
    { sizes: SIZE_DRINK, addonGroup: '', tags: ['300g', 'Evento'], time: '15 min de forno',
      ingredients: [{ label: 'Carne moída' }, { label: 'Molho branco' }, { label: 'Massa fresca' }] }),

  P('mini-frango', 'doces', 'Kit Mini Frango com Requeijão', 179.00,
    '25 unidades de 300g. Para eventos e festas.',
    'Lasanha mini de frango com requeijão, kit com 25 unidades de 300g. Perfeita para buffets e celebrações.',
    { sizes: SIZE_DRINK, addonGroup: '', tags: ['300g', 'Evento'], time: '15 min de forno',
      ingredients: [{ label: 'Frango desfiado' }, { label: 'Requeijão' }, { label: 'Massa fresca' }] }),

  P('mini-queijos', 'doces', 'Kit Mini 5 Queijos', 179.00,
    '25 unidades de 300g. Favorita dos convidados.',
    'Lasanha mini de 5 queijos, kit com 25 unidades de 300g. Gorgonzola, muçarela, provolone, parmesão e cream cheese.',
    { sizes: SIZE_DRINK, addonGroup: '', tags: ['300g', 'Evento', 'Premium'], time: '15 min de forno',
      ingredients: [{ label: 'Gorgonzola' }, { label: 'Muçarela' }, { label: 'Provolone' }, { label: 'Parmesão' }, { label: 'Massa fresca' }] }),

  P('mini-vegetariana', 'doces', 'Kit Mini Vegetariana', 179.00,
    '25 unidades de 300g. Leve e saborosa.',
    'Lasanha mini vegetariana com legumes grelhados e molho pesto, kit com 25 unidades de 300g.',
    { sizes: SIZE_DRINK, addonGroup: '', tags: ['300g', 'Evento', 'Vegetariana'], time: '15 min de forno',
      ingredients: [{ label: 'Legumes grelhados' }, { label: 'Molho pesto' }, { label: 'Massa fresca' }] }),

  P('mini-file', 'doces', 'Kit Mini Filé aos 4 Queijos', 179.00,
    '25 unidades de 300g. Para eventos sofisticados.',
    'Lasanha mini de filé mignon aos 4 queijos, kit com 25 unidades de 300g. Premium para ocasiões especiais.',
    { sizes: SIZE_DRINK, addonGroup: '', tags: ['300g', 'Evento', 'Premium'], time: '20 min de forno',
      ingredients: [{ label: 'Filé mignon' }, { label: 'Gorgonzola' }, { label: 'Muçarela' }, { label: 'Massa fresca' }] }),

  /* ==================== Sobremesas Variadas ==================== */

  P('torta-alfajor', 'sobremesas', 'Torta Alfajor na Fatia', 24.90,
    'Camadas generosas de doce de leite com textura de alfajor.',
    'Camadas generosas de doce de leite com a textura inconfundível do alfajor. Para quem gosta de sobremesa que impressiona sem complicar.',
    { sizes: [{ id: 'u', label: 'Fatia · 1 porção', factor: 1 }], addonGroup: 'doce', tags: ['Fatia'], ingredients: [
      { label: 'Doce de leite' }, { label: 'Chocolate' }, { label: 'Base crocante' } ] }),

  P('chaja', 'sobremesas', 'Torta Chajá', 25.90,
    'Leve, cremosa, com equilíbrio entre doce e delicado.',
    'Leve, cremosa e com aquele equilíbrio perfeito entre doce e delicado. Uma sobremesa sofisticada que some rápido da mesa.',
    { sizes: [{ id: 'u', label: 'Fatia · 1 porção', factor: 1 }], addonGroup: 'doce', tags: ['Fatia'], ingredients: [
      { label: 'Pão de ló' }, { label: 'Creme' }, { label: 'Pêssego em calda' } ] }),

  P('choc-belga', 'sobremesas', 'Torta de Chocolate Belga', 25.90,
    'Chocolate intenso e aveludado.',
    'Chocolate de verdade, intenso e aveludado. Para os momentos em que só uma sobremesa à altura resolve.',
    { sizes: [{ id: 'u', label: 'Fatia · 1 porção', factor: 1 }], addonGroup: 'doce', tags: ['Fatia'], ingredients: [
      { label: 'Chocolate belga' }, { label: 'Creme' }, { label: 'Cacau' } ] }),

  P('sorvete-alfajor', 'sobremesas', 'Torta de Sorvete Alfajor', 29.90,
    'O frescor do sorvete com o sabor clássico do alfajor.',
    'O frescor do sorvete com o sabor clássico do alfajor. Cremosa, gelada e irresistível, especialmente nos dias quentes.',
    { sizes: [{ id: 'u', label: 'Fatia · gelada', factor: 1 }], addonGroup: 'doce', tags: ['Gelada'], ingredients: [
      { label: 'Sorvete' }, { label: 'Doce de leite' }, { label: 'Chocolate' } ] }),

  P('pudim-tradicional', 'sobremesas', 'Pudim Tradicional da Casa', 9.90,
    'Textura firme e calda generosa. O pudim de sempre.',
    'Feito com cuidado, textura firme e calda generosa. O pudim de sempre, do jeito que tem que ser.',
    { sizes: [{ id: 'u', label: '100g · 1 porção', factor: 1 }], addonGroup: 'doce', tags: ['100g'], ingredients: [
      { label: 'Leite condensado' }, { label: 'Ovos' }, { label: 'Calda de caramelo' } ] }),

  P('pudim-tradicional-380g', 'sobremesas', 'Pudim Tradicional da Casa Família', 27.90,
    'Textura firme e calda generosa. O pudim de sempre.',
    'Feito com cuidado, textura firme e calda generosa. O pudim de sempre, do jeito que tem que ser.',
    { sizes: [{ id: 'u', label: '380g · 4 porções', factor: 1 }], addonGroup: 'doce', tags: ['380g'], ingredients: [
      { label: 'Leite condensado' }, { label: 'Ovos' }, { label: 'Calda de caramelo' } ] }),

  P('pudim-coco', 'sobremesas', 'Pudim de Coco', 13.90,
    'Cremoso, aromático, com o sabor de coco que reconforta.',
    'Cremoso, aromático e com aquele sabor de coco que reconforta. Simples e delicioso do primeiro ao último pedaço.',
    { sizes: [{ id: 'u', label: '130g · 1 porção', factor: 1 }], addonGroup: 'doce', tags: ['130g'], ingredients: [
      { label: 'Leite condensado' }, { label: 'Coco' }, { label: 'Calda de caramelo' } ] }),

  P('pudim-cafe', 'sobremesas', 'Pudim de Café', 13.90,
    'Para os apaixonados por café. Intenso e sofisticado.',
    'Para os apaixonados por café: o sabor marcante que você ama em formato de sobremesa. Intenso e sofisticado.',
    { sizes: [{ id: 'u', label: '130g · 1 porção', factor: 1 }], addonGroup: 'doce', tags: ['130g'], ingredients: [
      { label: 'Leite condensado' }, { label: 'Café' }, { label: 'Calda de caramelo' } ] }),

  P('pudim-doce-leite', 'sobremesas', 'Pudim de Doce de Leite', 13.90,
    'Macio, encorpado e com doce de leite em cada garfada.',
    'Macio, encorpado e com doce de leite em cada garfada. Difícil comer só um.',
    { sizes: [{ id: 'u', label: '130g · 1 porção', factor: 1 }], addonGroup: 'doce', tags: ['130g'], ingredients: [
      { label: 'Leite condensado' }, { label: 'Doce de leite' }, { label: 'Calda de caramelo' } ] }),

  /* ==================== Os Mais Pedidos ==================== */

  P('pudim-leite-moca-familia', 'mais-pedidos', 'Pudim de Leite Moça Tradicional - Tamanho Família', 84.90,
    'O clássico da casa no tamanho para dividir.',
    'Pudim de Leite Moça tradicional em tamanho família. Textura firme e calda generosa para a mesa toda.',
    { sizes: [{ id: 'u', label: 'Tamanho Família', factor: 1 }], addonGroup: 'doce', tags: ['Família'], ingredients: [
      { label: 'Leite Moça' }, { label: 'Ovos' }, { label: 'Calda de caramelo' } ] }),

  P('pudim-leite-moca-individual', 'mais-pedidos', 'Pudim de Leite Moça Tradicional - Individual', 14.90,
    'O clássico em porção individual.',
    'Pudim de Leite Moça tradicional em porção individual. A medida certa da vontade.',
    { sizes: [{ id: 'u', label: 'Individual · 1 porção', factor: 1 }], addonGroup: 'doce', tags: ['Individual'], ingredients: [
      { label: 'Leite Moça' }, { label: 'Ovos' }, { label: 'Calda de caramelo' } ] }),

  P('pudim-leite-moca-medio-550g', 'mais-pedidos', 'Pudim de Leite Moça Tradicional - Tamanho Médio (550g)', 49.90,
    'O clássico no tamanho médio de 550g.',
    'Pudim de Leite Moça tradicional, 550g. Equilíbrio perfeito entre vontade e partilha.',
    { sizes: [{ id: 'u', label: '550g · Médio', factor: 1 }], addonGroup: 'doce', tags: ['550g'], ingredients: [
      { label: 'Leite Moça' }, { label: 'Ovos' }, { label: 'Calda de caramelo' } ] }),

  P('pudim-geladinho-gourmet', 'mais-pedidos', 'Geladinho Gourmet de Pudim de Leite Moça', 12.90,
    'Refrescância cremosa de pudim.',
    'Geladinho gourmet de pudim de Leite Moça. Cremoso e gelado na medida.',
    { sizes: [{ id: 'u', label: 'Unidade · geladinho', factor: 1 }], addonGroup: 'doce', tags: ['Geladinho'], ingredients: [
      { label: 'Leite Moça' }, { label: 'Leite' } ] }),

  P('pudim-laka-granule', 'mais-pedidos', 'Pudim de Laka com Granulê (Brigadeirão Branco)', 16.90,
    'Brigadeirão branco com granulê.',
    'Pudim de Laka com granulê, o brigadeirão branco cremoso com cobertura crocante.',
    { sizes: [{ id: 'u', label: 'Unidade · com granulê', factor: 1 }], addonGroup: 'doce', tags: ['Brigadeirão'], ingredients: [
      { label: 'Chocolate Laka' }, { label: 'Leite Moça' }, { label: 'Granulê' } ] }),

  /* ==================== Promoção do Dia! ==================== */

  P('pudim-combo-tradicional-geladinho', 'promocao-do-dia', 'Combo Pudim Tradicional + Geladinho', 89.90,
    '1 Pudim Família Tradicional + 1 geladinho sabor variado conforme disponibilidade na loja.',
    'Combo com 1 Pudim Família Tradicional e 1 geladinho de sabor variado, conforme disponibilidade na loja.',
    { old: 97.80, badge: '−8% OFF', sizes: [{ id: 'u', label: 'Combo', factor: 1 }], addonGroup: 'doce', tags: ['Combo'], ingredients: [
      { label: 'Pudim família tradicional' }, { label: 'Geladinho' } ] }),

  P('pudim-combo-5-geladinhos', 'promocao-do-dia', 'Combo com 5 Geladinhos com Desconto!', 59.90,
    '5 geladinhos conforme sabores disponíveis no dia! Com desconto especial!',
    'Combo com 5 geladinhos nos sabores disponíveis no dia, com desconto especial aplicado.',
    { old: 64.50, badge: '−7% OFF', sizes: [{ id: 'u', label: '5 unidades', factor: 1 }], addonGroup: 'doce', tags: ['Combo'], ingredients: [
      { label: 'Geladinhos sortidos' } ] }),

  P('pudim-kit-caixa-4', 'promocao-do-dia', 'Kit Caixa Presenteável com 4 Pudins Individuais', 59.90,
    '4 pudins sortidos conforme disponibilidade do dia.',
    'Kit em caixa presenteável com 4 pudins individuais sortidos, conforme disponibilidade do dia.',
    { sizes: [{ id: 'u', label: 'Caixa com 4', factor: 1 }], addonGroup: 'doce', tags: ['Presenteável'], ingredients: [
      { label: 'Pudins individuais sortidos' } ] }),

  /* ==================== Top Mais Vendidos! ==================== */

  P('pudim-premium-tradicional-individual', 'top-mais-vendidos', 'Pudim Tradicional de Leite Moça - Individual', 14.90,
    'O melhor pudim da vida! Macio, cremoso e lisinho.',
    'Nosso inconfundível Pudim Premium Gourmet 130g feito com puro Leite Moça! Macio e cremoso! O mais vendido, lisinho e saboroso... Vale a pena cada colherada! Assado em forno lento e baixo. Enviado em embalagem descartável, você desenforma em casa de maneira fácil e prática!',
    { badge: 'O mais queridinho', sizes: [{ id: 'u', label: '130g · Individual', factor: 1 }], addonGroup: 'doce', tags: ['130g'], ingredients: [
      { label: 'Leite Moça' }, { label: 'Ovos' }, { label: 'Calda de caramelo' } ] }),

  P('pudim-premium-doce-leite-individual', 'top-mais-vendidos', 'Pudim de Doce de Leite - Individual', 14.90,
    'Com Doce de Leite Mineiro, o melhor de Minas Gerais.',
    'Pudim Premium Gourmet 130g feito com puro Leite Moça + Doce de Leite Mineiro! Macio e cremoso, sabor sem igual! Assado em forno lento e baixo. Tamanho individual em embalagem descartável.',
    { sizes: [{ id: 'u', label: '130g · Individual', factor: 1 }], addonGroup: 'doce', tags: ['130g'], ingredients: [
      { label: 'Leite Moça' }, { label: 'Doce de leite mineiro' } ] }),

  P('pudim-premium-brigadeiro-individual', 'top-mais-vendidos', 'Pudim de Brigadeiro Gourmet - Individual', 16.90,
    'O brigadeirão viciante, top 2 mais vendidos.',
    'Pudim Premium Gourmet 130g feito com puro Leite Moça + chocolate nobre! Cobertura de granulê ao leite. Macio e cremoso, doce na medida certa! Assado em forno lento e baixo. Tamanho individual em embalagem descartável.',
    { sizes: [{ id: 'u', label: '130g · Individual', factor: 1 }], addonGroup: 'doce', tags: ['130g'], ingredients: [
      { label: 'Leite Moça' }, { label: 'Chocolate nobre' }, { label: 'Granulê ao leite' } ] }),

  P('pudim-premium-cheesecake-individual', 'top-mais-vendidos', 'Pudim de Cream Cheese com Frutas Vermelhas (Cheesecake) - Individual', 16.90,
    'Uma experiência gastronômica, top 3 mais vendidos.',
    'Pudim Premium Gourmet 130g feito com puro Leite Moça + Cream Cheese com calda de frutas vermelhas artesanal! Uma mistura de sabores que vai surpreender o seu paladar! Assado em forno lento e baixo. Tamanho individual em embalagem descartável.',
    { sizes: [{ id: 'u', label: '130g · Individual', factor: 1 }], addonGroup: 'doce', tags: ['130g'], ingredients: [
      { label: 'Leite Moça' }, { label: 'Cream cheese' }, { label: 'Calda de frutas vermelhas' } ] }),

  P('romeu-julieta', 'sobremesas', 'Romeu e Julieta', 39.90,
    'Queijo muçarela e goiabada no molho belga.',
    'Lasanha Romeu e Julieta com queijo muçarela e goiabada, finalizada com molho belga. Sob encomenda.',
    { sizes: [{ id: 'u', label: 'Unidade', factor: 1 }], addonGroup: 'doce', tags: ['Sob encomenda'], encomenda: true, ingredients: [
      { label: 'Muçarela' }, { label: 'Goiabada' }, { label: 'Molho belga' } ] }),

  P('california', 'sobremesas', 'Califórnia', 39.90,
    'Figo, pêssego e abacaxi no molho belga.',
    'Lasanha Califórnia com figo, pêssego e abacaxi no molho belga da casa. Sob encomenda.',
    { sizes: [{ id: 'u', label: 'Unidade', factor: 1 }], addonGroup: 'doce', tags: ['Sob encomenda'], encomenda: true, ingredients: [
      { label: 'Figo' }, { label: 'Pêssego' }, { label: 'Abacaxi' }, { label: 'Molho belga' } ] }),

  /* ==================== Massa Fresca & Molhos (venda avulsa) ==================== */

  P('massa-fresca-casa', 'massa-fresca', 'Massa Fresca da Casa', 18.00,
    'Massa fresca artesanal, por quilo.',
    'Massa fresca feita na casa com farinha e ovos. Ideal para suas receitas.',
    { sizes: [{ id: 'kg', label: '1 kg', factor: 1 }], addonGroup: '', tags: ['Produção própria'], time: 'Pronta para cozinhar',
      ingredients: [] }),

  P('molho-branco-casa', 'molhos-caseiros', 'Molho Branco da Casa', 12.00,
    'Molho branco cremoso, por litro.',
    'Bechamel da casa com manteiga e leite. Pronto para gratinar.',
    { sizes: [{ id: 'L', label: '1 litro', factor: 1 }], addonGroup: '', tags: ['Produção própria'], time: 'Pronto para servir',
      ingredients: [] }),

  P('molho-vermelho-casa', 'molhos-caseiros', 'Molho Vermelho da Casa', 10.00,
    'Molho de tomate da casa, por litro.',
    'Tomatada caseira no estilo pomarola. Pronta para servir.',
    { sizes: [{ id: 'L', label: '1 litro', factor: 1 }], addonGroup: '', tags: ['Produção própria'], time: 'Pronto para servir',
      ingredients: [] }),

  /* ==================== Bebidas ==================== */

  P('coca-cola-350', 'bebidas', 'Coca-Cola', 6.90,
    'O sabor que nunca passa da hora.',
    'Coca-Cola lata 350ml gelada, perfeita para acompanhar sua lasanha.',
    { sizes: [{ id: 'u', label: '350ml · gelada', factor: 1 }], addonGroup: '', tags: ['Lata'], ingredients: [] }),

  P('guarana-350', 'bebidas', 'Guaraná Antarctica', 5.90,
    'O guaraná mais brasileiro.',
    'Guaraná Antarctica lata 350ml gelado, refrescante e delicioso.',
    { sizes: [{ id: 'u', label: '350ml · gelado', factor: 1 }], addonGroup: '', tags: ['Lata'], ingredients: [] }),

  P('suco-laranja', 'bebidas', 'Suco de Laranja', 8.90,
    'Natural e fresquinho.',
    'Suco de laranja natural 400ml, feito na hora com laranjas selecionadas.',
    { sizes: [{ id: 'u', label: '400ml · natural', factor: 1 }], addonGroup: '', tags: ['Natural'], ingredients: [] }),

  P('agua-mineral', 'bebidas', 'Água Mineral', 4.50,
    'Pura e gelada.',
    'Água mineral sem gás 500ml, refrescante e leve.',
    { sizes: [{ id: 'u', label: '500ml · sem gás', factor: 1 }], addonGroup: '', tags: ['Sem gás'], ingredients: [] })
];

function getById(id) {
  return PRODUCTS.filter(function (p) { return p.id === id; })[0] || null;
}

/* Cadastro de preços da lasanha de 1,5kg (preço cheio por sabor).
   No popup da seleção cada unidade sai com o desconto do kit aplicado. */
var PRICE_1500 = {
  'cogumelos': 125.90,
  'queijos-gorgonzola': 98.90,
  'gorgonzola-bacon': 98.90,
  'bolonhesa-branca': 95.90,
  'bolonhesa-vermelha': 95.90,
  'brocolis-bacon-cream-cheese': 99.90,
  'brocolis-cream-cheese': 99.90,
  'carne-madeira': 110.90,
  'carne-gorgonzola': 118.90,
  'file-mignon': 164.90,
  'frango-branca': 89.90,
  'frango-vermelha': 89.90,
  'frango-requeijao': 99.90,
  'presunto-branca': 89.90,
  'presunto-vermelha': 89.90
};

PRODUCTS.forEach(function (p) {
  if (!PRICE_1500[p.id] || !p.sizes) { return; }
  p.sizes = p.sizes.map(function (s) {
    if (s.id !== 'g1500') { return s; }
    return { id: s.id, label: s.label, factor: s.factor, price: PRICE_1500[p.id] };
  });
});

function catOf(id) {
  return CATEGORIES.filter(function (c) { return c.id === id; })[0] || null;
}

function catName(id) {
  var c = catOf(id);
  return c ? c.name : id;
}