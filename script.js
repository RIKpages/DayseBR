const SUPABASE_URL = 'https://finmivasfcnnJntfaeei.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbm1pdmFzZmNubmpudGZhZWVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNzY2MTIsImV4cCI6MjEwNzY1MjYxMn0.0IURfOPO9ExLv4D2VM03ENyPIBzG2iy9xEyE1gtlFd0';
const WHATSAPP_LOJA = '5511999999999'; // Coloque aqui o WhatsApp real da Florenza (55 + DDD + Número)

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let listaProdutosGlobal = [];
let carrinho = [];
let totalVendasConcluidas = 0;
let receitaTotalAcumulada = 0;
let usuarioAdmin = false;

// --- Animações GSAP & ScrollTrigger ---
function iniciarAnimacoesPagina() {
    if (typeof gsap === 'undefined') return;

    if (typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);
    }

    // Entrada suave do Hero editorial
    gsap.from('.gs-hero', {
        y: 24,
        opacity: 0,
        duration: 0.75,
        stagger: 0.12,
        ease: 'power2.out',
        clearProps: 'transform,opacity'
    });

    // Revelação das seções no scroll
    gsap.utils.toArray('.gs-reveal').forEach((el) => {
        gsap.from(el, {
            y: 26,
            opacity: 0,
            duration: 0.7,
            ease: 'power2.out',
            clearProps: 'transform,opacity',
            scrollTrigger: {
                trigger: el,
                start: 'top 86%',
                once: true
            }
        });
    });

    // Sombra sutil na navbar ao rolar
    window.addEventListener('scroll', () => {
        const nav = document.getElementById('navbar');
        if (nav) {
            nav.classList.toggle('scrolled', window.scrollY > 16);
        }
    }, { passive: true });
}

function animarCardsVitrine() {
    if (typeof gsap === 'undefined') return;
    gsap.from('.card-produto', {
        y: 22,
        opacity: 0,
        duration: 0.55,
        stagger: 0.06,
        ease: 'power2.out',
        clearProps: 'transform,opacity'
    });
}

function animarAberturaModal(modalEl) {
    if (!modalEl || typeof gsap === 'undefined') return;
    const card = modalEl.querySelector('.modal-card');
    if (!card) return;

    if (card.classList.contains('drawer-card')) {
        gsap.fromTo(card, { x: 80, opacity: 0.6 }, { x: 0, opacity: 1, duration: 0.3, ease: 'power2.out' });
    } else {
        gsap.fromTo(card, { y: 18, scale: 0.97, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.28, ease: 'power2.out' });
    }
}

// --- Inicialização ---
async function init() {
    iniciarAnimacoesPagina();

    const clienteLogado = localStorage.getItem('florenza_cliente_email');
    const modalCliente = document.getElementById('modalCliente');

    if (!clienteLogado && modalCliente) {
        setTimeout(() => {
            // Só abre se nenhum outro modal estiver aberto
            const outroAberto = document.getElementById('modalAdmin')?.style.display === 'flex' ||
                                document.getElementById('modalDetalhesProduto')?.style.display === 'flex';
            if (!outroAberto) {
                modalCliente.style.display = 'flex';
                animarAberturaModal(modalCliente);
            }
        }, 1600);
    }

    await verificarSessao();
    await carregarProdutos();
}

// --- Identificação & Leads de Clientes ---
function fecharModalCliente() {
    const modalCliente = document.getElementById('modalCliente');
    if (modalCliente) modalCliente.style.display = 'none';
    localStorage.setItem('florenza_cliente_email', 'visitante@florenza.com');
}

async function salvarIdentificacaoCliente() {
    const emailInput = document.getElementById('emailClienteInput');
    const aceitaOfertas = document.getElementById('aceitaOfertas');
    const modalCliente = document.getElementById('modalCliente');

    if (!emailInput) return;

    const email = emailInput.value.trim();
    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!regexEmail.test(email)) {
        alert('Por favor, informe um e-mail válido.');
        return;
    }

    if (modalCliente) modalCliente.style.display = 'none';
    localStorage.setItem('florenza_cliente_email', email);

    if (aceitaOfertas && aceitaOfertas.checked) {
        try {
            await _supabase.from('leads').insert([{ email }]);
        } catch (err) {
            console.log('Lead já cadastrado ou erro de rede:', err);
        }
    }
}

// --- Autenticação Admin ---
async function verificarSessao() {
    try {
        const { data: { session } } = await _supabase.auth.getSession();
        usuarioAdmin = !!session;
        renderHeader(session);
    } catch (e) {
        console.error('Erro ao verificar sessão:', e);
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

function abrirModalAdmin() {
    const modal = document.getElementById('modalAdmin');
    if (modal) {
        modal.style.display = 'flex';
        animarAberturaModal(modal);
    }
}

function fecharModalAdmin() {
    const modal = document.getElementById('modalAdmin');
    if (modal) modal.style.display = 'none';
}

async function fazerLogin() {
    const email = document.getElementById('emailLogin')?.value.trim();
    const password = document.getElementById('senhaLogin')?.value;

    if (!email || !password) return alert('Preencha e-mail e senha.');

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

// --- Catálogo & Vitrine ---
async function carregarProdutos() {
    const grid = document.getElementById('gridProdutos');
    if (!grid) return;

    grid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1; text-align:center;">Carregando peças exclusivas...</p>';

    const { data, error } = await _supabase
        .from('tarefas')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        grid.innerHTML = '<p style="color: var(--accent-red); grid-column: 1/-1; text-align:center;">Erro ao carregar o catálogo.</p>';
        return;
    }

    listaProdutosGlobal = data || [];

    const totalAdminEl = document.getElementById('totalProdutosAdmin');
    if (totalAdminEl) totalAdminEl.textContent = `${listaProdutosGlobal.length} peças`;

    renderGrid(listaProdutosGlobal);
}

function formatarBRL(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderGrid(produtos) {
    const grid = document.getElementById('gridProdutos');
    if (!grid) return;

    grid.innerHTML = '';

    if (produtos.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1; text-align:center;">Nenhuma peça encontrada.</p>';
        return;
    }

    produtos.forEach((p) => {
        const nome = p.texto || 'Acessório Florenza';
        const precoNum = parseFloat(p.preco) || 0;
        const precoStr = p.preco ? formatarBRL(precoNum) : 'Sob consulta';
        const precoAntigo = p.preco_antigo ? formatarBRL(parseFloat(p.preco_antigo)) : null;
        const imagem = p.imagem || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600';
        const likes = p.likes || 0;
        const carrinhoCount = p.carrinho_count || 0;
        const permiteTamanho = Boolean(p.anel_pulseira_ativo);

        const card = document.createElement('div');
        card.className = 'card-produto';
        card.onclick = (e) => {
            if (e.target.closest('.metric-item') || e.target.closest('button')) return;
            abrirDetalhesProduto(p.id);
        };

        card.innerHTML = `
            <div class="img-container">
                ${precoAntigo ? '<span class="promo-badge-tag">OFERTA</span>' : ''}
                ${permiteTamanho ? '<span class="size-indicator-tag">Escolha de Tamanho</span>' : ''}
                <img src="${imagem}" alt="${nome}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600'">
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
                        ♥ <span id="like-count-${p.id}">${likes}</span> curtidas
                    </span>
                    <span class="metric-item">
                        🛍️ <span id="cart-count-${p.id}">${carrinhoCount}</span> na sacola
                    </span>
                </div>

                <div class="card-actions-row">
                    <button class="btn btn-dark btn-block" onclick="abrirDetalhesProduto(${p.id})">
                        Escolher Opções
                    </button>
                    ${usuarioAdmin ? `<button class="btn btn-danger-soft" onclick="excluirProduto(event, ${p.id})" title="Excluir peça">✕</button>` : ''}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    animarCardsVitrine();
}

function filtrarProdutos() {
    const inputBusca = document.getElementById('inputBusca');
    if (!inputBusca) return;
    const termo = inputBusca.value.toLowerCase().trim();
    const filtrados = listaProdutosGlobal.filter((p) => p.texto && p.texto.toLowerCase().includes(termo));
    renderGrid(filtrados);
}

async function darLike(e, id) {
    e.stopPropagation();
    const produto = listaProdutosGlobal.find((p) => p.id === id);
    if (!produto) return;

    const novosLikes = (produto.likes || 0) + 1;
    produto.likes = novosLikes;

    const el = document.getElementById(`like-count-${id}`);
    if (el) el.textContent = novosLikes;

    try {
        await _supabase.from('tarefas').update({ likes: novosLikes }).eq('id', id);
    } catch (err) {
        console.error('Erro ao registrar curtida:', err);
    }
}

// --- Modal de Personalização (Embalagens, Cores e Tamanho Condicional) ---
function abrirDetalhesProduto(id) {
    const produto = listaProdutosGlobal.find((p) => p.id === id);
    if (!produto) return;

    const modal = document.getElementById('modalDetalhesProduto');
    const container = document.getElementById('conteudoDetalhesProduto');
    const precoNum = parseFloat(produto.preco) || 0;
    const nome = produto.texto || 'Acessório Florenza';
    const imagem = produto.imagem || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600';
    const temAnelPulseiraAtivo = Boolean(produto.anel_pulseira_ativo);

    container.innerHTML = `
        <div class="detail-header-grid">
            <img src="${imagem}" alt="${nome}" class="detail-thumb" onerror="this.src='https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600'">
            <div>
                <h2 style="font-family: var(--font-serif); font-size: 1.45rem;">${nome}</h2>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin: 3px 0 6px;">Personalize sua embalagem Florenza</p>
                <span class="card-price" style="font-size: 1.25rem;">${formatarBRL(precoNum)}</span>
            </div>
        </div>

        <div class="customization-box">
            <!-- Tipo de Embalagem -->
            <div class="option-group">
                <label>Escolha a Embalagem</label>
                <div class="size-options-row">
                    <div>
                        <input type="radio" id="embCaixa" name="tipoEmbalagem" value="Caixinha Personalizada" checked class="size-option-input">
                        <label for="embCaixa" class="size-option-label">🎁 Caixinha Personalizada</label>
                    </div>
                    <div>
                        <input type="radio" id="embSacola" name="tipoEmbalagem" value="Sacola de Presente" class="size-option-input">
                        <label for="embSacola" class="size-option-label">🛍️ Sacola Florenza</label>
                    </div>
                </div>
            </div>

            <!-- Cor das Caixinhas e Sacolas -->
            <div class="option-group">
                <label>Cor da Caixinha / Sacola</label>
                <div class="color-options-row">
                    <label class="color-option">
                        <input type="radio" name="corEmbalagem" value="Rosa" checked>
                        <span class="color-circle" style="background-color: #e8b4b8;"></span>
                        Rosa
                    </label>
                    <label class="color-option">
                        <input type="radio" name="corEmbalagem" value="Preto">
                        <span class="color-circle" style="background-color: #1a1615;"></span>
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

            <!-- Tamanho de Anel e Pulseira (Condicional ao Admin) -->
            ${temAnelPulseiraAtivo ? `
            <div class="option-group" id="blocoTamanhoAnelPulseira">
                <label>Tamanho (Anel / Pulseira)</label>
                <div class="size-options-row">
                    <div>
                        <input type="radio" id="tamP" name="tamanhoItem" value="P (14/15)" checked class="size-option-input">
                        <label for="tamP" class="size-option-label">P (14/15)</label>
                    </div>
                    <div>
                        <input type="radio" id="tamM" name="tamanhoItem" value="M (16/17)" class="size-option-input">
                        <label for="tamM" class="size-option-label">M (16/17)</label>
                    </div>
                    <div>
                        <input type="radio" id="tamG" name="tamanhoItem" value="G (18/20)" class="size-option-input">
                        <label for="tamG" class="size-option-label">G (18/20)</label>
                    </div>
                    <div>
                        <input type="radio" id="tamAjust" name="tamanhoItem" value="Ajustável" class="size-option-input">
                        <label for="tamAjust" class="size-option-label">Ajustável</label>
                    </div>
                </div>
            </div>
            ` : ''}

            <button onclick="adicionarComDetalhes(${produto.id})" class="btn btn-dark btn-block" style="margin-top: 6px; padding: 13px;">
                Adicionar à Sacola
            </button>
        </div>
    `;

    modal.style.display = 'flex';
    animarAberturaModal(modal);
}

function fecharDetalhesProduto() {
    const modal = document.getElementById('modalDetalhesProduto');
    if (modal) modal.style.display = 'none';
}

function adicionarComDetalhes(id) {
    const produto = listaProdutosGlobal.find((p) => p.id === id);
    if (!produto) return;

    const nomeBase = produto.texto || 'Acessório Florenza';
    const preco = parseFloat(produto.preco) || 0;

    const embalagemEl = document.querySelector('input[name="tipoEmbalagem"]:checked');
    const corEl = document.querySelector('input[name="corEmbalagem"]:checked');
    const tamanhoEl = document.querySelector('input[name="tamanhoItem"]:checked');

    const tipoEmbalagem = embalagemEl ? embalagemEl.value : 'Caixinha Personalizada';
    const cor = corEl ? corEl.value : 'Rosa';
    const tamanho = tamanhoEl ? tamanhoEl.value : null;

    const detalhesTexto = `${tipoEmbalagem} · Cor: ${cor}${tamanho ? ` · Tam: ${tamanho}` : ''}`;
    const itemKey = `${id}-${tipoEmbalagem}-${cor}-${tamanho || 'unico'}`;

    const itemExistente = carrinho.find((item) => item.key === itemKey);
    if (itemExistente) {
        itemExistente.quantidade += 1;
    } else {
        carrinho.push({
            key: itemKey,
            id,
            nome: nomeBase,
            detalhes: detalhesTexto,
            preco,
            quantidade: 1
        });
    }

    atualizarContadorSacola();

    // Atualiza métrica na vitrine e Supabase
    produto.carrinho_count = (produto.carrinho_count || 0) + 1;
    const el = document.getElementById(`cart-count-${id}`);
    if (el) el.textContent = produto.carrinho_count;

    _supabase.from('tarefas').update({ carrinho_count: produto.carrinho_count }).eq('id', id).catch(() => {});

    fecharDetalhesProduto();
    abrirCarrinho();
}

// --- Sacola / Carrinho ---
function atualizarContadorSacola() {
    const totalItens = carrinho.reduce((acc, item) => acc + item.quantidade, 0);
    const contadorEl = document.getElementById('contadorCarrinho');
    if (contadorEl) contadorEl.textContent = totalItens;
}

function abrirCarrinho() {
    const modal = document.getElementById('modalCarrinho');
    if (modal) {
        modal.style.display = 'flex';
        renderizarCarrinho();
        animarAberturaModal(modal);
    }
}

function fecharCarrinho() {
    const modal = document.getElementById('modalCarrinho');
    if (modal) modal.style.display = 'none';
}

function removerItemCarrinho(index) {
    carrinho.splice(index, 1);
    atualizarContadorSacola();
    renderizarCarrinho();
}

function renderizarCarrinho() {
    const lista = document.getElementById('listaItensCarrinho');
    const totalEl = document.getElementById('carrinhoTotalPreco');
    if (!lista || !totalEl) return;

    lista.innerHTML = '';

    if (carrinho.length === 0) {
        lista.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin-top: 48px;">Sua sacola Florenza está vazia.</p>';
        totalEl.textContent = 'R$ 0,00';
        return;
    }

    let totalGeral = 0;
    carrinho.forEach((item, index) => {
        const subtotal = item.preco * item.quantidade;
        totalGeral += subtotal;

        const row = document.createElement('div');
        row.className = 'cart-item-row';
        row.innerHTML = `
            <div>
                <strong>${item.nome}</strong> <span>x${item.quantidade}</span>
                <span class="cart-item-meta">${item.detalhes}</span>
            </div>
            <div style="text-align: right; white-space: nowrap;">
                <strong>${formatarBRL(subtotal)}</strong>
                <button class="cart-remove-btn" onclick="removerItemCarrinho(${index})" title="Remover">✕</button>
            </div>
        `;
        lista.appendChild(row);
    });

    totalEl.textContent = formatarBRL(totalGeral);
}

function finalizarCompra() {
    if (carrinho.length === 0) return alert('Sua sacola está vazia!');

    const emailCliente = localStorage.getItem('florenza_cliente_email') || 'Cliente Vitrine';
    let mensagem = `Olá, *Florenza Bijouterias*! ✨%0AGostaria de finalizar o seguinte pedido:%0A(E-mail: ${emailCliente})%0A%0A`;
    let totalGeral = 0;

    carrinho.forEach((item) => {
        const subtotal = item.preco * item.quantidade;
        totalGeral += subtotal;
        mensagem += `• *${item.nome}* x${item.quantidade}%0A  _${item.detalhes}_ — ${formatarBRL(subtotal)}%0A`;
    });

    mensagem += `%0A*Total do Pedido: ${formatarBRL(totalGeral)}*%0A%0AAguardo confirmação de pagamento e entrega!`;

    totalVendasConcluidas += 1;
    receitaTotalAcumulada += totalGeral;
    atualizarDashboardVendas();

    window.open(`https://wa.me/${WHATSAPP_LOJA}?text=${mensagem}`, '_blank');

    carrinho = [];
    atualizarContadorSacola();
    fecharCarrinho();
}

function atualizarDashboardVendas() {
    const elVendas = document.getElementById('adminTotalVendas');
    const elReceita = document.getElementById('adminReceitaTotal');
    if (elVendas) elVendas.textContent = totalVendasConcluidas;
    if (elReceita) elReceita.textContent = formatarBRL(receitaTotalAcumulada);
}

// --- CRUD Admin (Blindado contra ausência de coluna no Supabase) ---
async function adicionarProduto() {
    const nomeInput = document.getElementById('nomeProduto');
    const precoInput = document.getElementById('precoProduto');
    const precoAntigoInput = document.getElementById('precoAntigoProduto');
    const imagemInput = document.getElementById('imagemProduto');
    const anelPulseiraCheckbox = document.getElementById('adminAtivoAnelPulseira');

    if (!nomeInput) return;

    const nome = nomeInput.value.trim();
    const preco = precoInput ? precoInput.value.trim().replace(',', '.') : '';
    const precoAntigo = precoAntigoInput ? precoAntigoInput.value.trim().replace(',', '.') : '';
    const imagem = imagemInput ? imagemInput.value.trim() : '';
    const anelPulseiraAtivo = anelPulseiraCheckbox ? anelPulseiraCheckbox.checked : false;

    if (!nome) return alert('Informe o nome da peça.');

    const novoItem = { texto: nome };
    if (preco) novoItem.preco = preco;
    if (precoAntigo) novoItem.preco_antigo = precoAntigo;
    if (imagem) novoItem.imagem = imagem;
    if (anelPulseiraAtivo) novoItem.anel_pulseira_ativo = true;

    let { error } = await _supabase.from('tarefas').insert([novoItem]);

    // Fallback automático caso a coluna 'anel_pulseira_ativo' ainda não tenha sido criada no Supabase
    if (error && error.message && error.message.includes('anel_pulseira_ativo')) {
        delete novoItem.anel_pulseira_ativo;
        const retry = await _supabase.from('tarefas').insert([novoItem]);
        error = retry.error;
        if (!error) {
            alert('Peça publicada! Dica: crie a coluna booleana "anel_pulseira_ativo" na tabela "tarefas" do Supabase para salvar o seletor de tamanhos.');
        }
    }

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
    if (!confirm('Deseja realmente remover esta peça da vitrine?')) return;

    const { error } = await _supabase.from('tarefas').delete().eq('id', id);
    if (error) {
        alert('Erro ao excluir: ' + error.message);
    } else {
        carregarProdutos();
    }
}

// Fechar modais ao clicar fora do card
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.style.display = 'none';
        if (e.target.id === 'modalCliente') {
            localStorage.setItem('florenza_cliente_email', 'visitante@florenza.com');
        }
    }
});

init();
