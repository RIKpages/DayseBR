// Array temporário para testar a interface visualmente
// Substitua pelas tuas credenciais do Supabase:
const SUPABASE_URL = 'https://finmivasfcnnJntfaeei.supabase.co';
const SUPABASE_KEY = 'sb_publishable_1GrP5ip9yUycdbQ_JnvDdQ_b6_vxJFK'; 

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function carregarTarefas() {
    const lista = document.getElementById('listaTarefas');
    lista.innerHTML = ''; // Limpa a lista

    tarefas.forEach(t => {
        const item = document.createElement('li');
        item.textContent = t.texto;
        lista.appendChild(item);
    });
}

function adicionarTarefa() {
    const input = document.getElementById('inputTarefa');
    const valor = input.value.trim();

    if (valor === "") {
        alert("Digite alguma coisa!");
        return;
    }

    // Adiciona na lista local (depois substituiremos por um INSERT no banco de dados)
    tarefas.push({ id: Date.now(), texto: valor });
    input.value = '';
    
    carregarTarefas();
}

// Executa ao carregar a página
carregarTarefas();
