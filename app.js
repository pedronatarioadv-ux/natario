/* Natário Advocacia — app principal (clientes, processos, agenda, teses) */
"use strict";

const CFG = window.NATARIO_CONFIG;
const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "natario-auth" },
});
const C = window.CalcLogica;
const app = document.getElementById("app");
const E = { tipos: [], parceiros: [], token: null, usuario: null, cfg: {} };

/* ---------------- utilidades ---------------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
const sem = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Maceio" }).format(new Date());
const br = (d) => (d ? C.br(String(d).slice(0, 10)) : "");
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const localDT = (iso) => {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Maceio", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const g = (t) => f.find((x) => x.type === t).value;
  return { data: `${g("year")}-${g("month")}-${g("day")}`, hora: `${g("hour") === "24" ? "00" : g("hour")}:${g("minute")}` };
};
const isoLocal = (data, hora) => new Date(`${data}T${hora || "09:00"}:00-03:00`).toISOString();
const iniciais = (n) => String(n || "?").split(/\s+/).filter((p) => p.length > 2 || /^[A-ZÀ-Ú]/.test(p)).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const primeiroNome = (n) => String(n || "").split(/\s+/)[0] || "";
const nomeCurto = (n) => {
  const p = String(n || "").split(/\s+/); const suf = /^(júnior|junior|neto|filho|sobrinho)$/i;
  const out = [p[0]]; let i = 1;
  while (i < p.length && /^(de|da|do|dos|das|e)$/i.test(p[i])) out.push(p[i++]);
  if (p[i]) out.push(p[i++]);
  if (p[p.length - 1] && suf.test(p[p.length - 1]) && !out.includes(p[p.length - 1])) out.push(p[p.length - 1]);
  return out.join(" ");
};
const digitos = (s) => String(s || "").replace(/\D/g, "");
const fmtCNJ = (s) => { const d = digitos(s); return d.length === 20 ? `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d[13]}.${d.slice(14, 16)}.${d.slice(16)}` : s || ""; };

function toast(msg, ms = 3200) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), ms);
}
async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); toast("Copiado"); }
  catch { prompt("Copie o texto:", texto); }
}
function erro(e) { console.error(e); toast(e?.message || String(e), 5000); }

const I = { // ícones (traço)
  mesa: '<svg viewBox="0 0 24 24"><path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  clientes: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/></svg>',
  agenda: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  teses: '<svg viewBox="0 0 24 24"><path d="M12 3v18M5 7h14M7 7l-3 7a3.5 3.5 0 0 0 6 0zM17 7l-3 7a3.5 3.5 0 0 0 6 0zM8 21h8"/></svg>',
  mais: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  prazo: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/></svg>',
  ampulheta: '<svg viewBox="0 0 24 24"><path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9"/></svg>',
  insta: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6"/></svg>',
  pasta: '<svg viewBox="0 0 24 24"><path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/></svg>',
  ajustes: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  mais1: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  busca: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  whats: '<svg viewBox="0 0 24 24"><path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.3z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.5-2-1-1 1c-1.2-.4-2.3-1.5-2.7-2.7l1-1-1-2z"/></svg>',
  editar: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  lixo: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  copiar: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  externo: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  sino: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/></svg>',
  ok: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>',
  claude: '<svg viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>',
  doc: '<svg viewBox="0 0 24 24"><path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/></svg>',
};

/* ---------------- diálogo genérico ---------------- */
function dialogo(html, { aoAbrir } = {}) {
  const d = document.createElement("dialog");
  d.innerHTML = html;
  document.body.appendChild(d);
  d.addEventListener("close", () => d.remove());
  d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  $$("[data-fechar]", d).forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); d.close(); }));
  d.showModal();
  aoAbrir?.(d);
  return d;
}
function confirmar(msg, rotulo = "Excluir") {
  return new Promise((res) => {
    const d = dialogo(`<div class="conteudo"><p>${esc(msg)}</p><div class="pe-dialogo">
      <button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="sim">${esc(rotulo)}</button></div></div>`);
    $("#sim", d).onclick = () => { res(true); d.close(); };
    d.addEventListener("close", () => res(false));
  });
}

/* ---------------- WhatsApp e lembretes ---------------- */
function linkWhats(telefone, texto) {
  let d = digitos(telefone);
  if (d && d.length <= 11) d = "55" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}
function abrirWhats(cliente, texto) {
  dialogo(`<form><h2>Mensagem no WhatsApp</h2>
    <label class="campo"><span>Para</span><input type="tel" id="wtel" value="${esc(cliente?.telefone || "")}" placeholder="(82) 99999-9999"></label>
    <label class="campo"><span>Mensagem</span><textarea id="wtxt" rows="7">${esc(texto)}</textarea></label>
    <div class="pe-dialogo"><button class="btn" data-fechar>Cancelar</button>
    <a class="btn primario" id="wir" target="_blank" rel="noopener">${I.whats} Abrir no WhatsApp</a></div></form>`, {
    aoAbrir: (d) => {
      const at = () => ($("#wir", d).href = linkWhats($("#wtel", d).value, $("#wtxt", d).value));
      at(); $("#wtel", d).oninput = at; $("#wtxt", d).oninput = at;
      $("#wir", d).addEventListener("click", () => setTimeout(() => d.close(), 300));
    },
  });
}
const ROT_COMP = { audiencia: "audiência", prazo: "prazo", reuniao: "reunião", outro: "compromisso" };
function textoWhatsCompromisso(c, cliente) {
  const { data, hora } = localDT(c.inicio);
  const dia = `${SEMANA[C.D(data).getUTCDay()]}, ${br(data)}${c.dia_inteiro ? "" : `, às ${hora.replace(":", "h")}`}`;
  return `Olá, ${primeiroNome(cliente?.nome)}! Aqui é o Dr. Pedro, do Natário Advocacia.\n\nLembrando que sua ${ROT_COMP[c.tipo] || "audiência"} está marcada para ${dia}${c.local ? `, em ${c.local}` : ""}.\n\nQualquer dúvida, estou à disposição.`;
}
function textoWhatsMov(m, cliente, processo) {
  return `Olá, ${primeiroNome(cliente?.nome)}! Aqui é o Dr. Pedro, do Natário Advocacia.\n\nAtualização do seu processo${processo?.numero ? ` nº ${processo.numero}` : ""}:\n${m.texto.split("\n—")[0]}\n\nQualquer dúvida, estou à disposição.`;
}
function linkLembrete(c, clienteNome) {
  const ini = new Date(c.inicio);
  const l = new Date(ini.getTime()); l.setUTCDate(l.getUTCDate() - 5);
  const { data, hora } = localDT(ini.toISOString());
  const ld = localDT(l.toISOString());
  const dados = { lembrete_titulo: `${c.titulo}${clienteNome ? ` (${nomeCurto(clienteNome)})` : ""} – ${br(data)} ${c.dia_inteiro ? "" : hora}`.trim(), lembrete_data: `${br(ld.data)} 09:00` };
  return `shortcuts://run-shortcut?name=${encodeURIComponent("Natário")}&input=text&text=${encodeURIComponent(JSON.stringify(dados))}`;
}

/* ---------------- sistema de consulta do processo ---------------- */
const UF_TJ = { "01": "AC", "02": "AL", "03": "AP", "04": "AM", "05": "BA", "06": "CE", "07": "DF", "08": "ES", "09": "GO", "10": "MA", "11": "MT", "12": "MS", "13": "MG", "14": "PA", "15": "PB", "16": "PR", "17": "PE", "18": "PI", "19": "RJ", "20": "RN", "21": "RS", "22": "RO", "23": "RR", "24": "SC", "25": "SE", "26": "SP", "27": "TO" };
const SISTEMAS = {
  "esaj-tjal": { nome: "e-SAJ TJAL", url: (n) => esaj("https://www2.tjal.jus.br", n) },
  "esaj-tjal-2g": { nome: "e-SAJ TJAL 2º grau", url: () => "https://www2.tjal.jus.br/cposg5/open.do" },
  "esaj-tjsp": { nome: "e-SAJ TJSP", url: (n) => esaj("https://esaj.tjsp.jus.br", n) },
  "seeu": { nome: "SEEU", url: () => "https://seeu.pje.jus.br/seeu/" },
  "pje-tjpe": { nome: "PJe TJPE", url: () => "https://pje.tjpe.jus.br/1g/ConsultaPublica/listView.seam" },
  "tjse": { nome: "TJSE", url: () => "https://www.tjse.jus.br/portal/consultas/consulta-processual" },
  "pje-trf5": { nome: "PJe TRF5 / JFAL", url: () => "https://pje1g.trf5.jus.br/pjeconsulta/ConsultaPublica/listView.seam" },
  "pje-tre": { nome: "PJe Eleitoral", url: () => "https://consultaunificadapje.tse.jus.br/" },
  "pje-trt19": { nome: "PJe TRT19", url: (n) => `https://pje.trt19.jus.br/consultaprocessual/detalhe-processo/${digitos(n)}` },
  "stj": { nome: "STJ", url: (n) => `https://processo.stj.jus.br/processo/pesquisa/?termo=${encodeURIComponent(n)}&aplicacao=processos.ea&tipoPesquisa=tipoPesquisaGenerica` },
};
function esaj(base, n) {
  const d = digitos(n); const f = fmtCNJ(n);
  return `${base}/cpopg/search.do?conversationId=&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=${f.slice(0, 15)}&foroNumeroUnificado=${d.slice(16)}&dadosConsulta.valorConsultaNuUnificado=${f}&dadosConsulta.valorConsultaNuUnificado=UNIFICADO&dadosConsulta.valorConsulta=&dadosConsulta.tipoNuProcesso=UNIFICADO`;
}
function detectarSistema(p) {
  if (p.sistema && SISTEMAS[p.sistema]) return p.sistema;
  const tipo = E.tipos.find((t) => t.id === p.tipo_id)?.nome || "";
  if (/execu[cç][aã]o penal/i.test(tipo)) return "seeu";
  const d = digitos(p.numero);
  if (d.length !== 20) return null;
  const j = d[13], tr = d.slice(14, 16);
  if (j === "8") return tr === "02" ? "esaj-tjal" : tr === "26" ? "esaj-tjsp" : tr === "17" ? "pje-tjpe" : tr === "25" ? "tjse" : null;
  if (j === "4" && tr === "05") return "pje-trf5";
  if (j === "6") return "pje-tre";
  if (j === "5" && tr === "19") return "pje-trt19";
  if (j === "3") return "stj";
  return null;
}
async function consultarNoSistema(p) {
  const chave = detectarSistema(p);
  const url = p.url_consulta || (chave ? SISTEMAS[chave].url(p.numero) : `https://www.google.com/search?q=${encodeURIComponent(`"${fmtCNJ(p.numero)}"`)}`);
  try { await navigator.clipboard.writeText(fmtCNJ(p.numero)); } catch { /* sem permissão */ }
  window.open(url, "_blank", "noopener");
  toast(`Número copiado · abrindo ${chave ? SISTEMAS[chave].nome : "a busca"}`);
}

/* ---------------- dados de apoio ---------------- */
async function carregarApoio() {
  const [t, p, c] = await Promise.all([
    sb.from("tipos_processo").select("*").order("ordem"),
    sb.from("parceiros").select("*").order("nome"),
    sb.from("config").select("chave, valor"),
  ]);
  E.tipos = t.data || []; E.parceiros = p.data || [];
  E.cfg = Object.fromEntries((c.data || []).map((x) => [x.chave, x.valor]));
  E.token = E.cfg.token_pessoal || null;
  window.NATARIO_TIPOS = E.tipos;
}
window.natarioDialogo = (html, op) => dialogo(html, op);
window.natarioToast = (m, ms) => toast(m, ms);

/* ---------------- abrir pasta do OneDrive no Mac (ajudante "Natário Pastas") ---------------- */
function abrirPasta(rel) {
  location.href = `natario://abrir?p=${encodeURIComponent(rel)}`;
  setTimeout(() => { if (document.hasFocus()) toast("Se a pasta não abriu, instale o ajudante do Mac em Mais › Ajustes › Abrir pastas.", 6000); }, 2500);
}
const tipoPorId = (id) => E.tipos.find((t) => t.id === id);
const chipTipo = (id) => { const t = tipoPorId(id); return t ? `<span class="chip"><i style="background:${esc(t.cor)}"></i>${esc(t.nome)}</span>` : ""; };

/* ---------------- casca (menu) ---------------- */
const NAV = [
  { r: "", n: "Mesa", i: I.mesa, movel: true },
  { r: "clientes", n: "Clientes", i: I.clientes, movel: true },
  { r: "agenda", n: "Agenda", i: I.agenda, movel: true },
  { r: "teses", n: "Teses", i: I.teses, movel: true },
  { r: "prazos", n: "Prazos", i: I.prazo },
  { r: "prescricao", n: "Prescrição", i: I.ampulheta },
  { r: "instagram", n: "Instagram", i: I.insta },
  { r: "importar", n: "Importar pastas", i: I.pasta },
  { r: "ajustes", n: "Ajustes", i: I.ajustes },
];
function casca() {
  app.innerHTML = `
  <div class="casca">
    <header class="barra-topo"><div class="faixa">
      <a class="marca" href="#/"><img src="logo-claro.png" alt="Natário Advocacia"></a>
      <div class="usuario"><span>${esc(E.usuario?.email || "")}</span>
        <a href="https://claude.ai/new" target="_blank" rel="noopener">Perguntar ao Claude</a>
        <a href="#" id="sair">Sair</a></div>
    </div></header>
    <div class="menu"><nav>${NAV.map((n) => `<a href="#/${n.r}" data-r="${n.r}">${n.i}${n.n}</a>`).join("")}</nav></div>
    <header class="topo-movel"><a href="#/"><img src="logo-claro.png" alt="Natário Advocacia"></a>
      <a class="btn fantasma" href="https://claude.ai/new" target="_blank" rel="noopener" aria-label="Perguntar ao Claude">${I.claude}</a></header>
    <main class="principal" id="vista"></main>
    <nav class="abas">${NAV.filter((n) => n.movel).map((n) => `<a href="#/${n.r}" data-r="${n.r}">${n.i}<span>${n.n}</span></a>`).join("")}
      <a href="#/mais" data-r="mais">${I.mais}<span>Mais</span></a></nav>
    <button class="fab" id="fab" aria-label="Anotação rápida">${I.mais1}</button>
  </div>`;
  $("#sair").onclick = async (e) => { e.preventDefault(); await sb.auth.signOut(); location.hash = ""; iniciar(); };
  $("#fab").onclick = anotacaoRapida;
}
function marcarMenu(rota) {
  $$(".menu a, .abas a").forEach((a) => a.classList.toggle("ativo", a.dataset.r === rota || (rota === "cliente" && a.dataset.r === "clientes")));
}

/* ---------------- anotação rápida (mesma função do Atalho do iPhone) ---------------- */
function anotacaoRapida() {
  const d = dialogo(`<form><h2>Anotação rápida</h2>
    <p class="mudo pequeno">Escreva livremente, ex.: "audiência do João Silva dia 10 às 9h em Penedo" ou "Maria: juntada a resposta à acusação". O sistema identifica o cliente e lança.</p>
    <textarea id="txt" rows="5" required></textarea>
    <div class="pe-dialogo"><button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="env">Lançar</button></div></form>`);
  $("#env", d).onclick = async (e) => {
    e.preventDefault();
    const texto = $("#txt", d).value.trim(); if (!texto) return;
    e.target.disabled = true; e.target.textContent = "Lançando…";
    try {
      const { data, error } = await sb.functions.invoke("capturar", { body: { texto, origem: "app" } });
      if (error) throw error;
      d.close(); toast(data.mensagem || "Lançado", 5000); rota();
    } catch (err) { erro(err); e.target.disabled = false; e.target.textContent = "Lançar"; }
  };
}

/* ---------------- roteador ---------------- */
const ROTAS = {};
async function rota() {
  const h = location.hash.replace(/^#\/?/, "");
  const [nome, ...resto] = h.split("/");
  const v = $("#vista"); if (!v) return;
  marcarMenu(nome);
  v.innerHTML = `<p class="mudo">Carregando…</p>`;
  window.scrollTo(0, 0);
  try { await (ROTAS[nome] || ROTAS[""])(v, ...resto); } catch (e) { erro(e); v.innerHTML = `<div class="vazio">Não foi possível carregar. ${esc(e.message || "")}</div>`; }
}
window.addEventListener("hashchange", rota);
window.Natario = { sb, E, ROTAS, esc, $, $$, toast, erro, dialogo, confirmar, copiar, I, br, hoje, sem, chipTipo, tipoPorId, digitos, fmtCNJ, rota, nomeCurto };

/* ================= MESA DO ADVOGADO ================= */
ROTAS[""] = async (v) => {
  const h = hoje(), em5 = C.soma(h, 5), em7 = C.soma(h, 7), em30 = C.soma(h, 30);
  const iniDia = isoLocal(h, "00:00");
  const [comp, ent, movs, procs] = await Promise.all([
    sb.from("compromissos").select("id, tipo, titulo, inicio, dia_inteiro, local, concluido, cliente_id, clientes(nome, telefone)").eq("concluido", false).gte("inicio", isoLocal(C.soma(h, -60), "00:00")).lte("inicio", isoLocal(em30, "23:59")).order("inicio"),
    sb.from("entrada").select("*").eq("resolvido", false).order("criado_em", { ascending: false }),
    sb.from("movimentacoes").select("id, data, tipo, texto, origem, cliente_id, clientes(nome)").order("criado_em", { ascending: false }).limit(12),
    sb.from("processos").select("id, tipo_id, situacao, reu_preso").eq("situacao", "ativo"),
  ]);
  const cs = comp.data || [];
  const dia = (c) => localDT(c.inicio).data;
  const n = {
    audHoje: cs.filter((c) => c.tipo === "audiencia" && dia(c) === h).length,
    aud7: cs.filter((c) => c.tipo === "audiencia" && dia(c) >= h && dia(c) <= em7).length,
    aud30: cs.filter((c) => c.tipo === "audiencia" && dia(c) >= h).length,
    przHoje: cs.filter((c) => c.tipo === "prazo" && dia(c) === h).length,
    prz5: cs.filter((c) => c.tipo === "prazo" && dia(c) >= h && dia(c) <= em5).length,
    przVenc: cs.filter((c) => c.tipo === "prazo" && dia(c) < h).length,
    entrada: (ent.data || []).length,
    ativos: (procs.data || []).length,
    presos: (procs.data || []).filter((p) => p.reu_preso).length,
  };
  const cont = (rot, num, href, alerta) => `<a class="cont" href="${href}"><span>${rot}</span><b class="${num === 0 ? "zero" : alerta ? "alerta" : ""}">${num}</b></a>`;
  const saud = (() => { const hr = Number(localDT(new Date().toISOString()).hora.slice(0, 2)); return hr < 12 ? "Bom dia" : hr < 18 ? "Boa tarde" : "Boa noite"; })();
  const proximos = cs.filter((c) => dia(c) >= h).slice(0, 8);
  v.innerHTML = `
  <div class="cabecalho"><div><div class="rotulo">Mesa do advogado</div><h1>${saud}, Dr. Pedro</h1></div>
    <div class="acoes"><a class="btn" href="#/clientes/novo">${I.mais1} Novo cliente</a><a class="btn" href="#/prazos">${I.prazo} Calcular prazo</a></div></div>
  <div class="mesa">
    <section class="quadro"><h3>Audiências</h3>${cont("Hoje", n.audHoje, "#/agenda", true)}${cont("Próximos 7 dias", n.aud7, "#/agenda")}${cont("Próximos 30 dias", n.aud30, "#/agenda")}</section>
    <section class="quadro"><h3>Prazos</h3>${cont("Vencendo hoje", n.przHoje, "#/agenda/prazos", true)}${cont("Próximos 5 dias", n.prz5, "#/agenda/prazos", true)}${cont("Em atraso (não concluídos)", n.przVenc, "#/agenda/prazos", true)}</section>
    <section class="quadro"><h3>Processos</h3>${cont("Ativos", n.ativos, "#/clientes")}${cont("Réus presos", n.presos, "#/clientes/presos", true)}${cont("Caixa de entrada", n.entrada, "#entrada", true)}</section>
  </div>
  <div class="secao"><header><h2>Próximos compromissos</h2><a class="btn fantasma" href="#/agenda">Agenda completa</a></header>
    ${proximos.length ? `<ul class="lista">${proximos.map(itemComp).join("")}</ul>` : `<div class="cartao vazio">Nenhum compromisso nos próximos 30 dias.</div>`}</div>
  <div class="secao" id="entrada"><header><h2>Caixa de entrada</h2><span class="mudo pequeno">Textos compartilhados e pushes sem cliente identificado</span></header>
    ${(ent.data || []).length ? `<ul class="lista">${ent.data.map((x) => `<li><div class="item"><div class="corpo"><div class="sub">${esc(br(x.criado_em))} · ${esc(x.origem)}</div><div style="white-space:pre-wrap">${esc(x.texto)}</div></div>
      <div class="lado"><button class="btn pq" data-resolver="${x.id}">Lançar</button> <button class="btn pq fantasma" data-descartar="${x.id}">Descartar</button></div></div></li>`).join("")}</ul>` : `<div class="cartao vazio">Nada pendente.</div>`}</div>
  <div class="secao"><header><h2>Últimas movimentações</h2></header>
    ${(movs.data || []).length ? `<ul class="lista">${movs.data.map((m) => `<li><a class="item" href="#/cliente/${m.cliente_id}"><div class="corpo"><div class="titulo">${esc(m.clientes?.nome)}</div><div class="sub"><span class="tipo-mov tipo-${m.tipo}">${esc(m.tipo)}</span> · ${esc(m.texto.split("\n")[0])}</div></div><div class="lado num">${br(m.data)}</div></a></li>`).join("")}</ul>` : `<div class="cartao vazio">Sem movimentações ainda. Elas aparecem aqui quando você lança pelo app, pelo Chrome, pelo Atalho do iPhone ou pelo push dos tribunais.</div>`}</div>`;
  $$("[data-descartar]", v).forEach((b) => (b.onclick = async () => { await sb.from("entrada").update({ resolvido: true }).eq("id", b.dataset.descartar); rota(); }));
  $$("[data-resolver]", v).forEach((b) => (b.onclick = () => resolverEntrada((ent.data || []).find((x) => x.id === b.dataset.resolver))));
  ligarItensComp(v, cs);
};

function itemComp(c) {
  const { data, hora } = localDT(c.inicio);
  const d = C.D(data); const urg = data <= C.soma(hoje(), 5) && !c.concluido;
  return `<li class="${urg ? "urgente" : ""}"><div class="item">
    <div class="data-bloco"><b>${String(d.getUTCDate()).padStart(2, "0")}</b><span>${MESES[d.getUTCMonth()]}</span></div>
    <div class="corpo"><div class="titulo">${esc(c.titulo)}</div>
      <div class="sub">${esc(SEMANA[d.getUTCDay()])}${c.dia_inteiro ? "" : ` · ${hora}`}${c.local ? ` · ${esc(c.local)}` : ""}${c.clientes?.nome ? ` · <a href="#/cliente/${c.cliente_id}">${esc(nomeCurto(c.clientes.nome))}</a>` : ""}</div></div>
    <div class="lado"><span class="tipo-mov tipo-${c.tipo}">${esc(ROT_COMP[c.tipo] || c.tipo)}</span><div class="linha" style="justify-content:flex-end;margin-top:4px">
      ${c.cliente_id ? `<button class="btn pq fantasma" data-whats="${c.id}" title="WhatsApp">${I.whats}</button>` : ""}
      <a class="btn pq fantasma so-movel" href="${linkLembrete(c, c.clientes?.nome)}" title="Lembrete no iPhone">${I.sino}</a>
      <button class="btn pq fantasma" data-concluir="${c.id}" title="Concluir">${I.ok}</button></div></div>
  </div></li>`;
}
function ligarItensComp(raiz, lista) {
  $$("[data-whats]", raiz).forEach((b) => (b.onclick = () => { const c = lista.find((x) => x.id === b.dataset.whats); abrirWhats(c.clientes, textoWhatsCompromisso(c, c.clientes)); }));
  $$("[data-concluir]", raiz).forEach((b) => (b.onclick = async () => {
    const { error } = await sb.from("compromissos").update({ concluido: true }).eq("id", b.dataset.concluir);
    if (error) return erro(error); toast("Concluído"); rota();
  }));
}

/* Seleção de cliente com busca (usada em vários diálogos) */
function campoCliente(id = "cli", valor = null) {
  return `<label class="campo"><span>Cliente</span><div class="busca">${I.busca}<input type="search" id="${id}-q" placeholder="Nome ou CPF" value="${esc(valor?.nome || "")}" autocomplete="off"></div>
    <input type="hidden" id="${id}" value="${esc(valor?.id || "")}"><ul class="lista" id="${id}-res" hidden style="max-height:220px;overflow:auto"></ul></label>`;
}
function ligarCampoCliente(raiz, id = "cli", aoEscolher) {
  const q = $(`#${id}-q`, raiz), res = $(`#${id}-res`, raiz), hid = $(`#${id}`, raiz);
  let t;
  q.oninput = () => {
    hid.value = ""; clearTimeout(t);
    t = setTimeout(async () => {
      if (q.value.trim().length < 2) { res.hidden = true; return; }
      const { data } = await sb.rpc("buscar_clientes", { q: q.value.trim(), lim: 8 });
      res.innerHTML = (data || []).map((c) => `<li><a class="item" href="#" data-id="${c.id}" data-nome="${esc(c.nome)}"><div class="corpo"><div class="titulo">${esc(c.nome)}</div><div class="sub">${esc(c.cpf || "")}</div></div></a></li>`).join("") || `<li class="vazio">Nenhum cliente encontrado</li>`;
      res.hidden = false;
      $$("a[data-id]", res).forEach((a) => (a.onclick = (e) => { e.preventDefault(); hid.value = a.dataset.id; q.value = a.dataset.nome; res.hidden = true; aoEscolher?.(a.dataset.id); }));
    }, 250);
  };
}

async function resolverEntrada(x) {
  const it = x.interpretacao || {};
  const d = dialogo(`<form><h2>Lançar no cliente</h2><p class="pequeno" style="white-space:pre-wrap">${esc(x.texto)}</p>
    ${(x.sugestoes || []).length ? `<div class="chips">${x.sugestoes.map((s) => `<button class="btn pq" data-sug="${s.id}" data-nome="${esc(s.nome)}">${esc(s.nome)}</button>`).join("")}</div>` : ""}
    ${campoCliente("cli")}
    <label class="campo"><span>Processo</span><select id="proc"><option value="">Sem processo específico</option></select></label>
    <div class="pe-dialogo"><button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="ok">Lançar</button></div></form>`);
  const carregaProc = async (cid) => {
    const { data } = await sb.from("processos").select("id, numero, tipo_id").eq("cliente_id", cid);
    $("#proc", d).innerHTML = `<option value="">Sem processo específico</option>` + (data || []).map((p) => `<option value="${p.id}">${esc(p.numero || "sem número")} · ${esc(tipoPorId(p.tipo_id)?.nome || "")}</option>`).join("");
    if (data?.length === 1) $("#proc", d).value = data[0].id;
  };
  ligarCampoCliente(d, "cli", carregaProc);
  $$("[data-sug]", d).forEach((b) => (b.onclick = (e) => { e.preventDefault(); $("#cli", d).value = b.dataset.sug; $("#cli-q", d).value = b.dataset.nome; carregaProc(b.dataset.sug); }));
  $("#ok", d).onclick = async (e) => {
    e.preventDefault();
    const cid = $("#cli", d).value; if (!cid) return toast("Escolha o cliente");
    const pid = $("#proc", d).value || null;
    const tipo = ["audiencia", "prazo", "andamento", "observacao", "decisao"].includes(it.tipo) ? it.tipo : "anotacao";
    const linhas = x.origem === "push" ? (it.movimentos || []).filter((m) => m.relevante).map((m) => ({ data: m.data, texto: `${m.resumo}\n— ${m.descricao}`, tipo: m.tipo || "andamento" })) : [{ data: hoje(), texto: it.resumo || x.texto, tipo }];
    for (const l of linhas) {
      const { error } = await sb.from("movimentacoes").insert({ cliente_id: cid, processo_id: pid, data: l.data || hoje(), tipo: l.tipo, texto: l.texto, origem: x.origem === "push" ? "push" : "compartilhar" });
      if (error) return erro(error);
    }
    if (it.data && ["audiencia", "prazo", "reuniao"].includes(it.tipo)) {
      const { error: e1 } = await sb.from("compromissos").insert({ cliente_id: cid, processo_id: pid, tipo: it.tipo, titulo: it.titulo || x.texto.slice(0, 80), inicio: isoLocal(it.data, it.hora), dia_inteiro: !it.hora, local: it.local || null, observacoes: x.texto });
    }
    if (x.origem === "push" && it.numero && pid) {
      const { data: p } = await sb.from("processos").select("numero").eq("id", pid).single();
      if (p && !p.numero) await sb.from("processos").update({ numero: fmtCNJ(it.numero) }).eq("id", pid);
    }
    await sb.from("entrada").update({ resolvido: true }).eq("id", x.id);
    d.close(); toast("Lançado"); rota();
  };
}

/* ================= CLIENTES ================= */
ROTAS.clientes = async (v, sub) => {
  if (sub === "novo") return formCliente(v, null);
  const { data, error } = await sb.from("clientes")
    .select("id, nome, cpf, telefone, situacao, ultima_atividade, processos(id, tipo_id, numero, parceiros, situacao, reu_preso)")
    .order("nome").limit(5000);
  if (error) throw error;
  const todos = data || [];
  const limite = C.soma(hoje(), -365);
  const st = { q: "", tipo: null, parceiro: "", todos: false, presos: sub === "presos" };
  v.innerHTML = `
    <div class="cabecalho"><div><div class="rotulo">Clientes</div><h1>Clientes do escritório</h1></div>
      <div class="acoes"><a class="btn primario" href="#/clientes/novo">${I.mais1} Novo cliente</a><a class="btn oculto-movel" href="#/importar">${I.pasta} Importar pastas</a></div></div>
    <div class="linha" style="margin-bottom:12px"><div class="busca">${I.busca}<input type="search" id="q" placeholder="Pesquisar por nome, CPF ou número do processo"></div>
      <select id="parc" style="width:auto;min-width:170px"><option value="">Todas as parcerias</option>${E.parceiros.map((p) => `<option>${esc(p.nome)}</option>`).join("")}</select></div>
    <div class="filtro" id="ft"><button data-f="recentes" class="ativo">Último ano</button><button data-f="todos">Todos</button><button data-f="presos">Réus presos</button>
      ${E.tipos.map((t) => `<button data-t="${t.id}">${esc(t.nome)}</button>`).join("")}</div>
    <p class="mudo pequeno" id="conta" style="margin:10px 2px"></p>
    <ul class="lista" id="lista"></ul>`;
  const desenhar = () => {
    const q = sem(st.q).trim(), qd = digitos(st.q);
    let l = todos.filter((c) => {
      if (q) {
        const ok = sem(c.nome).includes(q) || (qd.length >= 3 && (digitos(c.cpf).includes(qd) || c.processos.some((p) => digitos(p.numero).includes(qd))));
        if (!ok) return false;
      } else if (!st.todos && !st.presos && !st.tipo) {
        if (!c.ultima_atividade || c.ultima_atividade < limite) return false;
      }
      if (st.tipo && !c.processos.some((p) => p.tipo_id === st.tipo)) return false;
      if (st.presos && !c.processos.some((p) => p.reu_preso && p.situacao === "ativo")) return false;
      if (st.parceiro && !c.processos.some((p) => (p.parceiros || []).includes(st.parceiro))) return false;
      return true;
    });
    $("#conta", v).textContent = q ? `${l.length} resultado(s) para "${st.q}"` : st.todos ? `${l.length} clientes` : `${l.length} com atividade no último ano · ${todos.length} no total`;
    l = l.slice(0, 400);
    $("#lista", v).innerHTML = l.length ? l.map((c) => {
      const tipos = [...new Set(c.processos.map((p) => p.tipo_id))];
      return `<li><a class="item" href="#/cliente/${c.id}"><span class="iniciais">${esc(iniciais(c.nome))}</span>
        <div class="corpo"><div class="titulo">${esc(c.nome)}</div><div class="sub">${c.processos.length} processo${c.processos.length === 1 ? "" : "s"}${c.ultima_atividade ? ` · última atividade ${br(c.ultima_atividade)}` : ""}</div></div>
        <div class="lado chips oculto-movel">${tipos.slice(0, 2).map(chipTipo).join("")}</div></a></li>`;
    }).join("") : `<li class="vazio">${todos.length ? "Nenhum cliente neste filtro. Toque em “Todos” ou pesquise pelo nome." : "Nenhum cliente cadastrado ainda. Cadastre o primeiro em “Novo cliente” ou importe as pastas do OneDrive."}</li>`;
  };
  $("#q", v).oninput = (e) => { st.q = e.target.value; desenhar(); };
  $("#parc", v).onchange = (e) => { st.parceiro = e.target.value; desenhar(); };
  $$("#ft button", v).forEach((b) => (b.onclick = () => {
    $$("#ft button", v).forEach((x) => x.classList.remove("ativo")); b.classList.add("ativo");
    st.todos = b.dataset.f === "todos"; st.presos = b.dataset.f === "presos"; st.tipo = b.dataset.t ? Number(b.dataset.t) : null;
    desenhar();
  }));
  if (st.presos) $$("#ft button", v).forEach((b) => b.classList.toggle("ativo", b.dataset.f === "presos"));
  desenhar();
};

/* ---------- ficha do cliente (estilo SEEU) ---------- */
ROTAS.cliente = async (v, id, sub) => {
  if (sub === "editar") { const { data } = await sb.from("clientes").select("*").eq("id", id).single(); return formCliente(v, data); }
  const [cR, pR, mR, kR] = await Promise.all([
    sb.from("clientes").select("*").eq("id", id).single(),
    sb.from("processos").select("*").eq("cliente_id", id).order("criado_em"),
    sb.from("movimentacoes").select("*").eq("cliente_id", id).order("data", { ascending: false }).order("criado_em", { ascending: false }),
    sb.from("compromissos").select("*").eq("cliente_id", id).order("inicio", { ascending: false }),
  ]);
  if (cR.error) throw cR.error;
  const c = cR.data, procs = pR.data || [], movs = mR.data || [], comps = kR.data || [];
  const st = { proc: sessionStorage.getItem(`proc-${id}`) || (procs.length === 1 ? procs[0].id : "todos"), aba: "mov" };
  if (st.proc !== "todos" && !procs.find((p) => p.id === st.proc)) st.proc = "todos";

  const qualif = () => {
    const f = c.genero === "F";
    const end = [c.endereco, c.bairro, c.cidade && `${c.cidade}${c.uf ? `/${c.uf}` : ""}`, c.cep && `CEP ${c.cep}`].filter(Boolean).join(", ");
    return `${c.nome.toUpperCase()}, ${c.nacionalidade || (f ? "brasileira" : "brasileiro")}${c.estado_civil ? `, ${c.estado_civil}` : ""}${c.profissao ? `, ${c.profissao}` : ""}${c.rg ? `, ${f ? "portadora" : "portador"} do RG n. ${c.rg}${c.orgao_emissor ? ` ${c.orgao_emissor}` : ""}` : ""}${c.cpf ? ` e do CPF n. ${c.cpf}` : ""}${end ? `, ${f ? "residente e domiciliada" : "residente e domiciliado"} na ${end}` : ""}`;
  };

  v.innerHTML = `
    <div class="cabecalho"><div class="linha" style="gap:14px"><span class="iniciais" style="width:48px;height:48px;font-size:1rem">${esc(iniciais(c.nome))}</span>
      <div><div class="rotulo">Cliente${c.situacao === "arquivado" ? " · arquivado" : ""}</div><h1>${esc(c.nome)}</h1></div></div>
      <div class="acoes">
        <button class="btn" id="wa">${I.whats} WhatsApp</button>
        <a class="btn" href="#/cliente/${id}/editar">${I.editar} Editar</a>
        <button class="btn" id="qual">${I.copiar} Qualificação</button>
        <button class="btn" id="docs">${I.doc} Documentos</button>
        ${c.pasta ? `<button class="btn" id="pastaCli" title="${esc(c.pasta)}">${I.pasta} Abrir pasta</button>` : ""}
      </div></div>

    <details class="cartao" ${procs.length ? "" : "open"}><summary style="padding:14px 18px;cursor:pointer;font-weight:600">Dados pessoais</summary>
      <dl class="ficha">${[
        ["CPF", c.cpf], ["RG", [c.rg, c.orgao_emissor].filter(Boolean).join(" ")], ["Nascimento", br(c.nascimento)], ["Estado civil", c.estado_civil],
        ["Profissão", c.profissao], ["Mãe", c.nome_mae], ["Pai", c.nome_pai], ["Telefone", c.telefone], ["E-mail", c.email],
        ["Endereço", [c.endereco, c.bairro, c.cidade && `${c.cidade}/${c.uf || ""}`, c.cep].filter(Boolean).join(", ")],
        ["Pasta no OneDrive", c.pasta],
      ].filter(([, val]) => val).map(([k, val]) => `<div><dt>${k}${c.fontes?.[{ CPF: "cpf", RG: "rg", Nascimento: "nascimento", Mãe: "nome_mae", Pai: "nome_pai", Endereço: "endereco" }[k]] ? ` <span class="fonte" title="Origem do dado">· ${esc(c.fontes[{ CPF: "cpf", RG: "rg", Nascimento: "nascimento", Mãe: "nome_mae", Pai: "nome_pai", Endereço: "endereco" }[k]])}</span>` : ""}</dt><dd>${esc(val)}</dd></div>`).join("") || `<div class="mudo">Sem dados pessoais. Use Editar para completar ou ler o documento.</div>`}
      ${c.documento_path ? `<div><dt>Documento</dt><dd><button class="btn pq" id="verdoc">${I.doc} Ver documento</button></dd></div>` : ""}
      ${c.observacoes ? `<div style="grid-column:1/-1"><dt>Observações</dt><dd style="white-space:pre-wrap">${esc(c.observacoes)}</dd></div>` : ""}</dl></details>

    <div class="secao"><header><h2>Processos</h2><button class="btn pq" id="novoProc">${I.mais1} Novo processo</button></header>
      ${procs.length > 1 ? `<div class="proc-barra" id="pbar"><button data-p="todos"><b>Todos</b><span>${procs.length} processos</span></button>${procs.map((p) => `<button data-p="${p.id}"><b>${esc(p.numero ? fmtCNJ(p.numero) : "Sem número")}</b><span>${esc(tipoPorId(p.tipo_id)?.nome || "")}${p.situacao !== "ativo" ? ` · ${p.situacao}` : ""}</span></button>`).join("")}</div>` : ""}
      <div class="cartao" id="painel"></div></div>`;

  $("#wa", v).onclick = () => abrirWhats(c, `Olá, ${primeiroNome(c.nome)}! Aqui é o Dr. Pedro, do Natário Advocacia.\n\n`);
  $("#qual", v).onclick = () => copiar(qualif());
  $("#docs", v).onclick = () => window.abrirDocumentos(c, procs, procs.find((x) => x.id === st.proc) || null);
  $("#pastaCli", v)?.addEventListener("click", () => abrirPasta(c.pasta));
  $("#novoProc", v).onclick = () => formProcesso(c, null);
  $("#verdoc", v)?.addEventListener("click", async () => {
    const { data, error } = await sb.storage.from("documentos").createSignedUrl(c.documento_path, 300);
    if (error) return erro(error); window.open(data.signedUrl, "_blank", "noopener");
  });

  const painel = () => {
    $$("#pbar button", v).forEach((b) => b.classList.toggle("ativo", b.dataset.p === st.proc));
    const p = procs.find((x) => x.id === st.proc);
    const ms = st.proc === "todos" ? movs : movs.filter((m) => m.processo_id === st.proc);
    const ks = st.proc === "todos" ? comps : comps.filter((k) => k.processo_id === st.proc);
    const el = $("#painel", v);
    if (!procs.length) {
      el.innerHTML = `<div class="vazio">Nenhum processo cadastrado. Cadastre o primeiro para separar movimentações e agenda por processo.</div>${tabelaMovs(ms, null)}`;
    } else {
      const sis = p ? detectarSistema(p) : null;
      el.innerHTML = `
        ${p ? `<div class="proc-cab"><div><div class="rotulo">${esc(tipoPorId(p.tipo_id)?.nome || "Processo")}${p.reu_preso ? " · réu preso" : ""}</div>
            <div class="numero">${esc(p.numero ? fmtCNJ(p.numero) : "Sem número")}</div>
            ${(p.parceiros || []).length ? `<div class="parceria">Em parceria com ${esc(p.parceiros.join(", "))}</div>` : ""}</div>
          <div class="acoes">${p.numero || p.url_consulta ? `<button class="btn pq primario" id="consultar">${I.externo} Consultar no sistema${sis ? ` · ${SISTEMAS[sis].nome}` : ""}</button>` : ""}
            ${p.pasta && p.pasta !== c.pasta ? `<button class="btn pq" id="pastaProc">${I.pasta} Pasta</button>` : ""}
            <button class="btn pq" id="edProc">${I.editar} Editar</button></div></div>` : `<div class="proc-cab"><div><div class="rotulo">Todos os processos</div><div class="numero">${procs.length} processos</div></div></div>`}
        <div class="subabas">${p ? `<button data-a="info">Informações gerais</button><button data-a="partes">Partes</button>` : ""}<button data-a="mov">Movimentações (${ms.length})</button><button data-a="agenda">Agenda (${ks.length})</button></div>
        <div id="aba"></div>`;
      $("#consultar", el)?.addEventListener("click", () => consultarNoSistema(p));
      $("#edProc", el)?.addEventListener("click", () => formProcesso(c, p));
      $("#pastaProc", el)?.addEventListener("click", () => abrirPasta(p.pasta));
      $$(".subabas button", el).forEach((b) => (b.onclick = () => { st.aba = b.dataset.a; aba(); }));
      if (!p && ["info", "partes"].includes(st.aba)) st.aba = "mov";
    }
    const aba = () => {
      $$(".subabas button", el).forEach((b) => b.classList.toggle("ativo", b.dataset.a === st.aba));
      const a = $("#aba", el); if (!a) return;
      if (st.aba === "info" && p) {
        a.innerHTML = `<dl class="pares">${[
          ["Número", p.numero && fmtCNJ(p.numero)], ["Classe / tipo", tipoPorId(p.tipo_id)?.nome], ["Assunto", p.assunto], ["Comarca", p.comarca], ["Vara / órgão", p.vara],
          ["Fase", p.fase], ["Situação", p.situacao], ["Réu preso", p.reu_preso ? "Sim" : "Não"], ["Sistema", detectarSistema(p) ? SISTEMAS[detectarSistema(p)].nome : p.url_consulta ? "Endereço próprio" : "Não identificado"],
          ["Pasta", p.pasta], ["Arquivos dos autos", (p.arquivos || []).join("\n")], ["Observações", p.observacoes],
        ].filter(([, x]) => x).map(([k, x]) => `<dt>${k}</dt><dd style="white-space:pre-wrap">${esc(x)}</dd>`).join("")}</dl>`;
      } else if (st.aba === "partes" && p) {
        a.innerHTML = `<dl class="pares"><dt>Cliente</dt><dd>${esc(c.nome)}</dd>${p.parte_contraria ? `<dt>Parte contrária / vítima</dt><dd>${esc(p.parte_contraria)}</dd>` : ""}
          <dt>Advogados</dt><dd>Pedro Henrique O. Natário Silveira (OAB/AL 17.023)${(p.parceiros || []).map((n) => `<br>${esc(n)}`).join("")}</dd></dl>`;
      } else if (st.aba === "agenda") {
        a.innerHTML = `<div style="padding:12px 14px"><button class="btn pq" id="novoComp">${I.mais1} Novo compromisso</button></div>${ks.length ? `<ul class="lista" style="border:0;border-radius:0;border-top:1px solid var(--line)">${ks.map((k) => itemComp({ ...k, clientes: c })).join("")}</ul>` : `<div class="vazio">Sem compromissos.</div>`}`;
        $("#novoComp", a).onclick = () => formCompromisso({ cliente: c, processo_id: p?.id || null });
        ligarItensComp(a, ks.map((k) => ({ ...k, clientes: c })));
      } else {
        a.innerHTML = formMov(p) + tabelaMovs(ms, p ? null : procs);
        ligarFormMov(a, c, p, procs);
        ligarTabelaMovs(a, ms, c, procs);
      }
    };
    if (procs.length) aba(); else { ligarTabelaMovs(el, ms, c, procs); el.insertAdjacentHTML("afterbegin", formMov(null)); ligarFormMov(el, c, null, procs); }
  };
  $$("#pbar button", v).forEach((b) => (b.onclick = () => { st.proc = b.dataset.p; try { sessionStorage.setItem(`proc-${id}`, st.proc); } catch { /* */ } painel(); }));
  painel();
};

const ROT_MOV = { andamento: "Andamento", observacao: "Observação", audiencia: "Audiência", prazo: "Prazo", decisao: "Decisão", anotacao: "Anotação" };
const ROT_ORIGEM = { app: "App", chrome: "Chrome", compartilhar: "Compartilhado", importacao: "Importação", claude: "Claude", push: "Push" };
function formMov() {
  return `<form class="mov-form" style="padding:14px;display:flex;flex-direction:column;gap:10px;border-bottom:1px solid var(--line)">
    <div class="grade" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
      <label class="campo"><span>Data</span><input type="date" name="data" value="${hoje()}"></label>
      <label class="campo"><span>Tipo</span><select name="tipo">${Object.entries(ROT_MOV).map(([k, x]) => `<option value="${k}">${x}</option>`).join("")}</select></label>
      <label class="campo quando" hidden><span>Dia da audiência / prazo</span><input type="date" name="dataComp"></label>
      <label class="campo quando" hidden><span>Hora</span><input type="time" name="horaComp"></label>
    </div>
    <textarea name="texto" rows="2" placeholder="Novo andamento ou observação importante…"></textarea>
    <div class="linha"><button class="btn primario pq">Lançar movimentação</button><span class="mudo pequeno quando" hidden>Também entra na agenda, com lembrete 5 dias antes.</span></div></form>`;
}
function ligarFormMov(raiz, cliente, processo, procs) {
  const f = $(".mov-form", raiz); if (!f) return;
  const proc = processo || (procs.length === 1 ? procs[0] : null);
  f.tipo.onchange = () => $$(".quando", f).forEach((x) => (x.hidden = !["audiencia", "prazo"].includes(f.tipo.value)));
  f.onsubmit = async (e) => {
    e.preventDefault();
    const texto = f.texto.value.trim(); if (!texto) return;
    const { error } = await sb.from("movimentacoes").insert({ cliente_id: cliente.id, processo_id: proc?.id || null, data: f.data.value || hoje(), tipo: f.tipo.value, texto, origem: "app" });
    if (error) return erro(error);
    if (["audiencia", "prazo"].includes(f.tipo.value) && f.dataComp.value) {
      await sb.from("compromissos").insert({ cliente_id: cliente.id, processo_id: proc?.id || null, tipo: f.tipo.value,
        titulo: `${f.tipo.value === "prazo" ? "Prazo" : "Audiência"} – ${nomeCurto(cliente.nome)}`, inicio: isoLocal(f.dataComp.value, f.horaComp.value), dia_inteiro: !f.horaComp.value, observacoes: texto });
    }
    toast("Movimentação lançada"); rota();
  };
}
function tabelaMovs(ms, procs) {
  if (!ms.length) return `<div class="vazio">Sem movimentações registradas.</div>`;
  const total = ms.length;
  return `<div class="movs"><table><thead><tr><th>Seq.</th><th>Data</th><th>Evento</th><th>Origem</th><th></th></tr></thead><tbody>
    ${ms.map((m, i) => `<tr><td class="seq">${total - i}</td><td class="dt">${br(m.data)}</td>
      <td class="ev"><span class="tipo-mov tipo-${m.tipo}">${ROT_MOV[m.tipo] || m.tipo}</span>${procs && m.processo_id ? ` <span class="mudo pequeno">· ${esc(fmtCNJ(procs.find((p) => p.id === m.processo_id)?.numero || ""))}</span>` : ""}<div class="txt">${esc(m.texto)}</div>${m.url ? `<a class="pequeno" href="${esc(m.url)}" target="_blank" rel="noopener">abrir origem</a>` : ""}</td>
      <td class="or">${ROT_ORIGEM[m.origem] || m.origem}</td>
      <td class="ac"><button class="btn pq fantasma" data-wm="${m.id}" title="Enviar ao cliente">${I.whats}</button><button class="btn pq fantasma" data-em="${m.id}" title="Editar">${I.editar}</button></td></tr>`).join("")}
  </tbody></table></div>`;
}
function ligarTabelaMovs(raiz, ms, cliente, procs) {
  $$("[data-wm]", raiz).forEach((b) => (b.onclick = () => { const m = ms.find((x) => x.id === b.dataset.wm); abrirWhats(cliente, textoWhatsMov(m, cliente, procs.find((p) => p.id === m.processo_id))); }));
  $$("[data-em]", raiz).forEach((b) => (b.onclick = () => {
    const m = ms.find((x) => x.id === b.dataset.em);
    const d = dialogo(`<form><h2>Movimentação</h2>
      <div class="grade"><label class="campo"><span>Data</span><input type="date" id="md" value="${m.data}"></label>
      <label class="campo"><span>Tipo</span><select id="mt">${Object.entries(ROT_MOV).map(([k, x]) => `<option value="${k}" ${k === m.tipo ? "selected" : ""}>${x}</option>`).join("")}</select></label>
      <label class="campo"><span>Processo</span><select id="mp"><option value="">Sem processo</option>${procs.map((p) => `<option value="${p.id}" ${p.id === m.processo_id ? "selected" : ""}>${esc(p.numero ? fmtCNJ(p.numero) : "Sem número")}</option>`).join("")}</select></label></div>
      <textarea id="mx" rows="6">${esc(m.texto)}</textarea>
      <div class="pe-dialogo"><button class="btn perigo" id="del">${I.lixo} Excluir</button><span style="flex:1"></span><button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="sv">Salvar</button></div></form>`);
    $("#sv", d).onclick = async (e) => { e.preventDefault(); const { error } = await sb.from("movimentacoes").update({ data: $("#md", d).value, tipo: $("#mt", d).value, processo_id: $("#mp", d).value || null, texto: $("#mx", d).value }).eq("id", m.id); if (error) return erro(error); d.close(); rota(); };
    $("#del", d).onclick = async (e) => { e.preventDefault(); if (!(await confirmar("Excluir esta movimentação?"))) return; await sb.from("movimentacoes").delete().eq("id", m.id); d.close(); rota(); };
  }));
}

/* ---------- formulário de processo ---------- */
function formProcesso(cliente, p) {
  const d = dialogo(`<form><h2>${p ? "Editar processo" : "Novo processo"}</h2>
    <div class="grade">
      <label class="campo largo"><span>Número (CNJ)</span><input type="text" id="pn" value="${esc(p?.numero || "")}" placeholder="0000000-00.0000.8.02.0000" inputmode="numeric"></label>
      <label class="campo"><span>Tipo</span><select id="pt">${E.tipos.map((t) => `<option value="${t.id}" ${t.id === p?.tipo_id ? "selected" : ""}>${esc(t.nome)}</option>`).join("")}</select></label>
      <label class="campo"><span>Situação</span><select id="ps">${["ativo", "suspenso", "arquivado"].map((s) => `<option ${s === (p?.situacao || "ativo") ? "selected" : ""}>${s}</option>`).join("")}</select></label>
      <label class="campo"><span>Comarca</span><input type="text" id="pc" value="${esc(p?.comarca || "")}"></label>
      <label class="campo"><span>Vara / órgão</span><input type="text" id="pv" value="${esc(p?.vara || "")}"></label>
      <label class="campo"><span>Assunto</span><input type="text" id="pa" value="${esc(p?.assunto || "")}" placeholder="ex.: tráfico, art. 155"></label>
      <label class="campo"><span>Parte contrária / vítima</span><input type="text" id="pcon" value="${esc(p?.parte_contraria || "")}"></label>
      <label class="campo"><span>Fase</span><input type="text" id="pf" value="${esc(p?.fase || "")}" placeholder="ex.: instrução, recurso"></label>
      <label class="campo"><span>Sistema de consulta</span><select id="psis"><option value="">Detectar pelo número</option>${Object.entries(SISTEMAS).map(([k, s]) => `<option value="${k}" ${k === p?.sistema ? "selected" : ""}>${s.nome}</option>`).join("")}</select></label>
      <label class="campo largo"><span>Endereço próprio de consulta (opcional)</span><input type="text" id="pu" value="${esc(p?.url_consulta || "")}" placeholder="https://"></label>
      <label class="check largo"><input type="checkbox" id="pp" ${p?.reu_preso ? "checked" : ""}> Réu preso (prazos correm no recesso – CPP, art. 798-A)</label>
      <div class="largo"><span class="mudo pequeno">Parceria</span><div class="chips" style="margin-top:6px">${E.parceiros.map((x) => `<label class="check" style="margin-right:12px"><input type="checkbox" value="${esc(x.nome)}" class="parc" ${(p?.parceiros || []).includes(x.nome) ? "checked" : ""}> ${esc(x.nome)}</label>`).join("")}</div></div>
      <label class="campo largo"><span>Observações</span><textarea id="po" rows="3">${esc(p?.observacoes || "")}</textarea></label>
    </div>
    <div class="pe-dialogo">${p ? `<button class="btn perigo" id="del">${I.lixo} Excluir</button><span style="flex:1"></span>` : ""}<button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="sv">Salvar</button></div></form>`);
  $("#sv", d).onclick = async (e) => {
    e.preventDefault();
    const reg = { cliente_id: cliente.id, numero: fmtCNJ($("#pn", d).value.trim()) || null, tipo_id: Number($("#pt", d).value), situacao: $("#ps", d).value,
      comarca: $("#pc", d).value || null, vara: $("#pv", d).value || null, assunto: $("#pa", d).value || null, parte_contraria: $("#pcon", d).value || null,
      fase: $("#pf", d).value || null, sistema: $("#psis", d).value || null, url_consulta: $("#pu", d).value || null, reu_preso: $("#pp", d).checked,
      parceiros: $$(".parc", d).filter((x) => x.checked).map((x) => x.value), observacoes: $("#po", d).value || null };
    const q = p ? sb.from("processos").update(reg).eq("id", p.id) : sb.from("processos").insert(reg);
    const { error } = await q; if (error) return erro(error);
    d.close(); toast("Processo salvo"); rota();
  };
  $("#del", d)?.addEventListener("click", async (e) => { e.preventDefault(); if (!(await confirmar("Excluir este processo? As movimentações ficam no cliente, sem processo."))) return; await sb.from("processos").delete().eq("id", p.id); d.close(); rota(); });
}

/* ---------- formulário do cliente + leitura de documento ---------- */
const CAMPOS = [["nome", "Nome completo", "largo"], ["cpf", "CPF"], ["rg", "RG"], ["orgao_emissor", "Órgão emissor"], ["nascimento", "Nascimento", "", "date"],
  ["genero", "Gênero", "", "genero"], ["estado_civil", "Estado civil"], ["profissao", "Profissão"], ["nacionalidade", "Nacionalidade"], ["nome_mae", "Nome da mãe", "largo"],
  ["nome_pai", "Nome do pai", "largo"], ["telefone", "Telefone / WhatsApp", "", "tel"], ["email", "E-mail", "", "email"], ["endereco", "Endereço (rua e número)", "largo"],
  ["bairro", "Bairro"], ["cidade", "Cidade"], ["uf", "UF"], ["cep", "CEP"], ["pasta", "Pasta no OneDrive", "largo"], ["observacoes", "Observações", "largo", "area"]];
async function formCliente(v, c) {
  const novo = !c; c = c || { nacionalidade: "brasileira", fontes: {} };
  let docArquivo = null; let procsLidos = []; let parceirosLidos = [];
  v.innerHTML = `
    <div class="cabecalho"><div><div class="rotulo">${novo ? "Novo cliente" : "Editar cliente"}</div><h1>${esc(novo ? "Cadastro" : c.nome)}</h1></div></div>
    <div class="cartao" style="padding:18px;display:flex;flex-direction:column;gap:14px">
      <div class="linha" style="justify-content:space-between"><div><h3>Ler documento</h3><p class="mudo pequeno" style="margin:2px 0 0">RG, CNH, comprovante de residência ou peças do processo. Pode tirar foto ou escolher arquivos (vários de uma vez).</p></div>
        <label class="btn dourado">${I.doc} Escolher documentos<input type="file" id="arq" accept="image/*,application/pdf" multiple hidden></label></div>
      <div id="leitura" class="pequeno mudo" hidden></div>
    </div>
    <form id="fc" class="cartao" style="padding:18px;margin-top:14px;display:flex;flex-direction:column;gap:16px">
      <div class="grade">${CAMPOS.map(([k, rot, cls, tipo]) => {
        const val = c[k] ?? "";
        const fonte = c.fontes?.[k] ? `<span class="fonte">· ${esc(c.fontes[k])}</span>` : "";
        if (tipo === "area") return `<label class="campo ${cls}"><span>${rot}</span><textarea name="${k}" rows="3">${esc(val)}</textarea></label>`;
        if (tipo === "genero") return `<label class="campo"><span>${rot}</span><select name="genero"><option value="">—</option><option value="M" ${val === "M" ? "selected" : ""}>Masculino</option><option value="F" ${val === "F" ? "selected" : ""}>Feminino</option></select></label>`;
        return `<label class="campo ${cls || ""}"><span>${rot} ${fonte}</span><input type="${tipo || "text"}" name="${k}" value="${esc(val)}" ${k === "nome" ? "required" : ""}></label>`;
      }).join("")}</div>
      <div id="procsLidos"></div>
      <div class="linha">${!novo ? `<button type="button" class="btn perigo" id="arquivar">${c.situacao === "arquivado" ? "Reativar cliente" : "Arquivar cliente"}</button>` : ""}<span style="flex:1"></span>
        <a class="btn" href="${novo ? "#/clientes" : `#/cliente/${c.id}`}">Cancelar</a><button class="btn primario">Salvar</button></div>
    </form>`;
  const f = $("#fc", v);
  $("#arq", v).onchange = async (e) => {
    const arquivos = [...e.target.files]; if (!arquivos.length) return;
    const st = $("#leitura", v); st.hidden = false; st.textContent = "Lendo documento…";
    try {
      const preparados = [];
      for (const a of arquivos.slice(0, 6)) preparados.push(await prepararArquivo(a));
      docArquivo = arquivos.find((a) => a.type.startsWith("image/")) || null;
      const { data, error } = await sb.functions.invoke("ler-documento", { body: { arquivos: preparados } });
      if (error) throw new Error((await error.context?.json?.())?.erro || error.message);
      if (data.erro) throw new Error(data.erro);
      const dd = data.dados || {}; c.fontes = { ...(c.fontes || {}), ...(data.fontes || {}) };
      let n = 0;
      for (const [k, val] of Object.entries(dd)) {
        if (val && f[k] && !f[k].value) { f[k].value = val; n++; }
        else if (val && f[k] && f[k].value !== String(val)) f[k].title = `No documento: ${val}`;
      }
      procsLidos = (data.processos || []).filter((p) => p.numero);
      parceirosLidos = (data.advogados || []).map((nome) => E.parceiros.find((p) => sem(nome).includes(sem(p.nome).split(" ")[0]) && sem(nome).includes(sem(p.nome).split(" ").slice(-1)[0]))?.nome).filter(Boolean);
      $("#procsLidos", v).innerHTML = procsLidos.length ? `<div class="pequeno"><b>Processos encontrados nos documentos:</b>${procsLidos.map((p, i) => `<label class="check" style="margin-top:6px"><input type="checkbox" class="pl" data-i="${i}" checked> ${esc(fmtCNJ(p.numero))}${p.comarca ? ` · ${esc(p.comarca)}` : ""}${p.assunto ? ` · ${esc(p.assunto)}` : ""}</label>`).join("")}${parceirosLidos.length ? `<p class="parceria">Assinado em parceria com ${esc(parceirosLidos.join(", "))}</p>` : ""}</div>` : "";
      st.textContent = `${n} campo(s) preenchido(s). Confira CPF e RG antes de salvar.${data.observacao ? ` Obs.: ${data.observacao}` : ""}`;
    } catch (err) { st.textContent = `Não foi possível ler: ${err.message}`; }
  };
  $("#arquivar", v)?.addEventListener("click", async () => {
    await sb.from("clientes").update({ situacao: c.situacao === "arquivado" ? "ativo" : "arquivado" }).eq("id", c.id); location.hash = `#/cliente/${c.id}`;
  });
  f.onsubmit = async (e) => {
    e.preventDefault();
    const reg = {}; CAMPOS.forEach(([k]) => (reg[k] = f[k].value.trim() || null));
    reg.fontes = c.fontes || {};
    if (reg.cpf && novo) {
      const { data: dup } = await sb.from("clientes").select("id, nome").eq("cpf", reg.cpf).limit(1);
      if (dup?.length && !(await confirmar(`Já existe ${dup[0].nome} com este CPF. Cadastrar mesmo assim?`, "Cadastrar"))) return;
    }
    let id = c.id;
    if (novo) { const { data, error } = await sb.from("clientes").insert(reg).select("id").single(); if (error) return erro(error); id = data.id; }
    else { const { error } = await sb.from("clientes").update(reg).eq("id", id); if (error) return erro(error); }
    if (docArquivo) {
      try {
        const blob = await comprimir(docArquivo, 1600, 0.8);
        const caminho = `${id}/documento-${Date.now()}.jpg`;
        const up = await sb.storage.from("documentos").upload(caminho, blob, { contentType: "image/jpeg" });
        if (!up.error) await sb.from("clientes").update({ documento_path: caminho }).eq("id", id);
      } catch (err) { console.warn(err); }
    }
    const marcados = $$(".pl", v).filter((x) => x.checked).map((x) => procsLidos[Number(x.dataset.i)]);
    for (const p of marcados) {
      const { data: ex } = await sb.from("processos").select("id").eq("numero_limpo", digitos(p.numero)).limit(1);
      if (!ex?.length) await sb.from("processos").insert({ cliente_id: id, numero: fmtCNJ(p.numero), comarca: p.comarca || null, vara: p.vara || null, assunto: p.assunto || null, tipo_id: E.tipos[0]?.id, parceiros: parceirosLidos });
    }
    toast("Cliente salvo"); location.hash = `#/cliente/${id}`;
  };
}

/* imagens: reduz e converte para JPEG; PDF vai inteiro */
async function comprimir(arquivo, max = 1800, q = 0.82) {
  const img = await createImageBitmap(arquivo);
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const cv = document.createElement("canvas"); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
  cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
  return await new Promise((r) => cv.toBlob(r, "image/jpeg", q));
}
const paraBase64 = (blob) => new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(",")[1]); fr.readAsDataURL(blob); });
async function prepararArquivo(a) {
  if (a.type === "application/pdf") {
    if (a.size > 20 * 1024 * 1024) throw new Error(`${a.name} é grande demais (máx. 20 MB). Envie só as páginas da qualificação.`);
    return { nome: a.name, media_type: "application/pdf", data: await paraBase64(a) };
  }
  const b = await comprimir(a);
  return { nome: a.name, media_type: "image/jpeg", data: await paraBase64(b) };
}
Object.assign(window.Natario, { comprimir, paraBase64, prepararArquivo, itemComp, ligarItensComp, campoCliente, ligarCampoCliente, localDT, isoLocal, linkLembrete, abrirWhats });

/* ================= AGENDA ================= */
ROTAS.agenda = async (v, filtro) => {
  const st = { filtro: filtro || "pendentes" };
  v.innerHTML = `
    <div class="cabecalho"><div><div class="rotulo">Agenda</div><h1>Audiências e prazos</h1></div>
      <div class="acoes"><button class="btn primario" id="novo">${I.mais1} Novo compromisso</button><button class="btn" id="colar">Colar audiências</button></div></div>
    <div class="filtro" id="ft"><button data-f="pendentes">Pendentes</button><button data-f="audiencias">Audiências</button><button data-f="prazos">Prazos</button><button data-f="realizadas">Realizadas</button></div>
    <div id="lista" style="margin-top:14px"></div>`;
  $("#novo", v).onclick = () => formCompromisso({});
  $("#colar", v).onclick = colarAudiencias;
  const desenhar = async () => {
    $$("#ft button", v).forEach((b) => b.classList.toggle("ativo", b.dataset.f === st.filtro));
    let q = sb.from("compromissos").select("*, clientes(nome, telefone), processos(numero)");
    if (st.filtro === "realizadas") q = q.or(`concluido.eq.true,inicio.lt.${isoLocal(hoje(), "00:00")}`).order("inicio", { ascending: false }).limit(200);
    else {
      q = q.eq("concluido", false).order("inicio");
      if (st.filtro === "audiencias") q = q.eq("tipo", "audiencia").gte("inicio", isoLocal(hoje(), "00:00"));
      else if (st.filtro === "prazos") q = q.eq("tipo", "prazo");
      else q = q.gte("inicio", isoLocal(C.soma(hoje(), -30), "00:00"));
    }
    const { data, error } = await q; if (error) return erro(error);
    const grupos = {};
    for (const c of data || []) { const k = localDT(c.inicio).data.slice(0, 7); (grupos[k] = grupos[k] || []).push(c); }
    const nomesMes = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    $("#lista", v).innerHTML = Object.keys(grupos).length ? Object.entries(grupos).map(([k, cs]) => `<div class="secao" style="margin-top:18px"><header><h2 style="text-transform:capitalize">${nomesMes[Number(k.slice(5)) - 1]} de ${k.slice(0, 4)}</h2><span class="mudo pequeno">${cs.length}</span></header><ul class="lista">${cs.map(itemComp).join("")}</ul></div>`).join("")
      : `<div class="cartao vazio">Nada por aqui. Use “Novo compromisso”, “Colar audiências” ou o botão + para anotar.</div>`;
    ligarItensComp(v, data || []);
  };
  $$("#ft button", v).forEach((b) => (b.onclick = () => { st.filtro = b.dataset.f; desenhar(); }));
  desenhar();
};

function formCompromisso({ cliente = null, processo_id = null, comp = null }) {
  const c0 = comp ? localDT(comp.inicio) : { data: hoje(), hora: "" };
  const d = dialogo(`<form><h2>${comp ? "Editar compromisso" : "Novo compromisso"}</h2>
    ${campoCliente("cli", cliente)}
    <div class="grade">
      <label class="campo"><span>Tipo</span><select id="ct">${Object.entries(ROT_COMP).map(([k, x]) => `<option value="${k}" ${k === comp?.tipo ? "selected" : ""}>${x}</option>`).join("")}</select></label>
      <label class="campo"><span>Data</span><input type="date" id="cd" value="${c0.data}" required></label>
      <label class="campo"><span>Hora</span><input type="time" id="ch" value="${comp?.dia_inteiro ? "" : c0.hora}"></label>
      <label class="campo"><span>Processo</span><select id="cp"><option value="">—</option></select></label>
      <label class="campo largo"><span>Título</span><input type="text" id="cti" value="${esc(comp?.titulo || "")}" placeholder="ex.: Audiência de instrução – Fulano"></label>
      <label class="campo largo"><span>Local</span><input type="text" id="cl" value="${esc(comp?.local || "")}"></label>
      <label class="campo largo"><span>Observações</span><textarea id="co" rows="3">${esc(comp?.observacoes || "")}</textarea></label>
    </div>
    <div class="pe-dialogo"><button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="sv">Salvar</button></div></form>`);
  const carregaProc = async (cid) => {
    const { data } = await sb.from("processos").select("id, numero").eq("cliente_id", cid);
    $("#cp", d).innerHTML = `<option value="">—</option>` + (data || []).map((p) => `<option value="${p.id}" ${p.id === (comp?.processo_id || processo_id) ? "selected" : ""}>${esc(p.numero ? fmtCNJ(p.numero) : "Sem número")}</option>`).join("");
  };
  ligarCampoCliente(d, "cli", carregaProc);
  if (cliente?.id) carregaProc(cliente.id);
  $("#sv", d).onclick = async (e) => {
    e.preventDefault();
    const cid = $("#cli", d).value || null; const tipo = $("#ct", d).value;
    const nome = $("#cli-q", d).value;
    const reg = { cliente_id: cid, processo_id: $("#cp", d).value || null, tipo, inicio: isoLocal($("#cd", d).value, $("#ch", d).value), dia_inteiro: !$("#ch", d).value,
      titulo: $("#cti", d).value.trim() || `${ROT_COMP[tipo][0].toUpperCase()}${ROT_COMP[tipo].slice(1)}${nome ? ` – ${nomeCurto(nome)}` : ""}`, local: $("#cl", d).value || null, observacoes: $("#co", d).value || null };
    const { error } = comp ? await sb.from("compromissos").update(reg).eq("id", comp.id) : await sb.from("compromissos").insert(reg);
    if (error) return erro(error); d.close(); toast("Salvo na agenda"); rota();
  };
}

/* Colar bloco de notas com várias audiências */
function colarAudiencias() {
  const d = dialogo(`<div class="conteudo"><h2>Colar audiências</h2>
    <p class="mudo pequeno">Cole o bloco de notas inteiro. O sistema separa cada audiência, identifica cliente e data e mostra a prévia antes de gravar.</p>
    <textarea id="bloco" rows="10"></textarea>
    <div id="previa"></div>
    <div class="pe-dialogo"><button class="btn" data-fechar>Fechar</button><button class="btn primario" id="ler">Analisar</button></div></div>`);
  d.style.width = "min(860px, calc(100vw - 24px))";
  let itens = [];
  $("#ler", d).onclick = async (e) => {
    const b = e.target;
    if (b.dataset.etapa === "gravar") return gravar();
    const texto = $("#bloco", d).value.trim(); if (!texto) return;
    b.disabled = true; b.textContent = "Analisando…";
    try {
      const { data, error } = await sb.functions.invoke("capturar", { body: { texto, modo: "lote", origem: "app" } });
      if (error) throw error; itens = data.itens || [];
      const linha = (it, i) => `<tr><td><input type="checkbox" class="sel" data-i="${i}" checked></td><td class="num">${br(it.data)}${it.hora ? ` ${it.hora}` : ""}</td>
        <td>${esc(it.titulo || "")}<div class="mudo pequeno">${esc(it.trecho || "")}</div></td>
        <td>${it.cliente ? esc(it.cliente.nome) : `<select class="cs" data-i="${i}"><option value="">Sem cliente (cria só na agenda)</option>${(it.sugestoes || []).map((s) => `<option value="${s.id}">${esc(s.nome)}</option>`).join("")}<option value="novo">Cadastrar “${esc(it.nome_cliente || "")}”</option></select>`}</td></tr>`;
      const pend = itens.map((x, i) => [x, i]).filter(([x]) => x.situacao === "pendente");
      const real = itens.map((x, i) => [x, i]).filter(([x]) => x.situacao === "realizada");
      const tab = (lista) => `<div class="tabela"><table><thead><tr><th></th><th>Data</th><th>Audiência</th><th>Cliente</th></tr></thead><tbody>${lista.map(([x, i]) => linha(x, i)).join("")}</tbody></table></div>`;
      const aviso = data.falhas ? `<p class="aviso">${data.falhas} de ${data.partes} parte(s) do bloco não puderam ser lidas. Grave estas e cole de novo só o trecho que faltou.</p>` : "";
      if (!itens.length) { $("#previa", d).innerHTML = `${aviso}<p class="mudo">Não encontrei audiências com data neste texto. Confira se colou o bloco inteiro.</p>`; b.disabled = false; b.textContent = "Analisar"; return; }
      $("#previa", d).innerHTML = aviso + `<h3 style="margin-top:8px">Pendentes (${pend.length})</h3>${pend.length ? tab(pend) : `<p class="mudo">Nenhuma.</p>`}
        <h3 style="margin-top:14px">Realizadas (${real.length})</h3>${real.length ? tab(real) : `<p class="mudo">Nenhuma.</p>`}`;
      b.dataset.etapa = "gravar"; b.textContent = `Gravar selecionadas`;
    } catch (err) { erro(err); b.textContent = "Analisar"; }
    b.disabled = false;
  };
  async function gravar() {
    let n = 0, falhou = 0;
    for (const x of $$(".sel", d).filter((x) => x.checked)) {
      const it = itens[Number(x.dataset.i)];
      let cid = it.cliente?.id || $(`.cs[data-i="${x.dataset.i}"]`, d)?.value || null;
      if (cid === "novo") { const { data } = await sb.from("clientes").insert({ nome: it.nome_cliente }).select("id").single(); cid = data?.id || null; }
      const realizada = it.situacao === "realizada";
      await sb.from("compromissos").insert({ cliente_id: cid, processo_id: it.processo?.id || null, tipo: it.tipo || "audiencia", titulo: it.titulo || it.trecho?.slice(0, 120) || "Audiência",
        inicio: isoLocal(it.data, it.hora), dia_inteiro: !it.hora, local: it.local || null, observacoes: [it.trecho, it.observacao].filter(Boolean).join("\n"), concluido: realizada });
      if (e1) { falhou++; console.error(e1); continue; }
      if (realizada && cid) await sb.from("movimentacoes").insert({ cliente_id: cid, processo_id: it.processo?.id || null, data: it.data, tipo: "audiencia", texto: [it.titulo, it.observacao].filter(Boolean).join(" — "), origem: "importacao" });
      n++;
    }
    d.close(); toast(`${n} audiência(s) gravada(s)${falhou ? ` · ${falhou} com erro` : ""}`, falhou ? 6000 : 3200); rota();
  }
}

/* ================= TESES ================= */
ROTAS.teses = async (v) => {
  const st = { q: "", trib: "", tema: "", fav: false };
  const { data: temasR } = await sb.from("teses").select("tema");
  const temas = [...new Set((temasR || []).map((t) => t.tema))].sort();
  v.innerHTML = `
    <div class="cabecalho"><div><div class="rotulo">Banco de teses</div><h1>Jurisprudência criminal</h1>
      <p class="mudo pequeno" style="margin:4px 0 0">Alimentado toda semana com os informativos do STJ e do STF. Resumos automáticos: confira o inteiro teor antes de citar.</p></div>
      <div class="acoes"><button class="btn" id="buscarAgora">Buscar novidades agora</button><button class="btn primario" id="nova">${I.mais1} Nova tese</button></div></div>
    <div class="linha"><div class="busca">${I.busca}<input type="search" id="q" placeholder="Palavra, tema ou número do julgado"></div>
      <select id="tema" style="width:auto"><option value="">Todos os temas</option>${temas.map((t) => `<option>${esc(t)}</option>`).join("")}</select></div>
    <div class="filtro" id="ft" style="margin-top:10px"><button data-t="" class="ativo">Todas</button><button data-t="STJ">STJ</button><button data-t="STF">STF</button><button data-t="manual">Minhas</button><button data-t="fav">Favoritas</button></div>
    <div id="lista" style="display:flex;flex-direction:column;gap:12px;margin-top:14px"></div>`;
  const desenhar = async () => {
    let q = st.q.trim() ? sb.rpc("buscar_teses", { q: st.q.trim(), lim: 100 }) : sb.from("teses").select("*").order("data_julgamento", { ascending: false, nullsFirst: false }).order("criado_em", { ascending: false }).limit(100);
    if (st.trib === "manual") q = q.eq("manual", true); else if (st.trib === "fav") q = q.eq("favorita", true); else if (st.trib) q = q.eq("tribunal", st.trib);
    if (st.tema) q = q.eq("tema", st.tema);
    const { data, error } = await q; if (error) return erro(error);
    $("#lista", v).innerHTML = (data || []).length ? data.map((t) => `<article class="cartao tese">
      <div class="linha" style="justify-content:space-between"><span class="rotulo">${esc(t.tribunal)}${t.orgao ? ` · ${esc(t.orgao)}` : ""} · ${esc(t.tema)}</span>
        <span class="chips">${t.conferida ? `<span class="chip">${I.ok} conferida</span>` : ""}</span></div>
      <h3>${esc(t.titulo)}</h3><p>${esc(t.tese)}</p>
      <div class="pe"><span class="mudo pequeno">${esc([t.julgado, t.relator, t.data_julgamento && br(t.data_julgamento), t.fonte].filter(Boolean).join(" · "))}</span>
        <span class="linha">${t.link ? `<a class="btn pq fantasma" href="${esc(t.link)}" target="_blank" rel="noopener">${I.externo} Fonte</a>` : ""}
        <button class="btn pq fantasma" data-cp="${t.id}">${I.copiar} Copiar</button>
        <button class="btn pq fantasma" data-cf="${t.id}">${t.conferida ? "Desmarcar" : "Marcar conferida"}</button>
        <button class="btn pq fantasma" data-fv="${t.id}">${t.favorita ? "★" : "☆"}</button></span></div></article>`).join("")
      : `<div class="cartao vazio">${st.q || st.trib || st.tema ? "Nada encontrado com esses filtros." : "O banco começa a ser alimentado na primeira busca semanal (segunda e terça, às 6h17). Use “Buscar novidades agora” para adiantar."}</div>`;
    $$("[data-cp]", v).forEach((b) => (b.onclick = () => { const t = data.find((x) => x.id === b.dataset.cp); copiar(`${t.tese} (${[t.tribunal, t.orgao, t.julgado, t.relator && `Rel. ${t.relator.replace(/^Min\.?\s*/i, "Min. ")}`, t.data_julgamento && `j. ${br(t.data_julgamento)}`, t.fonte].filter(Boolean).join(", ")}).`); }));
    $$("[data-cf]", v).forEach((b) => (b.onclick = async () => { const t = data.find((x) => x.id === b.dataset.cf); await sb.from("teses").update({ conferida: !t.conferida }).eq("id", t.id); desenhar(); }));
    $$("[data-fv]", v).forEach((b) => (b.onclick = async () => { const t = data.find((x) => x.id === b.dataset.fv); await sb.from("teses").update({ favorita: !t.favorita }).eq("id", t.id); desenhar(); }));
  };
  let tm; $("#q", v).oninput = (e) => { st.q = e.target.value; clearTimeout(tm); tm = setTimeout(desenhar, 300); };
  $("#tema", v).onchange = (e) => { st.tema = e.target.value; desenhar(); };
  $$("#ft button", v).forEach((b) => (b.onclick = () => { $$("#ft button", v).forEach((x) => x.classList.remove("ativo")); b.classList.add("ativo"); st.trib = b.dataset.t; desenhar(); }));
  $("#buscarAgora", v).onclick = async (e) => {
    e.target.disabled = true;
    await Promise.all(["STJ", "STF"].map((t) => sb.functions.invoke(`atualizar-teses?tribunal=${t}`, { body: {} })));
    toast("Buscando nos informativos. As teses novas aparecem em 2 a 3 minutos.", 6000);
  };
  $("#nova", v).onclick = () => {
    const d = dialogo(`<form><h2>Nova tese</h2><div class="grade">
      <label class="campo"><span>Tribunal</span><input type="text" id="tt" value="STJ"></label><label class="campo"><span>Órgão</span><input type="text" id="to"></label>
      <label class="campo"><span>Tema</span><input type="text" id="tm" list="temas"><datalist id="temas">${temas.map((t) => `<option>${esc(t)}</option>`).join("")}</datalist></label>
      <label class="campo"><span>Julgado</span><input type="text" id="tj" placeholder="HC 000.000/AL"></label>
      <label class="campo largo"><span>Título</span><input type="text" id="tti" required></label>
      <label class="campo largo"><span>Tese</span><textarea id="tx" rows="5" required></textarea></label>
      <label class="campo largo"><span>Link</span><input type="text" id="tl"></label></div>
      <div class="pe-dialogo"><button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="sv">Salvar</button></div></form>`);
    $("#sv", d).onclick = async (e) => {
      e.preventDefault();
      const { error } = await sb.from("teses").insert({ tribunal: $("#tt", d).value, orgao: $("#to", d).value || null, tema: $("#tm", d).value || "Outros", julgado: $("#tj", d).value || null,
        titulo: $("#tti", d).value, tese: $("#tx", d).value, link: $("#tl", d).value || null, manual: true, conferida: true });
      if (error) return erro(error); d.close(); desenhar();
    };
  };
  desenhar();
};

/* ================= MAIS (iPhone) ================= */
ROTAS.mais = async (v) => {
  v.innerHTML = `<div class="cabecalho"><div><div class="rotulo">Mais</div><h1>Ferramentas</h1></div></div>
    <ul class="lista">${[
      ["#/prazos", I.prazo, "Calculadora de prazos", "CPP, CPC, DJe, feriados e recesso"],
      ["#/prescricao", I.ampulheta, "Calculadora de prescrição", "Abstrata, retroativa, intercorrente e executória"],
      ["#/instagram", I.insta, "Instagram", "Temas, roteiros e legendas"],
      ["https://claude.ai/new", I.claude, "Perguntar ao Claude", "Dúvidas, peças, procuração e contrato"],
      ["#/ajustes", I.ajustes, "Ajustes", "Integrações, tipos de processo, parceiros, backup"],
    ].map(([h, ic, t, s]) => `<li><a class="item" href="${h}" ${h.startsWith("http") ? 'target="_blank" rel="noopener"' : ""}><span class="iniciais">${ic.replace("<svg", '<svg width="18" height="18" style="stroke:currentColor;fill:none;stroke-width:1.6"')}</span><div class="corpo"><div class="titulo">${t}</div><div class="sub">${s}</div></div></a></li>`).join("")}</ul>`;
};

/* ================= AJUSTES ================= */
ROTAS.ajustes = async (v) => {
  await carregarApoio();
  const urlAgenda = `${CFG.supabaseUrl}/functions/v1/agenda?t=${E.token}`;
  const webcal = urlAgenda.replace(/^https:/, "webcal:");
  const urlCapturar = `${CFG.supabaseUrl}/functions/v1/capturar`;
  const tema = (() => { try { return localStorage.getItem("natario-tema") || ""; } catch { return ""; } })();
  v.innerHTML = `<div class="cabecalho"><div><div class="rotulo">Ajustes</div><h1>Configurações</h1></div></div>
  <div class="secao"><header><h2>Abrir pastas no Mac</h2></header><div class="cartao" style="padding:18px">
    <p class="mudo pequeno" style="margin:0 0 8px">O botão "Abrir pasta" do cliente abre a pasta dele no OneDrive do seu Mac. Para isso, instale uma vez o ajudante: no Finder, abra Documentos › Natario Advocacia › mac e dê dois cliques em <b>instalar-abrir-pastas.command</b>. Na primeira vez que usar o botão, o navegador pergunta se pode abrir o "Natário Pastas": marque "Sempre permitir".</p></div></div>
  <div class="secao"><header><h2>Integrações do iPhone</h2></header><div class="cartao" style="padding:18px;display:flex;flex-direction:column;gap:12px">
    <div><b>Agenda do iPhone</b><p class="mudo pequeno" style="margin:2px 0 8px">Assine uma vez: audiências e prazos aparecem sozinhos no app Calendário, com alerta 5 dias antes.</p>
      <div class="linha"><a class="btn primario pq" href="${esc(webcal)}">Assinar no iPhone</a><button class="btn pq" data-copy="${esc(urlAgenda)}">${I.copiar} Copiar endereço</button></div></div>
    <div><b>Atalho "Natário" (compartilhar)</b><p class="mudo pequeno" style="margin:2px 0 8px">Use no Atalho do iPhone e no script do Gmail. Não compartilhe este token.</p>
      <div class="linha"><code style="overflow-wrap:anywhere;font-size:.8rem">${esc(E.token)}</code><button class="btn pq" data-copy="${esc(E.token)}">${I.copiar} Copiar token</button><button class="btn pq" data-copy="${esc(urlCapturar)}">${I.copiar} Copiar endereço</button></div></div>
  </div></div>
  <div class="secao"><header><h2>Aparência</h2></header><div class="filtro" id="tema"><button data-t="">Automático</button><button data-t="light">Claro</button><button data-t="dark">Escuro</button></div></div>
  <div class="secao"><header><h2>Tipos de processo</h2><button class="btn pq" id="novoTipo">${I.mais1} Novo tipo</button></header>
    <ul class="lista">${E.tipos.map((t) => `<li><div class="item"><input type="color" value="${esc(t.cor)}" data-cor="${t.id}" style="width:34px;height:30px;border:0;background:none;padding:0"><div class="corpo"><input type="text" value="${esc(t.nome)}" data-nome="${t.id}"></div>
      <select data-cont="${t.id}" style="width:auto"><option value="corridos" ${t.contagem === "corridos" ? "selected" : ""}>Dias corridos</option><option value="uteis" ${t.contagem === "uteis" ? "selected" : ""}>Dias úteis</option></select></div></li>`).join("")}</ul></div>
  <div class="secao"><header><h2>Advogados parceiros</h2><button class="btn pq" id="novoParc">${I.mais1} Novo parceiro</button></header>
    <ul class="lista">${E.parceiros.map((p) => `<li><div class="item"><div class="corpo"><div class="titulo">${esc(p.nome)}</div><div class="sub">${esc(p.oab || "")}</div></div><button class="btn pq fantasma" data-delp="${p.id}">${I.lixo}</button></div></li>`).join("")}</ul></div>
  <div class="secao"><header><h2>Feriados e dias sem expediente</h2></header><div class="cartao" style="padding:18px">
    <p class="mudo pequeno" style="margin-top:0">Usados na calculadora de prazos. Confira o calendário do TJAL a cada ano e inclua suspensões de expediente e feriados municipais.</p>
    <div class="grade" id="fer">${C.CATALOGO.map((f) => `<label class="check"><input type="checkbox" value="${f.id}" ${(E.cfg.feriados?.ativos || C.padraoAtivos()).includes(f.id) ? "checked" : ""}> ${esc(f.nome)} <span class="mudo pequeno">· ${f.grupo}</span></label>`).join("")}</div>
    <h3 style="margin:16px 0 8px">Datas extras</h3><div id="extras">${(E.cfg.feriados?.extras || []).map((x) => `<div class="linha extra" style="margin-bottom:6px"><input type="date" value="${x.data}" style="width:auto"><input type="text" value="${esc(x.nome)}"><button class="btn pq fantasma rm">${I.lixo}</button></div>`).join("")}</div>
    <div class="linha"><button class="btn pq" id="addExtra">${I.mais1} Adicionar data</button><button class="btn primario pq" id="salvarFer">Salvar feriados</button></div></div></div>
  <div class="secao"><header><h2>Backup</h2></header><div class="cartao" style="padding:18px"><p class="mudo pequeno" style="margin-top:0">O plano gratuito do servidor não faz backup automático. Baixe uma cópia de tempos em tempos e guarde no OneDrive.</p>
    <button class="btn" id="backup">Baixar backup (JSON)</button></div></div>
  <div class="secao"><button class="btn perigo" id="sair2">Sair do sistema</button></div>`;
  $$("[data-copy]", v).forEach((b) => (b.onclick = () => copiar(b.dataset.copy)));
  $$("#tema button", v).forEach((b) => { b.classList.toggle("ativo", b.dataset.t === tema); b.onclick = () => { aplicarTema(b.dataset.t); rota(); }; });
  $$("[data-nome],[data-cor],[data-cont]", v).forEach((el) => (el.onchange = async () => {
    const id = el.dataset.nome || el.dataset.cor || el.dataset.cont;
    const campo = el.dataset.nome ? "nome" : el.dataset.cor ? "cor" : "contagem";
    const { error } = await sb.from("tipos_processo").update({ [campo]: el.value }).eq("id", id); if (error) erro(error); else toast("Salvo");
  }));
  $("#novoTipo", v).onclick = async () => { const ordem = Math.max(0, ...E.tipos.map((t) => t.ordem)) + 1; await sb.from("tipos_processo").insert({ nome: `Novo tipo ${ordem}`, ordem }); rota(); };
  $("#novoParc", v).onclick = () => {
    const d = dialogo(`<form><h2>Novo parceiro</h2><label class="campo"><span>Nome</span><input type="text" id="pn" required></label><label class="campo"><span>OAB</span><input type="text" id="po"></label>
      <div class="pe-dialogo"><button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="sv">Salvar</button></div></form>`);
    $("#sv", d).onclick = async (e) => { e.preventDefault(); await sb.from("parceiros").insert({ nome: $("#pn", d).value.trim(), oab: $("#po", d).value || null }); d.close(); rota(); };
  };
  $$("[data-delp]", v).forEach((b) => (b.onclick = async () => { if (await confirmar("Remover este parceiro da lista?", "Remover")) { await sb.from("parceiros").delete().eq("id", b.dataset.delp); rota(); } }));
  const linhaExtra = () => `<div class="linha extra" style="margin-bottom:6px"><input type="date" style="width:auto"><input type="text" placeholder="Ex.: Emancipação de Penedo / suspensão de expediente"><button class="btn pq fantasma rm">${I.lixo}</button></div>`;
  v.addEventListener("click", (e) => { if (e.target.closest(".rm")) e.target.closest(".extra").remove(); });
  $("#addExtra", v).onclick = () => $("#extras", v).insertAdjacentHTML("beforeend", linhaExtra());
  $("#salvarFer", v).onclick = async () => {
    const valor = { ativos: $$("#fer input", v).filter((x) => x.checked).map((x) => x.value),
      extras: $$(".extra", v).map((x) => ({ data: $("input[type=date]", x).value, nome: $("input[type=text]", x).value })).filter((x) => x.data) };
    const { error } = await sb.from("config").upsert({ chave: "feriados", valor }); if (error) return erro(error); E.cfg.feriados = valor; toast("Feriados salvos");
  };
  $("#backup", v).onclick = async (e) => {
    e.target.disabled = true; e.target.textContent = "Gerando…";
    const tabelas = ["clientes", "processos", "movimentacoes", "compromissos", "teses", "entrada", "tipos_processo", "parceiros", "config"];
    const out = { gerado_em: new Date().toISOString() };
    for (const t of tabelas) {
      out[t] = []; let de = 0;
      for (;;) { const { data, error } = await sb.from(t).select("*").range(de, de + 999); if (error) { erro(error); break; } out[t].push(...data); if (data.length < 1000) break; de += 1000; }
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: "application/json" }));
    a.download = `natario-backup-${hoje()}.json`; a.click();
    e.target.disabled = false; e.target.textContent = "Baixar backup (JSON)";
  };
  $("#sair2", v).onclick = async () => { await sb.auth.signOut(); location.hash = ""; iniciar(); };
};

function aplicarTema(t) {
  try { if (t) localStorage.setItem("natario-tema", t); else localStorage.removeItem("natario-tema"); } catch { /* */ }
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
}
try { aplicarTema(localStorage.getItem("natario-tema") || ""); } catch { /* */ }

/* ================= LOGIN ================= */
async function telaLogin(msg = "") {
  let primeiro = false;
  try { const { data } = await sb.rpc("sistema_tem_usuario"); primeiro = data === false; } catch { /* */ }
  app.innerHTML = `<div class="entrada-login"><form class="cartao" id="fl">
    <img class="logo-escuro" src="logo.png" alt="Natário Advocacia"><img class="logo-claro" src="logo-claro.png" alt="Natário Advocacia">
    ${primeiro ? `<p class="pequeno" style="margin:0"><b>Primeiro acesso.</b> Crie seu login: este será o único usuário com acesso aos dados.</p>` : ""}
    <label class="campo"><span>E-mail</span><input type="email" id="em" autocomplete="username" required></label>
    <label class="campo"><span>Senha${primeiro ? " (mínimo 8 caracteres)" : ""}</span><input type="password" id="se" autocomplete="${primeiro ? "new-password" : "current-password"}" minlength="${primeiro ? 8 : 1}" required></label>
    ${msg ? `<p class="pequeno" style="color:var(--danger);margin:0">${esc(msg)}</p>` : ""}
    <button class="btn primario">${primeiro ? "Criar meu acesso" : "Entrar"}</button></form></div>`;
  $("#fl").onsubmit = async (e) => {
    e.preventDefault();
    const email = $("#em").value.trim(), password = $("#se").value;
    if (primeiro) {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) return telaLogin(error.message);
      if (!data.session) {
        app.innerHTML = `<div class="entrada-login"><div class="cartao"><img class="logo-escuro" src="logo.png" alt="Natário Advocacia"><img class="logo-claro" src="logo-claro.png" alt="Natário Advocacia">
          <p>Enviamos um e-mail de confirmação para <b>${esc(email)}</b>. Abra o link (mesmo que a página do link não carregue) e volte aqui para entrar.</p>
          <button class="btn primario" onclick="location.reload()">Já confirmei</button></div></div>`;
        return;
      }
      return iniciar();
    }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return telaLogin(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message === "Email not confirmed" ? "Confirme o e-mail pelo link enviado e tente de novo." : error.message);
    iniciar();
  };
}

async function iniciar() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return telaLogin();
  E.usuario = data.session.user;
  const { data: ok } = await sb.rpc("eh_autorizado");
  if (!ok) { await sb.auth.signOut(); return telaLogin("Este usuário não tem acesso ao sistema."); }
  await carregarApoio();
  casca();
  rota();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
