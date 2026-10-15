const SUPABASE_URL = 'https://finmivasfcnnJntfaeei.supabase.co';
// Usa a tua chave anon pública que começa por eyJ...
const SUPABASE_KEY = 'sb_publishable_1GrP5ip9yUycdbQ_JnvDdQ_b6_vxJFK'; 

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Controla a exibição com base na sessão de utilizador
async function verificarSessao() {
    const { data: { session } } = await _supabase.auth.getSession();
    controlarInterface(session);
    carregarProdutos();
}

function controlarInterface(session) {
    const secaoAdmin = document.getElementById('secaoAdmin');
    const secaoLogin = document.getElementById('secaoLogin');
    const statusLogin = document.getElementById('statusLogin');

    if (session) {
        secaoAdmin.style.display = 'block';
        secaoLogin.style.display = 'none';
        statusLogin.innerHTML = `<button onclick="fazerLogout()" class="btn-danger btn-sm">Sair (${session.user.email})</button>`;
    } else {
        secaoAdmin.style.display = 'none';
        statusLogin.innerHTML = `<button onclick="toggleLogin()" class="btn-secondary">Área Admin</button>`;
    }
}

function toggleLogin() {
    const secaoLogin = document.getElementById('secaoLogin');
    secaoLogin.style.display = secaoLogin.style.display === 'none' ? 'block' : 'none';
}

async function fazerLogin() {
    const email = document.getElementById('emailLogin').value.trim();
    const password = document.getElementById('senhaLogin').value;

    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });

    if (error) {
        alert('Erro ao entrar: ' + error.message);
    } else {
        alert('Login efetuado com sucesso!');
        controlarInterface(data.session);
    }
}

async function fazerLogout() {
    await _supabase.auth.signOut();
    controlarInterface(null);
}

// Carregar Produtos na Loja (Público)
async function carregarProdutos() {
    const grid = document.getElementById('gridProdutos');
    grid.innerHTML = '<p>A carregar produtos...</p>';

    const { data: produtos, error } = await _supabase
        .from('tarefas') // Reutilizando a tabela existente
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.error(error);
        grid.innerHTML = '<p>Erro ao carregar a loja.</p>';
        return;
    }

    grid.innerHTML = '';

    if (!produtos || produtos.length === 0) {
        grid.innerHTML = '<p>Nenhum produto disponível na loja no momento.</p>';
        return;
    }

    produtos.forEach(p => {
        const card = document.createElement('div');
        card.className = 'card-produto';
        card.innerHTML = `
            <div>
                <h3>📦 ${p.texto}</h3>
                <p class="preco">${p.preco ? p.preco : 'Preço sob consulta'}</p>
            </div>
            <button class="btn-comprar" onclick="alert('Item adicionado ao carrinho!')">Comprar</button>
        `;
        grid.appendChild(card);
    });
}

// Cadastrar Produto (Apenas Logado)
async function adicionarProduto() {
    const nome = document.getElementById('nomeProduto').value.trim();
    const preco = document.getElementById('precoProduto').value.trim();

    if (!nome) {
        alert("Digite o nome do produto!");
        return;
    }

    const { error } = await _supabase
        .from('tarefas')
        .insert([{ texto: nome, preco: preco }]);

    if (error) {
        alert('Erro ao cadastrar produto: ' + error.message);
    } else {
        document.getElementById('nomeProduto').value = '';
        document.getElementById('precoProduto').value = '';
        carregarProdutos();
    }
}

verificarSessao();
