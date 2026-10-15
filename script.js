const SUPABASE_URL = 'https://finmivasfcnnJntfaeei.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbm1pdmFzZmNubmpudGZhZWVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNzY2MTIsImV4cCI6MjEwNzY1MjYxMn0.0IURfOPO9ExLv4D2VM03ENyPIBzG2iy9xEyE1gtlFd0';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let listaProdutosGlobal = [];
let carrinho = [];
let totalVendasConcluidas = 0;
let receitaTotalAcumulada = 0;
let usuarioAdmin = false;

async function init() {
    const clienteLogado = localStorage.getItem('atelier_cliente_email');
    const modalCliente = document.getElementById('modalCliente');
    
    if (!clienteLogado && modalCliente) {
        setTimeout(() => { modalCliente.style.display = 'flex'; }, 1500);
    }

    await verificarSessao();
    await carregarProdutos();
}

function fecharModalCliente() {
    const modalCliente = document.getElementById('modalCliente');
    if (modalCliente) modalCliente.style.display = 'none';
    localStorage.setItem('atelier_cliente_email', 'visitante@florenza.com');
}

async function salvarIdentificacaoCliente() {
    const emailInputModal = document.getElementById('emailClienteInput');
    const aceitaOfertasCheckbox = document.getElementById('aceitaOfertas');
    const modalCliente = document.getElementById('modalCliente');

    if (!emailInputModal) return;
    const email = emailInputModal.value.trim();
    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!regexEmail.test(email)) {
        alert('Por favor, introduza um endereço de email válido.');
        return;
    }

    if (modalCliente) modalCliente.style.display = 'none';
    localStorage.setItem('atelier_cliente_email', email);

    if (aceitaOfertasCheckbox && aceitaOfertasCheckbox.checked) {
        try {
            await _supabase.from('leads').insert([{ email: email }]);
        } catch (err) {
            console.log('Lead já registada', err);
        }
    }
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
        statusDiv.innerHTML = `<button onclick="abrirModalAdmin()" class="btn btn-dark">Painel Admin</button>`;
        formLoginView.style.display = 'none';
        formCadastroView.style.display = 'block';
        atualizarDashboardVendas();
    } else {
        statusDiv.innerHTML = `<button onclick="abrirModalAdmin()" class="btn btn-outline">Admin</button>`;
        formLoginView.style.display = 'block';
        formCadastroView.style.display = 'none';
    }
}

function abrirModalAdmin() { document.getElementById('modalAdmin').style.display = 'flex'; }
function fecharModalAdmin() { document.getElementById('modalAdmin').style.display = 'none'; }
function abrirCarrinho() { document.getElementById('modalCarrinho').style.display = 'flex'; renderizarCarrinho(); }
function fecharCarrinho() { document.getElementById('modalCarrinho').style.display = 'none'; }

async function fazerLogin() {
    const email = document.getElementById('emailLogin').value.trim();
    const password = document.getElementById('senhaLogin').value;

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
        grid.innerHTML = '<p style="color: #c84b31;">Erro ao carregar o catálogo.</p>';
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
        const nome = p.texto || 'Acessório Florenza';
        const precoNum = parseFloat(p.preco) || 0;
        const precoStr = p.preco ? `R$ ${precoNum.toFixed(2)}` : 'Sob consulta';
        const precoAntigo = p.preco_antigo ? `R$ ${parseFloat(p.preco_antigo).toFixed(2)}` : null;
        const imagem = p.imagem || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=500';
        const likes = p.likes || 0;
        const carrinhoCount = p.carrinho_count || 0;

        const card = document.createElement('div');
        card.className = 'card-produto';
        // Clicar no card abre o painel de opções de embalagens/tamanhos
        card.onclick = (e) => {
            // Se clicar nos botões de like ou excluir, não abre o modal de detalhes
            if (e.target.closest('.metric-item') || e.target.closest('button')) return;
            abrirDetalhesProduto(p.id);
        };

        card.innerHTML = `
            <div class="img-container">
                ${precoAntigo ? '<span class="promo-badge-tag">PROMOÇÃO</span>' : ''}
                <img src="${imagem}" alt="${nome}" onerror="this.src='https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=500'">
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
                    <span class="metric-item" onclick="darLike(event, ${p.id})">
                        ♥ <span id="like-count-${p.id}">${likes}</span> gostos
                    </span>
                    <span class="metric-item">
                        🛍️ <span id="cart-count-${p.id}">${carrinhoCount}</span> no carrinho
                    </span>
                </div>

                <div class="card-actions-row">
                    <button class="btn btn-dark btn-block" onclick="abrirDetalhesProduto(${p.id})">
                        Ver Opções & Comprar
                    </button>
                    ${usuarioAdmin ? `<button class="btn btn-danger-soft" onclick="excluirProduto(event, ${p.id})" title="Excluir produto">✕</button>` : ''}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Abre o painel interativo de sacolinhas, caixinhas, cores e tamanho condicional
function abrirDetalhesProduto(id) {
    const produto = listaProdutosGlobal.find(p => p.id === id);
    if (!produto) return;

    const modal = document.getElementById('modalDetalhesProduto');
    const container = document.getElementById('conteudoDetalhesProduto');
    const precoNum = parseFloat(produto.preco) || 0;
    const nome = produto.texto || 'Acessório';

    // Verifica se a opção de anel/pulseira está ativa para este produto (salva no admin)
    const temAnelPulseiraAtivo = produto.anel_pulseira_ativo === true;

    container.innerHTML = `
        <h2>${nome}</h2>
        <p class="subtitle" style="margin-bottom: 12px;">Personalize a sua experiência Florenza</p>
        <div class="price-container" style="margin-bottom: 16px;">
            <span class="card-price" style="font-size: 1.3rem;">R$ ${precoNum.toFixed(2)}</span>
        </div>

        <div class="customization-box">
            <!-- Escolha de Embalagem -->
            <div class="option-group">
                <label>Tipo de Embalagem</label>
                <div class="size-options-row">
                    <label class="size-option-label"><input type="radio" name="tipoEmbalagem" value="Caixinha Personalizada" checked class="size-option-input"> 🎁 Caixinha Personalizada</label>
                    <label class="size-option-label"><input type="radio" name="tipoEmbalagem" value="Sacotinho de Presente" class="size-option-input"> 🛍️ Sacotinho Florenza</label>
                </div>
            </div>

            <!-- Escolha de Cor das Caixinhas e Sacolas -->
            <div class="option-group">
                <label>Cor das Caixinhas e Sacolas</label>
                <div class="color-options-row">
                    <label class="color-option">
                        <input type="radio" name="corEmbalagem" value="Rosa" checked>
                        <span class="color-circle" style="background-color: #e8b4b8;"></span>
                        Rosa
                    </label>
                    <label class="color-option">
                        <input type="radio" name="corEmbalagem" value="Preto">
                        <span class="color-circle" style="background-color: #1f1b19;"></span>
                        Preto
                    </label>
                    <label class="color-option">
                        <input type="radio" name="corEmbalagem" value="Bege">
                        <span class="color-circle" style="background-color: #dfd3c3;"></span>
                        Bege
                    </label>
                    <label class="color-option">
                        <input type="radio" name="corEmbalagem" value="Branco">
                        <span class="color-circle" style="background-color: #ffffff;"></span>
                        Branco
                    </label>
                </div>
            </div>

            <!-- Painel de Tamanho de Anel e Pulseira (Aparece APENAS se estiver ativo no admin) -->
            ${temAnelPulseiraAtivo ? `
            <div class="option-group" id="blocoTamanhoAnelPulseira">
                <label>Tamanho (Anel / Pulseira)</label>
                <div class="size-options-row">
                    <label class="size-option-label"><input type="radio" name="tamanhoItem" value="Tamanho P (14/15)" checked class="size-option-input"> P (14/15)</label>
                    <label class="size-option-label"><input type="radio" name="tamanhoItem" value="Tamanho M (16/17)" class="size-option-input"> M (16/17)</label>
                    <label class="size-option-label"><input type="radio" name="tamanhoItem" value="Tamanho G (18/20)" class="size-option-input"> G (18/20)</label>
                    <label class="size-option-label"><input type="radio" name="tamanhoItem" value="Ajustável" class="size-option-input"> Ajustável</label>
                </div>
            </div>
            ` : ''}

            <button onclick="adicionarComDetalhes(${produto.id}, '${nome.replace(/'/g, "\\'")}', ${precoNum})" class="btn btn-dark btn-block" style="margin-top: 10px; padding: 12px;">
                Adicionar ao Carrinho com Embalagem Escolhida
            </button>
        </div>
    `;

    modal.style.display = 'flex';
}

function fecharDetalhesProduto() {
    document.getElementById('modalDetalhesProduto').style.display = 'none';
}

function adicionarComDetalhes(id, nome, preco) {
    const embalagemEl = document.querySelector('input[name="tipoEmbalagem"]:checked');
    const corEl = document.querySelector('input[name="corEmbalagem"]:checked');
    const tamanhoEl = document.querySelector('input[name="tamanhoItem"]:checked');

    const tipoEmbalagem = embalagemEl ? embalagemEl.value : 'Caixinha';
    const cor = corEl ? corEl.value : 'Rosa';
    const tamanho = tamanhoEl ? tamanhoEl.value : 'Padrão';

    // Cria uma chave única no carrinho com base nas escolhas de personalização
    const itemKey = `${id}-${tipoEmbalagem}-${cor}-${tamanho}`;
    const nomePersonalizado = `${nome} (${tipoEmbalagem} Cor: ${cor}${tamanho !== 'Padrão' ? ' | Tam: ' + tamanho : ''})`;

    const itemExistente = carrinho.find(item => item.key === itemKey);
    if (itemExistente) {
        itemExistente.quantidade += 1;
    } else {
        carrinho.push({ key: itemKey, id, nome: nomePersonalizado, preco, quantidade: 1 });
    }

    const totalItensCarrinho = carrinho.reduce((acc, item) => acc + item.quantidade, 0);
    const contadorEl = document.getElementById('contadorCarrinho');
    if (contadorEl) contadorEl.textContent = totalItensCarrinho;

    // Atualiza contador no Supabase
    const produto = listaProdutosGlobal.find(p => p.id === id);
    if (produto) {
        produto.carrinho_count = (produto.carrinho_count || 0) + 1;
        _supabase.from('tarefas').update({ carrinho_count: produto.carrinho_count }).eq('id', id).catch(() => {});
        const el = document.getElementById(`cart-count-${id}`);
        if (el) el.textContent = produto.carrinho_count;
    }

    fecharDetalhesProduto();
    alert(`"${nome}" adicionado com a sua embalagem personalizada!`);
}

function filtrarProdutos() {
    const inputBusca = document.getElementById('inputBusca');
    if (!inputBusca) return;
    const termo = inputBusca.value.toLowerCase();
    const filtrados = listaProdutosGlobal.filter(p => (p.texto && p.texto.toLowerCase().includes(termo)));
    renderGrid(filtrados);
}

async function darLike(e, id) {
    e.stopPropagation();
    const produto = listaProdutosGlobal.find(p => p.id === id);
    if (!produto) return;

    const novosLikes = (produto.likes || 0) + 1;
    await _supabase.from('tarefas').update({ likes: novosLikes }).eq('id', id).catch(() => {});
    produto.likes = novosLikes;
    const el = document.getElementById(`like-count-${id}`);
    if (el) el.textContent = novosLikes;
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

    const numeroWhatsApp = "5538999715565"; // Altere para o seu WhatsApp com DDD
    const emailCliente = localStorage.getItem('atelier_cliente_email') || 'Visitante Florenza';

    let mensagem = `Olá, Florenza! Gostaria de fazer a seguinte encomenda:%0A(Cliente: ${emailCliente})%0A%0A`;
    let totalGeral = 0;
    
    carrinho.forEach((item) => {
        const subtotal = item.preco * item.quantidade;
        totalGeral += subtotal;
        mensagem += `- ${item.nome} x(${item.quantidade}) — R$ ${subtotal.toFixed(2)}%0A`;
    });

    mensagem += `%0A*Total da Encomenda: R$ ${totalGeral.toFixed(2)}*%0A%0APor favor, confirme os detalhes para pagamento.`;

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
    const anelPulseiraCheckbox = document.getElementById('adminAtivoAnelPulseira');

    if (!nomeInput) return;

    const nome = nomeInput.value.trim();
    const preco = precoInput ? precoInput.value.trim() : '';
    const precoAntigo = precoAntigoInput ? precoAntigoInput.value.trim() : '';
    const imagem = imagemInput ? imagemInput.value.trim() : '';
    const anelPulseiraAtivo = anelPulseiraCheckbox ? anelPulseiraCheckbox.checked : false;

    if (!nome) return alert('Informe o nome do artigo.');

    const novoItem = { 
        texto: nome,
        anel_pulseira_ativo: anelPulseiraAtivo
    };
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
        if (anelPulseiraCheckbox) anelPulseiraCheckbox.checked = false;
        fecharModalAdmin();
        carregarProdutos();
    }
}

async function excluirProduto(e, id) {
    e.stopPropagation();
    if (!confirm('Tem certeza de que pretende eliminar este artigo da loja?')) return;

    const { error } = await _supabase.from('tarefas').delete().eq('id', id);
    if (error) {
        alert('Erro ao excluir: ' + error.message);
    } else {
        carregarProdutos();
    }
}

init();
