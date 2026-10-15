const SUPABASE_URL = 'https://finmivasfcnnJntfaeei.supabase.co';
const SUPABASE_KEY = 'sb_publishable_1GrP5ip9yUycdbQ_JnvDdQ_b6_vXJFK';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let listaProdutosGlobal = [];

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
            <button onclick="abrirModalAdmin()" class="btn btn-primary">
                ⚙️ Admin
            </button>
        `;
        formLoginView.style.display = 'none';
        formCadastroView.style.display = 'block';
    } else {
        statusDiv.innerHTML = `
            <button onclick="abrirModalAdmin()" class="btn btn-outline">
                Entrar como Admin
            </button>
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

async function fazerLogin() {
    const emailInput = document.getElementById('emailLogin');
    const senhaInput = document.getElementById('senhaLogin');
    
    if (!emailInput || !senhaInput) return;

    const email = emailInput.value.trim();
    const password = senhaInput.value;

    if (!email || !password) {
        alert('Por favor, preencha o email e a palavra-passe.');
        return;
    }

    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });

    if (error) {
        alert('Erro ao entrar: ' + error.message);
    } else {
        renderHeader(data.session);
        fecharModalAdmin();
        alert('Sessão iniciada com sucesso!');
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

    grid.innerHTML = '<p style="color: var(--text-muted);">A carregar os produtos...</p>';

    const { data, error } = await _supabase
        .from('tarefas')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.error('Erro ao buscar dados:', error);
        grid.innerHTML = '<p style="color: var(--danger);">Não foi possível carregar os produtos.</p>';
        return;
    }

    listaProdutosGlobal = data || [];
    const totalBadge = document.getElementById('totalProdutos');
    if (totalBadge) totalBadge.textContent = `${listaProdutosGlobal.length} Produtos`;
    
    renderGrid(listaProdutosGlobal);
}

function renderGrid(produtos) {
    const grid = document.getElementById('gridProdutos');
    if (!grid) return;

    grid.innerHTML = '';

    if (produtos.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1;">Nenhum produto encontrado.</p>';
        return;
    }

    produtos.forEach(p => {
        const nome = p.texto || 'Produto sem nome';
        const preco = p.preco ? `${p.preco} €` : 'Preço sob consulta';
        const imagem = p.imagem || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500';

        const card = document.createElement('div');
        card.className = 'card-produto';
        card.innerHTML = `
            <div class="img-container">
                <img src="${imagem}" alt="${nome}" onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500'">
            </div>
            <div class="card-body">
                <div>
                    <h3 class="card-title">${nome}</h3>
                    <div class="card-price">${preco}</div>
                </div>
                <button class="btn btn-primary btn-block" onclick="alert('Item adicionado ao seu carrinho!')">
                    🛒 Comprar
                </button>
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

async function adicionarProduto() {
    const nomeInput = document.getElementById('nomeProduto');
    const precoInput = document.getElementById('precoProduto');
    const imagemInput = document.getElementById('imagemProduto');

    if (!nomeInput) return;

    const nome = nomeInput.value.trim();
    const preco = precoInput ? precoInput.value.trim() : '';
    const imagem = imagemInput ? imagemInput.value.trim() : '';

    if (!nome) {
        alert('Por favor, informe o nome do produto.');
        return;
    }

    const novoItem = { texto: nome };
    if (preco) novoItem.preco = preco;
    if (imagem) novoItem.imagem = imagem;

    const { error } = await _supabase.from('tarefas').insert([novoItem]);

    if (error) {
        alert('Erro ao guardar: ' + error.message);
    } else {
        nomeInput.value = '';
        if (precoInput) precoInput.value = '';
        if (imagemInput) imagemInput.value = '';
        fecharModalAdmin();
        carregarProdutos();
    }
}

// Inicia ao carregar a página
init();
