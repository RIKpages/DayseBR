// Array temporário para testar a interface visualmente
let tarefas = [
    { id: 1, texto: "Configurar o GitHub Pages" },
    { id: 2, texto: "Conectar o Banco de Dados" }
];

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