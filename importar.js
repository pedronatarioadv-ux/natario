/* Natário Advocacia — importação das pastas de clientes do OneDrive (no computador) */
"use strict";
(function () {
  const { sb, E, ROTAS, esc, $, $$, toast, erro, sem, digitos, fmtCNJ } = window.Natario;

  const MIDIA = /\.(mp4|mov|avi|mkv|wmv|m4v|3gp|webm|mp3|m4a|wav|ogg|opus|aac|wma|amr|flac|zip|rar|7z|exe|dll|ini|db|lnk|tmp|ds_store)$/i;
  const TERCEIROS = /(certid[aã]o\s*de\s*nascimento|nascimento|\bfilh[oa]s?\b|casamento|[oó]bito|esposa|marido|m[aã]e\b|pai\b)/i;
  const PESSOAL = /(\brg\b|cnh|identidade|doc(umento)?s?[\s_-]*pessoa|carteira|\bcpf\b|habilita[cç][aã]o|^doc\b)/i;
  const ENDERECO = /(comprovante|resid[eê]ncia|endere[cç]o|conta\s*de\s*(luz|[aá]gua|energia)|equatorial|casal|energisa|fatura)/i;
  const PECAS = /(procura[cç][aã]o|contrato|den[uú]ncia|flagrante|\bapf\b|interrogat[oó]rio|qualifica[cç][aã]o|boletim|\bb\.?\s?o\b|inqu[eé]rito|autos|[ií]ntegra|processo|habilita[cç][aã]o|resposta|peti[cç][aã]o|alega[cç][oõ]es)/i;
  const AUTOS = /(autos|[ií]ntegra|processo|inqu[eé]rito|c[oó]pia)/i;
  const CAMPOS_CLIENTE = new Set(["nome", "cpf", "rg", "orgao_emissor", "nascimento", "nacionalidade", "genero", "estado_civil", "profissao", "nome_mae", "nome_pai", "endereco", "bairro", "cidade", "uf", "cep", "telefone", "email", "pasta", "fontes", "ultima_atividade"]);
  const CNJ = /\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/;
  const TIPOS_NOME = () => Object.fromEntries(E.tipos.map((t) => [sem(t.nome), t.id]));

  const carregarScript = (src) => new Promise((ok, falha) => { if ($(`script[src="${src}"]`)) return ok(); const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = falha; document.head.appendChild(s); });
  async function pdfjs() {
    await carregarScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    return window.pdfjsLib;
  }
  async function jszip() { await carregarScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"); return window.JSZip; }

  async function textoDocx(file) {
    const Z = await jszip(); const z = await Z.loadAsync(file);
    const xml = await z.file("word/document.xml")?.async("string"); if (!xml) return "";
    return xml.replace(/<w:tab\/>/g, " ").replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
  }
  async function lerPdf(file) {
    const lib = await pdfjs();
    const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
    let texto = "";
    for (let i = 1; i <= Math.min(doc.numPages, 8); i++) {
      const pg = await doc.getPage(i); const c = await pg.getTextContent();
      texto += c.items.map((x) => x.str).join(" ") + "\n";
    }
    const imagens = [];
    if (texto.replace(/\s/g, "").length < 150) { // PDF escaneado: manda as 2 primeiras páginas como imagem
      for (let i = 1; i <= Math.min(doc.numPages, 2); i++) {
        const pg = await doc.getPage(i); const vp = pg.getViewport({ scale: 1.6 });
        const cv = document.createElement("canvas"); cv.width = vp.width; cv.height = vp.height;
        await pg.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
        const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.8));
        imagens.push({ nome: `${file.name} (pág. ${i})`, media_type: "image/jpeg", data: await window.Natario.paraBase64(blob) });
      }
    }
    return { texto, imagens, paginas: doc.numPages };
  }
  // recorta só os trechos com qualificação, para economizar
  function trechos(texto, nome) {
    if (texto.length <= 7000) return texto;
    const alvos = [/CPF/gi, /filh[oa] de/gi, /residente/gi, /RG\s*n/gi];
    const primeiro = sem(nome).split(" ")[0];
    const janelas = [];
    for (const re of alvos) {
      let m; while ((m = re.exec(texto)) && janelas.length < 6) {
        const ini = Math.max(0, m.index - 1200), fim = Math.min(texto.length, m.index + 1200);
        const pedaco = texto.slice(ini, fim);
        if (!primeiro || sem(pedaco).includes(primeiro)) janelas.push(pedaco);
      }
    }
    return (janelas.length ? janelas.slice(0, 3).join("\n[...]\n") : texto.slice(0, 7000));
  }

  ROTAS.importar = async (v) => {
    v.innerHTML = `
      <div class="cabecalho"><div><div class="rotulo">Importar</div><h1>Pastas de clientes do OneDrive</h1>
        <p class="mudo pequeno" style="margin:4px 0 0">Use no computador, no Chrome, com o OneDrive sincronizado. Os arquivos não saem do seu computador, exceto o necessário para ler a qualificação.</p></div></div>
      <div class="cartao" style="padding:18px;display:flex;flex-direction:column;gap:12px">
        <ol class="pequeno" style="margin:0;padding-left:18px;line-height:1.7">
          <li>Escolha a pasta principal onde ficam as pastas dos clientes (ex.: OneDrive › Clientes).</li>
          <li>O sistema separa o que é cliente, o que é pasta de processo e o que deve ser ignorado. Você confere a prévia.</li>
          <li>Na importação, ele lê RG/CNH e comprovante; sem documento pessoal, procura a qualificação na procuração, denúncia, flagrante ou interrogatório. Áudios, vídeos e documentos de terceiros (certidão de nascimento de filhos etc.) são ignorados.</li>
        </ol>
        <label class="check"><input type="checkbox" id="nivel2"> As pastas dos clientes estão um nível abaixo (ex.: Clientes › Criminal › Fulano)</label>
        <div class="linha"><label class="btn primario">Escolher pasta principal<input type="file" id="pasta" webkitdirectory directory multiple hidden></label><span class="mudo pequeno" id="info"></span></div>
      </div>
      <div id="etapa2"></div>`;
    $("#pasta", v).onchange = (e) => analisar(v, [...e.target.files], $("#nivel2", v).checked ? 2 : 1);
  };

  async function analisar(v, files, nivel) {
    const pastas = new Map();
    for (const f of files) {
      const seg = f.webkitRelativePath.split("/");
      if (seg.length <= nivel + 1) continue; // arquivo solto na raiz
      if (MIDIA.test(f.name) || f.name.startsWith("~$") || f.name.startsWith(".")) continue;
      const chave = seg.slice(0, nivel + 1).join("/");
      const p = pastas.get(chave) || { chave, nome: seg[nivel], subpastas: new Set(), arquivos: [], ultima: 0 };
      if (seg.length > nivel + 2) p.subpastas.add(seg[nivel + 1]);
      p.arquivos.push(f); p.ultima = Math.max(p.ultima, f.lastModified || 0);
      pastas.set(chave, p);
    }
    const lista = [...pastas.values()];
    $("#info", v).textContent = `${lista.length} pastas encontradas`;
    const et = $("#etapa2", v);
    if (!lista.length) { et.innerHTML = `<div class="cartao vazio">Nenhuma pasta com arquivos. Confira o nível das pastas.</div>`; return; }
    et.innerHTML = `<div class="cartao resultado"><b>Analisando a estrutura…</b><div class="barra-prog"><i id="bp"></i></div><span class="mudo pequeno" id="bpt"></span></div>`;

    const { data: existentes } = await sb.from("clientes").select("id, nome").limit(10000);
    const jaTem = new Set((existentes || []).map((c) => sem(c.nome).replace(/\s+/g, " ").trim()));
    const classif = new Map();
    for (let i = 0; i < lista.length; i += 40) {
      const lote = lista.slice(i, i + 40).map((p) => ({ pasta: p.nome, subpastas: [...p.subpastas].slice(0, 15), arquivos: p.arquivos.slice(0, 25).map((f) => f.webkitRelativePath.split("/").slice(-2).join("/")) }));
      try {
        const { data, error } = await sb.functions.invoke("classificar-pastas", { body: { pastas: lote } });
        if (error) throw new Error((await error.context?.json?.())?.erro || error.message);
        for (const r of data.resultado || []) classif.set(r.pasta, r);
      } catch (err) { erro(err); }
      $("#bp", et).style.width = `${Math.round(((i + 40) / lista.length) * 100)}%`; $("#bpt", et).textContent = `${Math.min(i + 40, lista.length)} de ${lista.length}`;
    }
    const itens = lista.map((p) => {
      const c = classif.get(p.nome) || { cliente: true, nome: p.nome, processos: [] };
      const nome = c.nome || p.nome;
      const duplicado = jaTem.has(sem(nome).replace(/\s+/g, " ").trim());
      const pessoais = p.arquivos.filter((f) => (PESSOAL.test(f.name) || ENDERECO.test(f.name)) && !TERCEIROS.test(f.name));
      const pecas = p.arquivos.filter((f) => PECAS.test(f.name) && !TERCEIROS.test(f.name) && /\.(pdf|docx)$/i.test(f.name));
      return { ...p, c, nome, duplicado, pessoais, pecas, marcado: c.cliente !== false && !duplicado };
    }).sort((a, b) => Number(b.marcado) - Number(a.marcado) || a.nome.localeCompare(b.nome));

    const nCli = itens.filter((x) => x.marcado).length;
    et.innerHTML = `
      <div class="secao"><header><h2>Prévia</h2><span class="mudo pequeno">${nCli} clientes novos · ${itens.filter((x) => x.duplicado).length} já cadastrados · ${itens.filter((x) => x.c.cliente === false).length} pastas ignoradas</span></header>
      <div class="cartao" style="padding:14px;display:flex;flex-direction:column;gap:10px">
        <label class="check"><input type="checkbox" id="lerDocs" checked> Ler documentos para preencher a qualificação (usa a API: cerca de R$ 0,10 por cliente)</label>
        <div class="linha"><button class="btn pq" id="todos">Marcar todos os clientes</button><button class="btn pq" id="nenhum">Desmarcar todos</button></div></div>
      <div class="tabela cartao"><table><thead><tr><th></th><th>Cliente</th><th>Processos</th><th>Arquivos úteis</th><th>Observação</th></tr></thead><tbody>
        ${itens.map((x, i) => `<tr><td><input type="checkbox" class="sel" data-i="${i}" ${x.marcado ? "checked" : ""}></td>
          <td><input type="text" class="nm" data-i="${i}" value="${esc(x.nome)}" style="min-width:220px"><div class="mudo pequeno">${esc(x.chave)}</div></td>
          <td class="pequeno">${(x.c.processos || []).map((p) => `${esc(p.numero ? fmtCNJ(p.numero) : p.subpasta || "sem número")} <span class="mudo">${esc(p.tipo || "")}</span>`).join("<br>") || "—"}</td>
          <td class="pequeno">${x.pessoais.length} pessoal · ${x.pecas.length} peças</td>
          <td class="pequeno mudo">${x.duplicado ? "Já cadastrado" : x.c.cliente === false ? esc(x.c.motivo || "Não parece cliente") : ""}</td></tr>`).join("")}
      </tbody></table></div>
      <div class="linha"><button class="btn primario" id="importar">Importar selecionados</button></div>
      <div id="prog"></div></div>`;
    $("#todos", et).onclick = () => $$(".sel", et).forEach((x) => { const it = itens[Number(x.dataset.i)]; x.checked = it.c.cliente !== false && !it.duplicado; });
    $("#nenhum", et).onclick = () => $$(".sel", et).forEach((x) => (x.checked = false));
    $("#importar", et).onclick = async (e) => {
      e.target.disabled = true;
      $$(".nm", et).forEach((x) => (itens[Number(x.dataset.i)].nome = x.value.trim()));
      const escolhidos = $$(".sel", et).filter((x) => x.checked).map((x) => itens[Number(x.dataset.i)]);
      await importar(et, escolhidos, $("#lerDocs", et).checked);
    };
  }

  async function importar(et, itens, lerDocs) {
    const prog = $("#prog", et);
    prog.innerHTML = `<div class="cartao resultado"><b id="pt">Importando…</b><div class="barra-prog"><i id="pb"></i></div><ul class="pequeno mudo" id="log" style="margin:0;padding-left:18px;max-height:260px;overflow:auto"></ul></div>`;
    const log = (t) => $("#log", prog).insertAdjacentHTML("afterbegin", `<li>${esc(t)}</li>`);
    const tipos = TIPOS_NOME();
    let feitos = 0, erros = 0;
    const fila = [...itens];
    const trabalhador = async () => {
      while (fila.length) {
        const it = fila.shift();
        try { await importarUm(it, lerDocs, tipos); log(`✓ ${it.nome}`); }
        catch (err) { erros++; log(`✗ ${it.nome}: ${err.message}`); }
        feitos++;
        $("#pb", prog).style.width = `${Math.round((feitos / itens.length) * 100)}%`;
        $("#pt", prog).textContent = `Importando… ${feitos} de ${itens.length}`;
      }
    };
    await Promise.all([trabalhador(), trabalhador()]);
    $("#pt", prog).textContent = `Concluído: ${feitos - erros} cliente(s) importado(s)${erros ? `, ${erros} com erro` : ""}.`;
    toast("Importação concluída");
  }

  async function importarUm(it, lerDocs, tipos) {
    let dados = {}, fontes = {}, procsLidos = [], advogados = [];
    const imgDoc = it.pessoais.find((f) => /\.(jpe?g|png|heic|webp)$/i.test(f.name) && PESSOAL.test(f.name));
    if (lerDocs && (it.pessoais.length || it.pecas.length)) {
      const arquivos = [], textos = [];
      const prioridade = (f) => (PESSOAL.test(f.name) ? 0 : ENDERECO.test(f.name) ? 1 : /procura/i.test(f.name) ? 2 : /den[uú]ncia|flagrante|apf/i.test(f.name) ? 3 : 4);
      const candidatos = [...it.pessoais, ...it.pecas].sort((a, b) => prioridade(a) - prioridade(b)).slice(0, 5);
      for (const f of candidatos) {
        try {
          if (/\.(jpe?g|png|webp|heic)$/i.test(f.name)) { if (arquivos.length < 3) arquivos.push(await window.Natario.prepararArquivo(f)); }
          else if (/\.docx$/i.test(f.name)) textos.push({ nome: f.name, texto: trechos(await textoDocx(f), it.nome) });
          else if (/\.pdf$/i.test(f.name)) {
            const r = await lerPdf(f);
            if (r.imagens.length) arquivos.push(...r.imagens.slice(0, 3 - arquivos.length));
            else textos.push({ nome: f.name, texto: trechos(r.texto, it.nome) });
          }
        } catch (err) { console.warn(f.name, err); }
      }
      if (arquivos.length || textos.length) {
        const { data, error } = await sb.functions.invoke("ler-documento", { body: { arquivos: arquivos.slice(0, 3), textos: textos.slice(0, 4), nome_alvo: it.nome } });
        if (error) throw new Error((await error.context?.json?.())?.erro || error.message);
        if (data?.dados) { dados = data.dados; fontes = data.fontes || {}; procsLidos = data.processos || []; advogados = data.advogados || []; }
      }
    }
    const limpa = (o) => Object.fromEntries(Object.entries(o).filter(([, x]) => x !== null && x !== "" && x !== undefined));
    const reg = { ...limpa(dados), nome: it.nome || dados.nome, pasta: it.chave, fontes,
      ultima_atividade: it.ultima ? new Date(it.ultima).toISOString().slice(0, 10) : null };
    if (reg.nascimento && !/^\d{4}-\d{2}-\d{2}$/.test(reg.nascimento)) delete reg.nascimento;
    if (reg.genero && !["M", "F"].includes(reg.genero)) delete reg.genero;
    for (const k of Object.keys(reg)) if (!CAMPOS_CLIENTE.has(k)) delete reg[k];
    const { data: cli, error } = await sb.from("clientes").insert(reg).select("id").single();
    if (error) throw error;

    if (imgDoc) {
      try {
        const blob = await window.Natario.comprimir(imgDoc, 1600, 0.8);
        const caminho = `${cli.id}/documento-${Date.now()}.jpg`;
        const up = await sb.storage.from("documentos").upload(caminho, blob, { contentType: "image/jpeg" });
        if (!up.error) await sb.from("clientes").update({ documento_path: caminho }).eq("id", cli.id);
      } catch (err) { console.warn(err); }
    }

    const parceiros = advogados.map((nome) => E.parceiros.find((p) => { const s = sem(p.nome).split(" "); return sem(nome).includes(s[0]) && sem(nome).includes(s[s.length - 1]); })?.nome).filter(Boolean);
    const vistos = new Set();
    const procs = [];
    for (const p of it.c.processos || []) {
      const num = p.numero || (p.subpasta && p.subpasta.match(CNJ)?.[0]) || null;
      const sub = p.subpasta ? `${it.chave}/${p.subpasta}` : it.chave;
      const autos = it.arquivos.filter((f) => f.webkitRelativePath.startsWith(sub + "/") && /\.pdf$/i.test(f.name) && (AUTOS.test(f.name) || CNJ.test(f.name) || f.size > 3e6)).map((f) => f.webkitRelativePath).slice(0, 10);
      procs.push({ numero: num ? fmtCNJ(num) : null, tipo_id: tipos[sem(p.tipo || "")] || E.tipos[0]?.id, assunto: p.assunto || null, comarca: p.comarca || null, pasta: sub, arquivos: autos });
      if (num) vistos.add(digitos(num));
    }
    for (const p of procsLidos) {
      if (!p.numero || vistos.has(digitos(p.numero))) continue;
      vistos.add(digitos(p.numero));
      procs.push({ numero: fmtCNJ(p.numero), tipo_id: E.tipos[0]?.id, assunto: p.assunto || null, comarca: p.comarca || null, vara: p.vara || null, pasta: it.chave, arquivos: [] });
    }
    for (const p of procs) {
      if (p.numero) { const { data: ex } = await sb.from("processos").select("id").eq("numero_limpo", digitos(p.numero)).limit(1); if (ex?.length) continue; }
      await sb.from("processos").insert({ ...p, cliente_id: cli.id, parceiros });
    }
  }
})();
