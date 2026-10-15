const SUPABASE_URL = 'https://finmivasfcnnJntfaeei.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbm1pdmFzZmNubmpudGZhZWVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNzY2MTIsImV4cCI6MjEwNzY1MjYxMn0.0IURfOPO9ExLv4D2VM03ENyPIBzG2iy9xEyE1gtlFd0';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let listaProdutosGlobal = [];
let carrinho = [];
let totalVendasConcluidas = 0;
let receitaTotalAcumulada = 0;
let usuarioAdmin = false;

async function init() {
    await verificarSessao();
    await carregarProdutos();
}

async function verificarSessao() {
    try {
        const { data: { session } } = await _supabase.auth.getSession();
        usuarioAdmin = !!session;
        renderHeader(session);
    } catch (e) {
        console.error("Erro na sessão:", e);
    }
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
    const modal = document.getElementById('modalAdmin');
    if (modal) modal.style.display = 'flex';
}

function fecharModalAdmin() {
    const modal = document.getElementById('modalAdmin');
    if (modal) modal.style.display = 'none';
}

function abrirCarrinho() {
    const modal = document.getElementById('modalCarrinho');
    if (modal) modal.style.display = 'flex';
    renderizarCarrinho();
}

function fecharCarrinho() {
    const modal = document.getElementById('modalCarrinho');
    if (modal) modal.style.display = 'none';
}

async function fazerLogin() {
    const emailInput = document.getElementById('emailLogin');
    const senhaInput = document.getElementById('senhaLogin');

    if (!emailInput || !senhaInput) return;

    const email = emailInput.value.trim();
    const password = senhaInput.value;

    if (!email || !password) return alert('Preencha todos os campos.');

    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });

    if (error) {
        alert('Erro ao entrar: ' + error.message);
    } else {
        usuarioAdmin = true;
        renderHeader(data.session);
        fecharModalAdmin();
        renderGrid(listaProdutosGlobal);
    }
}

async function fazerLogout() {
    await _supabase.auth.signOut();
    usuarioAdmin = false;
    renderHeader(null);
    fecharModalAdmin();
    renderGrid(listaProdutosGlobal);
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
        console.error(error);
        grid.innerHTML = '<p style="color: var(--accent-red);">Erro ao carregar o catálogo.</p>';
        return;
    }

    listaProdutosGlobal = data || [];
    
    const totalAdminEl = document.getElementById('totalProdutosAdmin');
    if (totalAdminEl) totalAdminEl.textContent = `${listaProdutosGlobal.length} artigos`;

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

    produtos.forEach(p => {
        const nome = p.texto || 'Artigo exclusivo';
        const precoNum = parseFloat(p.preco) || 0;
        const precoStr = p.preco ? `R$ ${precoNum.toFixed(2)}` : 'Sob consulta';
        const precoAntigo = p.preco_antigo ? `R$ ${parseFloat(p.preco_antigo).toFixed(2)}` : null;
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
                        <span class="card-price">${precoStr}</span>
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
                    <button class="btn btn-dark btn-block" onclick="adicionarAoCarrinho(${p.id}, '${nome.replace(/'/g, "\\'")}', ${precoNum})">
                        Adicionar
                    </button>
                    ${usuarioAdmin ? `<button class="btn btn-danger-soft" onclick="excluirProduto(${p.id})" title="Excluir produto">✕</button>` : ''}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function filtrarProdutos() {
    const inputBusca = document.getElementById('inputBusca');
    if (!inputBusca) return;

    const termo = inputBusca.value.toLowerCase();
    const filtrados = listaProdutosGlobal.filter(p => 
        (p.texto && p.texto.toLowerCase().includes(termo))
    );
    renderGrid(filtrados);
}

async function darLike(id) {
    const produto = listaProdutosGlobal.find(p => p.id === id);
    if (!produto) return;

    const novosLikes = (produto.likes || 0) + 1;
    
    // Atualiza no Supabase
    await _supabase.from('tarefas').update({ likes: novosLikes }).eq('id', id);
    
    produto.likes = novosLikes;
    const el = document.getElementById(`like-count-${id}`);
    if (el) el.textContent = novosLikes;
}

function adicionarAoCarrinho(id, nome, preco) {
    const itemExistente = carrinho.find(item => item.id === id);
    if (itemExistente) {
        itemExistente.quantidade += 1;
    } else {
        carrinho.push({ id, nome, preco, quantidade: 1 });
    }

    const totalItensCarrinho = carrinho.reduce((acc, item) => acc + item.quantidade, 0);
    const contadorEl = document.getElementById('contadorCarrinho');
    if (contadorEl) contadorEl.textContent = totalItensCarrinho;

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
    if (!lista || !totalEl) return;

    lista.innerHTML = '';

    if (carrinho.length === 0) {
        lista.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin-top: 40px;">O seu carrinho está vazio.</p>';
        totalEl.textContent = 'R$ 0,00';
        return;
    }

    let totalGeral = 0;
    carrinho.forEach((item) => {
        const subtotal = item.preco * item.quantidade;
        totalGeral += subtotal;

        const row = document.createElement('div');
        row.className = 'cart-item-row';
        row.innerHTML = `
            <span>${item.nome} <strong>x(${item.quantidade})</strong></span>
            <span><strong>R$ ${subtotal.toFixed(2)}</strong></span>
        `;
        lista.appendChild(row);
    });

    totalEl.textContent = `R$ ${totalGeral.toFixed(2)}`;
}

function finalizarCompra() {
    if (carrinho.length === 0) return alert('O carrinho está vazio!');

    const numeroWhatsApp = "31991096423"; // Substitua pelo seu WhatsApp com código do país e DDD

    let mensagem = "Olá! Gostaria de fazer a seguinte encomenda:%0A%0A";
    let totalGeral = 0;
    
    carrinho.forEach((item) => {
        const subtotal = item.preco * item.quantidade;
        totalGeral += subtotal;
        mensagem += `- ${item.nome} x(${item.quantidade}) — R$ ${subtotal.toFixed(2)}%0A`;
    });

    mensagem += `%0A*Total da Encomenda: R$ ${totalGeral.toFixed(2)}*%0A%0APor favor, confirme os detalhes.`;

    totalVendasConcluidas += 1;
    receitaTotalAcumulada += totalGeral;
    atualizarDashboardVendas();

    const urlWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${mensagem}`;
    window.open(urlWhatsApp, '_blank');

    carrinho = [];
    const contadorEl = document.getElementById('contadorCarrinho');
    if (contadorEl) contadorEl.textContent = '0';
    fecharCarrinho();
}

function atualizarDashboardVendas() {
    const elVendas = document.getElementById('adminTotalVendas');
    const elReceita = document.getElementById('adminReceitaTotal');
    if (elVendas) elVendas.textContent = totalVendasConcluidas;
    if (elReceita) elReceita.textContent = `R$ ${receitaTotalAcumulada.toFixed(2)}`;
}

async function adicionarProduto() {
    const nomeInput = document.getElementById('nomeProduto');
    const precoInput = document.getElementById('precoProduto');
    const precoAntigoInput = document.getElementById('precoAntigoProduto');
    const imagemInput = document.getElementById('imagemProduto');

    if (!nomeInput) return;

    const nome = nomeInput.value.trim();
    const preco = precoInput ? precoInput.value.trim() : '';
    const precoAntigo = precoAntigoInput ? precoAntigoInput.value.trim() : '';
    const imagem = imagemInput ? imagemInput.value.trim() : '';

    if (!nome) return alert('Informe o nome do artigo.');

    const novoItem = { texto: nome };
    if (preco) novoItem.preco = preco;
    if (precoAntigo) novoItem.preco_antigo = precoAntigo;
    if (imagem) novoItem.imagem = imagem;

    const { error } = await _supabase.from('tarefas').insert([novoItem]);

    if (error) {
        alert('Erro ao publicar: ' + error.message);
    } else {
        nomeInput.value = '';
        if (precoInput) precoInput.value = '';
        if (precoAntigoInput) precoAntigoInput.value = '';
        if (imagemInput) imagemInput.value = '';
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

async function subscreverNewsletter() {
    const inputEmail = document.getElementById('emailLead');
    if (!inputEmail) return;

    const email = inputEmail.value.trim();
    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!regexEmail.test(email)) {
        return alert('Por favor, introduza um endereço de email válido.');
    }

    const { error } = await _supabase.from('leads').insert([{ email: email }]);

    if (error) {
        if (error.code === '23505') {
            alert('Este email já se encontra registado na nossa newsletter.');
        } else {
            alert('Erro ao subscrever: ' + error.message);
        }
    } else {
        alert('Obrigado por subscrever! Em breve receberá as nossas novidades.');
        inputEmail.value = '';
    }
}

init();
