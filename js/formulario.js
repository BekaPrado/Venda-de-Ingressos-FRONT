let empresaId = null;
let eventoId = new URLSearchParams(window.location.search).get("eventoId");
let cupomAplicado = null;
let limiteParticipantes = 1; // valor padrão

// Buscar limite de participantes do evento
async function carregarEvento() {
  try {
    const eventoRes = await apiGet(`/evento/${eventoId}`);
    const evento = eventoRes.evento || eventoRes.dados;
    if (evento) {
      limiteParticipantes = evento.limite_participantes || 1;

      // Mostra a regra na tela
      const msg = document.getElementById("msg-participantes");
      msg.textContent = `⚠️ Você deve adicionar pelo menos 1 e no máximo ${limiteParticipantes} participantes.`;
      msg.style.color = "blue";
    }
  } catch (err) {
    console.error("Erro ao carregar evento:", err);
  }
}
carregarEvento();

// Adicionar participante dinamicamente
function adicionarParticipante() {
  const qtd = document.querySelectorAll(".participante-item").length;

  if (qtd >= limiteParticipantes) {
    alert(`⚠️ Este evento permite no máximo ${limiteParticipantes} participantes.`);
    return;
  }

  const div = document.createElement("div");
  div.classList.add("participante-item");
  div.innerHTML = `
    <input type="text" placeholder="Nome" class="nome-participante" required>
    <input type="email" placeholder="E-mail" class="email-participante" required>
    <input type="text" placeholder="Telefone" class="tel-participante" required oninput="mascaraTelefone(this)">
  `;
  document.getElementById("participantes").appendChild(div);
}

// Máscaras para inputs
function mascaraCPF(input) {
  input.value = input.value.replace(/\D/g, "").slice(0, 11) // garante máximo de 11 números
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function mascaraCNPJ(input) {
  input.value = input.value.replace(/\D/g, "").slice(0, 14) // máximo 14 números
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function mascaraTelefone(input) {
  input.value = input.value.replace(/\D/g, "").slice(0, 11) // máximo 11 dígitos (com DDD)
    .replace(/^(\d{2})(\d)/g, "($1) $2")
    .replace(/(\d{4,5})(\d{4})$/, "$1-$2");
}


// Validações de campos da empresa
function validarEmpresa(empresa) {
  if (!empresa.nome_empresa || !empresa.email || !empresa.endereco) {
    alert("⚠️ Preencha todos os campos obrigatórios (Nome da Empresa, Email, Endereço).");
    return false;
  }

  // Telefone: só números (mínimo 8 dígitos)
  if (empresa.telefone && !/^\d{8,15}$/.test(empresa.telefone.replace(/\D/g, ""))) {
    alert("⚠️ Telefone inválido. Digite entre 8 e 15 números.");
    return false;
  }

  // CPF: 11 dígitos
  if (empresa.cpf && !/^\d{11}$/.test(empresa.cpf.replace(/\D/g, ""))) {
    alert("⚠️ CPF inválido. Digite 11 números.");
    return false;
  }

  // CNPJ: 14 dígitos
  if (empresa.cnpj && !/^\d{14}$/.test(empresa.cnpj.replace(/\D/g, ""))) {
    alert("⚠️ CNPJ inválido. Digite 14 números.");
    return false;
  }

  return true;
}

// Capturar envio do formulário
document.getElementById("form-empresa").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!confirm("Tem certeza que deseja enviar os dados?")) return;

  const empresa = {
    nome_empresa: document.getElementById("nome_empresa").value.trim(),
    email: document.getElementById("email").value.trim(),
    telefone: document.getElementById("telefone").value.trim(),
    cpf: document.getElementById("cpf").value.trim() || null,
    cnpj: document.getElementById("cnpj").value.trim() || null,
    endereco: document.getElementById("endereco").value.trim(),
    evento_id: parseInt(eventoId),
    cupom_id: cupomAplicado ? cupomAplicado.id : null
  };

  if (!validarEmpresa(empresa)) return;

  // Valida número de participantes
  const participantes = document.querySelectorAll(".participante-item");
  if (participantes.length < 1) {
    alert("⚠️ Adicione pelo menos 1 participante.");
    return;
  }
  if (participantes.length > limiteParticipantes) {
    alert(`⚠️ Este evento permite no máximo ${limiteParticipantes} participantes.`);
    return;
  }

  try {
    const data = await apiPost("/empresa", empresa);

    if (data.status) {
      empresaId = data.dados?.id || data.empresa?.id;

      // Salvar participantes
      for (let p of participantes) {
        const participante = {
          nome: p.querySelector(".nome-participante").value.trim(),
          email: p.querySelector(".email-participante").value.trim(),
          telefone: p.querySelector(".tel-participante").value.trim(),
          empresa_id: empresaId
        };

        if (!participante.nome || !participante.email || !participante.telefone) {
          alert("⚠️ Preencha todos os dados dos participantes.");
          return;
        }

        await apiPost("/participante", participante);
      }

      alert("✅ Dados enviados com sucesso!");

      // Desabilita formulário mas mantém visível
      document.querySelectorAll("#form-empresa input, #form-empresa button").forEach(el => {
        el.disabled = true;
      });

      // Mostra cupom + pagamento na mesma página
      document.getElementById("secao-cupom").style.display = "block";
      document.getElementById("pagamento").style.display = "block";

      // Buscar evento para renderizar botão normal
      const eventoRes = await apiGet(`/evento/${eventoId}`);
      const eventoData = eventoRes.evento || eventoRes.dados;

      if (eventoData) {
        document.getElementById("pagamento").innerHTML = `
          <h3>Comprar com cupom</h3>
          <div id="botaoCupom"></div>

          <h3>Comprar sem cupom</h3>
          <div id="botaoNormal">${eventoData.botao_pagseguro}</div>
        `;
      }
    } else {
      alert("Erro ao enviar os dados.");
    }
  } catch (error) {
    console.error("Erro ao enviar empresa:", error);
    alert("Erro de comunicação com o servidor.");
  }
});

// Validar cupom
async function validarCupom() {
  const codigo = document.getElementById("cupom").value.trim();

  try {
    const data = await apiPost("/cupom/validar", { codigo, evento_id: parseInt(eventoId) });
    const msg = document.getElementById("msg-cupom");

    if (data.status) {
      cupomAplicado = data.cupom;
      msg.textContent = `✅ Cupom válido! Desconto aplicado: ${cupomAplicado.desconto} (${cupomAplicado.tipo})`;
      msg.style.color = "green";

      document.getElementById("botaoCupom").innerHTML = cupomAplicado.botao_pagseguro_html;
    } else {
      cupomAplicado = null;
      msg.textContent = "❌ Cupom inválido.";
      msg.style.color = "red";
      document.getElementById("botaoCupom").innerHTML = "";
    }
  } catch (error) {
    console.error("Erro ao validar cupom:", error);
    alert("Erro ao validar cupom.");
  }
}
