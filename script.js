const SUPABASE_URL = 'https://finmivasfcnnJntfaeei.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbm1pdmFzZmNubmpudGZhZWVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNzY2MTIsImV4cCI6MjEwNzY1MjYxMn0.0IURfOPO9ExLv4D2VM03ENyPIBzG2iy9xEyE1gtlFd0';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let listaProdutosGlobal = [];
let carrinho = [];
let totalVendasConcluidas = 0;
let receitaTotalAcumulada = 0;
let usuarioAdmin = false;

async function init() {
    // O modal do cliente agora só aparece se ele nunca tiver entrado, mas nunca bloqueia a página por defeito
    const clienteLogado = localStorage.getItem('atelier_cliente_email');
    const modalCliente = document.getElementById('modalCliente');
    
    if (!clienteLogado && modalCliente) {
        // Mostra apenas após 1.5 segundos para garantir que a página carregou toda
        setTimeout(() => {
            modalCliente.style.display = 'flex';
        }, 1500);
    }

    await verificarSessao();
    await carregarProdutos();
}

function fecharModalCliente() {
    const modalCliente = document.getElementById('modalCliente');
    if (modalCliente) modalCliente.style.display = 'none';
    localStorage.setItem('atelier_cliente_email', 'visitante@atelier.com');
}

async function salvarIdentificacaoCliente() {
    const emailInputModal = document.getElementById('emailClienteInput');
    const aceitaOfertasCheckbox = document.getElementById('aceitaOfertas');
    const modalCliente = document.getElementById('modalCliente');

    if (!emailInputModal) return;

    const email = emailInputModal.value.trim();
    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!regexEmail.test(email)) {
        alert('Por favor, introduza um endereço de email válido.');
        return;
    }

    if (modalCliente) modalCliente.style.display = 'none';
    localStorage.setItem('atelier_cliente_email', email);

    if (aceitaOfertasCheckbox && aceitaOfertasCheckbox.checked) {
        try {
            await _supabase.from('leads').insert([{ email: email }]);
        } catch (err) {
            console.log('Lead já registada ou erro de rede', err);
        }
    }
}
