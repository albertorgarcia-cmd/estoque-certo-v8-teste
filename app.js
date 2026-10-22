/* Estoque Certo Mobile · código original · sem bibliotecas ou serviços externos. */
(() => {
  'use strict';
  const E = window.Estoque;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = cents => (cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const num = v => Number(v).toLocaleString('pt-BR',{maximumFractionDigits:3});
  const date = v => new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
  const paths = {
    dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="11" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="18" width="7" height="3" rx="1"/>',
    box:'<path d="m12 3 9 5-9 5-9-5 9-5Z M3 8v10l9 5 9-5V8 M12 13v10 M7 5.8l10 5.5"/>',
    scan:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 7v10m3-10v10m4-10v10m3-10v10M1 12h22"/>',
    chart:'<path d="M4 3v18h17M8 16v-5m5 5V6m5 10v-8"/>',
    shield:'<path d="m12 3 8 3v6c0 5-8 10-8 10S4 17 4 12V6l8-3Z m-4 9 3 3 5-6"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    upload:'<path d="M12 15V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    search:'<circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/>',
    check:'<path d="m5 12 4 4L20 5"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    edit:'<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14v6Z"/>',
    camera:'<path d="M3 7h4l2-3h6l2 3h4v14H3V7Z"/><circle cx="12" cy="13" r="4"/>',
    file:'<path d="M5 3h9l5 5v13H5V3Zm9 0v6h5M8 13h8m-8 4h6"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.box}</svg>`;
  function icons(root = document) { $$('[data-icon]', root).forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
  const view = $('#view'), modal = $('#modal');
  let state, currentView = 'inicio', query = '', category = '', status = '', page = 1, selectedCode = null;
  let cameraStream = null, scanTimer = null, storageBlocked = false, importResult = null, installEvent = null, storageBaseline = null;
  let csvReadVersion = 0, restoreReadVersion = 0;
  const pageSize = 15;
  const FREE_PRODUCT_LIMIT = 50;
  // V8 preview: no paid entitlement or Google Play Billing integration yet.
  // All users remain on the free plan; purchase cannot be simulated.
  const productLimit = () => FREE_PRODUCT_LIMIT;
  const freeLimitMessage = () => `Limite gratuito de ${FREE_PRODUCT_LIMIT} produtos atingido. Seus dados continuam disponíveis para consulta, edição, contagem, exportação e backup. Conheça a versão completa para saber sobre o futuro desbloqueio oficial pela Google Play.`;
  const freeLimitReached = () => state.products.length >= productLimit();
  const titles = {
    inicio:['Seu estoque, em dia.','Uma visão clara para cuidar do que faz seu comércio girar.','CADA PRODUTO NO SEU LUGAR','Visão geral'],
    produtos:['Produtos bem organizados.','Cadastre, encontre e importe os produtos do seu comércio.','A BASE DE UM BOM CONTROLE','Produtos'],
    contagem:['Hora de conferir.','Encontre o produto, conte as unidades e registre o total físico.','DO SISTEMA PARA A PRATELEIRA','Contagem física'],
    relatorio:['As diferenças, à vista.','Compare o registrado com o contado e saiba o impacto em reais.','INFORMAÇÃO PARA AGIR','Diferenças'],
    backup:['Seus dados, com você.','Guarde uma cópia do seu trabalho e retome quando precisar.','CUIDADO QUE FAZ DIFERENÇA','Dados e backup']
  };
  function toast(message) { $('#toast').textContent = message; $('#toast').style.display = 'block'; clearTimeout(toast.timer); toast.timer = setTimeout(()=>$('#toast').style.display='none',5000); }
  function saveIndicator(message, error = false) { $('#save-state').textContent = message; $('#save-state').style.color = error ? '#b74c43' : ''; }
  function load() {
    try {
      const stored = localStorage.getItem(E.KEY);
      storageBaseline = stored;
      if (stored) state = E.validateState(JSON.parse(stored));
      else { state = E.seed(); state = E.persist(localStorage,state); storageBaseline = JSON.stringify(state); }
    } catch (error) {
      storageBlocked = true;
      state = E.seed();
      saveIndicator('⚠ Não salvo · veja Dados e backup',true);
      // Never overwrite an unreadable stored database with the demonstration.
      setTimeout(()=>toast('Não foi possível carregar ou salvar os dados. A demonstração está em memória; confira Dados e backup.'),100);
    }
  }
  function commit(mutator) {
    try {
      if (storageBlocked) throw new Error('Armazenamento indisponível ou dados incompatíveis. Faça backup e use outro navegador; os dados anteriores foram preservados.');
      if (localStorage.getItem(E.KEY) !== storageBaseline) { storageBlocked=true;saveIndicator('⚠ Dados alterados em outra aba',true);throw new Error('Outra aba alterou os dados. Recarregue esta página antes de continuar.'); }
      const next = structuredClone(state); mutator(next);
      state = E.persist(localStorage,next); storageBaseline=JSON.stringify(state);saveIndicator('● Salvo neste navegador'); return true;
    } catch (e) { toast(e.message.includes('quota') || e.name === 'QuotaExceededError' ? 'Espaço do navegador insuficiente. Baixe um backup antes de continuar.' : e.message); return false; }
  }
  const inventory = () => state.inventories.find(i=>i.id===state.activeId) || null;
  function navigate(v) { currentView = v; query = ''; category = ''; status = ''; page = 1; selectedCode = null; render(); }
  function btn(label, action, cls='', ic='') { return `<button type="button" class="btn ${cls}" data-action="${action}">${ic?icon(ic):''}${label}</button>`; }
  function summaryCard(label, value, note, ic, cls='') { return `<article class="card ${cls}"><div class="card-head">${label}<span class="icon-tile">${icon(ic)}</span></div><div class="card-value">${value}</div><div class="card-note">${note}</div></article>`; }
  function empty(message, detail='', action='') { return `<div class="card empty">${icon('box')}<h3>${message}</h3><p>${detail}</p>${action}</div>`; }
  function productCell(p) { return `<div class="product-cell"><span class="product-tile">${icon('box')}</span><div><strong title="${esc(p.descricao)}">${esc(p.descricao)}</strong><small>${esc(p.codigo)} · ${esc(p.localizacao)}</small></div></div>`; }
  function badge(r) { return r.counted ? (r.diferenca===0?'<span class="badge green">Conferido</span>':'<span class="badge red">Divergente</span>') : '<span class="badge orange">Pendente</span>'; }
  function render() {
    const t = titles[currentView]; $('#page-title').textContent=t[0];$('#page-subtitle').textContent=t[1];$('#eyebrow').textContent=t[2];$('#breadcrumb').textContent=t[3];
    $$('.nav-item').forEach(b=>{ b.classList.toggle('active',b.dataset.view===currentView); if(b.dataset.view===currentView)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current'); });
    $('#nav-products').textContent=state.products.length;
    $('#demo-description').textContent=state.products.length+' produtos no cadastro local · dados iniciais fictícios.';
    $('#inventory-select').innerHTML=state.inventories.length?state.inventories.map(i=>`<option value="${esc(i.id)}" ${i.id===state.activeId?'selected':''}>${esc(i.name)}</option>`).join(''):'<option>Nenhum inventário</option>';
    const inv = inventory(); $('#inventory-status').textContent=inv?(inv.closedAt?'Encerrado':'Em andamento'):'';
    $('#inventory-status').className='badge '+(inv?.closedAt?'':'green');
    if(currentView==='inicio') overview();
    if(currentView==='produtos') productsView();
    if(currentView==='contagem') countView();
    if(currentView==='relatorio') reportView();
    if(currentView==='backup') backupView();
    icons();
  }
  function overview() {
    const inv=inventory(), totalValue=state.products.reduce((s,p)=>s+Math.round(p.custoCentavos*p.quantidade),0), s=inv?E.totals(inv):{total:0,counted:0,pending:0,balance:0,different:0};
    const pct=s.total?Math.round(s.counted/s.total*100):0;
    const cats=[...new Set(state.products.map(p=>p.categoria))];
    view.innerHTML=`<div class="cards">
      ${summaryCard('Produtos cadastrados',num(state.products.length),'Distribuídos em '+cats.length+' categorias','box')}
      ${summaryCard('Estoque a custo',money(totalValue),'Quantidade registrada × custo unitário','chart','featured')}
      ${summaryCard('Produtos contados',s.counted+'<span style="font-size:15px;color:#93a08c"> / '+s.total+'</span>',pct+'% do inventário selecionado','check')}
      ${summaryCard('Aguardando contagem',num(s.pending),'Pendente não significa quantidade zero','clock')}
      </div><div class="dashboard-grid"><article class="inventory-hero"><p class="section-label">SEU INVENTÁRIO FÍSICO</p><div class="hero-decoration">${icon('box')}</div><span class="badge green">${inv?.closedAt?'Encerrado':'Em andamento'}</span><h2>${inv?esc(inv.name):'Comece pela primeira contagem'}</h2><p>Um produto por vez.<br>Mais clareza sobre o que está na sua loja.</p><div class="hero-line"><div class="progress-block"><div class="progress-legend"><strong>${pct}% concluído</strong><span>${s.counted} de ${s.total}</span></div><div class="progress" role="progressbar" aria-label="Avanço da contagem" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div></div>${btn('Ir para contagem','goto-count','primary','arrow')}</div></article>
      <article class="card"><div class="section-head"><div><h2>Seu mix de produtos</h2><p>Produtos por categoria</p></div>${icon('chart')}</div>${cats.slice(0,8).map((c,i)=>{const n=state.products.filter(p=>p.categoria===c).length;return `<div class="category-row"><span>${esc(c)}</span><div class="category-bar"><i style="width:${n/state.products.length*100}%;background:${['#537c50','#8ca66c','#c5d39a','#b9c6b5','#d4b98d'][i%5]}"></i></div><strong>${n}</strong></div>`;}).join('')}${cats.length>8?'<p class="help-text">Exibindo 8 de '+cats.length+' categorias.</p>':''}</article></div>
      <article class="card"><div class="section-head"><div><h2>Conferências recentes</h2><p>As últimas contagens deste inventário</p></div><button class="link-btn" data-action="goto-report">Ver diferenças ${icon('arrow')}</button></div>${inv&&inv.counts.length?recentTable(inv):empty('Nenhum produto contado ainda','Registre a primeira contagem para acompanhar aqui.')}</article>
      <div class="notice" style="margin-top:20px">${icon('shield')} <strong>Um detalhe que faz diferença:</strong> as contagens não alteram o estoque cadastrado. Revise o relatório antes de ajustar seu controle.</div>`;
  }
  function recentTable(inv) {
    const rows=E.report(inv).filter(r=>r.counted).sort((a,b)=>b.at.localeCompare(a.at)).slice(0,5);
    return `<div class="table-wrap"><table><thead><tr><th>Produto</th><th>Categoria</th><th class="numeric">Registrado</th><th class="numeric">Contado</th><th>Situação</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${productCell(r)}</td><td>${esc(r.categoria)}</td><td class="numeric">${num(r.quantidade)}</td><td class="numeric">${num(r.contada)}</td><td>${badge(r)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function filterToolbar(source, withStatus=false) {
    const categories=[...new Set(source.map(p=>p.categoria))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    return `<div class="toolbar"><div class="search">${icon('search')}<input id="search" type="search" aria-label="Pesquisar por código ou descrição" placeholder="Buscar por código ou descrição..." value="${esc(query)}" autocomplete="off"></div><div class="toolbar-group"><select id="category-filter" aria-label="Filtrar categoria"><option value="">Todas as categorias</option>${categories.map(c=>`<option ${category===c?'selected':''} value="${esc(c)}">${esc(c)}</option>`).join('')}</select>${withStatus?`<select id="status-filter" aria-label="Filtrar situação"><option value="">Todas as situações</option><option value="pending" ${status==='pending'?'selected':''}>Pendentes</option><option value="different" ${status==='different'?'selected':''}>Divergentes</option><option value="ok" ${status==='ok'?'selected':''}>Conferidos</option></select>`:''}</div></div>`;
  }
  function filtered(source) { const q=E.normal(query);return source.filter(p=>(!q||E.normal(p.codigo).includes(q)||E.normal(p.descricao).includes(q))&&(!category||p.categoria===category)&&(!status||(status==='pending'&&!p.counted)||(status==='different'&&p.counted&&p.diferenca!==0)||(status==='ok'&&p.counted&&p.diferenca===0))); }
  function paginate(items) { const pages=Math.max(1,Math.ceil(items.length/pageSize));page=Math.min(page,pages);return {rows:items.slice((page-1)*pageSize,page*pageSize),pages,total:items.length}; }
  function pagination(p) { return `<div class="pagination"><span>${p.total?((page-1)*pageSize+1)+'–'+Math.min(page*pageSize,p.total):'0'} de ${p.total} produtos</span><div><button class="btn small" data-action="prev" ${page===1?'disabled':''} aria-label="Página anterior">←</button><span>${page} / ${p.pages}</span><button class="btn small" data-action="next" ${page===p.pages?'disabled':''} aria-label="Próxima página">→</button></div></div>`; }
  function productsView() {
    const p=paginate(filtered(state.products));
    const usage=state.products.length;
    const salesNotice = usage>=40
      ? `<div class="notice ${usage>=50?'warning':''}"><strong>Seu plano gratuito:</strong> ${usage} de 50 produtos utilizados. ${usage>=50?'Você atingiu o limite gratuito. Pode continuar editando e contando os produtos existentes.':'Você está chegando ao limite gratuito.'} Versão completa planejada: <strong>até 2.000 produtos por R$ 79,90, pagamento único.</strong> ${btn('Conhecer a versão completa','upgrade-info','primary')}</div>`
      : `<div class="notice"><strong>Plano gratuito:</strong> ${usage} de 50 produtos utilizados. Cadastre, conte e gere relatórios gratuitamente. ${btn('Conhecer a versão completa','upgrade-info')}</div>`;
    view.innerHTML=`${salesNotice}<article class="card"><div class="section-head"><div><h2>Catálogo de produtos</h2><p>${state.products.length} produtos · altere o cadastro sem mudar inventários existentes</p></div><div class="toolbar-group">${btn('Importar CSV','import','','upload')}${btn('Cadastrar','add-product','primary','plus')}</div></div>${filterToolbar(state.products)}<div class="table-wrap"><table><thead><tr><th>Produto</th><th>Categoria</th><th>Unidade</th><th class="numeric">Custo</th><th class="numeric">Quantidade</th><th>Ação</th></tr></thead><tbody>${p.rows.map(r=>`<tr><td>${productCell(r)}</td><td>${esc(r.categoria)}</td><td>${esc(r.unidade)}</td><td class="numeric">${money(r.custoCentavos)}</td><td class="numeric">${num(r.quantidade)}</td><td><button class="icon-btn" data-edit="${esc(r.codigo)}" aria-label="Editar ${esc(r.descricao)}">${icon('edit')}</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty">Nenhum produto encontrado.</td></tr>'}</tbody></table></div>${pagination(p)}</article><p class="help-text">Valores calculados a custo de aquisição. Quantidades aceitam zero e até três casas decimais. Códigos preservam zeros à esquerda.</p>`;
  }
  function countView() {
    const inv=inventory();if(!inv){view.innerHTML=empty('Nenhum inventário criado','Comece um inventário para registrar as contagens.',btn('Novo inventário','new-inventory','primary','plus'));return;}
    const s=E.totals(inv),p=paginate(filtered(E.report(inv))), chosen=E.report(inv).find(r=>r.codigo===selectedCode);
    view.innerHTML=`<div class="notice ${inv.closedAt?'warning':''}">${inv.closedAt?'Este inventário foi encerrado em '+date(inv.closedAt)+'. As contagens estão bloqueadas.':'Informe o <strong>total físico</strong> encontrado. Cada registro substitui a contagem anterior mediante confirmação; não soma unidades.'} <strong>${s.pending} pendentes</strong> de ${s.total} produtos.</div><div class="count-layout"><article class="card"><div class="section-head"><div><h2>Encontre e conte</h2><p>Código, descrição ou leitor USB/Bluetooth</p></div>${btn('Câmera','scan','','camera')}</div>${filterToolbar(inv.items,true)}<div>${p.rows.map(r=>`<div class="count-item"><div><strong>${esc(r.descricao)}</strong><p>${esc(r.codigo)} · ${esc(r.localizacao)} · ${esc(r.unidade)}</p>${badge(r)} ${r.counted?'<small class="muted"> · '+num(r.contada)+' contados</small>':''}</div><button class="btn small ${r.codigo===selectedCode?'primary':''}" data-count="${esc(r.codigo)}" ${inv.closedAt?'disabled':''}>${r.counted?'Recontar':'Contar'} ${icon('arrow')}</button></div>`).join('')||'<div class="empty">Nenhum produto encontrado.</div>'}</div>${pagination(p)}</article><aside class="card count-panel" aria-label="Registrar contagem">${chosen?`<span class="badge">${esc(chosen.localizacao)} · ${esc(chosen.codigo)}</span><h2>${esc(chosen.descricao)}</h2><p class="help-text">Registrado: <strong>${num(chosen.quantidade)} ${esc(chosen.unidade)}</strong><br>${chosen.counted?'Contagem anterior: '+num(chosen.contada)+' · '+date(chosen.at):'Este produto ainda está pendente.'}</p><form id="count-form"><label for="count-value"><strong>Total físico encontrado</strong></label><input class="big-input" id="count-value" name="quantidade" inputmode="decimal" placeholder="0" required autocomplete="off" ${inv.closedAt?'disabled':''}><p class="help-text">Zero é válido. Não deixe o campo vazio.</p><button class="btn primary full-width" style="margin-top:15px" ${inv.closedAt?'disabled':''}>${icon('check')}Salvar contagem</button></form>`:`${icon('scan')}<h2>Pronto para contar?</h2><p class="help-text">Selecione um produto na lista ao lado. No celular, o formulário aparecerá aqui, acima da pesquisa.</p><div class="notice">Dica: leitores que funcionam como teclado podem preencher a busca com o código e usar Enter.</div>`}</aside></div><div class="toolbar" style="margin-top:20px"><p class="help-text">O inventário usa o cadastro de ${date(inv.createdAt)}. Novos produtos entram no próximo inventário.</p>${!inv.closedAt?btn('Encerrar inventário','close-inventory','','check'):''}</div>`;
  }
  function reportView() {
    const inv=inventory();if(!inv){view.innerHTML=empty('Sem inventário para comparar','Crie um inventário e registre as contagens.');return;}
    const s=E.totals(inv),p=paginate(filtered(E.report(inv)));
    view.innerHTML=`<div class="cards">${summaryCard('Saldo das diferenças',money(s.balance),'Apenas '+s.counted+' produtos contados','chart','featured')}${summaryCard('Faltas a custo',money(s.loss),'Soma das diferenças negativas','box')}${summaryCard('Sobras a custo',money(s.surplus),'Soma das diferenças positivas','plus')}${summaryCard('Produtos divergentes',String(s.different),s.pending+' pendentes fora do cálculo','scan')}</div><div class="notice ${s.pending?'warning':''}">${s.pending?'<strong>Relatório parcial:</strong> '+s.pending+' produtos ainda não foram contados. Suas diferenças ficam em branco, inclusive no CSV.':'Todos os produtos foram contados.'} Diferença = contado − registrado. Valor = diferença × custo da abertura do inventário.</div><article class="card"><div class="section-head"><div><h2>Conferência de diferenças</h2><p>${esc(inv.name)} · ${inv.closedAt?'encerrado':'em andamento'}</p></div>${btn('Exportar CSV completo','export-report','primary','download')}</div>${filterToolbar(inv.items,true)}<div class="table-wrap"><table><thead><tr><th>Produto</th><th class="numeric">Registrado</th><th class="numeric">Contado</th><th class="numeric">Diferença</th><th class="numeric">Impacto a custo</th><th>Situação</th></tr></thead><tbody>${p.rows.map(r=>`<tr><td>${productCell(r)}</td><td class="numeric">${num(r.quantidade)}</td><td class="numeric">${r.counted?num(r.contada):'—'}</td><td class="numeric ${r.diferenca<0?'negative':r.diferenca>0?'positive':''}">${r.counted?(r.diferenca>0?'+':'')+num(r.diferenca):'—'}</td><td class="numeric ${r.valorCentavos<0?'negative':r.valorCentavos>0?'positive':''}">${r.counted?money(r.valorCentavos):'—'}</td><td>${badge(r)}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">Nenhum produto encontrado.</td></tr>'}</tbody></table></div>${pagination(p)}</article><p class="help-text">O CSV exporta todos os produtos do inventário, independentemente dos filtros. Diferenças financeiras são arredondadas por item para centavos; valores negativos recebem proteção de fórmula no CSV e podem abrir como texto na planilha.</p>`;
  }
  function backupView() {
    view.innerHTML=`${storageBlocked?'<div class="notice error"><strong>Armazenamento bloqueado ou conteúdo local inválido.</strong> O conteúdo anterior não foi substituído. A demonstração está temporariamente em memória. Exporte os dados locais originais antes de recuperar um backup ou testar outro navegador. Alterações estão bloqueadas para evitar perda.</div>':''}<div class="backup-grid"><article class="card">${icon('shield')}<h2>Backup completo</h2><p>Baixe produtos, inventários e contagens em um arquivo JSON. Guarde uma cópia fora deste navegador antes de trocar de aparelho ou limpar os dados.</p><p class="help-text">${state.products.length} produtos · ${state.inventories.length} inventário(s)<br>Última gravação: ${date(state.updatedAt)}</p>${btn('Baixar backup JSON','backup','primary','download')}</article><article class="card">${icon('upload')}<h2>Restaurar uma cópia</h2><p>Confira o arquivo antes de confirmar. A restauração substitui todos os dados locais. Baixe o backup atual primeiro para manter seu trabalho.</p>${btn('Selecionar backup','restore','','upload')}</article><article class="card">${icon('file')}<h2>Leve seus produtos</h2><p>Exporte o catálogo ou baixe um modelo de importação. CSV em UTF-8, separado por ponto e vírgula, com custo e quantidade em formato brasileiro.</p><div class="toolbar-group">${btn('Exportar produtos','export-products','','download')}${btn('Modelo CSV','template','','file')}</div></article><article class="card">${icon('dashboard')}<h2>Usar como aplicativo</h2><p id="pwa-description">Abra a versão completa por localhost ou HTTPS para habilitar os recursos PWA. No navegador compatível, instale pelo menu. No iPhone: Compartilhar → Adicionar à Tela de Início.</p><button class="btn" id="install-app" ${installEvent?'':'disabled'}>Instalar aplicativo</button><p class="help-text" id="pwa-state">${location.protocol==='file:'?'Arquivo local: modo demonstração. PWA não disponível.':'Verificando disponibilidade offline...'}</p></article></div><div class="notice" style="margin-top:22px"><strong>Como seus dados são guardados:</strong> somente neste navegador e neste endereço. Não há conta, sincronização ou servidor. Uma janela anônima, outro navegador ou outro endereço usa dados separados. Faça backup regularmente.</div>${storageBlocked?btn('Exportar conteúdo local original','raw-backup','','download'):''}`;
    updatePWAState();
  }
  function openModal(title, content) { stopCamera();$('#modal-title').textContent=title;$('#modal-content').innerHTML=content;modal.showModal(); }
  function closeModal() { csvReadVersion++;restoreReadVersion++;stopCamera();modal.close(); }
  function productForm(code, draft = null) {
    const p=state.products.find(p=>p.codigo===code),values=draft || (p?{...p,custo:(p.custoCentavos/100).toFixed(2).replace('.',',')}:{ });
    const labels=[['codigo','Código do produto','Ex.: 000123'],['descricao','Descrição','Ex.: Caneca de cerâmica azul'],['categoria','Categoria','Ex.: Presentes'],['localizacao','Localização','Ex.: A-01'],['unidade','Unidade','Ex.: UN'],['custo','Custo unitário (R$)','Ex.: 12,90'],['quantidade','Quantidade registrada','Ex.: 0']];
    openModal(p?'Editar produto':'Cadastrar produto',`<form id="product-form" data-code="${esc(code||'')}"><div class="form-grid">${labels.map(([key,label,placeholder])=>`<div class="field ${key==='descricao'?'full':''}"><label for="f-${key}">${label}</label><input id="f-${key}" name="${key}" value="${esc(values[key]??'')}" placeholder="${placeholder}" required ${key==='codigo'&&p?'readonly':''} ${['custo','quantidade'].includes(key)?'inputmode="decimal"':`maxlength="${key==='descricao'?120:key==='unidade'?12:60}"`}>${key==='codigo'&&!p?'<button type="button" class="btn" data-action="scan-product" style="margin-top:8px">'+icon('camera')+' Ler código pela câmera</button>':''}</div>`).join('')}</div><p class="help-text">${p?'O código é fixo. Alterações não modificam inventários já criados.':'Todos os campos são obrigatórios. Zero é uma quantidade válida.'}</p><p id="form-error" class="form-error" role="alert"></p><div class="form-actions">${btn('Cancelar','cancel')}<button class="btn primary">Salvar produto</button>${!p?'<button type="submit" class="btn" data-save-next="true">Salvar e cadastrar outro</button>':''}</div></form>`);
  }
  function newInventory() {
    openModal('Novo inventário físico',`<form id="inventory-form"><div class="notice">Uma nova contagem com os <strong>${state.products.length} produtos</strong> cadastrados. Todos começam pendentes. Inventários anteriores serão preservados.</div><div class="field"><label for="inventory-name">Nome do inventário</label><input id="inventory-name" name="name" required maxlength="80" value="Inventário de ${new Date().toLocaleDateString('pt-BR')}" autocomplete="off"></div><p class="help-text">Custos, quantidades e localizações serão copiados para esta contagem. O cadastro continuará independente.</p><p id="form-error" class="form-error" role="alert"></p><div class="form-actions">${btn('Cancelar','cancel')}<button class="btn primary">Criar inventário</button></div></form>`);
  }
  function importModal() {
    if (freeLimitReached()) { toast(freeLimitMessage()); return; }
    importResult=null;
    openModal('Importar produtos por CSV',`<p class="help-text">Selecione um CSV em UTF-8, com até 10.000 linhas e 5 MB. Separador ponto e vírgula ou vírgula. O arquivo inteiro precisa ser válido antes da importação.</p><p class="help-text">Cabeçalhos: <code>codigo;descricao;categoria;localizacao;unidade;custo;quantidade</code><br>Use <code>12,90</code> com separador ponto e vírgula. Não use separadores de milhar.</p>${btn('Baixar modelo CSV','template','small','download')}<label class="file-zone">Arquivo de produtos<input type="file" id="csv-file" accept=".csv,text/csv"></label><div id="import-preview" aria-live="polite"></div><div class="form-actions">${btn('Cancelar','cancel')}<button class="btn primary" id="confirm-import" disabled>Importar produtos</button></div>`);
  }
  function download(content,name,type='text/plain;charset=utf-8') { const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000); }
  function backup() { download(JSON.stringify(state,null,2),'estoque-certo-backup-'+new Date().toISOString().slice(0,10)+'.json','application/json');toast('Backup gerado. Confira o arquivo na pasta de downloads.'); }
  function restoreModal() {
    openModal('Restaurar backup',`<div class="notice warning">A restauração substitui produtos e todos os inventários. <strong>Baixe seu backup atual antes de continuar.</strong></div>${btn('Baixar backup atual','backup','','download')}<label class="file-zone">Backup JSON do Estoque Certo Mobile<input id="restore-file" type="file" accept=".json,application/json"></label><div id="restore-preview" aria-live="polite"></div>`);
  }
  async function readFile(input,max=10*1024*1024) { const file=input.files[0];if(!file)return null;if(file.size>max)throw new Error('Arquivo grande demais. Limite: '+Math.round(max/1024/1024)+' MB.');const content=await file.text();if(content.includes('\uFFFD'))throw new Error('Codificação inválida. Salve o arquivo como UTF-8 e tente novamente.');return content; }
  // O ZXing faz a leitura no iPhone; a sessão impede callbacks de câmeras já fechadas.
  let zxingReader=null, scanSession=0;
  function stopCamera() {
    scanSession++;
    clearTimeout(scanTimer);
    scanTimer=null;
    const active=zxingReader;
    zxingReader=null;
    if(active){try{active.stop();}catch(e){}}
    cameraStream?.getTracks().forEach(t=>t.stop());cameraStream=null;
    const video=$('#scan-video');
    if(video?.srcObject){try{video.srcObject.getTracks().forEach(t=>t.stop());}catch(e){}video.srcObject=null;}
  }
  let scanPurpose='count', productDraft=null;
  function acceptScannedCode(code,inv) {
    code=String(code??'').trim();
    if(scanPurpose==='product'){
      const existing=state.products.find(p=>p.codigo===code);
      if(existing){const msg=$('#scan-message');if(msg)msg.textContent='Código '+code+' já cadastrado: '+existing.descricao+'. Feche a câmera para voltar ao cadastro.';return false;}
      const draft={...(productDraft||{}),codigo:code};
      productDraft=null;closeModal();productForm(null,draft);return true;
    }
    const product=inv.items.find(p=>p.codigo===code);
    if(product){selectedCode=code;query=code;status='';category='';page=1;closeModal();render();$('#count-value')?.focus();return true;}
    if($('#scan-message'))$('#scan-message').textContent='Código '+code+' não cadastrado neste inventário. Tente outro produto.';
    return false;
  }
  function loadZXing() {
    if(window.ZXingBrowser)return Promise.resolve(window.ZXingBrowser);
    if(window.__estoqueZXingPromise)return window.__estoqueZXingPromise;
    // Biblioteca de terceiros carregada sob demanda; requer internet na primeira utilização.
    window.__estoqueZXingPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/zxing-browser.min.js';
      script.onload=()=>window.ZXingBrowser?resolve(window.ZXingBrowser):reject(new Error('Biblioteca não carregada.'));
      script.onerror=()=>reject(new Error('Não foi possível carregar o leitor. Verifique a internet.'));
      document.head.appendChild(script);
    }).catch(e=>{window.__estoqueZXingPromise=null;throw e;});
    return window.__estoqueZXingPromise;
  }
  // No Android/Chrome, tenta também o detector nativo sobre o MESMO vídeo.
  // ZXing continua ativo como alternativa, inclusive para iPhone.
  async function startNativeScan(video, inv, session) {
    if (!('BarcodeDetector' in window)) return false;
    let detector;
    try {
      const preferred=['ean_13','ean_8','upc_a','upc_e','code_128','code_39','itf'];
      const supported=typeof BarcodeDetector.getSupportedFormats==='function'
        ? await BarcodeDetector.getSupportedFormats() : preferred;
      const formats=preferred.filter(f=>supported.includes(f));
      if (!formats.length || session!==scanSession) return false;
      detector=new BarcodeDetector({formats});
    } catch(e) { return false; }
    let attempts=0;
    const tick=async()=>{
      if(session!==scanSession||!modal.open||!$('#scan-video'))return;
      if(video.readyState>=2 && video.videoWidth>0){
        try {
          const found=await detector.detect(video);
          if(session!==scanSession||!modal.open)return;
          for(const item of found){
            const code=String(item.rawValue||'').trim();
            if(code && acceptScannedCode(code,inv))return;
            if(code){ // Código identificado, mas não cadastrado: manter aviso visível.
              scanTimer=setTimeout(tick,750);return;
            }
          }
        }catch(e){ /* ZXing permanece como alternativa. */ }
        attempts++;
        if(attempts%12===0){
          const msg=$('#scan-message');
          if(msg && !msg.textContent.includes('não cadastrado'))
            msg.textContent='Câmera ativa · procurando código de barras ('+attempts+' verificações). Centralize o código e mantenha a imagem nítida.';
        }
      }
      scanTimer=setTimeout(tick,350);
    };
    scanTimer=setTimeout(tick,350);
    return true;
  }
  async function scan(purpose='count') {
    scanPurpose=purpose;
    const inv=inventory();if(purpose==='count'&&(!inv||inv.closedAt)){toast('Selecione um inventário em andamento.');return;}
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){
      openModal('Leitura pela câmera',`<div class="notice">A câmera exige HTTPS e permissão do usuário. Use a pesquisa por código ou descrição.</div><div class="form-actions">${btn('Entendi','cancel','primary')}</div>`);return;
    }
    openModal('Ler código de barras',`<p class="help-text">Aponte para o código do produto. Nenhuma imagem é enviada para nosso servidor.</p><video id="scan-video" class="scan-video" autoplay muted playsinline></video><p id="scan-message" class="help-text" role="status">Carregando leitor de código de barras...</p><div class="form-actions">${btn('Fechar câmera','cancel')}</div>`);
    const session=scanSession;
    try {
      // Usar o mesmo decodificador em todos os navegadores evita que um detector
      // nativo abra a câmera mas falhe silenciosamente na leitura.
      const ZX=await loadZXing();
      if(session!==scanSession||!modal.open||!$('#scan-video'))return;
      const reader=new ZX.BrowserMultiFormatReader();
      const video=$('#scan-video');
      $('#scan-message').textContent='Solicitando câmera traseira...';
      const controls=await reader.decodeFromConstraints(
        {video:{facingMode:{ideal:'environment'}},audio:false},video,
        (result,error)=>{
          if(session!==scanSession||!modal.open)return;
          if(result){acceptScannedCode(result.getText(),inv);return;}
          // NotFoundException é normal enquanto o código não está enquadrado.
          if(error&&error.name&&!['NotFoundException','ChecksumException','FormatException'].includes(error.name)){
            const message=$('#scan-message');
            if(message && !message.textContent.includes('não cadastrado'))message.textContent='Leitor ativo · ZXing: '+String(error.name).slice(0,60)+'. Tentando reconhecer o código...';
          }
        }
      );
      if(session!==scanSession||!modal.open){controls.stop();return;}
      zxingReader=controls;
      $('#scan-message').textContent='Leitor ativo. Centralize o código de barras e mantenha a imagem nítida.';
      // Não inicia outra câmera: ambos os leitores observam o mesmo vídeo.
      startNativeScan(video,inv,session).catch(()=>{});
    }catch(e){
      if(session!==scanSession)return;
      stopCamera();
      if($('#scan-message'))$('#scan-message').textContent='Não foi possível iniciar o leitor: '+(e?.message||'erro desconhecido')+'. Use a pesquisa manual.';
    }
  }
  async function updatePWAState() {
    if(!$('#pwa-state')||location.protocol==='file:')return;
    try {const registration=await navigator.serviceWorker?.getRegistration();if($('#pwa-state'))$('#pwa-state').textContent=registration?.active?'Recursos offline preparados neste endereço. A instalação depende do navegador.':'Offline ainda não confirmado. Recarregue a versão completa em localhost ou HTTPS.';}catch(e){if($('#pwa-state'))$('#pwa-state').textContent='PWA não disponível neste ambiente.';}
  }
  // Centralized handlers also work with dynamically rendered content.
  document.addEventListener('click',event=>{
    const el=event.target.closest('button');if(!el)return;
    if(el.dataset.view){navigate(el.dataset.view);return;}
    if(el.dataset.edit){productForm(el.dataset.edit);return;}
    if(el.dataset.count){selectedCode=el.dataset.count;render();$('#count-value')?.focus();return;}
    const a=el.dataset.action;
    if(a==='upgrade-info')openModal('Estoque Certo Completo',`<p>Plano previsto: até <strong>2.000 produtos</strong>, por <strong>R$ 79,90</strong>, pagamento único e sem mensalidade.</p><p>Os produtos, inventários, relatórios, câmera e backup serão mantidos após um desbloqueio oficial.</p><div class="notice warning"><strong>VERSÃO V8 EM PREPARAÇÃO:</strong> a compra ainda não está disponível. Nenhum pagamento é realizado aqui e não existe botão de desbloqueio de teste. A futura compra deverá ocorrer pela Google Play, após a integração e a publicação do aplicativo Android.</div><div class="form-actions">${btn('Voltar','cancel')}${btn('Compra indisponível nesta versão','purchase-unavailable','',null)}</div>`);
    if(a==='purchase-unavailable')toast('A compra estará disponível somente após integração oficial com a Google Play.');
    if(a==='goto-count')navigate('contagem');
    if(a==='goto-report')navigate('relatorio');
    if(a==='add-product')productForm();
    if(a==='new-inventory')newInventory();
    if(a==='cancel'){const back=scanPurpose==='product'&&!!$('#scan-video');const draft=productDraft;closeModal();if(back){productDraft=null;productForm(null,draft);}}
    if(a==='import')importModal();
    if(a==='prev'||a==='next'){page+=a==='next'?1:-1;render();}
    if(a==='backup')backup();
    if(a==='restore')restoreModal();
    if(a==='export-products')download(E.productsCSV(state.products),'estoque-certo-produtos.csv','text/csv;charset=utf-8');
    if(a==='export-report'&&inventory())download(E.reportCSV(inventory()),'estoque-certo-diferencas.csv','text/csv;charset=utf-8');
    if(a==='template')download(E.productsCSV([{codigo:'000123',descricao:'Produto de exemplo',categoria:'Presentes',localizacao:'A-01',unidade:'UN',custoCentavos:1290,quantidade:0}]),'modelo-produtos.csv','text/csv;charset=utf-8');
    if(a==='scan')scan();
    if(a==='scan-product'){const f=$('#product-form');if(f){productDraft=Object.fromEntries(new FormData(f));scan('product');}}
    if(a==='raw-backup'){try{download(localStorage.getItem(E.KEY)||'Nenhum dado encontrado.','estoque-certo-conteudo-local-original.txt');}catch(e){toast('O navegador bloqueou a leitura dos dados locais.');}}
    if(a==='close-inventory'){
      const inv=inventory();if(!inv)return;const pending=E.totals(inv).pending;
      if(confirm(`Encerrar "${inv.name}"? ${pending?pending+' produtos continuarão identificados como pendentes. ':''}As contagens ficarão bloqueadas e o estoque cadastrado não será alterado.`)) {
        if(commit(s=>s.inventories.find(i=>i.id===s.activeId).closedAt=new Date().toISOString())){render();toast('Inventário encerrado. Relatório preservado.');}
      }
    }
  });
  document.addEventListener('input',event=>{
    if(event.target.id==='search'){
      const cursor=event.target.selectionStart;query=event.target.value;page=1;render();const input=$('#search');input.focus();try{input.setSelectionRange(cursor,cursor);}catch(e){}
    }
  });
  document.addEventListener('keydown',event=>{
    if(event.target.id==='search'&&event.key==='Enter'&&currentView==='contagem'){
      event.preventDefault();const matches=filtered(E.report(inventory()));const exact=matches.find(p=>p.codigo===query.trim());
      if(exact||matches.length===1){selectedCode=(exact||matches[0]).codigo;render();$('#count-value')?.focus();}else toast('Selecione um produto da lista para contar.');
    }
  });
  document.addEventListener('change',async event=>{
    const el=event.target;
    if(el.id==='inventory-select'){if(commit(s=>s.activeId=el.value)){selectedCode=null;page=1;render();}else render();}
    if(el.id==='category-filter'){category=el.value;page=1;render();}
    if(el.id==='status-filter'){status=el.value;page=1;render();}
    if(el.id==='csv-file'){
      const version=++csvReadVersion;
      importResult=null;$('#confirm-import').disabled=true;
      try {const content=await readFile(el,5*1024*1024);if(version!==csvReadVersion||content===null)return;const result=E.parseCSV(content);if(!$('#import-preview'))return;importResult=result;
        const overlaps=result.products.filter(p=>state.products.some(x=>x.codigo===p.codigo)).length;
        const newCount=result.products.length-overlaps;
        const overLimit=state.products.length+newCount>productLimit();
        $('#import-preview').innerHTML=`<div class="notice ${result.errors.length?'error':''}"><strong>${result.total} registro(s) encontrado(s).</strong> ${result.errors.length?'Corrija os erros e selecione o arquivo novamente. Nenhum dado será importado.':newCount+' novos · '+overlaps+' códigos existentes para atualizar.'} ${overLimit?'A importação ultrapassa o limite atual de '+productLimit()+' produtos.':''}</div>${result.errors.length?'<ul class="import-summary">'+result.errors.slice(0,40).map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul>':`<p class="help-text">Prévia: ${result.products.slice(0,3).map(p=>esc(p.codigo)+' · '+esc(p.descricao)).join('<br>')}</p><p class="help-text">Inventários já criados não serão alterados.</p>`}${result.errors.length>40?'<p>Exibindo os primeiros 40 erros.</p>':''}`;
        $('#confirm-import').disabled=!!result.errors.length||overLimit;
      }catch(e){if(version===csvReadVersion&&$('#import-preview'))$('#import-preview').innerHTML='<p class="form-error">'+esc(e.message)+'</p>';}
    }
    if(el.id==='restore-file'){
      const version=++restoreReadVersion;
      $('#restore-preview').innerHTML='';
      try {const content=await readFile(el);if(version!==restoreReadVersion||content===null)return;const candidate=E.validateState(JSON.parse(content));if(!$('#restore-preview'))return;
        $('#restore-preview').innerHTML=`<div class="notice"><strong>Backup válido</strong><br>${candidate.products.length} produtos · ${candidate.inventories.length} inventários<br>Gravado em ${date(candidate.updatedAt)}</div><button id="confirm-restore" class="btn danger">Substituir dados por este backup</button>`;
        $('#confirm-restore').onclick=()=>{
          if(!confirm('Confirma substituir TODOS os dados locais por este backup? Baixe o backup atual antes.'))return;
          try {const saved=E.persist(localStorage,candidate);state=saved;storageBaseline=JSON.stringify(saved);storageBlocked=false;saveIndicator('● Salvo neste navegador');closeModal();selectedCode=null;page=1;render();toast('Backup restaurado com sucesso.');}catch(e){toast('Restauração não gravada. Os dados atuais foram preservados: '+e.message);}
        };
      }catch(e){if(version===restoreReadVersion&&$('#restore-preview'))$('#restore-preview').innerHTML='<p class="form-error">Backup rejeitado: '+esc(e.message)+'</p>';}
    }
  });
  $('#modal-content').addEventListener('click',event=>{
    if(event.target.closest('#confirm-import')&&importResult&&!importResult.errors.length){
      const overlaps=importResult.products.filter(p=>state.products.some(x=>x.codigo===p.codigo)).length;
      if(state.products.length+importResult.products.length-overlaps>productLimit()){toast(freeLimitMessage());return;}
      if(!confirm(`Importar ${importResult.products.length} produtos? ${overlaps?overlaps+' códigos existentes terão seus dados substituídos. ':''}Inventários anteriores serão preservados.`))return;
      if(commit(s=>s.products=E.mergeProducts(s.products,importResult.products,true))){closeModal();navigate('produtos');toast('Produtos importados e salvos.');}
    }
  });
  document.addEventListener('submit',event=>{
    const form=event.target;event.preventDefault();
    if(form.id==='product-form'){
      const saveNext=event.submitter?.dataset.saveNext==='true';
      try {const p=E.product(Object.fromEntries(new FormData(form)));const code=form.dataset.code;
        if(!code&&state.products.some(x=>x.codigo===p.codigo))throw new Error('Este código já está cadastrado. Use Editar para atualizar.');
        if(!code&&freeLimitReached())throw new Error(freeLimitMessage());
        if(code&&!confirm('Salvar as alterações do cadastro de '+p.descricao+'? Os inventários existentes permanecerão com os dados originais.'))return;
        if(commit(s=>s.products=E.mergeProducts(s.products,[p],!!code))){closeModal();render();toast('Produto salvo no cadastro.');if(saveNext)setTimeout(()=>{productForm();$('#f-codigo')?.focus();},0);}
      }catch(e){$('#form-error').textContent=e.message;}
    }
    if(form.id==='inventory-form'){
      try{if(state.inventories.length>=200)throw new Error('Limite de 200 inventários. Faça backup antes de reorganizar seus dados.');const inv=E.createInventory(state.products,new FormData(form).get('name'));if(commit(s=>{s.inventories.push(inv);s.activeId=inv.id;})){closeModal();navigate('contagem');toast('Inventário criado. Todos os produtos estão pendentes.');}}catch(e){$('#form-error').textContent=e.message;}
    }
    if(form.id==='count-form'){
      try {const inv=inventory(),n=E.number(new FormData(form).get('quantidade')),old=inv.counts.find(c=>c.codigo===selectedCode);
        if(old&&!confirm('Substituir a contagem anterior de '+num(old.quantidade)+' por '+num(n)+'?'))return;
        if(commit(s=>E.setCount(s.inventories.find(i=>i.id===s.activeId),selectedCode,n,!!old))){selectedCode=null;render();toast('Contagem salva: '+num(n)+'.');}
      }catch(e){toast(e.message);}
    }
  });
  $('#new-inventory').onclick=newInventory;
  $('#quick-backup').onclick=backup;
  $('.brand').onclick=event=>{event.preventDefault();navigate('inicio');};
  $('#close-modal').onclick=closeModal;
  modal.addEventListener('close',()=>{csvReadVersion++;restoreReadVersion++;stopCamera();});modal.addEventListener('cancel',stopCamera);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();});
  window.addEventListener('pagehide',stopCamera);
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installEvent=event;if(currentView==='backup')render();});
  document.addEventListener('click',async event=>{if(event.target.closest('#install-app')&&installEvent){await installEvent.prompt();await installEvent.userChoice;installEvent=null;render();}});
  // Avoid last-write-wins data loss when another tab changes this database.
  window.addEventListener('storage',event=>{if(event.key===E.KEY){storageBlocked=true;saveIndicator('⚠ Dados alterados em outra aba',true);toast('Outra aba alterou os dados. Recarregue esta página antes de continuar.');}});
  load();render();
  if('serviceWorker' in navigator&&['http:','https:'].includes(location.protocol)&&!window.ESTOQUE_STANDALONE){navigator.serviceWorker.register('./sw.js').then(()=>updatePWAState()).catch(()=>{});}
})();
