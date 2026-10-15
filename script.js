const SUPABASE_URL = 'https://finmivasfcnnJntfaeei.supabase.co';
const SUPABASE_KEY = 'sb_publishable_1GrP5ip9yUycdbQ_JnvDdQ_b6_vXJFK';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let listaProdutosGlobal = [];
let carrinho = [];
let totalVendasConcluidas = 0;
let receitaTotalAcumulada = 0;

async function init() {
    await verificarSessao();
    await carregarProdutos();
}

async function verificarSessao() {
    const { data: { session } } = await _supabase.auth.getSession();
    renderHeader(session);
}

function renderHeader(session) {
    const statusDiv = document.getElementById('statusLogin');
    const formLoginView = document.getElementById('formLoginView');
    const formCadastroView = document.getElementById('formCadastroView');

    if (!statusDiv || !formLoginView || !formCadastroView) return;

    if (session) {
        statusDiv.innerHTML = `
            <button onclick="abrirModalAdmin()" class="btn btn-dark">Painel Admin</button>
        `;
        formLoginView.style.display = 'none';
        formCadastroView.style.display = 'block';
        atualizarDashboardVendas();
    } else {
        statusDiv.innerHTML = `
            <button onclick="abrirModalAdmin()" class="btn btn-outline">Área Admin</button>
        `;
        formLoginView.style.display = 'block';
        formCadastroView.style.display = 'none';
    }
}

function abrirModalAdmin() {
    document.getElementById('modalAdmin').style.display = 'flex';
}

function fecharModalAdmin() {
    document.getElementById('modalAdmin').style.display = 'none';
}

function abrirCarrinho() {
    document.getElementById('modalCarrinho').style.display = 'flex';
    renderizarCarrinho();
}

function fecharCarrinho() {
    document.getElementById('modalCarrinho').style.display = 'none';
}

async function fazerLogin() {
    const email = document.getElementById('emailLogin').value.trim();
    const password = document.getElementById('senhaLogin').value;

    if (!email || !password) return alert('Preencha todos os campos.');

    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });

    if (error) {
        alert('Erro ao entrar: ' + error.message);
    } else {
        renderHeader(data.session);
        fecharModalAdmin();
    }
}

async function fazerLogout() {
    await _supabase.auth.signOut();
    renderHeader(null);
    fecharModalAdmin();
}

async function carregarProdutos() {
    const grid = document.getElementById('gridProdutos');
    if (!grid) return;

    grid.innerHTML = '<p style="color: var(--text-muted);">A carregar artigos...</p>';

    const { data, error } = await _supabase
        .from('tarefas')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        grid.innerHTML = '<p style="color: var(--accent-red);">Erro ao carregar o catálogo.</p>';
        return;
    }

    listaProdutosGlobal = data || [];
    document.getElementById('totalProdutos').textContent = `${listaProdutosGlobal.length} artigos`;
    renderGrid(listaProdutosGlobal);
}

function renderGrid(produtos) {
    const grid = document.getElementById('gridProdutos');
    if (!grid) return;

    grid.innerHTML = '';

    if (produtos.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1;">Nenhum artigo encontrado.</p>';
        return;
    }

    _supabase.auth.getSession().then(({ data: { session } }) => {
        const isAdmin = !!session;

        produtos.forEach(p => {
            const nome = p.texto || 'Artigo exclusivo';
            const preco = p.preco ? `${p.preco} €` : 'Sob consulta';
            const precoAntigo = p.preco_antigo ? `${p.preco_antigo} €` : null;
            const imagem = p.imagem || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500';
            const likes = p.likes || 0;
            const carrinhoCount = p.carrinho_count || 0;

            const card = document.createElement('div');
            card.className = 'card-produto';
            card.innerHTML = `
                <div class="img-container">
                    ${precoAntigo ? '<span class="promo-badge-tag">PROMOÇÃO</span>' : ''}
                    <img src="${imagem}" alt="${nome}" onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500'">
                </div>
                <div class="card-body">
                    <div>
                        <h3 class="card-title">${nome}</h3>
                        <div class="price-container">
                            <span class="card-price">${preco}</span>
                            ${precoAntigo ? `<span class="card-old-price">${precoAntigo}</span>` : ''}
                        </div>
                    </div>

                    <div class="product-metrics">
                        <span class="metric-item" onclick="darLike(${p.id})">
                            ♥ <span id="like-count-${p.id}">${likes}</span> gostos
                        </span>
                        <span class="metric-item">
                            🛍️ <span id="cart-count-${p.id}">${carrinhoCount}</span> no carrinho
                        </span>
                    </div>

                    <div class="card-actions-row">
                        <button class="btn btn-dark btn-block" onclick="adicionarAoCarrinho('${nome}', '${p.preco || '0'}', ${p.id})">
                            Adicionar
                        </button>
                        ${isAdmin ? `<button class="btn btn-danger-soft" onclick="excluirProduto(${p.id})" title="Excluir produto">✕</button>` : ''}
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    });
}

function filtrarProdutos() {
    const termo = document.getElementById('inputBusca').value.toLowerCase();
    const filtrados = listaProdutosGlobal.filter(p => 
        (p.texto && p.texto.toLowerCase().includes(termo))
    );
    renderGrid(filtrados);
}

async function darLike(id) {
    const produto = listaProdutosGlobal.find(p => p.id === id);
    if (!produto) return;

    const novosLikes = (produto.likes || 0) + 1;
    await _supabase.from('tarefas').update({ likes: novosLikes }).eq('id', id).catch(() => {});
    
    produto.likes = novosLikes;
    const el = document.getElementById(`like-count-${id}`);
    if (el) el.textContent = novosLikes;
}

function adicionarAoCarrinho(nome, preco, id) {
    carrinho.push({ nome, preco: parseFloat(preco) || 0 });
    document.getElementById('contadorCarrinho').textContent = carrinho.length;

    const produto = listaProdutosGlobal.find(p => p.id === id);
    if (produto) {
        produto.carrinho_count = (produto.carrinho_count || 0) + 1;
        _supabase.from('tarefas').update({ carrinho_count: produto.carrinho_count }).eq('id', id).catch(() => {});
        const el = document.getElementById(`cart-count-${id}`);
        if (el) el.textContent = produto.carrinho_count;
    }

    alert(`"${nome}" foi adicionado ao carrinho.`);
}

function renderizarCarrinho() {
    const lista = document.getElementById('listaItensCarrinho');
    const totalEl = document.getElementById('carrinhoTotalPreco');
    lista.innerHTML = '';

    if (carrinho.length === 0) {
        lista.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin-top: 40px;">O seu carrinho está vazio.</p>';
        totalEl.textContent = '0.00 €';
        return;
    }

    let total = 0;
    carrinho.forEach((item) => {
        total += item.preco;
        const row = document.createElement('div');
        row.className = 'cart-item-row';
        row.innerHTML = `
            <span>${item.nome}</span>
            <span><strong>${item.preco.toFixed(2)} €</strong></span>
        `;
        lista.appendChild(row);
    });

    totalEl.textContent = `${total.toFixed(2)} €`;
}

function finalizarCompra() {
    if (carrinho.length === 0) return alert('O carrinho está vazio!');

    let totalCompra = carrinho.reduce((acc, item) => acc + item.preco, 0);
    totalVendasConcluidas += 1;
    receitaTotalAcumulada += totalCompra;

    carrinho = [];
    document.getElementById('contadorCarrinho').textContent = '0';
    atualizarDashboardVendas();
    fecharCarrinho();
    alert('Compra concluída com sucesso! Obrigado pela preferência.');
}

function atualizarDashboardVendas() {
    const elVendas = document.getElementById('adminTotalVendas');
    const elReceita = document.getElementById('adminReceitaTotal');
    if (elVendas) elVendas.textContent = totalVendasConcluidas;
    if (elReceita) elReceita.textContent = `${receitaTotalAcumulada.toFixed(2)} €`;
}

async function adicionarProduto() {
    const nome = document.getElementById('nomeProduto').value.trim();
    const preco = document.getElementById('precoProduto').value.trim();
    const precoAntigo = document.getElementById('precoAntigoProduto').value.trim();
    const imagem = document.getElementById('imagemProduto').value.trim();

    if (!nome) return alert('Informe o nome do artigo.');

    const novoItem = { texto: nome };
    if (preco) novoItem.preco = preco;
    if (precoAntigo) novoItem.preco_antigo = precoAntigo;
    if (imagem) novoItem.imagem = imagem;

    const { error } = await _supabase.from('tarefas').insert([novoItem]);

    if (error) {
        alert('Erro ao publicar: ' + error.message);
    } else {
        document.getElementById('nomeProduto').value = '';
        document.getElementById('precoProduto').value = '';
        document.getElementById('precoAntigoProduto').value = '';
        document.getElementById('imagemProduto').value = '';
        fecharModalAdmin();
        carregarProdutos();
    }
}

async function excluirProduto(id) {
    if (!confirm('Tem certeza de que pretende eliminar este artigo da loja?')) return;

    const { error } = await _supabase.from('tarefas').delete().eq('id', id);

    if (error) {
        alert('Erro ao excluir: ' + error.message);
    } else {
        carregarProdutos();
    }
}

init();
