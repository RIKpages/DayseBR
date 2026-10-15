const SUPABASE_URL = 'https://finmivasfcnnJntfaeei.supabase.co';
// Cole aqui a sua chave de API anon/public
const SUPABASE_KEY = 'sb_publishable_1GrP5ip9yUycdbQ_JnvDdQ_b6_vxJFK';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let listaProdutosGlobal = [];

// Inicialização da Aplicação
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
    if (session) {
        statusDiv.innerHTML = `
            <button onclick="abrirModalAdmin()" class="btn btn-primary">
                ⚙️ Admin
            </button>
        `;
        document.getElementById('formLoginView').style.display = 'none';
        document.getElementById('formCadastroView').style.display = 'block';
    } else {
        statusDiv.innerHTML = `
            <button onclick="abrirModalAdmin()" class="btn btn-outline">
                Entrar como Admin
            </button>
        `;
        document.getElementById('formLoginView').style.display = 'block';
        document.getElementById('formCadastroView').style.display = 'none';
    }
}

function abrirModalAdmin() {
    document.getElementById('modalAdmin').style.display = 'flex';
}

function fecharModalAdmin() {
    document.getElementById('modalAdmin').style.display = 'none';
}

// Autenticação
async function fazerLogin() {
    const email = document.getElementById('emailLogin').value.trim();
    const password = document.getElementById('senhaLogin').value;

    if (!email || !password) {
        alert('Por favor, preencha o email e a palavra-passe.');
        return;
    }

    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });

    if (error) {
        alert('Erro ao entrar: ' + error.message);
    } else {
        renderHeader(data.session);
        alert('Sessão iniciada com sucesso!');
    }
}

async function fazerLogout() {
    await _supabase.auth.signOut();
    renderHeader(null);
    fecharModalAdmin();
}

// Carregar Dados
async function carregarProdutos() {
    const grid = document.getElementById('gridProdutos');
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
    document.getElementById('totalProdutos').textContent = `${listaProdutosGlobal.length} Produtos`;
    renderGrid(listaProdutosGlobal);
}

function renderGrid(produtos) {
    const grid = document.getElementById('gridProdutos');
    grid.innerHTML = '';

    if (produtos.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1;">Nenhum produto encontrado.</p>';
        return;
    }

    produtos.forEach(p => {
        // Garantia contra campos nulos
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
    const termo = document.getElementById('inputBusca').value.toLowerCase();
    const filtrados = listaProdutosGlobal.filter(p => 
        (p.texto && p.texto.toLowerCase().includes(termo))
    );
    renderGrid(filtrados);
}

// Adicionar Novo Produto
async function adicionarProduto() {
    const nome = document.getElementById('nomeProduto').value.trim();
    const preco = document.getElementById('precoProduto').value.trim();
    const imagem = document.getElementById('imagemProduto').value.trim();

    if (!nome) {
        alert('Por favor, informe o nome do produto.');
        return;
    }

    // Objeto a guardar no Supabase
    const novoItem = { texto: nome };
    if (preco) novoItem.preco = preco;
    if (imagem) novoItem.imagem = imagem;

    const { error } = await _supabase.from('tarefas').insert([novoItem]);

    if (error) {
        alert('Erro ao guardar: ' + error.message);
    } else {
        // Limpa campos e recarrega
        document.getElementById('nomeProduto').value = '';
        document.getElementById('precoProduto').value = '';
        document.getElementById('imagemProduto').value = '';
        fecharModalAdmin();
        carregarProdutos();
    }
}

// Inicia ao carregar a página
init();
