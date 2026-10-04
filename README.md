# La Panini — Lasanhas Artesanais

Loja virtual + área administrativa. Front-end responsivo (HTML/CSS/JS) em `index.html`
e painel admin em `admin.html`, com backend em **PHP 8 + MySQL** sob `api/` consumido
via `fetch` (a loja cai em modo protótipo com `localStorage` se a API não responder).

## Estrutura

```
lapanini/
├── index.html        # loja (cardápio, checkout, acompanhar pedido)
├── admin.html        # área administrativa (login por sessão)
├── assets/           # imagens, favicon, docs de fotos
├── css/              # style.css (loja) · admin.css (painel)
├── js/
│   ├── data.js       # identidade, BRAND, DELIVERY, PRICING (regras espelham o servidor)
│   ├── catalog.js    # catálogo do protótipo
│   ├── art.js        # ilustrações/fallback de fotos
│   ├── api.js        # camada de integração com a API
│   ├── app.js        # loja (carrinho, checkout, track, conta)
│   └── admin.js      # painel (login real + módulos via API)
├── app/              # Backend: config, helpers, PDO, auth, store (regras de preço)
├── api/
│   ├── index.php     # front controller / roteador (/api/*)
│   ├── .htaccess
│   └── handlers/     # public, dashboard, orders, products, categories,
│                     # addons, coupons, areas, banners, users, settings
└── sql/lapanini.sql  # schema + seed (importar primeiro)
```

## Instalação

1. **Banco:** no cPanel (phpMyAdmin), importe `sql/lapanini.sql` e depois
   `sql/08-users-avatar.sql` (foto de perfil) e `sql/09-baked-fee.sql`
   (taxa da lasanha assada, editável em Configurações → Preparo).
   Bases já criadas: importe também `sql/02-home-sections.sql` (visibilidade/ordem da home),
   `sql/03-selection-1500.sql` (preços 1,5kg + pool da Seleção Generosa),
   `sql/04-addons-cardapio.sql` (adicionais Borda/Molhos/Extras/Retirar do cardápio) e
   `sql/06-addons-required.sql` (coluna "obrigatório" dos adicionais) e
    `sql/07-produto-nomes.sql` (ajustes de nome, ex.: Torta Alfajor na Fatia).
    Em seguida, NESTA ORDEM: `sql/10-sellers.sql` →
    `sql/11-sellers-commission.sql` → `sql/12-seller-rate.sql` (vendedores e
    comissão), `sql/13-cancel-orders.sql` → `sql/14-cancel-history.sql`
    (cancelamento com histórico), `sql/21-corrige-categorias.sql`
    (Romeu e Julieta/Califórnia → Sobremesas), `sql/22-2fa-totp.sql` (2FA),
     `sql/23-lgpd.sql` (consentimentos LGPD) e `sql/24-kits-mini.sql`
     (renomeia `doces` para Kits Mini em bases antigas) e por fim
     `sql/26-pudins-financeiro.sql` (financeiro Pudim Hass: Massa Fresca →
     Caldas, Molhos Caseiros → Geladinhos, fichas de pudim, remove os
     insumos e fichas das lasanhas) e `sql/27-tudo-que-vende.sql`
     (fichas de combos, kits mini, seleções fechadas e bebidas em revenda).
    Os dumps `lapanini.sql`/`lapanini-hostgator.sql` são o snapshot base —
    os incrementais acima são obrigatórios numa instalação nova.
   Para o financeiro: `sql/migration_financial_safe.sql`,
   `sql/migration_financial_v2_isficha.sql` e por fim
   `sql/seed_fichas_tecnicas.sql` (24 insumos + fichas dos 34 produtos `reg`).
   Em seguida, no phpMyAdmin, importe NESTA ORDEM (um de cada vez; se um
   import falhar, corrija antes de rodar o próximo):
   1. `sql/15-ingredient-categories.sql` — coluna `category` nos insumos
      (se já existir: erro 1060 — ignore o ALTER, rode só os UPDATEs);
   2. `sql/16-ficha-tecnica-full.sql` — cria `fichas_tecnicas` + `ficha_insumos`;
   3. `sql/17-massas-molhos-casa.sql` — categorias/produtos de Massa Fresca e
      Molhos Caseiros (internos, fora da vitrine);
   4. `sql/19-ficha-multi-categoria.sql` — campos por tipo (tempo_gratinado,
      modo_de_uso, volume_ml, rendimento_em_l);
   5. `sql/20-fichas-massa-molhos.sql` — fichas completas de massa/molhos.
   Opcional: `sql/18-venda-avulsa.sql` (ativa os 3 na vitrine; após o 17).
2. **Conexão:** edite `app/config.php` com o usuário/senha/banco da HostGator
   (host normalmente `localhost`, charset `utf8mb4`).
3. **Envie os arquivos:** copie a estrutura raiz para `public_html/`.
4. **Crie o primeiro admin:** com o site no ar, faça
   `POST api/install` com um JSON:
   ```json
   { "name": "Administrador", "email": "voce@lapanini.com.br", "password": "senha-segura8+" }
   ```
   A senha precisa de pelo menos 8 caracteres. Esse endpoint só funciona enquanto
   não existir nenhum usuário (proteção contra instalação repetida).

Depois é só abrir `admin.html`, entrar com e-mail/senha e iniciar em **Dashboard**.

## Como funciona

- **Pedidos:** `POST api/orders` — o servidor **recalcula** cada item, subtotal, desconto
  de cupom e taxa de entrega com base no catálogo do banco (nunca confia no valor do
  navegador). Retorna o pedido com número, horário e status.
- **Acompanhamento:** `GET api/orders/lookup?email=...` devolve o pedido mais recente
  daquele e-mail (loja tenta a API e usa `localStorage` como fallback).
- **Admin:** sessão via cookie `lapanini_admin`, senhas com `password_hash`. Operadores
  (perfil `operador`) não criam usuários nem alteram perfis; apenas `admin` gerencia.
- **Configurações:** exibidas na loja via `GET api/settings` (textos, cupom da faixa,
  horários, `free_from`, `home` com visibilidade/ordem das seções) e editáveis no painel em **Configurações**.
  A ordem/visibilidade da home fica em **Home / Seções** (tabela `home_sections`; Cardápio sempre visível).
- **Pricing:** regras autoritativas em `app/store.php`, espelho de `js/data.js`
  (kits/seleções não acumulam cupom, frete grátis quando o kit tem `frete_gratis`,
  abatimento por remoção é negativo, seleção respeita `min_units`/`max_per_flavor`).

## Endpoints

Formato das respostas: `{ "ok": true, "data": ... }` ou `{ "ok": false, "error": ... }`.

Públicos (sem autenticação):
- `GET|POST api/install`
- `GET api/auth/me` · `POST api/auth/login` · `POST api/auth/logout`
- `GET api/catalog` · `GET api/settings`
- `POST api/orders` · `GET api/orders/lookup?email=`

Admin (sessão):
- `GET api/admin/dashboard`
- `GET api/admin/orders` · `GET api/admin/orders/{id}` · `PUT api/admin/orders/{id}`
- `GET|POST api/admin/products` · `GET|PUT|DELETE api/admin/products/{id}`
- `GET|POST api/admin/categories` · `PUT|DELETE api/admin/categories/{id}`
- `GET|POST api/admin/addons` · `PUT|DELETE api/admin/addons/{id}`
- `GET|POST api/admin/coupons` · `PUT|DELETE api/admin/coupons/{code}`
- `GET|POST api/admin/areas` · `PUT|DELETE api/admin/areas/{id}`
- `GET api/admin/banners` · `POST api/admin/banners` · `PUT|DELETE api/admin/banners/{id}`
- `GET api/admin/home-sections` · `PUT api/admin/home-sections` (bulk `{sections:[{id,visible,position}]}`) · `PUT api/admin/home-sections/{id}`
- `POST api/admin/home-image` (multipart campo `image`; JPG/PNG/WebP até 2MB → `assets/img/custom/`; URL salva em `promo_image`)
- `GET|POST api/admin/users` · `PUT|DELETE api/admin/users/{id}`
- `GET|PUT api/admin/settings`

Exemplo de `POST api/orders`:

```json
{
  "customer": { "name": "Camila Souza", "phone": "(19) 99900-1122", "email": "camila@email.com" },
  "delivery": { "mode": "entrega", "areaId": "jardim-interlagos", "when": "hoje" },
  "payment": { "method": "pix" },
  "coupon": "PUDIMHASS10",
  "items": [
    { "productId": "file-mignon", "sizeId": "g1000", "qty": 1, "addons": ["queso-extra"] },
    { "productId": "mesa-farta", "qty": 1 },
    { "productId": "selecao-generosa", "picks": { "bolonhesa-branca": 2, "frango-vermelha": 2 } }
  ]
}
```

## Relevante

- Fotos reais: ver `assets/README.md` (nomes = `id` do produto no banco).
- Ambientes sem PHP/MySQL abrem a loja em modo protótipo (`localStorage`).
- Dados de demonstração: 33 produtos, 9 categorias, 6 áreas, 9 adicionais,
  2 cupons (PUDIMHASS10 ativo) e 2 banners; textos iniciais em `settings`.

> Ajuste horários, taxas, textos e fotos pelo próprio painel — tudo fica no banco.