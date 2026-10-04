# La Panini — assets

Esta pasta guarda os recursos visuais do protótipo navegável (fase de
validação visual). Nenhum arquivo aqui é definitivo: a versão funcional
PHP/MySQL carregará as fotos, o logo e os textos do servidor/banco.

## Estrutura

- `img/favicon.svg` — ícone da aba do navegador (pudim dourado).
- `img/logo-pudim-hass.svg` — **logo oficial Pudim Hass**; usada no cabeçalho
  (`.brand__img`), rodapé e sidebar do painel.
- `img/<id-do-produto>.jpg` — **fotos reais dos produtos** (a adicionar).

## Logo

O logo oficial está em `assets/img/hero.webp` e aparece no cabeçalho e no
hero. Se um novo arquivo de logo vier (ex.: recorte maior com texto), basta:

1. Salve em `assets/img/hero.webp` (ou `logo.png` e ajuste os dois `src`);
2. O cabeçalho usa `.brand__img` (altura 46px) — ajuste a altura em
   `css/style.css` (`.brand__img` e o `@media (max-width: 760px)`).

## Como substituir as ilustrações por fotos reais

As imagens dos produtos e do modal são geradas por `js/art.js`, que tenta
carregar automaticamente `assets/img/<id-do-produto>.jpg`. Se o arquivo
existir, a foto aparece; se não, o protótipo exibe a ilustração SVG
(`dishSVG()`). Basta criar as fotos com o id exato.

Ids do catálogo (de `js/catalog.js`):

- **Kits:** `mesa-farta`, `experiencia-mesa`, `curadoria-casa`
- **Seleções:** `selecao-generosa`, `selecao-compartilhar`, `selecao-essencial`
- **Clássicos:** `bolonhesa-branca`, `bolonhesa-vermelha`, `brocolis-cream-cheese`,
  `frango-branca`, `frango-vermelha`, `presunto-branca`, `presunto-vermelha`
- **Deluxe:** `queijos-gorgonzola`, `gorgonzola-bacon`, `carne-madeira`, `frango-requeijao`
- **Especiais:** `cogumelos`, `carne-gorgonzola`, `file-mignon`
- **Low Carb:** `abobrinha-frango`
- **Frutos do Mar:** `camarao-branco`, `bacalhau`
- **Doces:** `romeu-julieta`, `california`
- **Sobremesas:** `torta-alfajor`, `chaja`, `choc-belga`, `sorvete-alfajor`,
  `pudim-tradicional`, `pudim-coco`, `pudim-cafe`, `pudim-doce-leite`

Exemplos de arquivos: `assets/img/bolonhesa-branca.jpg`,
`assets/img/file-mignon.jpg`, `assets/img/mesa-farta.jpg`.

Recomendação para as fotos: fundo escuro, iluminação quente lateral, foco
nos ingredientes, sem textos sobrepostos — coerente com a identidade
"Nocturno & Artesanal Premium".

## Módulos JavaScript (ordem de carregamento em `index.html`)

1. `js/data.js` — identidade/BRAND, DELIVERY (bairros e taxas), COUPONS,
   CATEGORIES, ADDONS, tamanhos e PRICING (funções puras de cálculo).
2. `js/catalog.js` — `PRODUCTS` (catálogo completo), `getById`, `catOf`, `catName`.
3. `js/art.js` — paletas, `dishSVG`, `placeholderSrc`, `imgFallback`, `heroFallback`, `imgHtml`.
4. `js/app.js` — estado, carrinho, modais, drawer da sacola, checkout em
   4 passos, acompanhar pedido por e-mail, conta simulada, tema, deep links.

O admin (protótipo) usa `css/admin.css` e `js/admin.js` a partir de `admin.html`.

> **Versão funcional:** desde a fase PHP/MySQL, o admin em `admin.html` e a loja em
> `index.html` passaram a consumir a API real (ver `README.md` na raiz). O conteúdo
> desta pasta permanece: o logo oficial, as fotos dos produtos (id = slug do banco)
> e o favicon. Textos, taxas e horários agora vêm de `settings`/`areas` no MySQL e
> são editáveis pelo painel em **Configurações** / **Áreas de entrega**.

## Publicação na HostGator

As fotos sobem junto com o restante do site para `public_html/` (a loja usa apenas
caminhos relativos, então basta copiar a estrutura raiz). Instruções completas de
instalação (banco + `api/install`) estão no `README.md` da raiz.