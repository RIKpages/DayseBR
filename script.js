const SUPABASE_URL = 'https://finmivasfcnnJntfaeei.supabase.co';
const SUPABASE_KEY = 'sb_publishable_1GrP5ip9yUcdbQ_JnvDDq_b6_vXJFK';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Verificar se já existe uma sessão ativa
async function verificarSessao() {
    const { data: { session } } = await _supabase.auth.getSession();
    controlarInterface(session);
    carregarTarefas();
}

function controlarInterface(session) {
    const secaoLogin = document.getElementById('secaoLogin');
    const secaoTarefas = document.getElementById('secaoTarefas');

    if (session) {
        secaoLogin.style.display = 'none';
        secaoTarefas.style.display = 'block';
    } else {
        secaoLogin.style.display = 'flex';
        secaoTarefas.style.display = 'none';
    }
}

async function fazerLogin() {
    const email = document.getElementById('emailLogin').value;
    const password = document.getElementById('senhaLogin').value;

    const { data, error } = await _supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

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
    alert('Sessão terminada.');
}

// Procurar as tarefas salvas na base de dados (Leitura pública)
async function carregarTarefas() {
    const lista = document.getElementById('listaTarefas');
    lista.innerHTML = '<li>A carregar...</li>';

    const { data: tarefas, error } = await _supabase
        .from('tarefas')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        console.error('Erro ao carregar:', error);
        lista.innerHTML = '<li>Erro ao carregar dados.</li>';
        return;
    }

    lista.innerHTML = '';
    
    if (!tarefas || tarefas.length === 0) {
        lista.innerHTML = '<li>Sem tarefas registadas.</li>';
        return;
    }

    tarefas.forEach(t => {
        const item = document.createElement('li');
        item.textContent = t.texto;
        lista.appendChild(item);
    });
}

// Guardar nova tarefa (Apenas para utilizadores autenticados)
async function adicionarTarefa() {
    const input = document.getElementById('inputTarefa');
    const valor = input.value.trim();

    if (valor === "") {
        alert("Digite alguma coisa!");
        return;
    }

    const { error } = await _supabase
        .from('tarefas')
        .insert([{ texto: valor }]);

    if (error) {
        console.error('Erro ao guardar:', error);
        alert('Erro de permissão ou ao guardar na base de dados.');
    } else {
        input.value = '';
        carregarTarefas();
    }
}

// Executa ao carregar a página
verificarSessao();
