const SUPABASE_URL = 'https://finmivasfcnnJntfaeei.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbm1pdmFzZmNubmpudGZhZWVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNzY2MTIsImV4cCI6MjEwNzY1MjYxMn0.0IURfOPO9ExLv4D2VM03ENyPIBzG2iy9xEyE1gtlFd0';
const WHATSAPP_LOJA = '5511999999999'; // Substitua pelo WhatsApp real com DDI + DDD + número

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let listaProdutosGlobal = [];
let produtosVisiveis = [];
let indiceAtivo = 0;
let tamanhoRapidoSelecionado = 'P (14/15)';
let produtoSelecionadoCompra = null;
let carrinho = [];
let totalVendasConcluidas = 0;
let receitaTotalAcumulada = 0;
let usuarioAdmin = false;

function formatarBRL(valor) {
    const num = Number(valor) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function setModalDisplay(id, estado) {
    const el = document.getElementById(id);
    if (el) el.style.display = estado;
}

// --- Inicialização ---
function init() {
    const trilho = document.getElementById('trilhoProdutos');
    if (trilho) {
        trilho.innerHTML = '<p style="color: var(--text-muted); margin: 0 auto;">Carregando peças...</p>';
    }

    verificarSessao();
    carregarProdutos();

    const clienteLogado = localStorage.getItem('florenza_cliente_email');
    const adminAberto = document.getElementById('modalAdmin')?.style.display === 'flex';
    if (!clienteLogado && !adminAberto) {
        setModalDisplay('modalCliente', 'flex');
    }
}

// --- Barra de Pesquisa com Lupa + Expansão no Topo ---
function abrirBuscaTopo() {
    const navbar = document.getElementById('navbar');
    const input = document.getElementById('inputBusca');
    if (navbar) navbar.classList.add('search-active');
    if (input) input.focus();
}

function fecharBuscaTopo() {
    const navbar = document.getElementById('navbar');
    const input = document.getElementById('inputBusca');
    if (navbar) navbar.classList.remove('search-active');
    if (input) {
        input.value = '';
        filtrarProdutos();
    }
}

// --- Cliente & Ofertas ---
function fecharModalCliente() {
    setModalDisplay('modalCliente', 'none');
    localStorage.setItem('florenza_cliente_email', 'visitante@florenza.com');
}

async function salvarIdentificacaoCliente() {
    const input = document.getElementById('emailClienteInput');
    const aceita = document.getElementById('aceitaOfertas');
    if (!input) return;

    const email = input.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert('Por favor, informe um e-mail válido.');
        return;
    }

    setModalDisplay('modalCliente', 'none');
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
        const { data } = await _supabase.auth.getSession();
        const session = data ? data.session : null;
        usuarioAdmin = !!session;
        renderHeader(session);
    } catch (e) {
        console.error('Erro na sessão:', e);
        renderHeader(null);
    }
}

function renderHeader(session) {
    const statusDiv = document.getElementById('statusLogin');
    const formLoginView = document.getElementById('formLoginView');
    const formCadastroView = document.getElementById('formCadastroView');
    if (!statusDiv || !formLoginView || !formCadastroView) return;

    if (session) {
        statusDiv.innerHTML = `<button type="button" onclick="abrirModalAdmin()" class="btn btn-dark">Painel Admin</button>`;
        formLoginView.style.display = 'none';
        formCadastroView.style.display = 'block';
        atualizarDashboardVendas();
    } else {
        statusDiv.innerHTML = `<button type="button" onclick="abrirModalAdmin()" class="btn btn-outline">Admin</button>`;
        formLoginView.style.display = 'block';
        formCadastroView.style.display = 'none';
    }
}

function abrirModalAdmin() { setModalDisplay('modalAdmin', 'flex'); }
function fecharModalAdmin() { setModalDisplay('modalAdmin', 'none'); }
function abrirCarrinho() { setModalDisplay('modalCarrinho', 'flex'); renderizarCarrinho(); }
function fecharCarrinho() { setModalDisplay('modalCarrinho', 'none'); }

async function fazerLogin() {
    const email = document.getElementById('emailLogin')?.value.trim();
    const password = document.getElementById('senhaLogin')?.value;
    if (!email || !password) {
        alert('Preencha e-mail e senha.');
        return;
    }

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

// --- Carregamento & Trilho ---
async function carregarProdutos() {
    const trilho = document.getElementById('trilhoProdutos');
    if (!trilho) return;

    try {
        const { data, error } = await _supabase
            .from('tarefas')
            .select('*')
            .order('id', { ascending: false });

        if (error) {
            trilho.innerHTML = '<p style="color: var(--accent-red); margin: 0 auto;">Erro ao carregar produtos.</p>';
            return;
        }

        listaProdutosGlobal = Array.isArray(data) ? data : [];
        produtosVisiveis = [...listaProdutosGlobal];
        indiceAtivo = 0;

        const totalAdminEl = document.getElementById('totalProdutosAdmin');
        if (totalAdminEl) totalAdminEl.textContent = `${listaProdutosGlobal.length} peças`;

        renderTrilho(produtosVisiveis);
    } catch (err) {
        console.error('Falha ao buscar produtos:', err);
        trilho.innerHTML = '<p style="color: var(--accent-red); margin: 0 auto;">Falha de conexão ao carregar vitrine.</p>';
    }
}

function renderTrilho(produtos) {
    const trilho = document.getElementById('trilhoProdutos');
    const focoTitulo = document.getElementById('focoTitulo');
    const focoPreco = document.getElementById('focoPreco');
    if (!trilho) return;

    trilho.innerHTML = '';

    if (!produtos.length) {
        trilho.innerHTML = '<p style="color: var(--text-muted); margin: 0 auto;">Nenhuma peça encontrada.</p>';
        if (focoTitulo) focoTitulo.textContent = 'Sem peças no momento';
        if (focoPreco) focoPreco.textContent = '';
        return;
    }

    if (indiceAtivo >= produtos.length) indiceAtivo = 0;

    const fragment = document.createDocumentFragment();

    produtos.forEach((p, idx) => {
        const nome = p.texto || 'Acessório Florenza';
        const precoNum = parseFloat(p.preco) || 0;
        const precoStr = p.preco ? formatarBRL(precoNum) : 'Sob consulta';
        const imagem = p.imagem || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600';
        const temTamanho = p.anel_pulseira_ativo === true;

        const item = document.createElement('article');
        item.className = `rail-item ${idx === indiceAtivo ? 'is-active' : ''}`;
        item.onclick = () => {
            if (idx === indiceAtivo) {
                abrirTelaCompra(p.id);
            } else {
                selecionarIndiceTrilho(idx);
            }
        };

        const imgWrap = document.createElement('div');
        imgWrap.className = 'rail-img-wrap';

        if (p.preco_antigo) {
            const badge = document.createElement('span');
            badge.className = 'promo-badge-tag';
            badge.textContent = 'OFERTA';
            imgWrap.appendChild(badge);
        }

        if (temTamanho) {
            const tamTag = document.createElement('span');
            tamTag.className = 'size-tag-mini';
            tamTag.textContent = 'Anel/Pulseira';
            imgWrap.appendChild(tamTag);
        }

        const img = document.createElement('img');
        img.src = imagem;
        img.alt = nome;
        img.decoding = 'async';
        img.onerror = () => {
            img.src = 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600';
        };
        imgWrap.appendChild(img);

        const meta = document.createElement('div');
        meta.className = 'rail-item-meta';

        const spanNome = document.createElement('span');
        spanNome.className = 'rail-item-name';
        spanNome.textContent = nome;

        const spanPreco = document.createElement('span');
        spanPreco.className = 'rail-item-price';
        spanPreco.textContent = precoStr;

        meta.appendChild(spanNome);
        meta.appendChild(spanPreco);

        item.appendChild(imgWrap);
        item.appendChild(meta);
        fragment.appendChild(item);
    });

    trilho.appendChild(fragment);
    atualizarBarraFoco(produtos[indiceAtivo]);
    centralizarItemAtivo();
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
    trilho.scrollLeft = Math.max(0, targetScroll);
}

function atualizarBarraFoco(produto) {
    if (!produto) return;
    const precoNum = parseFloat(produto.preco) || 0;
    const precoAntigoNum = produto.preco_antigo ? parseFloat(produto.preco_antigo) : null;

    const tituloEl = document.getElementById('focoTitulo');
    const precoEl = document.getElementById('focoPreco');
    const antigoEl = document.getElementById('focoPrecoAntigo');
    const likesEl = document.getElementById('focoLikes');
    const sizesBox = document.getElementById('focoTamanhosRapidos');
    const btnCurtir = document.getElementById('btnCurtirAtivo');
    const btnComprar = document.getElementById('btnAbrirCompraAtivo');

    if (tituloEl) tituloEl.textContent = produto.texto || 'Acessório Florenza';
    if (precoEl) precoEl.textContent = produto.preco ? formatarBRL(precoNum) : 'Sob consulta';
    if (antigoEl) {
        if (precoAntigoNum) {
            antigoEl.textContent = formatarBRL(precoAntigoNum);
            antigoEl.style.display = 'inline';
        } else {
            antigoEl.style.display = 'none';
        }
    }
    if (likesEl) likesEl.textContent = produto.likes || 0;

    // Seletor rápido de tamanho no trilho APENAS se estiver ativo no admin
    if (sizesBox) {
        if (produto.anel_pulseira_ativo === true) {
            const opcoes = ['P (14/15)', 'M (16/17)', 'G (18/20)', 'Ajustável'];
            sizesBox.style.display = 'flex';
            sizesBox.innerHTML = opcoes.map((tam) => `
                <button type="button" class="focus-size-pill ${tam === tamanhoRapidoSelecionado ? 'active' : ''}" onclick="escolherTamanhoRapido('${tam}')">${tam}</button>
            `).join('');
        } else {
            sizesBox.style.display = 'none';
            sizesBox.innerHTML = '';
        }
    }

    if (btnCurtir) btnCurtir.onclick = () => darLike(produto.id);
    if (btnComprar) btnComprar.onclick = () => abrirTelaCompra(produto.id);
}

function escolherTamanhoRapido(tam) {
    tamanhoRapidoSelecionado = tam;
    atualizarBarraFoco(produtosVisiveis[indiceAtivo]);
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

// --- Tela de Personalização & Compra ---
function abrirTelaCompra(id) {
    const produto = listaProdutosGlobal.find((p) => p.id === id);
    if (!produto) return;

    produtoSelecionadoCompra = produto;
    const precoNum = parseFloat(produto.preco) || 0;
    const precoAntigoNum = produto.preco_antigo ? parseFloat(produto.preco_antigo) : null;

    const imgEl = document.getElementById('compraImagem');
    const tituloEl = document.getElementById('compraTitulo');
    const precoEl = document.getElementById('compraPreco');
    const antigoEl = document.getElementById('compraPrecoAntigo');
    const blocoTamanho = document.getElementById('blocoTamanhoAnelPulseira');

    if (imgEl) imgEl.src = produto.imagem || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=700';
    if (tituloEl) tituloEl.textContent = produto.texto || 'Acessório Florenza';
    if (precoEl) precoEl.textContent = produto.preco ? formatarBRL(precoNum) : 'Sob consulta';

    if (antigoEl) {
        if (precoAntigoNum) {
            antigoEl.textContent = formatarBRL(precoAntigoNum);
            antigoEl.style.display = 'inline';
        } else {
            antigoEl.style.display = 'none';
        }
    }

    if (blocoTamanho) {
        blocoTamanho.style.display = produto.anel_pulseira_ativo === true ? 'block' : 'none';
        if (produto.anel_pulseira_ativo === true) {
            const radios = document.querySelectorAll('input[name="tamanhoItem"]');
            radios.forEach((r) => {
                r.checked = (r.value === tamanhoRapidoSelecionado);
            });
        }
    }

    setModalDisplay('stageTrilho', 'none');
    setModalDisplay('stageCompra', 'block');
}

function voltarAoTrilho() {
    produtoSelecionadoCompra = null;
    setModalDisplay('stageCompra', 'none');
    setModalDisplay('stageTrilho', 'flex');
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
        ? (document.querySelector('input[name="tamanhoItem"]:checked')?.value || tamanhoRapidoSelecionado)
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

// --- Sacola Lateral (Estilo YOUR CART com sugestão rápida) ---
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

function adicionarSugestaoRapida(id) {
    const p = listaProdutosGlobal.find((item) => item.id === id);
    if (!p) return;

    const preco = parseFloat(p.preco) || 0;
    const detalhesTexto = 'Caixinha Personalizada · Cor: Rosa';
    const itemKey = `${p.id}-Caixinha Personalizada-Rosa-unico`;

    const existente = carrinho.find((item) => item.key === itemKey);
    if (existente) {
        existente.quantidade += 1;
    } else {
        carrinho.push({ key: itemKey, id: p.id, nome: p.texto || 'Acessório Florenza', detalhes: detalhesTexto, preco, quantidade: 1 });
    }

    atualizarContadorSacola();
    renderizarCarrinho();
}

function renderizarSugestoesSacola() {
    const box = document.getElementById('sugestoesSacola');
    if (!box) return;

    const extras = listaProdutosGlobal.filter((p) => !carrinho.some((c) => c.id === p.id)).slice(0, 2);
    if (!extras.length) {
        box.innerHTML = '';
        return;
    }

    box.innerHTML = `<strong>Complete seu pedido:</strong>` + extras.map((p) => `
        <div class="suggestion-row">
            <span>${p.texto || 'Peça Florenza'} — <strong>${formatarBRL(parseFloat(p.preco) || 0)}</strong></span>
            <button type="button" class="btn btn-outline btn-sm" onclick="adicionarSugestaoRapida(${p.id})">+ Add</button>
        </div>
    `).join('');
}

function renderizarCarrinho() {
    const lista = document.getElementById('listaItensCarrinho');
    const totalEl = document.getElementById('carrinhoTotalPreco');
    if (!lista || !totalEl) return;

    lista.innerHTML = '';
    if (!carrinho.length) {
        lista.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin-top: 40px;">Sua sacola está vazia.</p>';
        totalEl.textContent = 'R$ 0,00';
        renderizarSugestoesSacola();
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
                <button type="button" class="cart-remove-btn" onclick="removerItemCarrinho(${index})" title="Remover">✕</button>
            </div>
        `;
        lista.appendChild(row);
    });

    totalEl.textContent = formatarBRL(totalGeral);
    renderizarSugestoesSacola();
}

function finalizarCompra() {
    if (!carrinho.length) {
        alert('Sua sacola está vazia!');
        return;
    }

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

    if (!nome) {
        alert('Informe o nome da peça.');
        return;
    }

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

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        fecharBuscaTopo();
    }
});

init();
