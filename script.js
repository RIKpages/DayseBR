const SUPABASE_URL = 'https://finmivasfcnnjntfaeei.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbm1pdmFzZmNubmpudGZhZWVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNzY2MTIsImV4cCI6MjEwNzY1MjYxMn0.0IURfOPO9ExLv4D2VM03ENyPIBzG2iy9xEyE1gtlFd0';
const WHATSAPP_LOJA = '5511999999999'; // Substitua pelo número real da loja
const CACHE_PRODUTOS_KEY = 'florenza_3d_catalog_v1';

// Modelos e texturas 3D
const DEFAULT_HERO_GLB = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/IridescentDishWithOlives/glTF-Binary/IridescentDishWithOlives.glb';
const ORBIT_MODEL_A = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/MaterialsVariantsShoe/glTF-Binary/MaterialsVariantsShoe.glb';
const ORBIT_MODEL_B = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/BoomBox/glTF-Binary/BoomBox.glb';
const ROSE_TEX_URL = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/IridescentDishWithOlives/glTF/IridescentDishWithOlives_baseColor.png';
const GOLD_TEX_URL = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/WaterBottle/glTF/WaterBottle_baseColor.png';
const BUBBLE_SRC = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="rgba(251,207,232,0.14)" stroke="rgba(212,175,55,0.55)" stroke-width="2"/><ellipse cx="22" cy="20" rx="7" ry="4" transform="rotate(-25 22 20)" fill="rgba(255,255,255,0.65)"/></svg>';

let _supabase = null;
try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: { persistSession: false }
        });
    }
} catch (e) {}

const modelViewer = document.querySelector('#product-model');
const berriesFG = document.querySelector('.berries-container');
const berriesBG = document.querySelector('.berries-container-bg');
const leavesBG = document.querySelector('.leaves-container');
const allBerries = document.querySelectorAll('.berry');

let listaProdutosGlobal = [];
let produtosVisiveis = [];
let indiceAtivo = 0;
let carrinho = [];
let isSwitching = false;
let switchSpin = 0;
let roseTexture = null;
let goldTexture = null;
let totalVendasConcluidas = 0;
let receitaTotalAcumulada = 0;
let preloaderEncerrado = false;

function formatarBRL(valor) {
    return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function atualizarProgressoLoading(percentual, texto) {
    const fill = document.getElementById('preloaderBarFill');
    const status = document.getElementById('preloaderStatus');
    if (fill) fill.style.width = `${percentual}%`;
    if (status && texto) status.textContent = texto;
}

function finalizarLoadingScreen() {
    if (preloaderEncerrado) return;
    preloaderEncerrado = true;
    atualizarProgressoLoading(100, 'Vitrine pronta!');
    setTimeout(() => {
        const preloader = document.getElementById('preloaderFlorenza');
        if (preloader) preloader.classList.add('is-hidden');
    }, 280);
}

// Pré-carrega texturas e aquece shaders quando o modelo 3D central termina de carregar
if (modelViewer) {
    modelViewer.addEventListener('load', async () => {
        atualizarProgressoLoading(85, 'Preparando brilho 3D...');
        try {
            roseTexture = await modelViewer.createTexture(ROSE_TEX_URL);
            goldTexture = await modelViewer.createTexture(GOLD_TEX_URL);
            if (modelViewer.model && modelViewer.model.materials[0]?.pbrMetallicRoughness?.baseColorTexture) {
                const mat = modelViewer.model.materials[0];
                mat.pbrMetallicRoughness.baseColorTexture.setTexture(goldTexture);
                await new Promise((r) => requestAnimationFrame(r));
                mat.pbrMetallicRoughness.baseColorTexture.setTexture(roseTexture);
            }
        } catch (e) {}
        finalizarLoadingScreen();
    });
}

async function buscarProdutosSupabase(timeoutMs = 3500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const colunas = 'id,texto,preco,preco_antigo,imagem,likes,carrinho_count,anel_pulseira_ativo,modelo_3d_url';

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/tarefas?select=${colunas}&order=id.desc`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
            signal: controller.signal
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
    } catch (err) {
        clearTimeout(timer);
        throw err;
    }
}

async function init() {
    // Limite máximo de 3.2s para a tela de loading nunca travar em conexões lentas
    const safetyTimer = setTimeout(finalizarLoadingScreen, 3200);

    atualizarProgressoLoading(30, 'Carregando catálogo Florenza...');

    const cacheRaw = sessionStorage.getItem(CACHE_PRODUTOS_KEY);
    if (cacheRaw) {
        try {
            const cached = JSON.parse(cacheRaw);
            if (Array.isArray(cached) && cached.length) {
                listaProdutosGlobal = cached;
                produtosVisiveis = [...cached];
                renderCarrosselCards();
                atualizarHeroComProduto(produtosVisiveis[0]);
                atualizarProgressoLoading(65, 'Carregando modelo 3D...');
            }
        } catch (e) {}
    }

    try {
        const dados = await buscarProdutosSupabase(3500);
        if (Array.isArray(dados) && dados.length) {
            listaProdutosGlobal = dados;
            produtosVisiveis = [...dados];
            sessionStorage.setItem(CACHE_PRODUTOS_KEY, JSON.stringify(dados));
            renderCarrosselCards();
            atualizarHeroComProduto(produtosVisiveis[0]);
            const totalAdmin = document.getElementById('totalProdutosAdmin');
            if (totalAdmin) totalAdmin.textContent = dados.length;
        } else if (!listaProdutosGlobal.length) {
            usarCatalogoDemonstracao();
        }
    } catch (e) {
        if (!listaProdutosGlobal.length) usarCatalogoDemonstracao();
    }

    atualizarProgressoLoading(75, 'Sincronizando vitrine...');
    verificarSessao();

    // Se o model-viewer já estiver carregado, encerra loading imediatamente
    if (modelViewer && modelViewer.loaded) {
        clearTimeout(safetyTimer);
        finalizarLoadingScreen();
    }
}

function usarCatalogoDemonstracao() {
    listaProdutosGlobal = [
        {
            id: 1,
            texto: 'Colar Aurora Rosé',
            preco: '49.90',
            preco_antigo: '69.90',
            imagem: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400',
            likes: 24,
            anel_pulseira_ativo: false
        },
        {
            id: 2,
            texto: 'Anel Imperial Gold',
            preco: '39.90',
            imagem: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400',
            likes: 18,
            anel_pulseira_ativo: true
        }
    ];
    produtosVisiveis = [...listaProdutosGlobal];
    renderCarrosselCards();
    atualizarHeroComProduto(produtosVisiveis[0]);
}

function atualizarHeroComProduto(produto) {
    if (!produto) return;
    const nome = produto.texto || 'Pure Brilho';
    const partes = nome.split(' ');
    const l1 = document.getElementById('heroLinha1');
    const l2 = document.getElementById('heroLinha2');
    const precoEl = document.getElementById('heroPrecoAtivo');
    const antigoEl = document.getElementById('heroPrecoAntigoAtivo');
    const likesEl = document.getElementById('focoLikes');
    const btnCurtir = document.getElementById('btnCurtirAtivo');

    if (l1) l1.textContent = partes[0] || 'Florenza';
    if (l2) l2.textContent = partes.slice(1).join(' ') || 'Exclusiva';
    if (precoEl) precoEl.textContent = formatarBRL(produto.preco);
    if (antigoEl) {
        if (produto.preco_antigo) {
            antigoEl.textContent = formatarBRL(produto.preco_antigo);
            antigoEl.style.display = 'inline';
        } else {
            antigoEl.style.display = 'none';
        }
    }
    if (likesEl) likesEl.textContent = produto.likes || 0;
    if (btnCurtir) btnCurtir.onclick = () => darLike(produto.id);
}

function renderCarrosselCards() {
    const container = document.getElementById('carouselCards');
    if (!container) return;
    container.innerHTML = '';

    const visiveisSlice = [];
    if (produtosVisiveis.length > 0) {
        visiveisSlice.push({ produto: produtosVisiveis[indiceAtivo], realIndex: indiceAtivo });
        if (produtosVisiveis.length > 1) {
            const proxIdx = (indiceAtivo + 1) % produtosVisiveis.length;
            visiveisSlice.push({ produto: produtosVisiveis[proxIdx], realIndex: proxIdx });
        }
    }

    visiveisSlice.forEach(({ produto, realIndex }, pos) => {
        const card = document.createElement('div');
        card.className = `card ${pos === 0 ? 'active' : ''}`;
        const imgUrl = produto.imagem || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400';
        card.innerHTML = `
            <img src="${imgUrl}" alt="${produto.texto || 'Peça Florenza'}">
            <div class="card-info">
                <span>${produto.texto || 'Peça Florenza'}</span>
                <span>${formatarBRL(produto.preco)}</span>
            </div>
        `;
        card.addEventListener('click', () => {
            if (isSwitching) return;
            if (realIndex === indiceAtivo) {
                abrirModalPersonalizacao();
            } else {
                trocarPecaComCoreografia(realIndex);
            }
        });
        container.appendChild(card);
    });
}

// Transição coreografada inspirada no switchFlavor (fundo + giro 720° com blur + implosão/explosão)
function trocarPecaComCoreografia(novoIndice) {
    if (isSwitching || !produtosVisiveis.length) return;
    isSwitching = true;

    indiceAtivo = (novoIndice + produtosVisiveis.length) % produtosVisiveis.length;
    const produto = produtosVisiveis[indiceAtivo];
    const usarTemaGold = indiceAtivo % 2 === 1;

    renderCarrosselCards();
    atualizarHeroComProduto(produto);

    const body = document.body;
    const heroCenter = document.querySelector('.hero-center');
    const targetColors = usarTemaGold
        ? { inner: '#5a4321', mid: '#261b0d', outer: '#090704' }
        : { inner: '#5c2738', mid: '#281018', outer: '#090507' };

    if (window.gsap) {
        gsap.to(body, {
            '--bg-inner': targetColors.inner,
            '--bg-mid': targetColors.mid,
            '--bg-outer': targetColors.outer,
            duration: 1.4,
            ease: 'power2.inOut'
        });

        const spinObj = { val: 0, blur: 0 };
        gsap.to(spinObj, {
            val: 360,
            blur: 14,
            duration: 0.55,
            ease: 'power2.in',
            onUpdate: () => {
                switchSpin = spinObj.val;
                if (modelViewer) modelViewer.style.filter = `blur(${spinObj.blur}px)`;
            },
            onComplete: () => {
                body.classList.toggle('gold-theme', usarTemaGold);

                if (produto.modelo_3d_url && modelViewer && modelViewer.src !== produto.modelo_3d_url) {
                    modelViewer.src = produto.modelo_3d_url;
                } else if (modelViewer && modelViewer.model) {
                    const tex = usarTemaGold ? goldTexture : roseTexture;
                    if (tex) {
                        modelViewer.model.materials.forEach((mat) => {
                            if (mat.pbrMetallicRoughness?.baseColorTexture) {
                                mat.pbrMetallicRoughness.baseColorTexture.setTexture(tex);
                            }
                        });
                    }
                }

                gsap.to(spinObj, {
                    val: 720,
                    blur: 0,
                    duration: 1.35,
                    ease: 'back.out(0.7)',
                    onUpdate: () => {
                        switchSpin = spinObj.val;
                        if (modelViewer) modelViewer.style.filter = `blur(${spinObj.blur}px)`;
                    },
                    onComplete: () => {
                        switchSpin = 0;
                        if (modelViewer) modelViewer.style.filter = 'none';
                    }
                });
            }
        });

        let concluido = 0;
        allBerries.forEach((berry) => {
            const centerX = (window.innerWidth / 2 - berry.offsetLeft - berry.offsetWidth / 2);
            const centerY = (window.innerHeight / 2 - berry.offsetTop - berry.offsetHeight / 2);
            const startAngle = parseFloat(berry.dataset.angle) || 0;
            const nextBaseX = (Math.random() - 0.5) * 180;
            const nextBaseY = (Math.random() - 0.5) * 180;

            gsap.timeline()
                .to(berry, {
                    x: centerX,
                    y: centerY,
                    rotation: startAngle + 45,
                    scale: 0.1,
                    opacity: 0,
                    duration: 0.45,
                    ease: 'power2.in',
                    onComplete: () => {
                        berry.src = usarTemaGold ? ORBIT_MODEL_B : ORBIT_MODEL_A;
                        if (heroCenter) heroCenter.style.zIndex = 50;
                    }
                })
                .to(berry, { duration: 0.25 })
                .to(berry, {
                    onStart: () => { if (heroCenter) heroCenter.style.zIndex = 1; },
                    x: nextBaseX,
                    y: nextBaseY,
                    rotation: startAngle + 90,
                    scale: 1,
                    opacity: 1,
                    duration: 0.85,
                    ease: 'back.out(1.5)',
                    onComplete: () => {
                        berry.dataset.angle = startAngle + 90;
                        berry.dataset.baseX = nextBaseX;
                        berry.dataset.baseY = nextBaseY;
                        berry.dataset.rx = 0;
                        berry.dataset.ry = 0;
                        concluido++;
                        if (concluido === allBerries.length) isSwitching = false;
                    }
                });
        });
    } else {
        isSwitching = false;
    }
}

// Setas do carrossel
document.getElementById('btnPrevCard')?.addEventListener('click', () => {
    trocarPecaComCoreografia(indiceAtivo - 1);
});
document.getElementById('btnNextCard')?.addEventListener('click', () => {
    trocarPecaComCoreografia(indiceAtivo + 1);
});

// Parallax e Repulsão pelo Cursor
allBerries.forEach((b) => {
    b.dataset.rx = 0;
    b.dataset.ry = 0;
    b.dataset.angle = Math.random() * 360;
    b.dataset.baseX = 0;
    b.dataset.baseY = 0;
});

const mouse = { x: 0, y: 0, px: 0, py: 0 };
const currentMouse = { x: 0, y: 0 };

window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) - 0.5;
    mouse.y = (e.clientY / window.innerHeight) - 0.5;
    mouse.px = e.clientX;
    mouse.py = e.clientY;
});

function animate() {
    const time = Date.now() * 0.001;
    currentMouse.x += (mouse.x - currentMouse.x) * 0.05;
    currentMouse.y += (mouse.y - currentMouse.y) * 0.05;

    if (modelViewer) {
        modelViewer.cameraOrbit = `${(currentMouse.x * 40) + switchSpin}deg ${75 + (currentMouse.y * 20)}deg 240%`;
    }

    if (berriesFG) berriesFG.style.transform = `translate(${currentMouse.x * 60}px, ${currentMouse.y * 60}px)`;
    if (berriesBG) berriesBG.style.transform = `translate(${currentMouse.x * -30}px, ${currentMouse.y * -30}px)`;
    if (leavesBG) leavesBG.style.transform = `translate(${currentMouse.x * -15}px, ${currentMouse.y * -15}px)`;

    if (!isSwitching) {
        allBerries.forEach((berry, i) => {
            const rect = berry.getBoundingClientRect();
            const bx = rect.left + rect.width / 2;
            const by = rect.top + rect.height / 2;
            const dx = mouse.px - bx;
            const dy = mouse.py - by;
            const dist = Math.sqrt(dx * dx + dy * dy);

            let targetRx = 0, targetRy = 0, speedMult = 1;
            if (dist < 400 && dist > 0) {
                const force = (400 - dist) / 400;
                targetRx = (dx / dist) * force * -80;
                targetRy = (dy / dist) * force * -80;
                speedMult = 1 + force * 5;
            }

            let rx = parseFloat(berry.dataset.rx) || 0;
            let ry = parseFloat(berry.dataset.ry) || 0;
            let angle = parseFloat(berry.dataset.angle) || 0;
            const baseX = parseFloat(berry.dataset.baseX) || 0;
            const baseY = parseFloat(berry.dataset.baseY) || 0;

            rx += (targetRx - rx) * 0.1;
            ry += (targetRy - ry) * 0.1;
            angle += 0.2 * speedMult;

            berry.dataset.rx = rx;
            berry.dataset.ry = ry;
            berry.dataset.angle = angle;

            const dur = [5, 7, 6, 8, 5.5, 6.5, 9, 11, 10][i % 9];
            const phase = (time + i * 0.7) * (Math.PI * 2 / dur);
            const floatY = Math.sin(phase) * 15;
            const floatAngle = Math.cos(phase) * 6;

            berry.style.transform = `translate(calc(${rx + baseX}px), calc(${ry + baseY}px + ${floatY}px)) rotate(calc(${angle}deg + ${floatAngle}deg))`;
        });
    }

    document.querySelectorAll('.leaf').forEach((leaf, i) => {
        const dur = 10 + i * 2;
        const phase = (time + i * 1.2) * (Math.PI * 2 / dur);
        const floatY = Math.sin(phase) * 20;
        const floatX = Math.cos(phase * 0.5) * 15;
        const floatAngle = Math.sin(phase * 0.3) * 15;
        leaf.style.transform = `translate(${floatX}px, ${floatY}px) rotate(${floatAngle}deg)`;
    });

    requestAnimationFrame(animate);
}
animate();

// Partículas / Bolhas contínuas
const bubblesContainer = document.getElementById('bubbles-container');
function createBubble() {
    if (!bubblesContainer) return;
    const bubble = document.createElement('img');
    bubble.src = BUBBLE_SRC;
    bubble.className = 'bubble-img';
    const size = Math.random() * 40 + 14;
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.left = `${Math.random() * 100}%`;
    bubble.style.bottom = `-${size + 20}px`;
    const duration = Math.random() * 6 + 6;
    bubble.style.animation = `floatUpImg ${duration}s linear forwards`;
    bubblesContainer.appendChild(bubble);
    setTimeout(() => bubble.remove(), duration * 1000);
}
setInterval(createBubble, 500);
for (let i = 0; i < 10; i++) setTimeout(createBubble, i * 160);

// --- Busca, Personalização, Sacola, Admin & Supabase ---
function abrirBuscaTopo() {
    document.getElementById('navGlass').style.display = 'none';
    const wrap = document.getElementById('searchInputWrap');
    wrap.style.display = 'flex';
    document.getElementById('inputBusca').focus();
}

function fecharBuscaTopo() {
    document.getElementById('searchInputWrap').style.display = 'none';
    document.getElementById('navGlass').style.display = 'flex';
    const input = document.getElementById('inputBusca');
    if (input && input.value) {
        input.value = '';
        filtrarProdutos();
    }
}

function filtrarProdutos() {
    const termo = (document.getElementById('inputBusca')?.value || '').toLowerCase().trim();
    produtosVisiveis = termo
        ? listaProdutosGlobal.filter((p) => p.texto && p.texto.toLowerCase().includes(termo))
        : [...listaProdutosGlobal];
    indiceAtivo = 0;
    renderCarrosselCards();
    if (produtosVisiveis[0]) atualizarHeroComProduto(produtosVisiveis[0]);
}

function abrirModalPersonalizacao() {
    const p = produtosVisiveis[indiceAtivo];
    if (!p) return;
    document.getElementById('modalPieceTitle').textContent = p.texto || 'Peça Florenza';
    document.getElementById('modalPiecePrice').textContent = formatarBRL(p.preco);
    document.getElementById('blocoTamanhoAnelPulseira').style.display = p.anel_pulseira_ativo === true ? 'block' : 'none';
    document.getElementById('modalPersonalizar').style.display = 'flex';
}

function fecharModalPersonalizar() { document.getElementById('modalPersonalizar').style.display = 'none'; }
function abrirCarrinho() { document.getElementById('modalCarrinho').style.display = 'flex'; renderizarCarrinho(); }
function fecharCarrinho() { document.getElementById('modalCarrinho').style.display = 'none'; }
function abrirModalAdmin() { document.getElementById('modalAdmin').style.display = 'flex'; }
function fecharModalAdmin() { document.getElementById('modalAdmin').style.display = 'none'; }
function fecharModalCliente() { document.getElementById('modalCliente').style.display = 'none'; }

function fecharModaisAtivos() {
    ['modalPersonalizar', 'modalCarrinho', 'modalAdmin', 'modalCliente'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

function adicionarProdutoAtualAoCarrinho() {
    const p = produtosVisiveis[indiceAtivo];
    if (!p) return;

    const emb = document.querySelector('input[name="tipoEmbalagem"]:checked')?.value || 'Caixinha Personalizada';
    const cor = document.querySelector('input[name="corEmbalagem"]:checked')?.value || 'Rosa';
    const tam = p.anel_pulseira_ativo === true
        ? (document.querySelector('input[name="tamanhoItem"]:checked')?.value || 'P (14/15)')
        : null;

    const detalhes = `${emb} · Cor: ${cor}${tam ? ` · Tam: ${tam}` : ''}`;
    const key = `${p.id}-${emb}-${cor}-${tam || 'unico'}`;
    const existente = carrinho.find((item) => item.key === key);

    if (existente) {
        existente.quantidade += 1;
    } else {
        carrinho.push({ key, id: p.id, nome: p.texto || 'Peça Florenza', detalhes, preco: parseFloat(p.preco) || 0, quantidade: 1 });
    }

    document.getElementById('contadorCarrinho').textContent = carrinho.reduce((s, i) => s + i.quantidade, 0);
    fecharModalPersonalizar();
    abrirCarrinho();
}

function renderizarCarrinho() {
    const lista = document.getElementById('listaItensCarrinho');
    const totalEl = document.getElementById('carrinhoTotalPreco');
    lista.innerHTML = '';

    if (!carrinho.length) {
        lista.innerHTML = '<p style="color: var(--muted-color); text-align: center; margin-top: 30px;">Sua sacola está vazia.</p>';
        totalEl.textContent = 'R$ 0,00';
        return;
    }

    let total = 0;
    carrinho.forEach((item, idx) => {
        const sub = item.preco * item.quantidade;
        total += sub;
        const row = document.createElement('div');
        row.className = 'cart-item-row';
        row.innerHTML = `
            <div>
                <strong>${item.nome}</strong> x${item.quantidade}
                <small style="display:block; color: var(--muted-color);">${item.detalhes}</small>
            </div>
            <div>
                <strong>${formatarBRL(sub)}</strong>
                <button type="button" class="cart-remove-btn" onclick="removerItemCarrinho(${idx})">✕</button>
            </div>
        `;
        lista.appendChild(row);
    });
    totalEl.textContent = formatarBRL(total);
}

function removerItemCarrinho(idx) {
    carrinho.splice(idx, 1);
    document.getElementById('contadorCarrinho').textContent = carrinho.reduce((s, i) => s + i.quantidade, 0);
    renderizarCarrinho();
}

function finalizarCompra() {
    if (!carrinho.length) return alert('Sua sacola está vazia!');
    let msg = 'Olá, *Florenza Bijouterias*! ✨%0AGostaria de finalizar meu pedido:%0A%0A';
    let total = 0;
    carrinho.forEach((item) => {
        const sub = item.preco * item.quantidade;
        total += sub;
        msg += `• *${item.nome}* x${item.quantidade}%0A  _${item.detalhes}_ — ${formatarBRL(sub)}%0A`;
    });
    msg += `%0A*Total: ${formatarBRL(total)}*`;

    totalVendasConcluidas += 1;
    receitaTotalAcumulada += total;
    document.getElementById('adminTotalVendas').textContent = totalVendasConcluidas;
    document.getElementById('adminReceitaTotal').textContent = formatarBRL(receitaTotalAcumulada);

    window.open(`https://wa.me/${WHATSAPP_LOJA}?text=${msg}`, '_blank');
    carrinho = [];
    document.getElementById('contadorCarrinho').textContent = '0';
    fecharCarrinho();
}

async function darLike(id) {
    const p = listaProdutosGlobal.find((item) => item.id === id);
    if (!p) return;
    p.likes = (p.likes || 0) + 1;
    document.getElementById('focoLikes').textContent = p.likes;
    fetch(`${SUPABASE_URL}/rest/v1/tarefas?id=eq.${id}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ likes: p.likes })
    }).catch(() => {});
}

async function verificarSessao() {
    if (!_supabase) return;
    const { data } = await _supabase.auth.getSession();
    const session = data?.session;
    document.getElementById('formLoginView').style.display = session ? 'none' : 'block';
    document.getElementById('formCadastroView').style.display = session ? 'block' : 'none';
}

async function fazerLogin() {
    if (!_supabase) return;
    const email = document.getElementById('emailLogin').value.trim();
    const password = document.getElementById('senhaLogin').value;
    const { error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) return alert('Erro ao entrar: ' + error.message);
    verificarSessao();
}

async function fazerLogout() {
    if (_supabase) await _supabase.auth.signOut();
    verificarSessao();
    fecharModalAdmin();
}

async function adicionarProduto() {
    const nome = document.getElementById('nomeProduto').value.trim();
    const preco = document.getElementById('precoProduto').value.trim().replace(',', '.');
    const precoAntigo = document.getElementById('precoAntigoProduto').value.trim().replace(',', '.');
    const imagem = document.getElementById('imagemProduto').value.trim();
    const modelo3d = document.getElementById('modelo3dProduto').value.trim();
    const anelPulseiraAtivo = document.getElementById('adminAtivoAnelPulseira').checked;

    if (!nome) return alert('Informe o nome da peça.');

    const payload = { texto: nome };
    if (preco) payload.preco = preco;
    if (precoAntigo) payload.preco_antigo = precoAntigo;
    if (imagem) payload.imagem = imagem;
    if (modelo3d) payload.modelo_3d_url = modelo3d;
    if (anelPulseiraAtivo) payload.anel_pulseira_ativo = true;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/tarefas`, {
        method: 'POST',
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
        },
        body: JSON.stringify([payload])
    });

    if (!res.ok) return alert('Erro ao publicar peça no Supabase.');

    fecharModalAdmin();
    sessionStorage.removeItem(CACHE_PRODUTOS_KEY);
    init();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
