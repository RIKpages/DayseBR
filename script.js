const SUPABASE_URL = 'https://finmivasfcnnjntfaeei.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbm1pdmFzZmNubmpudGZhZWVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNzY2MTIsImV4cCI6MjEwNzY1MjYxMn0.0IURfOPO9ExLv4D2VM03ENyPIBzG2iy9xEyE1gtlFd0';
const WHATSAPP_LOJA = '5511999999999'; // Substitua pelo WhatsApp real com DDI + DDD + número
const ADMIN_EMAIL = 'kazin1324@gmail.com';
const CACHE_PRODUTOS_KEY = 'florenza_vitrine_cache_v3';

let _supabase = null;
try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
    }
} catch (e) {
    console.warn('SDK Supabase indisponível, usando REST direto:', e);
}

let listaProdutosGlobal = [];
let produtosVisiveis = [];
let indiceAtivo = 0;
let tamanhoRapidoSelecionado = 'P (14/15)';
let produtoSelecionadoCompra = null;
let carrinho = [];
let totalVendasConcluidas = 0;
let receitaTotalAcumulada = 0;
let usuarioAdmin = false;
let preloaderEncerrado = false;

function formatarBRL(valor) {
    const num = Number(valor) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function setModalDisplay(id, estado) {
    const el = document.getElementById(id);
    if (el) el.style.display = estado;
}

function esconderLogoCarregamento() {
    if (preloaderEncerrado) return;
    preloaderEncerrado = true;
    const preloader = document.getElementById('preloaderFlorenza');
    if (preloader) preloader.classList.add('is-hidden');
}

function getStorageSafe(chave) {
    try {
        return localStorage.getItem(chave);
    } catch (e) {
        return null;
    }
}

function setStorageSafe(chave, valor) {
    try {
        localStorage.setItem(chave, valor);
    } catch (e) {}
}

function lerCacheVitrine() {
    try {
        const raw = sessionStorage.getItem(CACHE_PRODUTOS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
        return null;
    }
}

function salvarCacheVitrine(produtos) {
    try {
        sessionStorage.setItem(CACHE_PRODUTOS_KEY, JSON.stringify(produtos));
    } catch (e) {}
}

async function buscarProdutosRapido(timeoutMs = 8000) {
    // Não solicitar colunas opcionais pelo nome: modelo_3d_url e carrinho_count
    // podem não existir no schema atual. select=* retorna somente as colunas reais.
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    const endpoint = `${SUPABASE_URL}/rest/v1/tarefas?select=*&order=id.desc`;

    try {
        const res = await fetch(endpoint, {
            method: 'GET',
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                Accept: 'application/json'
            },
            signal: controller.signal,
            cache: 'no-store'
        });
        const body = await res.text();
        if (!res.ok) {
            let detail = body;
            try {
                const parsed = JSON.parse(body);
                detail = parsed.message || parsed.details || parsed.hint || parsed.code || body;
            } catch (_) {}
            throw new Error(`Supabase HTTP ${res.status}: ${detail}`);
        }
        let rows;
        try { rows = body ? JSON.parse(body) : []; }
        catch (_) { throw new Error('A resposta do catálogo não é um JSON válido.'); }
        if (!Array.isArray(rows)) throw new Error('O catálogo retornou um formato inesperado.');
        return rows;
    } catch (err) {
        if (err && err.name === 'AbortError') {
            throw new Error(`Tempo esgotado ao consultar o catálogo após ${timeoutMs} ms.`);
        }
        throw err;
    } finally {
        window.clearTimeout(timer);
    }
}


// Movimento editorial sutil: parallax leve no destaque e brilho flutuante.
// Respeita a preferência de movimento reduzido e não depende de WebGL/GSAP.
function iniciarMovimentoFlorenza() {
    const stage = document.getElementById('showcaseModeloAtivo');
    const media = document.querySelector('.model-hero-media');
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobileOrCoarse = window.matchMedia && window.matchMedia('(max-width: 820px), (pointer: coarse)').matches;
    if (!stage || !media || reduced || mobileOrCoarse) return;

    let raf = 0;
    let targetX = 0, targetY = 0, currentX = 0, currentY = 0;
    stage.addEventListener('pointermove', (event) => {
        const rect = stage.getBoundingClientRect();
        targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 5;
        targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 5;
        if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
    stage.addEventListener('pointerleave', () => {
        targetX = 0; targetY = 0;
        if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
    function tick() {
        currentX += (targetX - currentX) * 0.09;
        currentY += (targetY - currentY) * 0.09;
        media.style.setProperty('--tilt-x', `${currentX}deg`);
        media.style.setProperty('--tilt-y', `${-currentY}deg`);
        if (Math.abs(targetX-currentX) > 0.02 || Math.abs(targetY-currentY) > 0.02) {
            raf = requestAnimationFrame(tick);
        } else {
            raf = 0;
        }
    }
}

function animarTrocaDeProduto() {
    const stage = document.getElementById('showcaseModeloAtivo');
    if (!stage || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    stage.classList.remove('product-switching', 'product-revealing');
    void stage.offsetWidth;
    stage.classList.add('product-switching');
    window.setTimeout(() => {
        stage.classList.remove('product-switching');
        stage.classList.add('product-revealing');
        window.setTimeout(() => stage.classList.remove('product-revealing'), 680);
    }, 220);
}

// --- Inicialização com Logo de Carregamento ---
function init() {
    // Garantia de segurança: fecha a logo de carregamento no máximo em 1.5s mesmo em rede lenta
    const fallbackLogoTimer = setTimeout(esconderLogoCarregamento, 1500);

    const emCache = lerCacheVitrine();
    if (emCache && emCache.length) {
        listaProdutosGlobal = emCache;
        produtosVisiveis = [...emCache];
        indiceAtivo = 0;
        renderTrilho(produtosVisiveis);
        clearTimeout(fallbackLogoTimer);
        setTimeout(esconderLogoCarregamento, 450);
    } else {
        const trilho = document.getElementById('trilhoProdutos');
        if (trilho) {
            trilho.innerHTML = '<p style="color: var(--text-muted); margin: 0 auto;">Carregando vitrine...</p>';
        }
    }

    iniciarMovimentoFlorenza();
    Promise.resolve(verificarSessao()).catch((err) => {
        console.warn('[Florenza] Não foi possível verificar a sessão administrativa.', err);
        renderHeader(null);
    });
    carregarProdutos(Boolean(emCache && emCache.length)).catch((err) => {
        console.warn('[Florenza] Catálogo indisponível.', err);
    }).finally(() => {
        clearTimeout(fallbackLogoTimer);
        setTimeout(esconderLogoCarregamento, 350);
    });

    const clienteLogado = getStorageSafe('florenza_cliente_email');
    if (!clienteLogado) {
        setTimeout(() => setModalDisplay('modalCliente', 'flex'), 1600);
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
    setStorageSafe('florenza_cliente_email', 'visitante@florenza.com');
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
    setStorageSafe('florenza_cliente_email', email);

    if (aceita && aceita.checked) {
        fetch(`${SUPABASE_URL}/rest/v1/leads`, {
            method: 'POST',
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal'
            },
            body: JSON.stringify([{ email }])
        }).catch(() => {});
    }
}

// --- Admin ---
async function verificarSessao() {
    if (!_supabase) { usuarioAdmin = false; renderHeader(null); return; }
    try {
        const { data, error } = await _supabase.auth.getSession();
        if (error) throw error;
        const session = data?.session || null;
        const email = String(session?.user?.email || '').trim().toLowerCase();
        if (session && email !== ADMIN_EMAIL.toLowerCase()) { await _supabase.auth.signOut(); usuarioAdmin = false; renderHeader(null); return; }
        usuarioAdmin = !!session; renderHeader(session);
    } catch (e) { console.warn('[Florenza] Falha ao validar sessão admin.', e); usuarioAdmin = false; renderHeader(null); }
}

async function obterHeadersAdmin(extra = {}) {
    if (!_supabase) throw new Error('Autenticação indisponível. Atualize a página e tente novamente.');
    const { data, error } = await _supabase.auth.getSession();
    if (error) throw error;
    const session = data?.session;
    const email = String(session?.user?.email || '').trim().toLowerCase();
    if (!session?.access_token || email !== ADMIN_EMAIL.toLowerCase()) { usuarioAdmin = false; renderHeader(null); throw new Error('Acesso administrativo não autorizado. Entre com a conta administrativa correta.'); }
    return { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}`, ...extra };
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
        const waInput = document.getElementById('adminWhatsappLoja');
        if (waInput) waInput.value = getStorageSafe('florenza_whatsapp_loja') || WHATSAPP_LOJA;
        renderizarListaAdmin();
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
    if (!_supabase) {
        alert('Cliente de autenticação ainda carregando, tente novamente em 1 segundo.');
        return;
    }
    const email = document.getElementById('emailLogin')?.value.trim();
    const password = document.getElementById('senhaLogin')?.value;
    if (!email || !password) {
        alert('Preencha e-mail e senha.');
        return;
    }

    if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) { alert('Esta conta não tem autorização para acessar o painel administrativo.'); return; }
    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) alert('Erro ao entrar: ' + error.message);
    else { usuarioAdmin = true; renderHeader(data.session); fecharModalAdmin(); }
}

async function fazerLogout() {
    if (_supabase) await _supabase.auth.signOut().catch(() => {});
    usuarioAdmin = false;
    renderHeader(null);
    fecharModalAdmin();
}

// --- Carregamento & Apresentação do Modelo ---
async function carregarProdutos(jaTemCache = false) {
    const trilho = document.getElementById('trilhoProdutos');
    if (!trilho) return;

    try {
        const data = await buscarProdutosRapido(5000);
        const lista = Array.isArray(data) ? data : [];
        // Uma resposta vazia não apaga um cache anterior válido (ex.: leitura pública
        // temporariamente sem linhas por configuração de acesso no Supabase).
        if (!lista.length && jaTemCache && listaProdutosGlobal.length) {
            renderTrilho(produtosVisiveis);
            return;
        }
        listaProdutosGlobal = lista;
        salvarCacheVitrine(lista);

        const termo = (document.getElementById('inputBusca')?.value || '').toLowerCase().trim();
        produtosVisiveis = termo
            ? lista.filter((p) => p.texto && p.texto.toLowerCase().includes(termo))
            : [...lista];

        if (indiceAtivo >= produtosVisiveis.length) indiceAtivo = 0;

        const totalAdminEl = document.getElementById('totalProdutosAdmin');
        if (totalAdminEl) totalAdminEl.textContent = `${listaProdutosGlobal.length} peças`;

        renderTrilho(produtosVisiveis);
        if (usuarioAdmin) renderizarListaAdmin();
    } catch (err) {
        if (!jaTemCache) {
            trilho.innerHTML = `
                <div style="text-align:center; margin: 0 auto; padding: 12px;">
                    <p style="color: var(--accent-red); margin-bottom: 8px;">Não foi possível conectar à vitrine neste momento.</p>
                    <small style="display:block;color:var(--text-muted);margin-bottom:10px;">A apresentação da Florenza continua disponível. Tente atualizar as peças em instantes.</small>
                    <button type="button" class="btn btn-dark btn-sm" onclick="carregarProdutos(false)">Tentar novamente</button>
                </div>
            `;
        }
    }
}

function renderTrilho(produtos) {
    const trilho = document.getElementById('trilhoProdutos');
    if (!trilho) return;

    trilho.innerHTML = '';

    if (!produtos.length) {
        trilho.innerHTML = '<p style="color: var(--text-muted); margin: 0 auto;">Nenhuma peça encontrada.</p>';
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
        item.onclick = () => selecionarIndiceTrilho(idx);

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
        img.loading = idx < 4 ? 'eager' : 'lazy';
        img.onerror = () => {
            img.onerror = null;
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
    atualizarApresentacaoModelo(produtos[indiceAtivo]);
    centralizarItemAtivo();
}

function selecionarIndiceTrilho(novoIndice) {
    if (!produtosVisiveis.length) return;
    animarTrocaDeProduto();
    indiceAtivo = (novoIndice + produtosVisiveis.length) % produtosVisiveis.length;

    const itens = document.querySelectorAll('.rail-item');
    itens.forEach((el, i) => {
        el.classList.toggle('is-active', i === indiceAtivo);
    });

    atualizarApresentacaoModelo(produtosVisiveis[indiceAtivo]);
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

function atualizarApresentacaoModelo(produto) {
    if (!produto) return;

    const precoNum = parseFloat(produto.preco) || 0;
    const precoAntigoNum = produto.preco_antigo ? parseFloat(produto.preco_antigo) : null;
    const imagem = produto.imagem || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800';

    const heroImg = document.getElementById('heroModeloImg');
    const hero3DWrap = document.getElementById('heroModelo3DWrap');
    const heroToggle3D = document.getElementById('heroModeloToggle3D');
    const tituloEl = document.getElementById('heroModeloTitulo');
    const precoEl = document.getElementById('heroModeloPreco');
    const antigoEl = document.getElementById('heroModeloPrecoAntigo');
    const likesEl = document.getElementById('focoLikes');
    const sizesBox = document.getElementById('focoTamanhosRapidos');
    const btnCurtir = document.getElementById('btnCurtirAtivo');
    const btnComprar = document.getElementById('btnAbrirCompraAtivo');

    if (hero3DWrap) {
        hero3DWrap.innerHTML = '';
        hero3DWrap.style.display = 'none';
    }
    if (heroImg) {
        heroImg.loading = 'eager';
        heroImg.decoding = 'async';
        heroImg.fetchPriority = 'high';
        heroImg.src = imagem;
        heroImg.style.display = 'block';
    }
    if (heroToggle3D) {
        heroToggle3D.style.display = produto.modelo_3d_url ? 'flex' : 'none';
    }

    if (tituloEl) {
        const nome = produto.texto || 'Acessório Florenza';
        tituloEl.textContent = nome;
    }
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

function alternarHeroModelo(modo) {
    const produto = produtosVisiveis[indiceAtivo];
    const heroImg = document.getElementById('heroModeloImg');
    const hero3DWrap = document.getElementById('heroModelo3DWrap');
    if (!produto || !heroImg || !hero3DWrap) return;

    if (modo === '3d' && produto.modelo_3d_url) {
        heroImg.style.display = 'none';
        hero3DWrap.style.display = 'block';
        if (!hero3DWrap.querySelector('iframe')) {
            const iframe = document.createElement('iframe');
            iframe.src = produto.modelo_3d_url;
            iframe.allow = 'autoplay; fullscreen; xr-spatial-tracking';
            hero3DWrap.appendChild(iframe);
        }
    } else {
        hero3DWrap.style.display = 'none';
        heroImg.style.display = 'block';
    }
}

function escolherTamanhoRapido(tam) {
    tamanhoRapidoSelecionado = tam;
    atualizarApresentacaoModelo(produtosVisiveis[indiceAtivo]);
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

    // Likes ficam locais até existir um fluxo público protegido contra abuso.
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
    const controles3D = document.getElementById('controlesModelo3D');
    const container3D = document.getElementById('containerGetLayers');

    if (container3D) {
        container3D.innerHTML = '';
        container3D.style.display = 'none';
    }
    if (imgEl) {
        imgEl.src = produto.imagem || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=700';
        imgEl.style.display = 'block';
    }
    if (controles3D) {
        controles3D.style.display = produto.modelo_3d_url ? 'flex' : 'none';
    }

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
            document.querySelectorAll('input[name="tamanhoItem"]').forEach((r) => {
                r.checked = (r.value === tamanhoRapidoSelecionado);
            });
        }
    }

    const stageRail = document.getElementById('stageTrilho');
    const stagePurchase = document.getElementById('stageCompra');
    if (stageRail) stageRail.classList.add('is-leaving');
    window.setTimeout(() => {
        setModalDisplay('stageTrilho', 'none');
        if (stageRail) stageRail.classList.remove('is-leaving');
        setModalDisplay('stageCompra', 'block');
        if (stagePurchase) {
            stagePurchase.classList.remove('is-entering');
            void stagePurchase.offsetWidth;
            stagePurchase.classList.add('is-entering');
        }
    }, 190);
}

function alternarVisualizacaoMedia(modo) {
    const imgEl = document.getElementById('compraImagem');
    const container3D = document.getElementById('containerGetLayers');
    if (!imgEl || !container3D || !produtoSelecionadoCompra) return;

    if (modo === '3d' && produtoSelecionadoCompra.modelo_3d_url) {
        imgEl.style.display = 'none';
        container3D.style.display = 'block';
        if (!container3D.querySelector('iframe')) {
            const iframe = document.createElement('iframe');
            iframe.src = produtoSelecionadoCompra.modelo_3d_url;
            iframe.allow = 'autoplay; fullscreen; xr-spatial-tracking';
            container3D.appendChild(iframe);
        }
    } else {
        container3D.style.display = 'none';
        imgEl.style.display = 'block';
    }
}

function voltarAoTrilho() {
    produtoSelecionadoCompra = null;
    const container3D = document.getElementById('containerGetLayers');
    if (container3D) container3D.innerHTML = '';
    const stagePurchase = document.getElementById('stageCompra');
    if (stagePurchase) stagePurchase.classList.add('is-leaving');
    window.setTimeout(() => {
        setModalDisplay('stageCompra', 'none');
        if (stagePurchase) stagePurchase.classList.remove('is-leaving', 'is-entering');
        setModalDisplay('stageTrilho', 'flex');
        const stageRail = document.getElementById('stageTrilho');
        if (stageRail) {
            stageRail.classList.remove('is-leaving');
            void stageRail.offsetWidth;
            stageRail.style.animation = 'florenzaHeroEnter .65s cubic-bezier(.16,1,.3,1) both';
            window.setTimeout(() => { if (stageRail) stageRail.style.animation = ''; }, 700);
        }
        centralizarItemAtivo();
    }, 180);
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

    // Contadores não são gravados com a chave pública, evitando alterações anônimas no catálogo.

    abrirCarrinho();
}

// --- Sacola Lateral & WhatsApp ---
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

    const emailCliente = getStorageSafe('florenza_cliente_email') || 'Cliente Vitrine';
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

    const whatsappDestino = (getStorageSafe('florenza_whatsapp_loja') || WHATSAPP_LOJA).replace(/\D/g, '');
    window.open(`https://wa.me/${whatsappDestino}?text=${mensagem}`, '_blank', 'noopener');

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
    const modelo3d = (document.getElementById('modelo3dProduto')?.value || '').trim();
    const anelPulseiraAtivo = Boolean(document.getElementById('adminAtivoAnelPulseira')?.checked);

    if (!nome) {
        alert('Informe o nome da peça.');
        return;
    }

    const novoItem = { texto: nome };
    if (preco) novoItem.preco = preco;
    if (precoAntigo) novoItem.preco_antigo = precoAntigo;
    if (imagem) novoItem.imagem = imagem;
    if (modelo3d) novoItem.modelo_3d_url = modelo3d;
    if (anelPulseiraAtivo) novoItem.anel_pulseira_ativo = true;

    const postProduto = async (payload) => {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/tarefas`, {
            method: 'POST',
            headers: {
                ...(await obterHeadersAdmin()),
                'Content-Type': 'application/json',
                Prefer: 'return=minimal'
            },
            body: JSON.stringify([payload])
        });
        if (!res.ok) {
            const errTxt = await res.text();
            throw new Error(errTxt || ('HTTP ' + res.status));
        }
    };

    try {
        await postProduto(novoItem);
    } catch (err) {
        const msg = String(err.message || err);
        // Se os campos extras ainda não existem no banco, publica com os campos
        // essenciais e mantém os recursos opcionais desligados para essa peça.
        if (msg.includes('anel_pulseira_ativo') || msg.includes('modelo_3d_url') || msg.includes('42703')) {
            delete novoItem.anel_pulseira_ativo;
            delete novoItem.modelo_3d_url;
            try {
                await postProduto(novoItem);
                alert('Peça publicada. Os campos opcionais de tamanho e modelo 3D não foram enviados porque ainda não existem no banco.');
            } catch (err2) {
                alert('Erro ao publicar: ' + err2.message);
                return;
            }
        } else {
            alert('Erro ao publicar: ' + err.message);
            return;
        }
    }

    document.getElementById('nomeProduto').value = '';
    document.getElementById('precoProduto').value = '';
    document.getElementById('precoAntigoProduto').value = '';
    document.getElementById('imagemProduto').value = '';
    document.getElementById('modelo3dProduto').value = '';
    document.getElementById('adminAtivoAnelPulseira').checked = false;
    cancelarEdicaoProduto();
    fecharModalAdmin();
    carregarProdutos();
}


// --- Ferramentas administrativas adicionais (usam somente colunas já conhecidas) ---
function escaparHTMLAdmin(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function renderizarListaAdmin() {
    const listaEl = document.getElementById('adminListaProdutos');
    const countEl = document.getElementById('adminCatalogCount');
    if (!listaEl) return;
    const termo = (document.getElementById('adminBuscaProduto')?.value || '').trim().toLocaleLowerCase('pt-BR');
    const filtrados = listaProdutosGlobal.filter(p => String(p.texto || '').toLocaleLowerCase('pt-BR').includes(termo));
    if (countEl) countEl.textContent = `${filtrados.length} de ${listaProdutosGlobal.length} itens`;
    if (!filtrados.length) {
        listaEl.innerHTML = '<p class="admin-empty">Nenhum produto encontrado.</p>';
        return;
    }
    listaEl.innerHTML = filtrados.map(p => `
        <article class="admin-product-row">
            <img src="${escaparHTMLAdmin(p.imagem || '')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
            <div class="admin-product-copy">
                <strong>${escaparHTMLAdmin(p.texto || 'Produto sem nome')}</strong>
                <span>${escaparHTMLAdmin(formatarBRL(p.preco))}${p.preco_antigo ? ` · De ${escaparHTMLAdmin(formatarBRL(p.preco_antigo))}` : ''}</span>
                <small>ID: ${escaparHTMLAdmin(p.id ?? 'sem ID')}</small>
            </div>
            <div class="admin-product-actions">
                <button type="button" class="btn btn-secondary btn-sm" onclick="editarProdutoAdmin('${escaparHTMLAdmin(p.id)}')">Editar</button>
                <button type="button" class="btn btn-danger-soft btn-sm" onclick="excluirProdutoAdmin('${escaparHTMLAdmin(p.id)}')">Excluir</button>
            </div>
        </article>
    `).join('');
}

function editarProdutoAdmin(id) {
    const produto = listaProdutosGlobal.find(p => String(p.id) === String(id));
    if (!produto) return;
    document.getElementById('adminProdutoEditando').value = String(produto.id);
    document.getElementById('nomeProduto').value = produto.texto || '';
    document.getElementById('precoProduto').value = produto.preco ?? '';
    document.getElementById('precoAntigoProduto').value = produto.preco_antigo ?? '';
    document.getElementById('imagemProduto').value = produto.imagem || '';
    document.getElementById('modelo3dProduto').value = produto.modelo_3d_url || '';
    document.getElementById('adminAtivoAnelPulseira').checked = produto.anel_pulseira_ativo === true;
    document.getElementById('btnSalvarProdutoAdmin').textContent = 'Salvar alterações';
    document.getElementById('btnCancelarEdicaoAdmin').style.display = 'block';
    document.getElementById('nomeProduto').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelarEdicaoProduto() {
    ['nomeProduto','precoProduto','precoAntigoProduto','imagemProduto','modelo3dProduto'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    const tamanho = document.getElementById('adminAtivoAnelPulseira');
    if (tamanho) tamanho.checked = false;
    const editando = document.getElementById('adminProdutoEditando');
    if (editando) editando.value = '';
    const salvar = document.getElementById('btnSalvarProdutoAdmin');
    if (salvar) salvar.textContent = 'Publicar no Trilho';
    const cancelar = document.getElementById('btnCancelarEdicaoAdmin');
    if (cancelar) cancelar.style.display = 'none';
}

async function salvarProdutoAdmin() {
    const id = document.getElementById('adminProdutoEditando')?.value;
    if (!id) return adicionarProduto();
    const nome = document.getElementById('nomeProduto')?.value.trim();
    const preco = (document.getElementById('precoProduto')?.value || '').trim().replace(',', '.');
    const precoAntigo = (document.getElementById('precoAntigoProduto')?.value || '').trim().replace(',', '.');
    const imagem = (document.getElementById('imagemProduto')?.value || '').trim();
    if (!nome) return alert('Informe o nome da peça.');
    const modelo3d = (document.getElementById('modelo3dProduto')?.value || '').trim();
    const anelPulseiraAtivo = Boolean(document.getElementById('adminAtivoAnelPulseira')?.checked);
    const payload = { texto: nome, preco: preco || null, preco_antigo: precoAntigo || null, imagem: imagem || null, modelo_3d_url: modelo3d || null, anel_pulseira_ativo: anelPulseiraAtivo };
    const endpoint = `${SUPABASE_URL}/rest/v1/tarefas?id=eq.${encodeURIComponent(id)}`;
    const enviar = async (body) => {
        const res = await fetch(endpoint, {
            method: 'PATCH',
            headers: await obterHeadersAdmin({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
    };
    try {
        await enviar(payload);
        cancelarEdicaoProduto();
        await carregarProdutos(false);
        alert('Produto atualizado com sucesso.');
    } catch (err) {
        alert('Não foi possível atualizar o produto: ' + err.message);
    }
}

async function excluirProdutoAdmin(id) {
    const produto = listaProdutosGlobal.find(p => String(p.id) === String(id));
    if (!produto || !confirm(`Excluir "${produto.texto || 'este produto'}" do catálogo? Esta ação não pode ser desfeita.`)) return;
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/tarefas?id=eq.${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: await obterHeadersAdmin({ Prefer: 'return=minimal' })
        });
        if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
        cancelarEdicaoProduto();
        await carregarProdutos(false);
        alert('Produto removido do catálogo.');
    } catch (err) {
        alert('Não foi possível excluir o produto: ' + err.message);
    }
}

function exportarCatalogo(formato) {
    if (!listaProdutosGlobal.length) return alert('Não há produtos carregados para exportar.');
    let conteudo, tipo, nome;
    if (formato === 'csv') {
        const colunas = ['id','texto','preco','preco_antigo','imagem','modelo_3d_url','anel_pulseira_ativo','likes'];
        const linhas = [colunas.join(';'), ...listaProdutosGlobal.map(p => colunas.map(c =>
            `"${String(p[c] ?? '').replace(/"/g, '""')}"`).join(';'))];
        conteudo = '\ufeff' + linhas.join('\r\n'); tipo = 'text/csv;charset=utf-8'; nome = 'florenza-catalogo.csv';
    } else {
        conteudo = JSON.stringify({ exportado_em: new Date().toISOString(), produtos: listaProdutosGlobal }, null, 2);
        tipo = 'application/json'; nome = 'florenza-backup-catalogo.json';
    }
    const blob = new Blob([conteudo], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = nome; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function salvarConfigWhatsApp() {
    const campo = document.getElementById('adminWhatsappLoja');
    const numero = (campo?.value || '').replace(/\D/g, '');
    if (numero.length < 10 || numero.length > 15) return alert('Informe um número válido com DDI + DDD + número.');
    setStorageSafe('florenza_whatsapp_loja', numero);
    alert('WhatsApp salvo neste navegador.');
}

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.style.display = 'none';
        if (e.target.id === 'modalCliente') {
            setStorageSafe('florenza_cliente_email', 'visitante@florenza.com');
        }
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        fecharBuscaTopo();
    }
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Fundo reativo: acompanha o cursor com suavidade, sem interferir no trilho ou no toque.
(function iniciarFundoReativoFlorenza() {
    const reduzir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduzir) return;
    let x = 50, y = 45, tx = 50, ty = 45, raf = 0;
    window.addEventListener('pointermove', (event) => {
        tx = (event.clientX / Math.max(1, window.innerWidth)) * 100;
        ty = (event.clientY / Math.max(1, window.innerHeight)) * 100;
        if (!raf) raf = requestAnimationFrame(animar);
    }, { passive: true });
    function animar() {
        x += (tx - x) * .075;
        y += (ty - y) * .075;
        document.body.style.setProperty('--pointer-x', `${x.toFixed(2)}%`);
        document.body.style.setProperty('--pointer-y', `${y.toFixed(2)}%`);
        if (Math.abs(tx - x) > .08 || Math.abs(ty - y) > .08) raf = requestAnimationFrame(animar);
        else raf = 0;
    }
})();
