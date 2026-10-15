// Credenciais do Supabase
const SUPABASE_URL = 'https://finmivasfcnnJntfaeei.supabase.co';
const SUPABASE_KEY = 'sb_publishable_1GrP5ip9yUcdbQ_JnvDDq_b6_vXJFK';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Função para procurar as tarefas salvas na base de dados
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

// Função para guardar uma nova tarefa na base de dados
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
        alert('Erro ao guardar na base de dados.');
    } else {
        input.value = '';
        carregarTarefas(); // Atualiza a lista na tela
    }
}

// Executa ao carregar a página
carregarTarefas();
