'use strict';

/* =====================================================================
   Pudim LAPANINI — Mock API (simulação offline do painel administrativo).
   Substitui as chamadas fetch() por dados em memória, permitindo
   testar CRUD completo sem PHP/MySQL.
   ===================================================================== */

(function () {
  /* Simulação só em desenvolvimento local (file://). Em produção (http/https)
     o fetch real responde — sem este guard, o mock respondia auth/me com ok:true
     e qualquer pessoa abriria o painel sem digitar senha. */
  if (location.protocol !== 'file:') { return; }

  var MOCK_USER = { id: 1, name: 'Administrador', email: 'admin@lapanini.com.br', role: 'admin', active: true };

  var MOCK_CATEGORIES = [
    { id: 'pudins', name: 'Pudins Artesanais', short: 'Pudins', kicker: 'Cremosos, gelados e feitos todos os dias', position: 0, active: true },
    { id: 'selecoes-fechadas', name: 'Seleções Especiais Fechadas', short: 'Kits prontos com desconto', kicker: '', position: 1, active: true },
    { id: 'selecoes-personalizadas', name: 'Seleções Personalizadas', short: 'Monte seu kit', kicker: '', position: 2, active: true },
    { id: 'classicos', name: 'Pudins Sabores Clássicos', short: 'Sabores da casa', kicker: '', position: 10, active: true },
    { id: 'deluxe', name: 'Pudins Sabores Deluxe', short: 'Para exigentes', kicker: '', position: 20, active: true },
    { id: 'especiais', name: 'Pudins Sabores Especiais', short: 'Receitas autorais', kicker: '', position: 30, active: true },
    { id: 'lowcarb', name: 'Pudins Low Carb', short: 'Leves e saborosas', kicker: '', position: 40, active: true },
    { id: 'frutosdormar', name: 'Frutos do Mar', short: 'Premium', kicker: '', position: 50, active: true },
    { id: 'doces', name: 'Kits Mini', short: 'Kits Mini', kicker: '', position: 60, active: true },
    { id: 'massa-fresca', name: 'Massa Fresca da Casa', short: 'Massa Fresca', kicker: '', position: 65, active: true },
    { id: 'molhos-caseiros', name: 'Molhos Caseiros', short: 'Molhos', kicker: '', position: 66, active: true },
    { id: 'sobremesas', name: 'Sobremesas Variadas', short: 'Fatias e pudins', kicker: '', position: 70, active: true },
    { id: 'mais-pedidos', name: 'Os Mais Pedidos', short: 'Mais Pedidos', kicker: 'Os queridinhos da casa', position: 71, active: true },
    { id: 'promocao-do-dia', name: 'Promoção do Dia!', short: 'Promoção', kicker: 'Ofertas por tempo limitado', position: 72, active: true },
    { id: 'top-mais-vendidos', name: 'Top Mais Vendidos!', short: 'Top Vendidos', kicker: 'Os campeões de venda', position: 73, active: true },
    { id: 'bebidas', name: 'Escolha sua bebida', short: 'Bebidas', kicker: '', position: 80, active: true }
  ];

  var MOCK_PRODUCTS = [
    { id:'mesa-farta', cat_id:'selecoes-fechadas', name:'Mesa Farta', base_price:356.90, description:'4 pudins de 1,5kg + 12% OFF + Frete Grátis.', long_desc:'São 4 sabores diferentes, cada um servindo até 3 pessoas com conforto.', old_price:405.60, type:'kit', addon_group:'salgado', obs_note:'', encomenda:0, frete_gratis:1, badge:'−12% OFF', min_units:0, max_per_flavor:0, size_label:'4 unidades de 1,5kg', discount:0, tags:'', position:1, active:1, sizes:[], ingredients:[], components:['1x Bolonhesa com Molho Branco 1,5kg','1x Frango com Requeijão 1,5kg','1x Carne de Panela ao Molho Madeira 1,5kg','1x Queijos com Gorgonzola 1,5kg'], pool:[] },
    { id:'experiencia-mesa', cat_id:'selecoes-fechadas', name:'Experiência à Mesa', base_price:256.15, description:'4 unidades de 1kg + 10% OFF.', long_desc:'São 4 sabores diferentes, prontos para ir do freezer ao forno.', old_price:284.60, type:'kit', addon_group:'salgado', obs_note:'', encomenda:0, frete_gratis:0, badge:'−10% OFF', min_units:0, max_per_flavor:0, size_label:'4 unidades de 1kg', discount:0, tags:'', position:2, active:1, sizes:[], ingredients:[], components:['1x Presunto e Queijo com Molho Branco 1kg','1x Frango com Requeijão 1kg','1x Bolonhesa com Molho Branco 1kg','1x Carne de Panela ao Molho Madeira 1kg'], pool:[] },
    { id:'curadoria-casa', cat_id:'selecoes-fechadas', name:'Curadoria da Casa', base_price:179.00, description:'5 pudins individuais de 500g + 7% OFF.', long_desc:'São 5 sabores diferentes, prontos para ir do freezer ao forno.', old_price:192.50, type:'kit', addon_group:'salgado', obs_note:'', encomenda:0, frete_gratis:0, badge:'−7% OFF', min_units:0, max_per_flavor:0, size_label:'5 unidades de 500g', discount:0, tags:'', position:3, active:1, sizes:[], ingredients:[], components:['1x Bolonhesa com Molho Vermelho 500g','1x Queijos com Gorgonzola 500g','1x Frango com Molho Branco 500g','1x Carne de Panela ao Molho Madeira 500g','1x Presunto e Queijo com Molho Branco 500g'], pool:[] },

    { id:'selecao-generosa', cat_id:'selecoes-personalizadas', name:'Seleção Generosa', base_price:242.73, description:'Monte seu kit de pudins de 1,5kg + 10% OFF.', long_desc:'Escolha os sabores que preferir e componha sua própria seleção.', old_price:null, type:'selection', addon_group:'salgado', obs_note:'Mínimo de 3 unidades. Até 2 unidades por sabor.', encomenda:0, frete_gratis:0, badge:'', min_units:3, max_per_flavor:2, size_label:'1,5kg', discount:0.1, tags:'', position:4, active:1, sizes:[], ingredients:[], components:[], pool:['bolonhesa-branca','bolonhesa-vermelha','brocolis-cream-cheese','brocolis-bacon-cream-cheese','frango-branca','frango-vermelha','presunto-branca','presunto-vermelha','queijos-gorgonzola','gorgonzola-bacon','carne-madeira','frango-requeijao','cogumelos','carne-gorgonzola','file-mignon'] },
    { id:'selecao-compartilhar', cat_id:'selecoes-personalizadas', name:'Seleção Compartilhar', base_price:215.40, description:'Monte seu kit de pudins de 1kg + 7% OFF.', long_desc:'Escolha os sabores que preferir e componha sua própria seleção.', old_price:null, type:'selection', addon_group:'salgado', obs_note:'Mínimo de 4 unidades. Até 2 unidades por sabor.', encomenda:0, frete_gratis:0, badge:'', min_units:4, max_per_flavor:2, size_label:'1kg', discount:0.07, tags:'', position:5, active:1, sizes:[], ingredients:[], components:[], pool:['bolonhesa-branca','bolonhesa-vermelha','brocolis-cream-cheese','frango-branca','frango-vermelha','presunto-branca','presunto-vermelha'] },
    { id:'selecao-essencial', cat_id:'selecoes-personalizadas', name:'Seleção Essencial', base_price:163.90, description:'Monte seu kit de pudins individuais de 500g + 5% OFF.', long_desc:'Escolha os sabores que preferir e componha sua própria seleção.', old_price:null, type:'selection', addon_group:'salgado', obs_note:'Mínimo de 5 unidades. Até 2 unidades por sabor.', encomenda:0, frete_gratis:0, badge:'', min_units:5, max_per_flavor:2, size_label:'500g', discount:0.05, tags:'', position:6, active:1, sizes:[], ingredients:[], components:[], pool:['bolonhesa-branca','bolonhesa-vermelha','brocolis-cream-cheese','frango-branca','frango-vermelha','presunto-branca','presunto-vermelha'] },

    { id:'bolonhesa-branca', cat_id:'classicos', name:'Bolonhesa com Molho Branco', base_price:38.90, description:'Carne bovina moída, pomarola e especiarias ao molho branco.', long_desc:'Receita caseira de carne bovina moída salteada com cebolinha na manteiga.', old_price:null, type:'reg', addon_group:'salgado', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Clássico', position:10, active:1, sizes:[{id:'g500',label:'500g · 3 porções',factor:1},{id:'g1000',label:'1kg · 5 porções',factor:1.6},{id:'g1500',label:'1,5kg · 8 porções',factor:2.1}], ingredients:[{label:'Massa fresca'},{label:'Muçarela'},{label:'Molho branco'},{label:'Carne moída',rem:5}], components:[], pool:[] },
    { id:'bolonhesa-vermelha', cat_id:'classicos', name:'Bolonhesa com Molho Vermelho', base_price:38.90, description:'Carne bovina moída no molho de tomate caseiro.', long_desc:'Receita caseira de carne bovina moída salteada com cebolinha na manteiga.', old_price:null, type:'reg', addon_group:'salgado', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Clássico', position:11, active:1, sizes:[{id:'g500',label:'500g · 3 porções',factor:1},{id:'g1000',label:'1kg · 5 porções',factor:1.6},{id:'g1500',label:'1,5kg · 8 porções',factor:2.1}], ingredients:[{label:'Massa fresca'},{label:'Muçarela'},{label:'Molho vermelho'},{label:'Carne moída',rem:5}], components:[], pool:[] },
    { id:'brocolis-cream-cheese', cat_id:'classicos', name:'Brócolis com Cream Cheese', base_price:36.90, description:'Brócolis fresco com cream cheese e molho branco.', long_desc:'Receita vegetariana nada clássica em que a estrela é o brócolis com cream cheese.', old_price:null, type:'reg', addon_group:'salgado', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Vegetariana', position:12, active:1, sizes:[{id:'g500',label:'500g · 3 porções',factor:1},{id:'g1000',label:'1kg · 5 porções',factor:1.6},{id:'g1500',label:'1,5kg · 8 porções',factor:2.1}], ingredients:[{label:'Massa fresca'},{label:'Muçarela'},{label:'Brócolis'},{label:'Cream cheese',rem:3}], components:[], pool:[] },
    { id:'brocolis-bacon-cream-cheese', cat_id:'classicos', name:'Brócolis com Bacon e Cream Cheese', base_price:36.90, description:'Brócolis fresco, bacon crocante e cream cheese.', long_desc:'Receita de brócolis com cream cheese e bacon crocante.', old_price:null, type:'reg', addon_group:'salgado', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Clássico', position:13, active:1, sizes:[{id:'g500',label:'500g · 3 porções',factor:1},{id:'g1000',label:'1kg · 5 porções',factor:1.6},{id:'g1500',label:'1,5kg · 8 porções',factor:2.1}], ingredients:[{label:'Massa fresca'},{label:'Muçarela'},{label:'Brócolis'},{label:'Cream cheese',rem:3},{label:'Bacon',rem:4}], components:[], pool:[] },
    { id:'frango-branca', cat_id:'classicos', name:'Frango com Molho Branco', base_price:36.90, description:'Frango desfiado temperado ao molho branco.', long_desc:'Receita caseira de frango desfiado com molho branco.', old_price:null, type:'reg', addon_group:'salgado', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Clássico', position:14, active:1, sizes:[{id:'g500',label:'500g · 3 porções',factor:1},{id:'g1000',label:'1kg · 5 porções',factor:1.6},{id:'g1500',label:'1,5kg · 8 porções',factor:2.1}], ingredients:[{label:'Massa fresca'},{label:'Muçarela'},{label:'Frango desfiado',rem:4}], components:[], pool:[] },
    { id:'frango-vermelha', cat_id:'classicos', name:'Frango com Molho Vermelho', base_price:36.90, description:'Frango desfiado no molho de tomate caseiro.', long_desc:'Receita caseira de frango desfiado com molho de tomate caseiro.', old_price:null, type:'reg', addon_group:'salgado', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Clássico', position:15, active:1, sizes:[{id:'g500',label:'500g · 3 porções',factor:1},{id:'g1000',label:'1kg · 5 porções',factor:1.6},{id:'g1500',label:'1,5kg · 8 porções',factor:2.1}], ingredients:[{label:'Massa fresca'},{label:'Muçarela'},{label:'Frango desfiado',rem:4}], components:[], pool:[] },
    { id:'presunto-branca', cat_id:'classicos', name:'Presunto e Queijo com Molho Branco', base_price:33.90, description:'Presunto premium com molho branco da casa.', long_desc:'Uma lasanha bem brasileira, com o diferencial na escolha do presunto premium.', old_price:null, type:'reg', addon_group:'salgado', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Clássico', position:16, active:1, sizes:[{id:'g500',label:'500g · 3 porções',factor:1},{id:'g1000',label:'1kg · 5 porções',factor:1.6},{id:'g1500',label:'1,5kg · 8 porções',factor:2.1}], ingredients:[{label:'Massa fresca'},{label:'Muçarela'},{label:'Presunto',rem:3}], components:[], pool:[] },
    { id:'presunto-vermelha', cat_id:'classicos', name:'Presunto e Queijo com Molho Vermelho', base_price:33.90, description:'Presunto premium no molho vermelho.', long_desc:'Uma versão bem brasileira para quem não gosta de molho branco.', old_price:null, type:'reg', addon_group:'salgado', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Clássico', position:17, active:1, sizes:[{id:'g500',label:'500g · 3 porções',factor:1},{id:'g1000',label:'1kg · 5 porções',factor:1.6},{id:'g1500',label:'1,5kg · 8 porções',factor:2.1}], ingredients:[{label:'Massa fresca'},{label:'Muçarela'},{label:'Presunto',rem:3}], components:[], pool:[] },

    { id:'queijos-gorgonzola', cat_id:'deluxe', name:'Queijos com Gorgonzola', base_price:37.90, description:'Muçarela, provolone, parmesão e gorgonzola.', long_desc:'Receita perfeita para amantes de queijo. A receita autoral leva muçarela, provolone e parmesão com gorgonzola.', old_price:null, type:'reg', addon_group:'salgado', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Deluxe', position:20, active:1, sizes:[{id:'g500',label:'500g · 3 porções',factor:1},{id:'g1000',label:'1kg · 5 porções',factor:1.6},{id:'g1500',label:'1,5kg · 8 porções',factor:2.1}], ingredients:[{label:'Massa fresca'},{label:'Muçarela'},{label:'Provolone'},{label:'Parmesão'},{label:'Gorgonzola'},{label:'Cream cheese',rem:3}], components:[], pool:[] },
    { id:'gorgonzola-bacon', cat_id:'deluxe', name:'Queijos Gorgonzola e Bacon', base_price:37.90, description:'Queijos e bacon crocante. Para quem quer mais.', long_desc:'Receita perfeita para amantes de queijo e bacon.', old_price:null, type:'reg', addon_group:'salgado', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Deluxe', position:21, active:1, sizes:[{id:'g500',label:'500g · 3 porções',factor:1},{id:'g1000',label:'1kg · 5 porções',factor:1.6},{id:'g1500',label:'1,5kg · 8 porções',factor:2.1}], ingredients:[{label:'Massa fresca'},{label:'Muçarela'},{label:'Gorgonzola'},{label:'Bacon',rem:4}], components:[], pool:[] },
    { id:'carne-madeira', cat_id:'deluxe', name:'Carne de Panela ao Molho Madeira', base_price:41.90, description:'Carne desfiada, madeira e champignon.', long_desc:'Um sucesso da casa. Carne temperada com especiarias, cozida até desfiar, com molho madeira especial.', old_price:null, type:'reg', addon_group:'salgado', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Deluxe', position:22, active:1, sizes:[{id:'g500',label:'500g · 3 porções',factor:1},{id:'g1000',label:'1kg · 5 porções',factor:1.6},{id:'g1500',label:'1,5kg · 8 porções',factor:2.1}], ingredients:[{label:'Massa fresca'},{label:'Muçarela'},{label:'Carne desfiada',rem:5},{label:'Champignon',rem:3}], components:[], pool:[] },
    { id:'frango-requeijao', cat_id:'deluxe', name:'Frango com Requeijão', base_price:37.90, description:'Frango cremoso com o toque do requeijão.', long_desc:'Quer uma lasanha mais cremosa? A de frango com requeijão une o molho vermelho e a cremosidade do requeijão.', old_price:null, type:'reg', addon_group:'salgado', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Deluxe', position:23, active:1, sizes:[{id:'g500',label:'500g · 3 porções',factor:1},{id:'g1000',label:'1kg · 5 porções',factor:1.6},{id:'g1500',label:'1,5kg · 8 porções',factor:2.1}], ingredients:[{label:'Massa fresca'},{label:'Muçarela'},{label:'Frango desfiado',rem:4},{label:'Requeijão',rem:3}], components:[], pool:[] },

    { id:'cogumelos', cat_id:'especiais', name:'Cogumelos', base_price:46.90, description:'Shitake, shimeji e paris em molho especial.', long_desc:'Uma deliciosa mistura de cogumelos shitake, shimeji e paris em um único produto.', old_price:null, type:'reg', addon_group:'salgado', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Especial', position:30, active:1, sizes:[{id:'g500',label:'500g · 3 porções',factor:1},{id:'g1000',label:'1kg · 5 porções',factor:1.6},{id:'g1500',label:'1,5kg · 8 porções',factor:2.1}], ingredients:[{label:'Massa fresca'},{label:'Muçarela'},{label:'Cogumelos mix',rem:6}], components:[], pool:[] },
    { id:'carne-gorgonzola', cat_id:'especiais', name:'Carne de Panela com Gorgonzola', base_price:44.90, description:'Madeira, champignon e um toque de gorgonzola.', long_desc:'Receita de carne de panela ao molho madeira, champignons e um toque de gorgonzola.', old_price:null, type:'reg', addon_group:'salgado', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Especial', position:31, active:1, sizes:[{id:'g500',label:'500g · 3 porções',factor:1},{id:'g1000',label:'1kg · 5 porções',factor:1.6},{id:'g1500',label:'1,5kg · 8 porções',factor:2.1}], ingredients:[{label:'Massa fresca'},{label:'Muçarela'},{label:'Carne desfiada',rem:5},{label:'Champignon',rem:3},{label:'Gorgonzola',rem:4}], components:[], pool:[] },
    { id:'file-mignon', cat_id:'especiais', name:'Filé Mignon aos 4 Queijos', base_price:54.90, description:'Filé mignon com gorgonzola, provolone, parmesão e muçarela.', long_desc:'Receita de filé mignon com 4 queijos: gorgonzola, provolone, parmesão e muçarela.', old_price:null, type:'reg', addon_group:'salgado', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Premium,Especial', position:32, active:1, sizes:[{id:'g500',label:'500g · 3 porções',factor:1},{id:'g1000',label:'1kg · 5 porções',factor:1.6},{id:'g1500',label:'1,5kg · 8 porções',factor:2.1}], ingredients:[{label:'Massa fresca'},{label:'Muçarela'},{label:'Filé mignon',rem:8},{label:'Gorgonzola',rem:4},{label:'Provolone',rem:3},{label:'Parmesão',rem:2}], components:[], pool:[] },

    { id:'abobrinha-frango', cat_id:'lowcarb', name:'Abobrinha com Frango Cremoso', base_price:39.90, description:'Massa trocada por abobrinha, recheio de frango cremoso.', long_desc:'Receita low carb: a massa tradicional é substituída por abobrinha.', old_price:null, type:'reg', addon_group:'salgado', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Low Carb,Light', position:40, active:1, sizes:[{id:'g500',label:'500g · 3 porções',factor:1}], ingredients:[{label:'Abobrinha'},{label:'Muçarela'},{label:'Frango cremoso',rem:4}], components:[], pool:[] },

    { id:'camarao-branco', cat_id:'frutosdormar', name:'Camarão com Molho Branco', base_price:119.90, description:'Camarão graúdo premium no molho branco da casa.', long_desc:'Receita de camarão com molho branco da casa, generosa dose de queijo muçarela e massa fresca.', old_price:null, type:'reg', addon_group:'salgado', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Premium', position:50, active:1, sizes:[{id:'g500',label:'500g · 3 porções',factor:1},{id:'g1000',label:'1kg · 5 porções',factor:1.6},{id:'g1500',label:'1,5kg · 8 porções',factor:2.1}], ingredients:[{label:'Massa fresca'},{label:'Muçarela'},{label:'Camarão',rem:10}], components:[], pool:[] },
    { id:'bacalhau', cat_id:'frutosdormar', name:'Bacalhau com Molho Branco', base_price:119.90, description:'Bacalhau desfiado e temperado com ervas.', long_desc:'Receita de bacalhau com molho misto, generosa dose de queijo muçarela e massa fresca.', old_price:null, type:'reg', addon_group:'salgado', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Premium', position:51, active:1, sizes:[{id:'g500',label:'500g · 3 porções',factor:1},{id:'g1000',label:'1kg · 5 porções',factor:1.6},{id:'g1500',label:'1,5kg · 8 porções',factor:2.1}], ingredients:[{label:'Massa fresca'},{label:'Muçarela'},{label:'Bacalhau',rem:10}], components:[], pool:[] },

    { id:'mini-bolonhesa', cat_id:'doces', name:'Kit Mini Bolonhesa', base_price:179.00, description:'25 unidades de 300g. Perfeita para eventos.', long_desc:'Kit com 25 mini pudins de bolonhesa (300g cada). Ideal para festas e eventos.', old_price:null, type:'reg', addon_group:'', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'25 un. · evento', discount:0, tags:'300g,Evento', position:62, active:1, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[{label:'Carne moída'},{label:'Molho branco'},{label:'Massa fresca'}], components:[], pool:[] },
    { id:'mini-frango', cat_id:'doces', name:'Kit Mini Frango com Requeijão', base_price:179.00, description:'25 unidades de 300g. Para eventos e festas.', long_desc:'Kit com 25 mini pudins de frango com requeijão (300g cada).', old_price:null, type:'reg', addon_group:'', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'25 un. · evento', discount:0, tags:'300g,Evento', position:63, active:1, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[{label:'Frango desfiado'},{label:'Requeijão'},{label:'Massa fresca'}], components:[], pool:[] },
    { id:'mini-queijos', cat_id:'doces', name:'Kit Mini 5 Queijos', base_price:179.00, description:'25 unidades de 300g. Favorita dos convidados.', long_desc:'Kit com 25 mini pudins de 5 queijos (300g cada).', old_price:null, type:'reg', addon_group:'', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'25 un. · evento', discount:0, tags:'300g,Evento,Premium', position:64, active:1, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[{label:'Gorgonzola'},{label:'Muçarela'},{label:'Provolone'},{label:'Parmesão'},{label:'Massa fresca'}], components:[], pool:[] },
    { id:'mini-vegetariana', cat_id:'doces', name:'Kit Mini Vegetariana', base_price:179.00, description:'25 unidades de 300g. Leve e saborosa.', long_desc:'Kit com 25 mini pudins vegetarianas (300g cada).', old_price:null, type:'reg', addon_group:'', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'25 un. · evento', discount:0, tags:'300g,Evento,Vegetariana', position:65, active:1, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[{label:'Legumes grelhados'},{label:'Molho pesto'},{label:'Massa fresca'}], components:[], pool:[] },
    { id:'mini-file', cat_id:'doces', name:'Kit Mini Filé aos 4 Queijos', base_price:179.00, description:'25 unidades de 300g. Para eventos sofisticados.', long_desc:'Kit com 25 mini pudins de filé aos 4 queijos (300g cada).', old_price:null, type:'reg', addon_group:'', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'25 un. · evento', discount:0, tags:'300g,Evento,Premium', position:66, active:1, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[{label:'Filé mignon'},{label:'Gorgonzola'},{label:'Muçarela'},{label:'Massa fresca'}], components:[], pool:[] },
    { id:'romeu-julieta', cat_id:'sobremesas', name:'Romeu e Julieta', base_price:39.90, description:'Queijo muçarela e goiabada finalizados com molho belga.', long_desc:'Romeu e Julieta preparado com queijo muçarela e goiabada.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:1, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Sob encomenda', position:79, active:1, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[{label:'Muçarela'},{label:'Goiabada'},{label:'Molho belga'}], components:[], pool:[] },
    { id:'california', cat_id:'sobremesas', name:'Califórnia', base_price:39.90, description:'Figo, pêssego e abacaxi em molho belga.', long_desc:'Califórnia com molho belga preparado na casa.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:1, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Sob encomenda', position:80, active:1, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[{label:'Figo'},{label:'Pêssego'},{label:'Abacaxi'},{label:'Molho belga'}], components:[], pool:[] },

    { id:'torta-alfajor', cat_id:'sobremesas', name:'Torta Alfajor na Fatia', base_price:24.90, description:'Camadas generosas de doce de leite com textura de alfajor.', long_desc:'Camadas generosas de doce de leite com a textura inconfundível do alfajor.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Fatia', position:70, active:1, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[{label:'Doce de leite'},{label:'Massa alfajor'}], components:[], pool:[] },
    { id:'chaja', cat_id:'sobremesas', name:'Torta Chajá', base_price:25.90, description:'Leve, cremosa, com equilíbrio entre doce e delicado.', long_desc:'Leve, cremosa e com aquele equilíbrio perfeito entre doce e delicado.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Fatia', position:71, active:1, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[{label:'Merengue'},{label:'Doce de leite'},{label:'Uva'}], components:[], pool:[] },
    { id:'choc-belga', cat_id:'sobremesas', name:'Torta de Chocolate Belga', base_price:25.90, description:'Chocolate intenso e aveludado.', long_desc:'Chocolate de verdade, intenso e aveludado.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Fatia', position:72, active:1, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[{label:'Chocolate belga'},{label:'Creme'}], components:[], pool:[] },
    { id:'sorvete-alfajor', cat_id:'sobremesas', name:'Torta de Sorvete Alfajor', base_price:29.90, description:'O frescor do sorvete com o sabor clássico do alfajor.', long_desc:'O frescor do sorvete com o sabor clássico do alfajor.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Gelada', position:73, active:1, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[{label:'Sorvete'},{label:'Massa alfajor'},{label:'Doce de leite'}], components:[], pool:[] },
    { id:'pudim-tradicional', cat_id:'sobremesas', name:'Pudim Tradicional da Casa 100g', base_price:9.90, description:'Textura firme e calda generosa. O pudim de sempre.', long_desc:'Feito com cuidado, textura firme e calda generosa.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'100g', position:74, active:1, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[{label:'Leite'},{label:'Ovos'},{label:'Açúcar'}], components:[], pool:[] },
    { id:'pudim-tradicional-380g', cat_id:'sobremesas', name:'Pudim Tradicional da Casa 380g', base_price:27.90, description:'Textura firme e calda generosa. Versão família.', long_desc:'Feito com cuidado, textura firme e calda generosa. Versão família de 380g.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'380g', position:75, active:1, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[{label:'Leite'},{label:'Ovos'},{label:'Açúcar'}], components:[], pool:[] },
    { id:'pudim-coco', cat_id:'sobremesas', name:'Pudim de Coco 130g', base_price:13.90, description:'Cremoso, aromático, com o sabor de coco que reconforta.', long_desc:'Cremoso, aromático e com aquele sabor de coco que reconforta.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'130g', position:76, active:1, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[{label:'Coco'},{label:'Leite'},{label:'Ovos'}], components:[], pool:[] },
    { id:'pudim-cafe', cat_id:'sobremesas', name:'Pudim de Café 130g', base_price:13.90, description:'Para os apaixonados por café. Intenso e sofisticado.', long_desc:'Para os apaixonados por café: o sabor marcante que você ama.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'130g', position:77, active:1, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[{label:'Café'},{label:'Leite'},{label:'Ovos'}], components:[], pool:[] },
    { id:'pudim-doce-leite', cat_id:'sobremesas', name:'Pudim de Doce de Leite 130g', base_price:13.90, description:'Macio, encorpado e com doce de leite em cada garfada.', long_desc:'Macio, encorpado e com doce de leite em cada garfada.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'130g', position:78, active:1, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[{label:'Doce de leite'},{label:'Leite'},{label:'Ovos'}], components:[], pool:[] },
    { id:'pudim-leite-moca-familia', cat_id:'mais-pedidos', name:'Pudim de Leite Moça Tradicional - Tamanho Família', base_price:84.90, description:'O clássico da casa no tamanho para dividir.', long_desc:'Pudim de Leite Moça tradicional em tamanho família.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Família', position:81, active:1, sizes:[{id:'u',label:'Tamanho Família',factor:1}], ingredients:[{label:'Leite Moça'},{label:'Ovos'},{label:'Calda de caramelo'}], components:[], pool:[] },
    { id:'pudim-leite-moca-individual', cat_id:'mais-pedidos', name:'Pudim de Leite Moça Tradicional - Individual', base_price:14.90, description:'O clássico em porção individual.', long_desc:'Pudim de Leite Moça tradicional em porção individual.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Individual', position:82, active:1, sizes:[{id:'u',label:'Individual · 1 porção',factor:1}], ingredients:[{label:'Leite Moça'},{label:'Ovos'},{label:'Calda de caramelo'}], components:[], pool:[] },
    { id:'pudim-leite-moca-medio-550g', cat_id:'mais-pedidos', name:'Pudim de Leite Moça Tradicional - Tamanho Médio (550g)', base_price:49.90, description:'O clássico no tamanho médio de 550g.', long_desc:'Pudim de Leite Moça tradicional, 550g.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'550g', position:83, active:1, sizes:[{id:'u',label:'550g · Médio',factor:1}], ingredients:[{label:'Leite Moça'},{label:'Ovos'},{label:'Calda de caramelo'}], components:[], pool:[] },
    { id:'pudim-geladinho-gourmet', cat_id:'mais-pedidos', name:'Geladinho Gourmet de Pudim de Leite Moça', base_price:12.90, description:'Refrescância cremosa de pudim.', long_desc:'Geladinho gourmet de pudim de Leite Moça.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Geladinho', position:84, active:1, sizes:[{id:'u',label:'Unidade · geladinho',factor:1}], ingredients:[{label:'Leite Moça'},{label:'Leite'}], components:[], pool:[] },
    { id:'pudim-laka-granule', cat_id:'mais-pedidos', name:'Pudim de Laka com Granulê (Brigadeirão Branco)', base_price:16.90, description:'Brigadeirão branco com granulê.', long_desc:'Pudim de Laka com granulê, o brigadeirão branco cremoso.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Brigadeirão', position:85, active:1, sizes:[{id:'u',label:'Unidade · com granulê',factor:1}], ingredients:[{label:'Chocolate Laka'},{label:'Granulê'}], components:[], pool:[] },
    { id:'pudim-combo-tradicional-geladinho', cat_id:'promocao-do-dia', name:'Combo Pudim Tradicional + Geladinho', base_price:89.90, description:'1 Pudim Família Tradicional + 1 geladinho.', long_desc:'Combo com 1 Pudim Família Tradicional e 1 geladinho.', old_price:97.80, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'-8% OFF', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Combo', position:86, active:1, sizes:[{id:'u',label:'Combo',factor:1}], ingredients:[{label:'Pudim família'},{label:'Geladinho'}], components:[], pool:[] },
    { id:'pudim-combo-5-geladinhos', cat_id:'promocao-do-dia', name:'Combo com 5 Geladinhos com Desconto!', base_price:59.90, description:'5 geladinhos com desconto especial!', long_desc:'Combo com 5 geladinhos nos sabores do dia.', old_price:64.50, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'-7% OFF', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Combo', position:87, active:1, sizes:[{id:'u',label:'5 unidades',factor:1}], ingredients:[{label:'Geladinhos sortidos'}], components:[], pool:[] },
    { id:'pudim-kit-caixa-4', cat_id:'promocao-do-dia', name:'Kit Caixa Presenteável com 4 Pudins Individuais', base_price:59.90, description:'4 pudins sortidos conforme disponibilidade do dia.', long_desc:'Kit em caixa presenteável com 4 pudins individuais sortidos.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Presenteável', position:88, active:1, sizes:[{id:'u',label:'Caixa com 4',factor:1}], ingredients:[{label:'Pudins sortidos'}], components:[], pool:[] },
    { id:'pudim-premium-tradicional-individual', cat_id:'top-mais-vendidos', name:'Pudim Tradicional de Leite Moça - Individual', base_price:14.90, description:'O melhor pudim da vida! Macio, cremoso e lisinho.', long_desc:'Pudim Premium Gourmet 130g feito com puro Leite Moça.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'O mais queridinho', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'130g', position:89, active:1, sizes:[{id:'u',label:'130g · Individual',factor:1}], ingredients:[{label:'Leite Moça'},{label:'Ovos'}], components:[], pool:[] },
    { id:'pudim-premium-doce-leite-individual', cat_id:'top-mais-vendidos', name:'Pudim de Doce de Leite - Individual', base_price:14.90, description:'Com Doce de Leite Mineiro.', long_desc:'Pudim Premium Gourmet 130g com Doce de Leite Mineiro.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'130g', position:90, active:1, sizes:[{id:'u',label:'130g · Individual',factor:1}], ingredients:[{label:'Leite Moça'},{label:'Doce de leite'}], components:[], pool:[] },
    { id:'pudim-premium-brigadeiro-individual', cat_id:'top-mais-vendidos', name:'Pudim de Brigadeiro Gourmet - Individual', base_price:16.90, description:'O brigadeirão viciante, top 2 mais vendidos.', long_desc:'Pudim Premium Gourmet 130g com chocolate nobre e granulê ao leite.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'130g', position:91, active:1, sizes:[{id:'u',label:'130g · Individual',factor:1}], ingredients:[{label:'Chocolate nobre'},{label:'Granulê'}], components:[], pool:[] },
    { id:'pudim-premium-cheesecake-individual', cat_id:'top-mais-vendidos', name:'Pudim de Cream Cheese com Frutas Vermelhas (Cheesecake) - Individual', base_price:16.90, description:'Experiência gastronômica, top 3 mais vendidos.', long_desc:'Pudim Premium Gourmet 130g com cream cheese e calda de frutas vermelhas.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'130g', position:92, active:1, sizes:[{id:'u',label:'130g · Individual',factor:1}], ingredients:[{label:'Cream cheese'},{label:'Frutas vermelhas'}], components:[], pool:[] },

    { id:'pudim-leite-condensado', cat_id:'pudins', name:'Pudim de Leite Condensado', base_price:0.00, description:'O clássico cremoso da vovó, com calda de caramelo dourada.', long_desc:'Pudim clássico de leite condensado, cremoso, com calda de caramelo dourada.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Clássico', position:80, active:0, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[{label:'Leite condensado'},{label:'Ovos'},{label:'Calda de caramelo'}], components:[], pool:[] },
    { id:'pudim-chocolate-belga', cat_id:'pudins', name:'Pudim de Chocolate Belga', base_price:0.00, description:'Intenso, aveludado, para quem leva chocolate a sério.', long_desc:'Pudim de chocolate belga, intenso e aveludado.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Premium', position:81, active:0, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[{label:'Chocolate belga'},{label:'Leite condensado'},{label:'Ovos'}], components:[], pool:[] },
    { id:'pudim-maracuja', cat_id:'pudins', name:'Pudim de Maracujá', base_price:0.00, description:'Equilíbrio perfeito entre o doce e o azedinho.', long_desc:'Pudim de maracujá com o equilíbrio perfeito entre o doce e o azedinho.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'', position:82, active:0, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[{label:'Maracujá'},{label:'Leite condensado'},{label:'Ovos'}], components:[], pool:[] },
    { id:'pudim-doce-de-leite-ouro', cat_id:'pudins', name:'Pudim de Doce de Leite', base_price:0.00, description:'Com fios de ouro e um toque argentino.', long_desc:'Pudim de doce de leite com fios de ouro e um toque argentino.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'', position:83, active:0, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[{label:'Doce de leite'},{label:'Leite condensado'},{label:'Ovos'}], components:[], pool:[] },
    { id:'pudim-fit', cat_id:'pudins', name:'Pudim Fit (sem açúcar)', base_price:0.00, description:'Sabor de verdade, sem culpa.', long_desc:'Pudim fit sem açúcar, sabor de verdade sem culpa.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Sem açúcar,Fit', position:84, active:0, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[{label:'Leite'},{label:'Ovos'},{label:'Adoçante'}], components:[], pool:[] },
    { id:'mini-pudins-cx6', cat_id:'pudins', name:'Mini Pudims (caixa c/ 6)', base_price:0.00, description:'Presente perfeito ou sobremesa para a semana.', long_desc:'Caixa com 6 mini pudins — presente perfeito ou sobremesa para a semana.', old_price:null, type:'reg', addon_group:'doce', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'Caixa c/ 6', discount:0, tags:'Caixa,Presente', position:85, active:0, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[{label:'Leite condensado'},{label:'Ovos'},{label:'Calda de caramelo'}], components:[], pool:[] },
    { id:'massa-fresca-casa', cat_id:'massa-fresca', name:'Massa Fresca da Casa (kg)', base_price:18.00, description:'Massa fresca artesanal — produção interna.', long_desc:'Massa fresca feita na casa com farinha e ovos.', old_price:null, type:'reg', addon_group:'', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Produção interna', position:100, active:1, sizes:[{id:'kg',label:'1 kg',factor:1}], ingredients:[], components:[], pool:[] },
    { id:'molho-branco-casa', cat_id:'molhos-caseiros', name:'Molho Branco da Casa (L)', base_price:12.00, description:'Molho branco artesanal — produção interna.', long_desc:'Molho branco da casa (bechamel).', old_price:null, type:'reg', addon_group:'', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Produção interna', position:101, active:1, sizes:[{id:'L',label:'1 litro',factor:1}], ingredients:[], components:[], pool:[] },
    { id:'molho-vermelho-casa', cat_id:'molhos-caseiros', name:'Molho Vermelho da Casa (L)', base_price:10.00, description:'Molho vermelho artesanal — produção interna.', long_desc:'Molho de tomate da casa (pomarola).', old_price:null, type:'reg', addon_group:'', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Produção interna', position:102, active:1, sizes:[{id:'L',label:'1 litro',factor:1}], ingredients:[], components:[], pool:[] },

    { id:'coca-cola-350', cat_id:'bebidas', name:'Coca-Cola', base_price:6.90, description:'Lata 350ml gelada.', long_desc:'Coca-Cola lata 350ml gelada.', old_price:null, type:'reg', addon_group:'', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Lata', position:110, active:1, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[], components:[], pool:[] },
    { id:'guarana-350', cat_id:'bebidas', name:'Guaraná Antarctica', base_price:5.90, description:'Lata 350ml gelada.', long_desc:'Guaraná Antarctica lata 350ml gelado.', old_price:null, type:'reg', addon_group:'', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Lata', position:111, active:1, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[], components:[], pool:[] },
    { id:'suco-laranja', cat_id:'bebidas', name:'Suco de Laranja', base_price:8.90, description:'Natural, 400ml.', long_desc:'Suco de laranja natural 400ml.', old_price:null, type:'reg', addon_group:'', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Natural', position:112, active:1, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[], components:[], pool:[] },
    { id:'agua-mineral', cat_id:'bebidas', name:'Água Mineral', base_price:4.50, description:'Sem gás, 500ml.', long_desc:'Água mineral sem gás 500ml.', old_price:null, type:'reg', addon_group:'', obs_note:'', encomenda:0, frete_gratis:0, badge:'', min_units:0, max_per_flavor:0, size_label:'', discount:0, tags:'Sem gás', position:113, active:1, sizes:[{id:'u',label:'Unidade',factor:1}], ingredients:[], components:[], pool:[] }
  ];

  /* Lista única de todo o cardápio (mesmos ids de js/data.js e do banco). */
  var MOCK_ADDONS = [
    { id:'borda-queijo', label:'Borda de Queijo Extra', grp:'borda', price:12.90, position:1, active:true },
    { id:'molho-especial', label:'Molho Especial da Casa', grp:'molho', price:6.90, position:2, active:true },
    { id:'molho-branco-extra', label:'Molho Branco Extra', grp:'molho', price:5.90, position:3, active:true },
    { id:'bacon', label:'Bacon Crocante', grp:'extra', price:7.90, position:4, active:true },
    { id:'cheddar', label:'Cheddar Derretido', grp:'extra', price:6.90, position:5, active:true },
    { id:'cebola-caramelizada', label:'Cebola Caramelizada', grp:'extra', price:5.90, position:6, active:true },
    { id:'ovo', label:'Ovo Frito', grp:'extra', price:3.90, position:7, active:true },
    { id:'palmito', label:'Palmito', grp:'extra', price:6.90, position:8, active:true },
    { id:'sem-cebola', label:'Retirar Cebola', grp:'retirar', price:0, position:9, active:true }
  ];

  var MOCK_COUPONS = [
    { code:'PUDIMHASS10', ctype:'percent', cvalue:10, label:'10% OFF', highlight:true, max_uses:100, used:12, expires_at:'2026-12-31', active:true },
    { code:'BEMVINDO15', ctype:'percent', cvalue:15, label:'Boas-vindas', highlight:false, max_uses:50, used:3, expires_at:'2026-06-30', active:false }
  ];

  var MOCK_AREAS = [
    { id:'centro', name:'Centro', fee:5.90, eta:25, position:1, active:true },
    { id:'jardim', name:'Jardim das Flores', fee:7.90, eta:30, position:2, active:true },
    { id:'vila-nova', name:'Vila Nova', fee:8.90, eta:35, position:3, active:true },
    { id:'parque', name:'Parque Industrial', fee:9.90, eta:40, position:4, active:true },
    { id:'nova-era', name:'Nova Era', fee:10.90, eta:45, position:5, active:true },
    { id:'distrito', name:'Distrito Industrial', fee:11.90, eta:50, position:6, active:true }
  ];

  var MOCK_BANNERS = [
    { id:1, title:'Monte sua Seleção', subtitle:'Escolha os sabores e ganhe até 12% OFF', position:'home-middle', position_order:1, active:true },
    { id:2, title:'Frete Grátis na Mesa Farta', subtitle:'4 pudins de 1,5kg com desconto e frete por nossa conta', position:'home-end', position_order:1, active:true }
  ];

  var MOCK_SETTINGS = {
    store_name:'Pudim LAPANINI', tagline:'Pudins Artesanais',
    cnpj:'',
    phone:'(19) 99404-8354', whats:'5519994048354',
    address:'Rua Osvaldo Serra, 193 — Jardim Interlagos', city:'Campinas · SP',
    hours_short:'Ter–Dom · 18h às 23h30', hours_detail:'Terça a domingo, das 18h às 23h30. Segunda-feira a cozinha descansa.',
    eta:'45–60 min', free_from:'5.90',
    offer_text:'Ganhe frete grátis na Mesa Farta!', offer_copy:'MESA10',
    delivery_note:'Retirada na loja ou delivery por aplicativo.',
    store_open:'1', orders_paused:'0', whats_only:'nao', pay_mode:'online',
    hours_mon:'0', hours_mon_open:'18:00', hours_mon_close:'23:30',
    hours_seg_open:'18:00', hours_seg_close:'23:30',
    hours_sab_open:'18:00', hours_sab_close:'23:30',
    hours_dom_open:'18:00', hours_dom_close:'23:30',
    pay_pix:'1', pay_card:'1', pay_cash:'1',
    delivery_active:'1', pickup_active:'1', min_delivery:'30.00',
    notif_sound:'1', notif_email:'0', notif_whats:'0'
  };

  var MOCK_USERS = [
    { id:1, name:'Administrador', email:'admin@lapanini.com.br', role:'admin', active:true },
    { id:2, name:'Operador Carlos', email:'carlos@lapanini.com.br', role:'operador', active:true }
  ];

  var MOCK_ORDERS = [
    { id:1001, number:1001, status:'recebido', at:Date.now()-15*60000, customer:{name:'João Silva',phone:'(11) 98888-7777',email:'joao@email.com'}, items:[{qty:2,name:'Bolonhesa com Molho Branco 1kg',price:62.24},{qty:1,name:'Frango com Requeijão 500g',price:37.90}], payment:{method:'pix'}, delivery:{mode:'entrega',districtName:'Centro'}, total:100.14 },
    { id:1002, number:1002, status:'confirmado', at:Date.now()-45*60000, customer:{name:'Maria Santos',phone:'(11) 97777-6666',email:'maria@email.com'}, items:[{qty:1,name:'Mesa Farta',price:356.90}], payment:{method:'cartao'}, delivery:{mode:'entrega',districtName:'Jardim das Flores'}, total:364.80 },
    { id:1003, number:1003, status:'preparacao', at:Date.now()-80*60000, customer:{name:'Pedro Lima',phone:'(11) 96666-5555',email:'pedro@email.com'}, items:[{qty:1,name:'Filé Mignon aos 4 Queijos 1kg',price:88.84},{qty:1,name:'Torta Chajá',price:25.90}], payment:{method:'dinheiro'}, delivery:{mode:'retirada',districtName:''}, total:114.74 },
    { id:1004, number:1004, status:'entrega', at:Date.now()-120*60000, customer:{name:'Ana Costa',phone:'(11) 95555-4444',email:'ana@email.com'}, items:[{qty:3,name:'Pudim Tradicional da Casa 100g',price:29.70}], payment:{method:'pix'}, delivery:{mode:'entrega',districtName:'Vila Nova'}, total:38.60 },
    { id:1005, number:1005, status:'entregue', at:Date.now()-200*60000, customer:{name:'Lucas Ferreira',phone:'(11) 94444-3333',email:'lucas@email.com'}, items:[{qty:1,name:'Seleção Generosa 1,5kg',price:242.73}], payment:{method:'cartao'}, delivery:{mode:'entrega',districtName:'Parque Industrial'}, total:250.63 }
  ];

  var MOCK_HOME = [
    { id: 'offer',     label: 'Barra de oferta',                selector: '#offer',               area: 'fixed', visible: 1, position: 0 },
    { id: 'hero',      label: 'Hero / Início',                  selector: '#inicio',              area: 'main',  visible: 1, position: 1 },
    { id: 'cardapio',  label: 'Cardápio',                       selector: '#cardapio',            area: 'main',  visible: 1, position: 2 },
    { id: 'promocoes', label: 'Promoções / Destaque da semana', selector: '#promocoes',           area: 'main',  visible: 1, position: 3 },
    { id: 'steps',     label: 'Como funciona (3 passos)',       selector: '.steps',               area: 'main',  visible: 1, position: 4 },
    { id: 'duvidas',   label: 'Dúvidas frequentes',             selector: '#duvidas',             area: 'main',  visible: 1, position: 5 },
    { id: 'benefits',  label: 'Benefícios',                     selector: '.benefits',            area: 'main',  visible: 1, position: 6 },
    { id: 'footer',    label: 'Rodapé',                         selector: '.site-footer',         area: 'fixed', visible: 1, position: 7 },
    { id: 'fabs',      label: 'Botões flutuantes',              selector: '.fab, .floating-cart', area: 'fixed', visible: 1, position: 8 }
  ];

  var MOCK_INGREDIENTS = [
    { id: 1, name: 'Massa fresca', unit: 'kg', unit_cost: 12.00, supplier: '', notes: '', category: 'massas', purchase_unit: 'pct', purchase_qty: 1, purchase_price: 12, position: 1, active: true },
    { id: 2, name: 'Farinha de trigo', unit: 'kg', unit_cost: 6.50, supplier: '', notes: '', category: 'massas', purchase_unit: 'pct', purchase_qty: 1, purchase_price: 6.5, position: 2, active: true },
    { id: 3, name: 'Molho branco', unit: 'kg', unit_cost: 8.50, supplier: '', notes: '', category: 'molhos', purchase_unit: '', purchase_qty: null, purchase_price: null, position: 3, active: true },
    { id: 4, name: 'Molho vermelho', unit: 'kg', unit_cost: 7.00, supplier: '', notes: '', category: 'molhos', purchase_unit: '', purchase_qty: null, purchase_price: null, position: 4, active: true },
    { id: 5, name: 'Muçarela', unit: 'kg', unit_cost: 38.00, supplier: '', notes: '', category: 'geral', purchase_unit: 'pct', purchase_qty: 1, purchase_price: 38, position: 5, active: true },
    { id: 6, name: 'Massa Fresca da Casa', unit: 'kg', unit_cost: 18.00, supplier: 'Produção própria', notes: '', category: 'massa-fresca', purchase_unit: '', purchase_qty: null, purchase_price: null, position: 6, active: true }
  ];

  /* ---------- Store em memória ---------- */
  var DB = {
    products: MOCK_PRODUCTS.map(function (p) { return JSON.parse(JSON.stringify(p)); }),
    categories: MOCK_CATEGORIES.map(function (c) { return JSON.parse(JSON.stringify(c)); }),
    addons: MOCK_ADDONS.map(function (a) { return JSON.parse(JSON.stringify(a)); }),
    coupons: MOCK_COUPONS.map(function (c) { return JSON.parse(JSON.stringify(c)); }),
    areas: MOCK_AREAS.map(function (a) { return JSON.parse(JSON.stringify(a)); }),
    banners: MOCK_BANNERS.map(function (b) { return JSON.parse(JSON.stringify(b)); }),
    home: MOCK_HOME.map(function (h) { return JSON.parse(JSON.stringify(h)); }),
    settings: JSON.parse(JSON.stringify(MOCK_SETTINGS)),
    users: MOCK_USERS.map(function (u) { return JSON.parse(JSON.stringify(u)); }),
    orders: MOCK_ORDERS.map(function (o) { return JSON.parse(JSON.stringify(o)); }),
    canceled: [],
    ingredients: MOCK_INGREDIENTS.map(function (a) { return JSON.parse(JSON.stringify(a)); }),
    costHistory: [],
    _nextId: 100
  };

  function nextNum(arr, key) {
    var max = 0;
    arr.forEach(function (x) { var n = parseInt(x[key], 10); if (!isNaN(n) && n > max) max = n; });
    return max + 1;
  }
  function slugify(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  /* ---------- Router mock ---------- */

  function matchRoute(method, path) {
    var segments = path.replace(/^\/+/, '').split('/');
    var seg0 = segments[0] || '';
    var seg1 = segments[1] || '';
    var seg2 = segments[2] || '';

    if (seg0 === 'auth' && seg1 === 'me' && method === 'GET') return { action: 'auth/me' };
    if (seg0 === 'auth' && seg1 === 'login' && method === 'POST') return { action: 'auth/login' };
    if (seg0 === 'auth' && seg1 === 'logout' && method === 'POST') return { action: 'auth/logout' };

    if (seg0 === 'admin' && seg1 === 'dashboard' && method === 'GET') return { action: 'dashboard' };

    if (seg0 === 'admin' && seg1 === 'categories') {
      if (method === 'GET') return { action: 'list_categories' };
      if (method === 'POST') return { action: 'create_category' };
      if (segments.length >= 3 && method === 'PUT') return { action: 'update_category', id: decodeURIComponent(seg2) };
      if (segments.length >= 3 && method === 'DELETE') return { action: 'delete_category', id: decodeURIComponent(seg2) };
    }

    if (seg0 === 'admin' && seg1 === 'products') {
      if (method === 'GET') return { action: 'list_products' };
      if (method === 'POST') return { action: 'create_product' };
      if (segments.length >= 3 && method === 'GET') return { action: 'get_product', id: decodeURIComponent(seg2) };
      if (segments.length >= 3 && method === 'PUT') return { action: 'update_product', id: decodeURIComponent(seg2) };
      if (segments.length >= 3 && method === 'DELETE') return { action: 'delete_product', id: decodeURIComponent(seg2) };
    }

    if (seg0 === 'admin' && seg1 === 'addons') {
      if (method === 'GET') return { action: 'list_addons' };
      if (method === 'POST') return { action: 'create_addon' };
      if (segments.length >= 3 && method === 'PUT') return { action: 'update_addon', id: decodeURIComponent(seg2) };
      if (segments.length >= 3 && method === 'DELETE') return { action: 'delete_addon', id: decodeURIComponent(seg2) };
    }

    if (seg0 === 'admin' && seg1 === 'ingredients') {
      if (method === 'GET' && segments.length === 2) return { action: 'list_ingredients' };
      if (method === 'POST' && segments.length === 2) return { action: 'create_ingredient' };
      if (segments.length === 3 && method === 'PUT') return { action: 'update_ingredient', id: decodeURIComponent(seg2) };
      if (segments.length === 3 && method === 'DELETE') return { action: 'delete_ingredient', id: decodeURIComponent(seg2) };
    }

    if (seg0 === 'admin' && seg1 === 'cost-history' && method === 'GET') {
      var qm = path.indexOf('?');
      var iid = null;
      if (qm !== -1) {
        var m = /ingredient_id=(\d+)/.exec(path.slice(qm));
        if (m) { iid = parseInt(m[1], 10); }
      }
      return { action: 'list_cost_history', ingredient_id: iid };
    }

    if (seg0 === 'admin' && seg1 === 'coupons') {
      if (method === 'GET') return { action: 'list_coupons' };
      if (method === 'POST') return { action: 'create_coupon' };
      if (segments.length >= 3 && method === 'PUT') return { action: 'update_coupon', id: decodeURIComponent(seg2) };
      if (segments.length >= 3 && method === 'DELETE') return { action: 'delete_coupon', id: decodeURIComponent(seg2) };
    }

    if (seg0 === 'admin' && seg1 === 'areas') {
      if (method === 'GET') return { action: 'list_areas' };
      if (method === 'POST') return { action: 'create_area' };
      if (segments.length >= 3 && method === 'PUT') return { action: 'update_area', id: decodeURIComponent(seg2) };
      if (segments.length >= 3 && method === 'DELETE') return { action: 'delete_area', id: decodeURIComponent(seg2) };
    }

    if (seg0 === 'admin' && seg1 === 'banners') {
      if (method === 'GET') return { action: 'list_banners' };
      if (method === 'POST') return { action: 'create_banner' };
      if (segments.length >= 3 && method === 'PUT') return { action: 'update_banner', id: decodeURIComponent(seg2) };
      if (segments.length >= 3 && method === 'DELETE') return { action: 'delete_banner', id: decodeURIComponent(seg2) };
    }

    if (seg0 === 'admin' && seg1 === 'home-sections') {
      if (method === 'GET') return { action: 'list_home' };
      if (method === 'PUT' && segments.length < 3) return { action: 'update_home' };
      if (segments.length >= 3 && method === 'PUT') return { action: 'update_home_one', id: decodeURIComponent(seg2) };
    }

    if (seg0 === 'admin' && seg1 === 'users') {
      if (method === 'GET') return { action: 'list_users' };
      if (method === 'POST') return { action: 'create_user' };
      if (segments.length >= 3 && method === 'PUT') return { action: 'update_user', id: decodeURIComponent(seg2) };
      if (segments.length >= 3 && method === 'DELETE') return { action: 'delete_user', id: decodeURIComponent(seg2) };
    }

    if (seg0 === 'admin' && seg1 === 'settings') {
      if (method === 'GET') return { action: 'get_settings' };
      if (method === 'PUT') return { action: 'update_settings' };
    }

    if (seg0 === 'admin' && seg1 === 'orders') {
      if (seg2 === 'canceled' && segments.length === 3 && method === 'GET') return { action: 'list_canceled' };
      if (seg2 === 'canceled' && segments.length === 5 && segments[4] === 'restore' && method === 'POST') return { action: 'restore_canceled', id: decodeURIComponent(segments[3] || '') };
      if (segments.length === 4 && segments[3] === 'cancel' && method === 'POST') return { action: 'cancel_order', id: decodeURIComponent(seg2) };
      if (segments.length === 2 && method === 'GET') return { action: 'list_orders' };
      if (segments.length === 2 && method === 'POST') return { action: 'create_order' };
      if (segments.length === 3 && method === 'GET') return { action: 'get_order', id: decodeURIComponent(seg2) };
      if (segments.length === 3 && method === 'PUT') return { action: 'update_order', id: decodeURIComponent(seg2) };
    }

    return null;
  }

  function handleMock(method, path, body) {
    var route = matchRoute(method, path);
    if (!route) return Promise.resolve({ ok: false, error: 'Endpoint não encontrado: ' + method + ' ' + path, status: 404 });

    switch (route.action) {

      /* ---- Auth ---- */
      case 'auth/me':
        return Promise.resolve({ ok: true, data: MOCK_USER });
      case 'auth/login':
        if (body && body.email) {
          MOCK_USER.email = body.email;
          MOCK_USER.name = body.email.split('@')[0];
        }
        return Promise.resolve({ ok: true, data: MOCK_USER });
      case 'auth/logout':
        return Promise.resolve({ ok: true, data: {} });

      /* ---- Dashboard ---- */
      case 'dashboard': {
        var ativos = DB.products.filter(function (p) { return !!p.active; }).length;
        var pausados = DB.products.filter(function (p) { return !p.active; }).length;
        var faturamento = DB.orders.reduce(function (s, o) { return s + (o.total || 0); }, 0);
        var ticket = DB.orders.length ? faturamento / DB.orders.length : 0;
        var days = [];
        for (var i = 6; i >= 0; i--) {
          var d = new Date(Date.now() - i * 86400000);
          days.push({ d: d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3), v: Math.floor(Math.random() * 15) + 2 });
        }
        var atencao = [];
        if (pausados > 0) atencao.push({ type: 'warn', title: 'Produtos pausados: ', text: pausados + ' item(s) pausados no cardápio.' });
        return Promise.resolve({ ok: true, data: { kpis: { pedidosHoje: DB.orders.length, faturamento: faturamento, ticketMedio: ticket, ativos: ativos, pausados: pausados }, bars: days, atencao: atencao } });
      }

      /* ---- Categories ---- */
      case 'list_categories':
        return Promise.resolve({ ok: true, data: DB.categories });
      case 'create_category': {
        var c = body || {};
        var newCat = { id: c.id || slugify(c.name), name: c.name || 'Nova Categoria', short: c.short || '', kicker: c.kicker || '', position: c.position || 0, active: c.active !== false };
        DB.categories.push(newCat);
        return Promise.resolve({ ok: true, data: newCat });
      }
      case 'update_category': {
        var idx = -1;
        DB.categories.forEach(function (x, i) { if (x.id === route.id) idx = i; });
        if (idx < 0) return Promise.reject({ ok: false, error: 'Categoria não encontrada', status: 404 });
        Object.assign(DB.categories[idx], body);
        return Promise.resolve({ ok: true, data: DB.categories[idx] });
      }
      case 'delete_category':
        DB.categories = DB.categories.filter(function (x) { return x.id !== route.id; });
        return Promise.resolve({ ok: true, data: {} });

      /* ---- Products ---- */
      case 'list_products':
        return Promise.resolve({ ok: true, data: DB.products });
      case 'get_product': {
        var found = DB.products.filter(function (x) { return x.id === route.id; })[0];
        return found ? Promise.resolve({ ok: true, data: found }) : Promise.reject({ ok: false, error: 'Produto não encontrado', status: 404 });
      }
      case 'create_product': {
        var p = body || {};
        var newP = {
          id: p.id || slugify(p.name), cat_id: p.cat || p.cat_id || 'classicos', name: p.name || 'Novo Produto',
          base_price: parseFloat(p.base) || 0, description: p.description || '', long_desc: p.long || '',
          old_price: p.old != null ? parseFloat(p.old) : null, type: p.type || 'reg', addon_group: p.addonGroup || 'salgado',
          obs_note: p.obsNote || '', encomenda: p.encomenda ? 1 : 0, frete_gratis: p.freteGratis ? 1 : 0,
          badge: p.badge || '', min_units: p.min || 0, max_per_flavor: p.maxPerFlavor || 0,
          size_label: p.sizeLabel || '', discount: parseFloat(p.discount) || 0, tags: Array.isArray(p.tags) ? p.tags.join(',') : (p.tags || ''),
          position: p.position || 0, active: p.active !== false ? 1 : 0,
          sizes: p.sizes || [], ingredients: p.ingredients || [], components: p.components || [], pool: p.pool || []
        };
        DB.products.push(newP);
        return Promise.resolve({ ok: true, data: newP });
      }
      case 'update_product': {
        var pi = -1;
        DB.products.forEach(function (x, i) { if (x.id === route.id) pi = i; });
        if (pi < 0) return Promise.reject({ ok: false, error: 'Produto não encontrado', status: 404 });
        var up = body || {};
        var existing = DB.products[pi];
        var updated = Object.assign({}, existing, {
          id: existing.id, cat_id: up.cat || up.cat_id || existing.cat_id, name: up.name || existing.name,
          base_price: up.base != null ? parseFloat(up.base) : existing.base_price,
          description: up.description != null ? up.description : existing.description,
          long_desc: up.long != null ? up.long : existing.long_desc,
          old_price: up.old != null ? (up.old === '' ? null : parseFloat(up.old)) : existing.old_price,
          type: up.type || existing.type, addon_group: up.addonGroup || existing.addon_group,
          obsNote: up.obsNote != null ? up.obsNote : existing.obsNote,
          encomenda: up.encomenda != null ? (up.encomenda ? 1 : 0) : existing.encomenda,
          frete_gratis: up.freteGratis != null ? (up.freteGratis ? 1 : 0) : existing.frete_gratis,
          badge: up.badge != null ? up.badge : existing.badge,
          min_units: up.min != null ? up.min : existing.min_units,
          max_per_flavor: up.maxPerFlavor != null ? up.maxPerFlavor : existing.max_per_flavor,
          size_label: up.sizeLabel != null ? up.sizeLabel : existing.size_label,
          discount: up.discount != null ? parseFloat(up.discount) : existing.discount,
          tags: Array.isArray(up.tags) ? up.tags.join(',') : (up.tags != null ? up.tags : existing.tags),
          position: up.position != null ? up.position : existing.position,
          active: up.active != null ? (up.active ? 1 : 0) : existing.active,
          sizes: up.sizes || existing.sizes,
          ingredients: up.ingredients || existing.ingredients,
          components: up.components || existing.components,
          pool: up.pool || existing.pool
        });
        DB.products[pi] = updated;
        return Promise.resolve({ ok: true, data: updated });
      }
      case 'delete_product':
        DB.products = DB.products.filter(function (x) { return x.id !== route.id; });
        return Promise.resolve({ ok: true, data: {} });

      /* ---- Addons ---- */
      case 'list_addons':
        return Promise.resolve({ ok: true, data: DB.addons });
      case 'create_addon': {
        var a = body || {};
        var newA = { id: a.id || slugify(a.label), label: a.label || 'Novo Adicional', grp: a.grp || 'salgado', price: parseFloat(a.price) || 0, position: a.position || 0, active: a.active !== false };
        DB.addons.push(newA);
        return Promise.resolve({ ok: true, data: newA });
      }
      case 'update_addon': {
        var ai = -1;
        DB.addons.forEach(function (x, i) { if (x.id === route.id) ai = i; });
        if (ai < 0) return Promise.reject({ ok: false, error: 'Adicional não encontrado', status: 404 });
        Object.assign(DB.addons[ai], body);
        return Promise.resolve({ ok: true, data: DB.addons[ai] });
      }
      case 'delete_addon':
        DB.addons = DB.addons.filter(function (x) { return x.id !== route.id; });
        return Promise.resolve({ ok: true, data: {} });

      /* ---- Coupons ---- */
      case 'list_coupons':
        return Promise.resolve({ ok: true, data: DB.coupons });
      case 'create_coupon': {
        var cp = body || {};
        var newCp = { code: (cp.code || 'CUPOM').toUpperCase(), ctype: cp.ctype || 'percent', cvalue: parseFloat(cp.value) || 0, label: cp.label || '', highlight: !!cp.highlight, max_uses: cp.maxUses || null, used: 0, expires_at: cp.expiresAt || null, active: cp.active !== false };
        DB.coupons.push(newCp);
        return Promise.resolve({ ok: true, data: newCp });
      }
      case 'update_coupon': {
        var ci = -1;
        DB.coupons.forEach(function (x, i) { if (x.code === route.id) ci = i; });
        if (ci < 0) return Promise.reject({ ok: false, error: 'Cupom não encontrado', status: 404 });
        Object.assign(DB.coupons[ci], body);
        return Promise.resolve({ ok: true, data: DB.coupons[ci] });
      }
      case 'delete_coupon':
        DB.coupons = DB.coupons.filter(function (x) { return x.code !== route.id; });
        return Promise.resolve({ ok: true, data: {} });

      /* ---- Areas ---- */
      case 'list_areas':
        return Promise.resolve({ ok: true, data: DB.areas });
      case 'create_area': {
        var ar = body || {};
        var newAr = { id: ar.id || slugify(ar.name), name: ar.name || 'Nova Área', fee: parseFloat(ar.fee) || 0, eta: parseInt(ar.eta) || 25, position: ar.position || 0, active: ar.active !== false };
        DB.areas.push(newAr);
        return Promise.resolve({ ok: true, data: newAr });
      }
      case 'update_area': {
        var ari = -1;
        DB.areas.forEach(function (x, i) { if (x.id === route.id) ari = i; });
        if (ari < 0) return Promise.reject({ ok: false, error: 'Área não encontrada', status: 404 });
        Object.assign(DB.areas[ari], body);
        return Promise.resolve({ ok: true, data: DB.areas[ari] });
      }
      case 'delete_area':
        DB.areas = DB.areas.filter(function (x) { return x.id !== route.id; });
        return Promise.resolve({ ok: true, data: {} });

      /* ---- Banners ---- */
      case 'list_banners':
        return Promise.resolve({ ok: true, data: DB.banners });
      case 'create_banner': {
        var b = body || {};
        var newB = { id: nextNum(DB.banners, 'id'), title: b.title || 'Novo Banner', subtitle: b.subtitle || '', position: b.position || 'home-middle', position_order: b.positionOrder || 0, active: b.active !== false };
        DB.banners.push(newB);
        return Promise.resolve({ ok: true, data: newB });
      }
      case 'update_banner': {
        var bi = -1;
        DB.banners.forEach(function (x, i) { if (String(x.id) === String(route.id)) bi = i; });
        if (bi < 0) return Promise.reject({ ok: false, error: 'Banner não encontrado', status: 404 });
        Object.assign(DB.banners[bi], body);
        return Promise.resolve({ ok: true, data: DB.banners[bi] });
      }
      case 'delete_banner':
        DB.banners = DB.banners.filter(function (x) { return String(x.id) !== String(route.id); });
        return Promise.resolve({ ok: true, data: {} });

      /* ---- Settings ---- */
      case 'get_settings':
        return Promise.resolve({ ok: true, data: DB.settings });
      case 'update_settings':
        if (body && body.settings) Object.assign(DB.settings, body.settings);
        return Promise.resolve({ ok: true, data: DB.settings });

      /* ---- Users ---- */
      case 'list_users':
        return Promise.resolve({ ok: true, data: DB.users });
      case 'create_user': {
        var u = body || {};
        var newU = { id: nextNum(DB.users, 'id'), name: u.name || 'Novo Usuário', email: u.email || '', role: u.role || 'operador', active: u.active !== false };
        DB.users.push(newU);
        return Promise.resolve({ ok: true, data: newU });
      }
      case 'update_user': {
        var ui = -1;
        DB.users.forEach(function (x, i) { if (String(x.id) === String(route.id)) ui = i; });
        if (ui < 0) return Promise.reject({ ok: false, error: 'Usuário não encontrado', status: 404 });
        Object.assign(DB.users[ui], body);
        return Promise.resolve({ ok: true, data: DB.users[ui] });
      }
      case 'delete_user':
        DB.users = DB.users.filter(function (x) { return String(x.id) !== String(route.id); });
        return Promise.resolve({ ok: true, data: {} });

      /* ---- Orders ---- */
      case 'list_orders':
        return Promise.resolve({ ok: true, data: DB.orders });
      case 'get_order': {
        var oFound = DB.orders.filter(function (x) { return String(x.id) === String(route.id); })[0];
        return oFound ? Promise.resolve({ ok: true, data: oFound }) : Promise.reject({ ok: false, error: 'Pedido não encontrado', status: 404 });
      }
      case 'update_order': {
        var oi = -1;
        DB.orders.forEach(function (x, i) { if (String(x.id) === String(route.id)) oi = i; });
        if (oi < 0) return Promise.reject({ ok: false, error: 'Pedido não encontrado', status: 404 });
        Object.assign(DB.orders[oi], body);
        return Promise.resolve({ ok: true, data: DB.orders[oi] });
      }
      case 'create_order': {
        var newOrder = Object.assign({ id: nextNum(DB.orders, 'id') }, body || {});
        DB.orders.push(newOrder);
        return Promise.resolve({ ok: true, data: newOrder });
      }
      case 'cancel_order': {
        var ci = -1;
        DB.orders.forEach(function (x, i) { if (String(x.id) === String(route.id)) ci = i; });
        if (ci < 0) return Promise.reject({ ok: false, error: 'Pedido não encontrado', status: 404 });
        var cancelled = Object.assign({}, DB.orders[ci], { canceled_at: new Date().toISOString(), canceled_id: DB.orders[ci].id });
        DB.orders.splice(ci, 1);
        DB.canceled.unshift(cancelled);
        return Promise.resolve({ ok: true, data: { id: cancelled.id, number: cancelled.number } });
      }
      case 'list_canceled':
        return Promise.resolve({ ok: true, data: DB.canceled });
      case 'restore_canceled': {
        var ri = -1;
        DB.canceled.forEach(function (x, i) { if (String(x.id) === String(route.id)) ri = i; });
        if (ri < 0) return Promise.reject({ ok: false, error: 'Cancelado não encontrado', status: 404 });
        var restored = DB.canceled[ri];
        DB.canceled.splice(ri, 1);
        delete restored.canceled_at;
        delete restored.canceled_id;
        DB.orders.unshift(restored);
        return Promise.resolve({ ok: true, data: restored });
      }

      /* ---- Home sections ---- */
      case 'list_home':
        return Promise.resolve({ ok: true, data: DB.home.slice().sort(function (a, b) { return a.position - b.position; }) });
      case 'update_home': {
        var secs = (body && body.sections) || [];
        secs.forEach(function (s, i) {
          DB.home.forEach(function (h) {
            if (h.id === s.id) {
              if (typeof s.label === 'string' && s.label.trim() !== '') { h.label = s.label.trim(); }
              h.visible = (h.id === 'cardapio') ? 1 : (s.visible ? 1 : 0);
              h.position = (typeof s.position === 'number') ? s.position : i;
            }
          });
        });
        DB.home.sort(function (a, b) { return a.position - b.position; });
        return Promise.resolve({ ok: true, data: DB.home.slice() });
      }
      case 'update_home_one': {
        var hi = -1;
        DB.home.forEach(function (x, i) { if (x.id === route.id) hi = i; });
        if (hi < 0) return Promise.reject({ ok: false, error: 'Seção não encontrada', status: 404 });
        if (body && typeof body.label === 'string' && body.label.trim() !== '') {
          DB.home[hi].label = body.label.trim();
        }
        if (body && typeof body.visible !== 'undefined' && DB.home[hi].id !== 'cardapio') {
          DB.home[hi].visible = body.visible ? 1 : 0;
        }
        if (body && typeof body.position === 'number') { DB.home[hi].position = body.position; }
        DB.home.sort(function (a, b) { return a.position - b.position; });
        return Promise.resolve({ ok: true, data: DB.home.slice() });
      }

      default:
        return Promise.reject({ ok: false, error: 'Rota mock não implementada: ' + route.action, status: 404 });
    }
  }

  /* ---------- Interceptar fetch (nativo) ---------- */

  var _origFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf('api/') !== 0) {
      return _origFetch.apply(this, arguments);
    }

    var method = (init && init.method) || 'GET';
    var body = null;
    if (init && init.body) {
      try { body = JSON.parse(init.body); } catch (e) { body = init.body; }
    }

    var path = url.replace(/^api\//, '');

    try {
      var result = handleMock(method, path, body);
    } catch (err) {
      return Promise.resolve({
        ok: false,
        status: 500,
        json: function () { return Promise.resolve({ ok: false, error: String(err) }); }
      });
    }

    return result.then(function (resp) {
      return {
        ok: true,
        status: 200,
        json: function () { return Promise.resolve(resp); }
      };
    }, function (err) {
      return {
        ok: false,
        status: (err && err.status) || 500,
        json: function () { return Promise.resolve({ ok: false, error: (err && err.error) || 'Erro mock' }); }
      };
    });
  };

  /* Badge visual no admin indicando modo simulação */
  window.injectMockBadge = function () {
    if (document.getElementById('mock-badge')) return;
    var topbar = document.querySelector('.topbar__right');
    if (!topbar) return;
    var badge = document.createElement('span');
    badge.id = 'mock-badge';
    badge.textContent = 'MODO SIMULAÇÃO';
    badge.style.cssText = 'background:#F26B21;color:#fff;padding:2px 8px;border-radius:4px;font-size:.65rem;font-weight:700;margin-right:8px;letter-spacing:.5px';
    topbar.insertBefore(badge, topbar.firstChild);
  };
  injectMockBadge();

})();
