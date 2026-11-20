const SUPABASE_URL = 'https://finmivasfcnnJntfaeei.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbm1pdmFzZmNubmpudGZhZWVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNzY2MTIsImV4cCI6MjEwNzY1MjYxMn0.0IURfOPO9ExLv4D2VM03ENyPIBzG2iy9xEyE1gtlFd0';
const WHATSAPP_LOJA = '5511999999999'; // Substitua pelo WhatsApp real com DDI + DDD + número

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let listaProdutosGlobal = [];
let produtosVisiveis = [];
let indiceAtivo = 0;
let produtoSelecionadoCompra = null;
let carrinho = [];
let totalVendasConcluidas = 0;
let receitaTotalAcumulada = 0;
let usuarioAdmin = false;

function formatarBRL(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// --- Inicialização ---
async function init() {
    if (typeof gsap !== 'undefined') {
        gsap.from('.gs-rail', { y: 18, opacity: 0, duration: 0.65, ease: 'power2.out', clearProps: 'transform,opacity' });
    }

    const clienteLogado = localStorage.getItem('florenza_cliente_email');
    const modalCliente = document.getElementById('modalCliente');
    if (!clienteLogado && modalCliente) {
        setTimeout(() => {
            const adminAberto = document.getElementById('modalAdmin')?.style.display === 'flex';
            if (!adminAberto) modalCliente.style.display = 'flex';
        }, 1600);
    }

    await verificarSessao();
    await carregarProdutos();
}

// --- Cliente & Leads ---
function fecharModalCliente() {
    const modal = document.getElementById('modalCliente');
    if (modal) modal.style.display = 'none';
    localStorage.setItem('florenza_cliente_email', 'visitante@florenza.com');
}

async function salvarIdentificacaoCliente() {
    const input = document.getElementById('emailClienteInput');
    const aceita = document.getElementById('aceitaOfertas');
    const modal = document.getElementById('modalCliente');
    if (!input) return;

    const email = input.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return alert('Por favor, informe um e-mail válido.');
    }

    if (modal) modal.style.display = 'none';
    localStorage.setItem('florenza_cliente_email', email);

    if (aceita && aceita.checked) {
        try {
            await _supabase.from('leads').insert([{ email }]);
        } catch (err) {
            console.log('Lead já cadastrada ou erro de rede:', err);
        }
    }
}

// --- Admin ---
async function verificarSessao() {
    try {
        const { data: { session } } = await _supabase.auth.getSession();
        usuarioAdmin = !!session;
        renderHeader(session);
    } catch (e) {
        console.error('Erro na sessão:', e);
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
    }
}

async function fazerLogout() {
    await _supabase.auth.signOut();
    usuarioAdmin = false;
    renderHeader(null);
    fecharModalAdmin();
}

// --- Carregamento & Trilho Interativo ---
async function carregarProdutos() {
    const trilho = document.getElementById('trilhoProdutos');
    if (!trilho) return;

    trilho.innerHTML = '<p style="color: var(--text-muted); margin: 0 auto;">Carregando coleção...</p>';

    const { data, error } = await _supabase
        .from('tarefas')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        trilho.innerHTML = '<p style="color: var(--accent-red); margin: 0 auto;">Erro ao carregar produtos.</p>';
        return;
    }

    listaProdutosGlobal = data || [];
    produtosVisiveis = [...listaProdutosGlobal];
    indiceAtivo = 0;

    const totalAdminEl = document.getElementById('totalProdutosAdmin');
    if (totalAdminEl) totalAdminEl.textContent = `${listaProdutosGlobal.length} peças`;

    renderTrilho(produtosVisiveis);
}

function renderTrilho(produtos) {
    const trilho = document.getElementById('trilhoProdutos');
    if (!trilho) return;

    trilho.innerHTML = '';

    if (!produtos.length) {
        trilho.innerHTML = '<p style="color: var(--text-muted); margin: 0 auto;">Nenhuma peça encontrada.</p>';
        document.getElementById('focoTitulo').textContent = 'Sem peças no momento';
        document.getElementById('focoPreco').textContent = '';
        return;
    }

    if (indiceAtivo >= produtos.length) indiceAtivo = 0;

    produtos.forEach((p, idx) => {
        const nome = p.texto || 'Acessório Florenza';
        const precoNum = parseFloat(p.preco) || 0;
        const precoStr = p.preco ? formatarBRL(precoNum) : 'Sob consulta';
        const imagem = p.imagem || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600';

        const item = document.createElement('article');
        item.className = `rail-item ${idx === indiceAtivo ? 'is-active' : ''}`;
        item.dataset.index = idx;

        item.onclick = () => {
            if (idx === indiceAtivo) {
                abrirTelaCompra(p.id);
            } else {
                selecionarIndiceTrilho(idx);
            }
        };

        item.innerHTML = `
            <div class="rail-img-wrap">
                ${p.preco_antigo ? '<span class="promo-badge-tag">OFERTA</span>' : ''}
                <img src="${imagem}" alt="${nome}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600'">
            </div>
            <div class="rail-item-meta">
                <span class="rail-item-name">${nome}</span>
                <span class="rail-item-price">${precoStr}</span>
            </div>
        `;

        trilho.appendChild(item);
    });

    atualizarBarraFoco(produtos[indiceAtivo]);
    centralizarItemAtivo();

    if (typeof gsap !== 'undefined') {
        gsap.from('.rail-item', {
            y: 16,
            opacity: 0,
            duration: 0.45,
            stagger: 0.05,
            ease: 'power2.out',
            clearProps: 'opacity'
        });
    }
}

function selecionarIndiceTrilho(novoIndice) {
    if (!produtosVisiveis.length) return;
    indiceAtivo = (novoIndice + produtosVisiveis.length) % produtosVisiveis.length;

    const itens = document.querySelectorAll('.rail-item');
    itens.forEach((el, i) => {
        el.classList.toggle('is-active', i === indiceAtivo);
    });

    atualizarBarraFoco(produtosVisiveis[indiceAtivo]);
    centralizarItemAtivo();
}

function moverTrilho(passo) {
    selecionarIndiceTrilho(indiceAtivo + passo);
}

function centralizarItemAtivo() {
    const trilho = document.getElementById('trilhoProdutos');
    const ativoEl = trilho?.querySelector('.rail-item.is-active');
    if (!trilho || !ativoEl) return;

    const targetScroll = ativoEl.offsetLeft - (trilho.clientWidth - ativoEl.clientWidth) / 2;
    trilho.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });
}

function atualizarBarraFoco(produto) {
    if (!produto) return;
    const precoNum = parseFloat(produto.preco) || 0;

    document.getElementById('focoTitulo').textContent = produto.texto || 'Acessório Florenza';
    document.getElementById('focoPreco').textContent = produto.preco ? formatarBRL(precoNum) : 'Sob consulta';
    document.getElementById('focoLikes').textContent = produto.likes || 0;

    const btnCurtir = document.getElementById('btnCurtirAtivo');
    btnCurtir.onclick = () => darLike(produto.id);

    const btnComprar = document.getElementById('btnAbrirCompraAtivo');
    btnComprar.onclick = () => abrirTelaCompra(produto.id);
}

function filtrarProdutos() {
    const termo = (document.getElementById('inputBusca')?.value || '').toLowerCase().trim();
    produtosVisiveis = listaProdutosGlobal.filter((p) => p.texto && p.texto.toLowerCase().includes(termo));
    indiceAtivo = 0;
    renderTrilho(produtosVisiveis);
}

async function darLike(id) {
    const produto = listaProdutosGlobal.find((p) => p.id === id);
    if (!produto) return;

    const novosLikes = (produto.likes || 0) + 1;
    produto.likes = novosLikes;

    const focoLikesEl = document.getElementById('focoLikes');
    if (focoLikesEl && produtosVisiveis[indiceAtivo]?.id === id) {
        focoLikesEl.textContent = novosLikes;
    }

    try {
        await _supabase.from('tarefas').update({ likes: novosLikes }).eq('id', id);
    } catch (err) {
        console.error('Erro ao curtir:', err);
    }
}

// --- Tela de Compra Dedicada (Transição Direta) ---
function abrirTelaCompra(id) {
    const produto = listaProdutosGlobal.find((p) => p.id === id);
    if (!produto) return;

    produtoSelecionadoCompra = produto;
    const precoNum = parseFloat(produto.preco) || 0;
    const precoAntigoNum = produto.preco_antigo ? parseFloat(produto.preco_antigo) : null;

    document.getElementById('compraImagem').src = produto.imagem || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=700';
    document.getElementById('compraTitulo').textContent = produto.texto || 'Acessório Florenza';
    document.getElementById('compraPreco').textContent = produto.preco ? formatarBRL(precoNum) : 'Sob consulta';

    const antigoEl = document.getElementById('compraPrecoAntigo');
    if (precoAntigoNum) {
        antigoEl.textContent = formatarBRL(precoAntigoNum);
        antigoEl.style.display = 'inline';
    } else {
        antigoEl.style.display = 'none';
    }

    // Exibe seletor de anel/pulseira APENAS se ativo no admin
    const blocoTamanho = document.getElementById('blocoTamanhoAnelPulseira');
    blocoTamanho.style.display = produto.anel_pulseira_ativo === true ? 'block' : 'none';

    document.getElementById('stageTrilho').style.display = 'none';
    const stageCompra = document.getElementById('stageCompra');
    stageCompra.style.display = 'block';

    if (typeof gsap !== 'undefined') {
        gsap.fromTo('.purchase-split', { y: 18, opacity: 0.2 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power2.out' });
    }
}

function voltarAoTrilho() {
    produtoSelecionadoCompra = null;
    document.getElementById('stageCompra').style.display = 'none';
    document.getElementById('stageTrilho').style.display = 'flex';
    centralizarItemAtivo();
}

function adicionarProdutoAtualAoCarrinho() {
    if (!produtoSelecionadoCompra) return;

    const p = produtoSelecionadoCompra;
    const nomeBase = p.texto || 'Acessório Florenza';
    const preco = parseFloat(p.preco) || 0;

    const tipoEmbalagem = document.querySelector('input[name="tipoEmbalagem"]:checked')?.value || 'Caixinha Personalizada';
    const cor = document.querySelector('input[name="corEmbalagem"]:checked')?.value || 'Rosa';
    const tamanho = p.anel_pulseira_ativo === true
        ? (document.querySelector('input[name="tamanhoItem"]:checked')?.value || null)
        : null;

    const detalhesTexto = `${tipoEmbalagem} · Cor: ${cor}${tamanho ? ` · Tam: ${tamanho}` : ''}`;
    const itemKey = `${p.id}-${tipoEmbalagem}-${cor}-${tamanho || 'unico'}`;

    const existente = carrinho.find((item) => item.key === itemKey);
    if (existente) {
        existente.quantidade += 1;
    } else {
        carrinho.push({ key: itemKey, id: p.id, nome: nomeBase, detalhes: detalhesTexto, preco, quantidade: 1 });
    }

    atualizarContadorSacola();

    p.carrinho_count = (p.carrinho_count || 0) + 1;
    _supabase.from('tarefas').update({ carrinho_count: p.carrinho_count }).eq('id', p.id).catch(() => {});

    abrirCarrinho();
}

// --- Sacola & WhatsApp ---
function atualizarContadorSacola() {
    const total = carrinho.reduce((acc, item) => acc + item.quantidade, 0);
    const el = document.getElementById('contadorCarrinho');
    if (el) el.textContent = total;
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
    if (!carrinho.length) {
        lista.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin-top: 48px;">Sua sacola está vazia.</p>';
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
    if (!carrinho.length) return alert('Sua sacola está vazia!');

    const emailCliente = localStorage.getItem('florenza_cliente_email') || 'Cliente Vitrine';
    let mensagem = `Olá, *Florenza Bijouterias*! ✨%0AGostaria de finalizar o pedido:%0A(E-mail: ${emailCliente})%0A%0A`;
    let totalGeral = 0;

    carrinho.forEach((item) => {
        const subtotal = item.preco * item.quantidade;
        totalGeral += subtotal;
        mensagem += `• *${item.nome}* x${item.quantidade}%0A  _${item.detalhes}_ — ${formatarBRL(subtotal)}%0A`;
    });

    mensagem += `%0A*Total do Pedido: ${formatarBRL(totalGeral)}*`;

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

// --- CRUD Admin ---
async function adicionarProduto() {
    const nome = document.getElementById('nomeProduto')?.value.trim();
    const preco = (document.getElementById('precoProduto')?.value || '').trim().replace(',', '.');
    const precoAntigo = (document.getElementById('precoAntigoProduto')?.value || '').trim().replace(',', '.');
    const imagem = (document.getElementById('imagemProduto')?.value || '').trim();
    const anelPulseiraAtivo = Boolean(document.getElementById('adminAtivoAnelPulseira')?.checked);

    if (!nome) return alert('Informe o nome da peça.');

    const novoItem = { texto: nome };
    if (preco) novoItem.preco = preco;
    if (precoAntigo) novoItem.preco_antigo = precoAntigo;
    if (imagem) novoItem.imagem = imagem;
    if (anelPulseiraAtivo) novoItem.anel_pulseira_ativo = true;

    let { error } = await _supabase.from('tarefas').insert([novoItem]);

    if (error && error.message && error.message.includes('anel_pulseira_ativo')) {
        delete novoItem.anel_pulseira_ativo;
        const retry = await _supabase.from('tarefas').insert([novoItem]);
        error = retry.error;
        if (!error) {
            alert('Peça publicada! Crie a coluna booleana "anel_pulseira_ativo" na tabela "tarefas" do Supabase para ativar o seletor de tamanhos.');
        }
    }

    if (error) {
        alert('Erro ao publicar: ' + error.message);
    } else {
        document.getElementById('nomeProduto').value = '';
        document.getElementById('precoProduto').value = '';
        document.getElementById('precoAntigoProduto').value = '';
        document.getElementById('imagemProduto').value = '';
        document.getElementById('adminAtivoAnelPulseira').checked = false;
        fecharModalAdmin();
        carregarProdutos();
    }
}

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.style.display = 'none';
        if (e.target.id === 'modalCliente') {
            localStorage.setItem('florenza_cliente_email', 'visitante@florenza.com');
        }
    }
});

init();
