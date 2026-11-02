# CAP Project Skeleton, Models & Event Handlers

Read for: `cds init`/`cds watch`, entities and services, `before`/`on`/`after` handlers in Node.js, CQL with bound parameters, Java handlers.

---

## 2. Project skeleton

```bash
npm i -g @sap/cds-dk
cds init bookshop && cd bookshop
cds add sample        # optional sample content
cds watch             # dev server with live reload, SQLite in-memory
cds add hana,xsuaa,mta,approuter   # production facets when needed
```

```cds
// db/schema.cds
namespace my.bookshop;
using { cuid, managed } from '@sap/cds/common';

entity Books : cuid, managed {
  title  : String(111) @mandatory;
  stock  : Integer;
  author : Association to Authors;
}
entity Authors : cuid { name : String(111); books : Association to many Books on books.author = $self; }

// srv/cat-service.cds
using my.bookshop as my from '../db/schema';
service CatalogService @(path: '/browse') {
  @readonly entity Books as projection on my.Books;
  action submitOrder(book: Books:ID, quantity: Integer) returns { stock: Integer };
}
```

---

## 3. Event handlers (Node.js)

```js
// srv/cat-service.js
const cds = require('@sap/cds')
module.exports = class CatalogService extends cds.ApplicationService { init() {
  const { Books } = this.entities
  this.before('CREATE', Books, req => { if (req.data.stock < 0) req.error(400, 'stock must be ≥ 0') })
  this.on('submitOrder', async req => {
    const { book, quantity } = req.data
    const n = await UPDATE(Books, book).with`stock = stock - ${quantity}`.where`stock >= ${quantity}`
    if (!n) return req.error(409, `${quantity} exceeds stock for book #${book}`)
    return SELECT.one.from(Books, book).columns('stock')
  })
  return super.init()
}}
```

- Phases: `before` (validate), `on` (implement / replace default), `after` (post-process).
- CQL via `SELECT`/`INSERT`/`UPDATE`/`DELETE` with tagged templates: values are bound
  parameters — don't build CQL/SQL by string concatenation.
- Java: `@Before/@On/@After` handlers on `EventHandler` classes, CQN builders.
