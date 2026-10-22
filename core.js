(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Estoque = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1;
  const KEY = 'estoque-certo-mobile:v8-previa-comercial';
  const fields = ['codigo', 'descricao', 'categoria', 'localizacao', 'unidade', 'custo', 'quantidade'];
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const normal = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  function number(value, places = 3) {
    const s = String(value).trim();
    if (!new RegExp('^\\d+(?:[.,]\\d{1,' + places + '})?$').test(s)) throw new Error('Informe um número não negativo, sem separador de milhar.');
    const n = Number(s.replace(',', '.'));
    if (!Number.isFinite(n) || n > 1000000000) throw new Error('Número acima do limite de 1 bilhão.');
    return n;
  }
  function text(value, name, max = 120) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error(name + ': preencha de 1 a ' + max + ' caracteres.');
    return value.trim();
  }
  function product(raw, internal = false) {
    const p = {};
    p.codigo = text(raw.codigo, 'Código', 60);
    p.descricao = text(raw.descricao, 'Descrição');
    p.categoria = text(raw.categoria, 'Categoria', 60);
    p.localizacao = text(raw.localizacao, 'Localização', 60);
    p.unidade = text(raw.unidade, 'Unidade', 12);
    p.custoCentavos = internal ? raw.custoCentavos : Math.round(number(raw.custo, 2) * 100);
    if (!Number.isSafeInteger(p.custoCentavos) || p.custoCentavos < 0 || p.custoCentavos > 100000000000) throw new Error('Custo inválido.');
    p.quantidade = number(raw.quantidade);
    if (!Number.isSafeInteger(Math.round(p.custoCentavos * p.quantidade))) throw new Error('Valor financeiro do produto acima do limite seguro.');
    return p;
  }
  function parseCSV(source) {
    const s = source.replace(/^\uFEFF/, '');
    let quoted = false, first = '';
    for (let i = 0; i < s.length; i++) { if (s[i] === '"') quoted = !quoted; if (!quoted && /[\r\n]/.test(s[i])) break; first += s[i]; }
    const delimiter = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = [], cell = '', inside = false, ended = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inside) {
        if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') { inside = false; ended = true; } else cell += c;
      } else if (c === '"') {
        if (cell || ended) throw new Error('Aspas em posição inválida no CSV.'); inside = true;
      } else if (c === delimiter) { row.push(cell); cell = ''; ended = false; }
      else if (c === '\r' || c === '\n') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); if (row.some(x => x.trim())) rows.push(row); row = []; cell = ''; ended = false; }
      else { if (ended) throw new Error('Caractere após fechamento de aspas.'); cell += c; }
    }
    if (inside) throw new Error('Aspas não fechadas no CSV.');
    row.push(cell); if (row.some(x => x.trim())) rows.push(row);
    if (!rows.length) throw new Error('Arquivo CSV vazio.');
    const headers = rows.shift().map(normal);
    if (headers.length !== fields.length || new Set(headers).size !== fields.length || fields.some(x => !headers.includes(x))) throw new Error('Cabeçalho esperado: ' + fields.join(';'));
    if (!rows.length) throw new Error('O CSV não contém produtos.');
    if (rows.length > 10000) throw new Error('Importe no máximo 10.000 produtos por arquivo.');
    const seen = new Set(), products = [], errors = [];
    rows.forEach((row, i) => {
      try {
        if (row.length !== headers.length) throw new Error('Número de colunas diferente do cabeçalho.');
        const p = product(Object.fromEntries(headers.map((h, j) => [h, row[j]])));
        if (seen.has(p.codigo)) throw new Error('Código duplicado no arquivo: ' + p.codigo);
        seen.add(p.codigo); products.push(p);
      } catch (e) { errors.push('Registro ' + (i + 1) + ': ' + e.message); }
    });
    return { products, errors, total: rows.length };
  }
  // Prefixing spreadsheet formulas prevents CSV injection in Excel/LibreOffice.
  function csvCell(v) { const s = String(v ?? ''); return '"' + (/^[\s]*[=+\-@\t\r]/.test(s) ? "'" + s : s).replace(/"/g, '""') + '"'; }
  function csv(rows) { return '\uFEFF' + rows.map(r => r.map(csvCell).join(';')).join('\r\n'); }
  const decimal = (v, n = 3) => Number(v).toFixed(n).replace('.', ',');
  function productsCSV(products) { return csv([fields, ...products.map(p => [p.codigo, p.descricao, p.categoria, p.localizacao, p.unidade, decimal(p.custoCentavos / 100, 2), decimal(p.quantidade)])]); }
  function report(inv) {
    return inv.items.map(p => {
      const count = inv.counts.find(c => c.codigo === p.codigo);
      const counted = !!count;
      const difference = counted ? Math.round((count.quantidade - p.quantidade) * 1000) / 1000 : null;
      return { ...p, counted, contada: counted ? count.quantidade : null, diferenca: difference, valorCentavos: counted ? Math.sign(difference) * Math.round(Math.abs(difference) * p.custoCentavos) : null, at: counted ? count.at : null };
    });
  }
  function totals(inv) {
    const rows = report(inv), counted = rows.filter(r => r.counted);
    return { total: rows.length, counted: counted.length, pending: rows.length - counted.length, different: counted.filter(r => r.diferenca !== 0).length, balance: counted.reduce((s, r) => s + r.valorCentavos, 0), loss: counted.filter(r => r.valorCentavos < 0).reduce((s, r) => s + r.valorCentavos, 0), surplus: counted.filter(r => r.valorCentavos > 0).reduce((s, r) => s + r.valorCentavos, 0) };
  }
  function reportCSV(inv) { return csv([['inventario','codigo','descricao','categoria','localizacao','unidade','custo_unitario','quantidade_registrada','quantidade_contada','diferenca_quantidade','diferenca_valor','situacao','contado_em'], ...report(inv).map(r => [inv.name,r.codigo,r.descricao,r.categoria,r.localizacao,r.unidade,decimal(r.custoCentavos/100,2),decimal(r.quantidade),r.counted ? decimal(r.contada) : '',r.counted ? decimal(r.diferenca) : '',r.counted ? decimal(r.valorCentavos/100,2) : '',r.counted ? (r.diferenca === 0 ? 'Conferido' : 'Divergente') : 'Pendente',r.at || ''])]); }
  function id() { return globalThis.crypto?.randomUUID?.() || 'inv-' + Date.now() + '-' + Math.random().toString(36).slice(2); }
  function createInventory(products, name) {
    if (!products.length) throw new Error('Cadastre produtos antes de iniciar um inventário.');
    return { id: id(), name: text(name,'Nome do inventário',80), createdAt: new Date().toISOString(), closedAt: null, items: products.map(p => ({ ...p })), counts: [] };
  }
  function setCount(inv, code, value, confirmed = false) {
    if (inv.closedAt) throw new Error('Inventário encerrado; as contagens estão bloqueadas.');
    if (!inv.items.some(p => p.codigo === code)) throw new Error('Produto ausente do inventário.');
    const n = number(value), index = inv.counts.findIndex(c => c.codigo === code);
    if (index !== -1 && !confirmed) throw new Error('Confirme a substituição da contagem anterior.');
    const count = { codigo: code, quantidade: n, at: new Date().toISOString() };
    if (index === -1) inv.counts.push(count); else inv.counts[index] = count;
    return inv;
  }
  function mergeProducts(current, incoming, confirmed = false) {
    if (incoming.some(p => current.some(c => c.codigo === p.codigo)) && !confirmed) throw new Error('Confirme a atualização dos códigos existentes.');
    const merged = new Map(current.map(p => [p.codigo,p]));
    incoming.forEach(p => merged.set(p.codigo, { ...p })); return [...merged.values()];
  }
  function validateState(raw) {
    if (!raw || raw.version !== VERSION || !Array.isArray(raw.products) || !Array.isArray(raw.inventories)) throw new Error('Backup incompatível ou incompleto (versão 1 necessária).');
    const validateProducts = ps => {
      if (!ps.length || ps.length > 10000) throw new Error('Lista de produtos inválida.');
      const products = ps.map(p => product(p, true));
      if (new Set(products.map(p => p.codigo)).size !== products.length) throw new Error('Backup com códigos duplicados.');
      if (!Number.isSafeInteger(products.reduce((s,p) => s + Math.round(p.custoCentavos * p.quantidade),0))) throw new Error('Valor total acima do limite financeiro seguro.');
      return products;
    };
    const date = s => { if (typeof s !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(s) || Number.isNaN(Date.parse(s))) throw new Error('Data inválida no backup.'); return s; };
    const products = validateProducts(raw.products);
    if (raw.inventories.length > 200) throw new Error('Limite de 200 inventários por backup.');
    const inventories = raw.inventories.map(i => {
      const items = validateProducts(i.items);
      if (!Array.isArray(i.counts) || i.counts.length > items.length) throw new Error('Contagens inválidas no backup.');
      const codes = new Set(items.map(p => p.codigo)), seen = new Set();
      const counts = i.counts.map(c => {
        if (!codes.has(c.codigo) || seen.has(c.codigo)) throw new Error('Contagem duplicada ou produto desconhecido.');
        seen.add(c.codigo); return { codigo:c.codigo, quantidade:number(c.quantidade), at:date(c.at) };
      });
      const inv = { id:text(i.id,'Identificador',100), name:text(i.name,'Nome',80), createdAt:date(i.createdAt), closedAt:i.closedAt === null ? null : date(i.closedAt), items, counts };
      const financials = report(inv).filter(r => r.counted).map(r => Math.abs(r.valorCentavos));
      if (financials.some(v => !Number.isSafeInteger(v)) || !Number.isSafeInteger(financials.reduce((s,v) => s + v,0))) throw new Error('Diferenças acima do limite financeiro seguro.');
      return inv;
    });
    if (new Set(inventories.map(i => i.id)).size !== inventories.length) throw new Error('Inventários duplicados.');
    if (raw.activeId !== null && !inventories.some(i => i.id === raw.activeId)) throw new Error('Inventário selecionado inválido.');
    return { version: VERSION, products, inventories, activeId:raw.activeId, updatedAt:date(raw.updatedAt) };
  }
  function persist(storage, state) {
    const next = validateState({ ...state, updatedAt:new Date().toISOString() });
    storage.setItem(KEY, JSON.stringify(next)); return next;
  }
  function seed() {
    const groups = [
      ['Vestuário',['Camiseta básica','Camisa de algodão','Calça jeans','Bermuda sarja','Vestido estampado','Blusa manga longa','Saia midi','Moletom leve','Regata lisa','Meia de algodão'],['P · areia','M · azul','G · preto','GG · verde']],
      ['Papelaria',['Caderno universitário','Caneta esferográfica','Lápis grafite','Bloco de notas','Pasta com elástico','Estojo escolar','Marcador de texto','Borracha branca','Agenda semanal','Régua 30 cm'],['azul','coral','verde','amarelo']],
      ['Presentes',['Caneca de cerâmica','Porta-retrato','Vela aromática','Caixa para presente','Chaveiro artesanal','Caderno de memórias','Mini vaso decorativo','Sacola para presente','Cartão comemorativo','Kit de embalagem'],['natural','azul','rosê','terracota']],
      ['Utilidades',['Pote hermético','Pano de prato','Espátula de silicone','Garrafa reutilizável','Organizador de gaveta','Cesto multiuso','Prendedor de roupa','Tábua de cozinha','Peneira pequena','Jarra com tampa'],['pequeno','médio','grande','família']],
      ['Acessórios',['Bolsa transversal','Carteira compacta','Cinto casual','Boné de algodão','Necessaire','Elástico de cabelo','Presilha','Lenço estampado','Ecobag dobrável','Porta-cartões'],['areia','marinho','preto','oliva']]
    ];
    const products = [];
    groups.forEach(([category,names,variants],g) => {
      for (let j=0;j<20;j++) {
        const n = g*20+j;
        products.push({ codigo:String(100001+n), descricao:names[j%10]+' '+variants[Math.floor(j/10)],categoria:category,localizacao:String.fromCharCode(65+g)+'-'+String(1+Math.floor(j/5)).padStart(2,'0'),unidade:'UN',custoCentavos:350+(n*367)%9800,quantidade:n%17===0?0:5+(n*7)%65 });
      }
    });
    // V7 TEST: start with 20 sample products to allow testing 40/50 thresholds.
    products.splice(20);
    const inventory = createInventory(products,'Inventário de demonstração');
    products.slice(0,24).forEach((p,j) => setCount(inventory,p.codigo, j===3?0:Math.max(0,p.quantidade+(j%5===0?-2:j%7===0?3:0))));
    return {version:VERSION,products,inventories:[inventory],activeId:inventory.id,updatedAt:new Date().toISOString()};
  }
  return {VERSION,KEY,normal,number,product,parseCSV,csvCell,csv,productsCSV,report,totals,reportCSV,createInventory,setCount,mergeProducts,validateState,persist,seed,own};
});
