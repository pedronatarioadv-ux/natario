/* Natário Advocacia — documentos do cliente (procuração, contrato, habilitação, renúncia)
   Gera .docx no próprio aparelho, sobre o timbrado do escritório (modelos/natario.docx)
   ou o do Dr. Fábio Lobo nas parcerias (modelos/fabio.docx). */
(function () {
  const PEDRO = "**Pedro Henrique Oliveira Natário Silveira**";
  const END = "Av. Getúlio Vargas, nº 934, Vip Empresarial, Centro Histórico da cidade de Penedo, estado de Alagoas";
  const QUAL_PEDRO = `${PEDRO}, advogado inscrito na Ordem dos Advogados do Brasil, Seccional de Alagoas, sob nº. 17.023, com escritório profissional na ${END}, Tel.: (82) 999463729 e endereço eletrônico: contato@natarioadvocacia.com.br`;
  const QUAL_DOIS = `**Fábio José Lobo Nunes**, advogado inscrito na Ordem dos Advogados do Brasil, Seccional de Alagoas, sob nº 2.847, e ${PEDRO}, advogado inscrito na Ordem dos Advogados do Brasil, Seccional de Alagoas, sob nº 17.023, ambos com escritório profissional na Av. Getúlio Vargas, nº 934, Vip Empresarial, Sala 03, Centro Histórico da cidade de Penedo, estado de Alagoas`;
  const LINHA = "______________________________________________";
  const MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

  const xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const sem = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function dataExtenso(iso) {
    const [a, m, d] = iso.split("-").map(Number);
    return `${d} de ${MES[m - 1]} de ${a}`;
  }

  // ---------- valor por extenso (reais) ----------
  const U = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const D = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const Cn = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
  function ate999(n) {
    if (n === 100) return "cem";
    const c = Math.floor(n / 100), r = n % 100, p = [];
    if (c) p.push(Cn[c]);
    if (r) p.push(r < 20 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? " e " + U[r % 10] : ""));
    return p.join(" e ");
  }
  function inteiroExtenso(n) {
    if (n === 0) return "zero";
    const nomes = [["", ""], ["mil", "mil"], ["milhão", "milhões"], ["bilhão", "bilhões"]];
    const g = []; while (n > 0) { g.push(n % 1000); n = Math.floor(n / 1000); }
    const partes = [];
    for (let i = g.length - 1; i >= 0; i--) {
      if (!g[i]) continue;
      const txt = i === 1 && g[i] === 1 ? "mil" : `${ate999(g[i])}${i ? " " + nomes[i][g[i] === 1 ? 0 : 1] : ""}`;
      partes.push({ txt, v: g[i] });
    }
    return partes.reduce((acc, p, k) => (k ? acc + (k === partes.length - 1 && (p.v < 100 || p.v % 100 === 0) ? " e " : " ") : "") + p.txt, "");
  }
  function reaisExtenso(v) {
    const centavos = Math.round(v * 100), r = Math.floor(centavos / 100), c = centavos % 100;
    const pr = r ? `${inteiroExtenso(r)}${/(ões|ão)$/.test(inteiroExtenso(r)) ? " de" : ""} ${r === 1 ? "real" : "reais"}` : "";
    const pc = c ? `${inteiroExtenso(c)} ${c === 1 ? "centavo" : "centavos"}` : "";
    return [pr, pc].filter(Boolean).join(" e ") || "zero reais";
  }
  const reais = (v) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  window.reaisExtenso = reaisExtenso;

  // ---------- parágrafos do Word ----------
  function runs(t) {
    const out = []; let last = 0; const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g; let m;
    while ((m = re.exec(t))) {
      if (m.index > last) out.push([t.slice(last, m.index), 0, 0]);
      out.push(m[0].startsWith("**") ? [m[0].slice(2, -2), 1, 0] : [m[0].slice(1, -1), 0, 1]);
      last = m.index + m[0].length;
    }
    if (last < t.length) out.push([t.slice(last), 0, 0]);
    return out.map(([txt, b, i]) => `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>${b ? "<w:b/><w:bCs/>" : ""}${i ? "<w:i/><w:iCs/>" : ""}<w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="pt-BR"/></w:rPr><w:t xml:space="preserve">${xml(txt)}</w:t></w:r>`).join("");
  }
  const par = (p) => `<w:p><w:pPr><w:spacing w:before="${p.bef ?? 0}" w:after="${p.aft ?? 160}" w:line="276" w:lineRule="auto"/>${p.ind ? `<w:ind w:firstLine="${p.ind}"/>` : ""}<w:jc w:val="${p.al || "both"}"/><w:rPr><w:lang w:val="pt-BR"/></w:rPr></w:pPr>${runs(p.t || "")}</w:p>`;

  async function montarDocx(modelo, paras) {
    if (!window.JSZip) await new Promise((ok, falha) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"; s.onload = ok; s.onerror = falha; document.head.appendChild(s); });
    const r = await fetch(`modelos/${modelo}.docx`); if (!r.ok) throw new Error("Não consegui abrir o timbrado.");
    const z = await window.JSZip.loadAsync(await r.arrayBuffer());
    const doc = await z.file("word/document.xml").async("string");
    z.file("word/document.xml", doc.replace("{{CORPO}}", paras.map(par).join("")));
    return z.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }

  // ---------- qualificação ----------
  function qualificacao(c) {
    const f = c.genero === "F";
    const end = [c.endereco, c.bairro, c.cidade && `${c.cidade}${c.uf ? `/${c.uf}` : ""}`, c.cep && `CEP ${c.cep}`].filter(Boolean).join(", ");
    const p = [`**${c.nome.toUpperCase()}**`, c.nacionalidade || (f ? "brasileira" : "brasileiro")];
    if (c.estado_civil) p.push(c.estado_civil);
    if (c.profissao) p.push(c.profissao);
    const docs = [c.rg && `do RG n. ${c.rg}${c.orgao_emissor ? ` ${c.orgao_emissor}` : ""}`, c.cpf && `do CPF n. ${c.cpf}`].filter(Boolean);
    if (docs.length) p.push(`${f ? "portadora" : "portador"} ${docs.join(" e ")}`);
    if (end) p.push(`${f ? "residente e domiciliada" : "residente e domiciliado"} na ${end}`);
    return p.join(", ");
  }
  const faltando = (c) => [!c.cpf && "CPF", !c.rg && "RG", !c.estado_civil && "estado civil", !c.profissao && "profissão", !c.endereco && "endereço"].filter(Boolean);

  // ---------- modelos ----------
  function procuracao(c, o) {
    const f = c.genero === "F";
    const outorgante = o.completa ? qualificacao(c) : `**${c.nome.toUpperCase()}**, ${f ? "já qualificada" : "já qualificado"} nos autos`;
    const plural = o.fabio;
    return [
      { t: "**Procuração Particular**", al: "center", bef: 360, aft: 360 },
      { t: `**OUTORGANTE**: ${outorgante}.` },
      { t: `**${plural ? "OUTORGADOS" : "OUTORGADO"}**: ${plural ? QUAL_DOIS : QUAL_PEDRO}.` },
      { t: `Poderes Conferidos para **foro em geral**, com cláusula *ad judicia et extra*, em qualquer instância judiciária ou administrativa, em investigações policiais em geral, com outorga para habilitação em qualquer processo, podendo ${plural ? "os outorgados, em conjunto ou separadamente," : "o outorgado"} fazer os requerimentos que entender${plural ? "em" : ""} pertinentes, a exemplo de pedidos de liberdade, pedidos de acesso ao teor do inquérito/processo, produção de provas, impetração de habeas corpus ou mesmo mandado de segurança, assim como atuar da maneira mais ampla possível, podendo formalizar Acordo de Não Persecução Penal, solicitar restituição de bens apreendidos, participar de audiências, firmar acordos e composições, garantindo assim a possibilidade de praticar todos os atos necessários que visem a boa e fiel concretização dos deveres e prerrogativas advocatícias de defesa dos direitos subjetivos e interesses jurídicos ${f ? "da outorgante" : "do outorgante"}, bem como substabelecer a outrem, com ou sem reserva de iguais poderes, atuando em conjunto ou separadamente.` },
      { t: `Penedo/AL, ${dataExtenso(o.data)}.`, al: "center", bef: 480 },
      { t: LINHA, al: "center", bef: 960, aft: 0 },
      { t: f ? "Outorgante" : "Outorgante", al: "center" },
    ];
  }

  function contrato(c, o) {
    const f = c.genero === "F", pl = o.fabio;
    const CDO = pl ? "**CONTRATADOS**" : "**CONTRATADO**", CTE = "**CONTRATANTE**";
    const qualContratado = pl ? QUAL_DOIS : `${PEDRO}, advogado inscrito na OAB/AL sob o nº 17.023, com escritório profissional na ${END}, Tel.: (82) 999463729 e endereço eletrônico: contato@natarioadvocacia.com.br`;
    const v = o.valor;
    const ps = [
      { t: "**Contrato de Honorários Advocatícios**", al: "center", bef: 360, aft: 360 },
      { t: `Por este instrumento particular de contrato de honorários advocatícios que fazem de um lado ${qualContratado}, ${pl ? "doravante denominados" : "doravante denominado"} ${CDO}, e de outro lado ${qualificacao(c)}, ${f ? "denominada" : "denominado"} daqui por diante de ${CTE}, transigem nos seguintes termos:`, ind: 708 },
      { t: `1. ${pl ? "Os" : "O"} ${CDO} se ${pl ? "comprometem" : "compromete"} a ${o.objeto.replace(/\.$/, "")}.`, ind: 708 },
      { t: `2. Os serviços profissionais convencionados neste instrumento particular serão prestados a partir da presente data${o.termino ? ` e se encerram com ${o.termino.replace(/\.$/, "")}` : ""}.`, ind: 708 },
      { t: `3. Pelos serviços descritos no item 1, ${pl ? "os" : "o"} ${CDO} ${pl ? "perceberão" : "perceberá"} como honorários advocatícios o valor total de R$ ${reais(v)} (${reaisExtenso(v)}).`, ind: 708 },
    ];
    if (o.pagamento) ps.push({ t: o.pagamento.replace(/\s*$/, "").replace(/([^.])$/, "$1."), ind: 708 });
    const cl = [
      `As despesas decorrentes de custas judiciais ou administrativas correrão por conta exclusiva do ${CTE}, uma vez apresentadas as notas de despesas ${pl ? "pelos" : "pelo"} ${CDO}.`,
      `As despesas oriundas de deslocamento, alimentação e gastos com hotéis ou similares, independentemente de quantas vezes se façam necessárias, para qualquer ato que envolva a atividade profissional indicada no item 1 deste contrato, serão de inteira responsabilidade do ${CTE}, desde que apresentadas notas fiscais, cupons fiscais ou recibos que indiquem precisamente os gastos adimplidos ${pl ? "pelos" : "pelo"} ${CDO} e as diligências que ${pl ? "os" : "o"} ${CDO}, isolado ou com ajuda de terceiro, ${pl ? "foram" : "foi"} realizar, podendo a prestação de contas ser apresentada até 15 (quinze) dias após a conclusão integral da ação judicial.`,
      `O ${CTE} se obriga a prestar toda e qualquer documentação solicitada ${pl ? "pelos" : "pelo"} ${CDO}, a título de instruir o processo ao qual este contrato se refere.`,
      `Em caso de inadimplemento da obrigação de pagar a quantia após 30 (trinta) dias da data pactuada neste contrato, ${pl ? "os contratados têm" : "o contratado tem"} a opção de renunciar o processo, sem obrigação de restituir os valores já recebidos.`,
      `Em havendo resilição do contrato, por parte do ${CTE}, essa terá o indenizar ${pl ? "os" : "o"} ${CDO} em decorrência da rescisão contratual no importe correspondente a metade do valor estipulado no item 3, caso esta ainda não tenha sido protocolada, devendo o *quantum* ser pago no primeiro dia útil após a resilição. Em hipótese de desistência no curso da demanda, haverá dever do ${CTE} de adimplir integralmente com o valor estipulado.`,
      `Em caso de ofensa direta a qualquer das cláusulas deste contrato, a parte que o fizer será responsabilizada pela rescisão do presente instrumento, tendo como consequência, se for por parte ${pl ? "dos" : "do"} ${CDO}, o não recebimento das verbas decorrentes de honorários contratuais proporcionais, em eventual êxito da demanda; se, todavia, for por culpa do ${CTE}, este terá o ônus de pagar ${pl ? "aos" : "ao"} ${CDO} o valor indicado no item 8, seguindo, no que couber, os termos lá indicados.`,
      `${pl ? "Os" : "O"} ${CDO} ${pl ? "prestarão" : "prestará"} toda e qualquer informação sobre o andamento do processo sempre que contatado${pl ? "s" : ""} pelo ${CTE}, tendo o prazo de 24h, a se iniciar do primeiro dia útil após a solicitação, para o fornecimento da informação solicitada, podendo ser adotados como canais de comunicação as mensagens instantâneas de WhatsApp, e-mail, ligações ou atendimento pessoal; neste último caso, o atendimento sempre acontecerá no escritório ${pl ? "dos" : "do"} ${CDO}, sendo em todas as possibilidades respeitado o horário comercial.`,
      "Elegem as partes, para dirimir qualquer dúvida acerca do presente instrumento, o foro da comarca de Penedo, estado de Alagoas.",
    ];
    cl.forEach((t, i) => ps.push({ t: `${i + 4}. ${t}`, ind: 708 }));
    ps.push({ t: "E, por estarem justos e cientes, firmam o presente em duas vias.", ind: 708 });
    ps.push({ t: `Penedo/AL, ${dataExtenso(o.data)}.`, al: "center", bef: 240 });
    ps.push({ t: LINHA, al: "center", bef: 720, aft: 0 }, { t: "CONTRATANTE", al: "center" });
    if (pl) ps.push({ t: LINHA, al: "center", bef: 720, aft: 0 }, { t: "CONTRATADO – Fábio José Lobo Nunes", al: "center" }, { t: LINHA, al: "center", bef: 720, aft: 0 }, { t: "CONTRATADO – Pedro Henrique Oliveira Natário Silveira", al: "center" });
    else ps.push({ t: LINHA, al: "center", bef: 720, aft: 0 }, { t: "CONTRATADO", al: "center" });
    return ps;
  }

  const assinaturas = (pl) => pl
    ? [{ t: "**Fábio José Lobo Nunes**", al: "center", bef: 480, aft: 0 }, { t: "OAB/AL 2.847", al: "center" }, { t: "**Pedro Henrique O. Natário Silveira**", al: "center", bef: 240, aft: 0 }, { t: "OAB/AL 17.023", al: "center" }]
    : [{ t: "**Pedro Henrique O. Natário Silveira**", al: "center", bef: 480, aft: 0 }, { t: "OAB/AL 17.023", al: "center" }];

  const enderecamento = (j) => {
    j = j.replace(/^\s*(ao\s+)?(ju[ií]zo\s+)?/i, "").trim();
    return `Ao Juízo ${/^(da|do|de|dos|das)\s/i.test(j) ? j : `da ${j}`}`;
  };

  function habilitacao(c, o) {
    const f = c.genero === "F", pl = o.fabio;
    const adv = pl ? `dos causídicos ${QUAL_DOIS}` : `do causídico ${QUAL_PEDRO}`;
    const ps = [
      { t: `**${enderecamento(o.juizo)}**`, al: "center", bef: 360, aft: 360 },
      { t: `Autos n. ${o.autos || "[número]"}`, al: "left", bef: 240 },
      { t: `**${c.nome.toUpperCase()}**, ${f ? "já qualificada" : "já qualificado"} nos autos, vem requerer a habilitação ${adv}${o.finalidade ? `, com a finalidade de ${o.finalidade.replace(/\.$/, "")}` : ""}.`, ind: 708, bef: 480 },
    ];
    if (o.custodia) ps.push({ t: `Na mesma oportunidade requer, cordialmente, que, na hipótese de a audiência ocorrer por meio virtual, o link para participação seja enviado para ${pl ? "os advogados peticionantes" : "o advogado peticionante"}.`, ind: 708 });
    if (o.anexos) ps.push({ t: `Segue${/,| e /.test(o.anexos) ? "m" : ""} em anexo ${o.anexos.replace(/\.$/, "")}.`, ind: 708 });
    ps.push({ t: `${o.cidade || "Penedo"}/AL, assinado e datado digitalmente.`, al: "center", bef: 480 }, ...assinaturas(pl));
    return ps;
  }

  function renuncia(c, o) {
    const f = c.genero === "F", pl = o.fabio;
    const criminal = o.criminal;
    return [
      { t: `**${enderecamento(o.juizo)}**`, al: "center", bef: 360, aft: 360 },
      { t: `Autos n. ${o.autos || "[número]"}`, al: "left", bef: 240 },
      { t: `${PEDRO}, brasileiro, advogado devidamente habilitado nos autos ${criminal ? "da presente ação penal" : "do presente processo"}, considerando a impossibilidade de continuar a patrocinar a presente demanda, por motivos de foro íntimo e particular, vem **renunciar ao mandato judicial** outorgado ${f ? "pela sra." : "pelo sr."} **${c.nome.toUpperCase()}**.`, ind: 708, bef: 480 },
      { t: `Por meio deste documento ${criminal ? (f ? "a investigada" : "o investigado") : (f ? "a constituinte" : "o constituinte")} manifesta ciência da renúncia deste patrono e de que deve constituir novo procurador, ou requerer a assistência judiciária gratuita por meio dos serviços da r. Defensoria Pública.`, ind: 708 },
      { t: `${o.cidade || "Penedo"}/AL, ${dataExtenso(o.data)}.`, al: "center", bef: 480 },
      { t: "Assinado digitalmente", al: "center", bef: 240, aft: 0 },
      { t: "**Pedro Henrique O. Natário Silveira**", al: "center", aft: 0 },
      { t: "**OAB/AL 17.023**", al: "center" },
      { t: LINHA, al: "center", bef: 960, aft: 0 },
      { t: `**${c.nome.toUpperCase()}**`, al: "center" },
    ];
    void pl;
  }

  const TIPOS = {
    procuracao: { nome: "Procuração", arq: "Procuracao", fn: procuracao },
    contrato: { nome: "Contrato de honorários", arq: "Contrato", fn: contrato },
    habilitacao: { nome: "Habilitação", arq: "Habilitacao", fn: habilitacao },
    renuncia: { nome: "Renúncia", arq: "Renuncia", fn: renuncia },
  };

  const cidadeDaComarca = (p) => {
    const t = `${p?.comarca || ""} ${p?.vara || ""}`;
    const m = t.match(/comarca d[eao]s?\s+([A-ZÀ-Úa-zà-ú ]+?)(?:\s*[-/(]|$)/i) || (p?.comarca ? [null, p.comarca] : null);
    return m ? m[1].replace(/\/?AL$/i, "").trim() : "";
  };

  // ---------- diálogo ----------
  window.abrirDocumentos = function (cliente, procs, procAtual) {
    const p = procAtual || (procs.length === 1 ? procs[0] : null);
    const fabio = (procs || []).some((x) => (x.parceiros || []).some((n) => /f[aá]bio/i.test(n)));
    const tipoP = p ? (window.NATARIO_TIPOS || []).find((t) => t.id === p.tipo_id)?.nome || "" : "";
    const criminal = !p || /crimin/i.test(tipoP);
    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Maceio" }).format(new Date());
    const falta = faltando(cliente);
    const d = window.natarioDialogo(`<form><h2>Documentos · ${esc(cliente.nome)}</h2>
      <div class="filtro" id="dtipo">${Object.entries(TIPOS).map(([k, t], i) => `<button type="button" data-t="${k}" class="${i ? "" : "ativo"}">${t.nome}</button>`).join("")}</div>
      <div class="grade" style="margin-top:12px">
        <label class="campo"><span>Papel timbrado</span><select id="dpapel"><option value="natario" ${fabio ? "" : "selected"}>Natário Advocacia</option><option value="fabio" ${fabio ? "selected" : ""}>Parceria Dr. Fábio Lobo</option></select></label>
        <label class="campo"><span>Data</span><input type="date" id="ddata" value="${hoje}"></label>
      </div>
      <div id="dcampos"></div>
      <p class="mudo pequeno" id="dfalta"></p>
      <div class="pe-dialogo"><button type="button" class="btn" data-fechar>Fechar</button><button class="btn primario" id="dger">Gerar .docx</button></div></form>`);
    let tipo = "procuracao";
    const campos = () => {
      const c = $("#dcampos", d);
      const autos = p?.numero || "";
      const juizo = p?.vara ? `da ${p.vara.replace(/^(da|do)\s+/i, "")}${p.comarca && !sem(p.vara).includes(sem(p.comarca)) ? ` da Comarca de ${p.comarca}` : ""}` : "";
      c.innerHTML = {
        procuracao: `<label class="check"><input type="checkbox" id="dcompleta" ${criminal ? "" : "checked"}> Qualificação completa do cliente <span class="mudo pequeno">(em regra, no criminal: "já qualificado nos autos")</span></label>`,
        contrato: `<label class="campo"><span>Objeto (o contratado se compromete a…)</span><textarea id="dobj" rows="3">${p?.numero ? `acompanhar o processo n. ${esc(p.numero)}, realizando toda a defesa pertinente até o trânsito em julgado da sentença de primeiro grau` : ""}</textarea></label>
          <label class="campo"><span>Término (opcional)</span><input id="dterm" placeholder="ex.: o trânsito em julgado da sentença"></label>
          <div class="grade"><label class="campo"><span>Valor total (R$)</span><input id="dval" inputmode="decimal" placeholder="5.000,00"></label><span class="mudo pequeno" id="dext" style="align-self:end;padding-bottom:10px"></span></div>
          <label class="campo"><span>Forma de pagamento</span><textarea id="dpag" rows="2" placeholder="ex.: Os valores serão pagos em duas parcelas iguais e subsequentes…"></textarea></label>`,
        habilitacao: `<label class="campo"><span>Juízo</span><input id="djuizo" value="${esc(juizo)}" placeholder="da Vara do Único Ofício da Comarca de Piaçabuçu - AL"></label>
          <div class="grade"><label class="campo"><span>Autos n.</span><input id="dautos" value="${esc(autos)}"></label><label class="campo"><span>Cidade do fecho</span><input id="dcid" value="${esc(cidadeDaComarca(p) || "Penedo")}"></label></div>
          <label class="check"><input type="checkbox" id="dcust"> Flagrante / audiência de custódia (pede o link da audiência virtual)</label>
          <label class="campo"><span>Finalidade (opcional)</span><input id="dfin" placeholder="ex.: participação em audiência de custódia"></label>
          <label class="campo"><span>Anexos (opcional)</span><input id="danx" placeholder="ex.: o comprovante de residência do investigado e as certidões criminais negativas"></label>`,
        renuncia: `<label class="campo"><span>Juízo</span><input id="djuizo" value="${esc(juizo)}" placeholder="de Direito da Vara do Único Ofício de Piaçabuçu"></label>
          <div class="grade"><label class="campo"><span>Autos n.</span><input id="dautos" value="${esc(autos)}"></label><label class="campo"><span>Cidade do fecho</span><input id="dcid" value="${esc(cidadeDaComarca(p) || "Penedo")}"></label></div>`,
      }[tipo];
      const val = $("#dval", c);
      if (val) val.oninput = () => { const n = numero(val.value); $("#dext", c).textContent = n ? `(${reaisExtenso(n)})` : ""; };
      if ($("#dcust", c)) $("#dcust", c).onchange = (e) => { if (e.target.checked && !$("#dfin", c).value) $("#dfin", c).value = "participação em audiência de custódia"; };
      const precisa = tipo === "contrato" || (tipo === "procuracao" && $("#dcompleta", c)?.checked);
      $("#dfalta", d).textContent = precisa && falta.length ? `Faltam no cadastro: ${falta.join(", ")}. Complete em Editar para sair na qualificação.` : "";
      $("#dcompleta", c)?.addEventListener("change", campos);
    };
    const numero = (s) => { const n = Number(String(s).replace(/[^\d,]/g, "").replace(",", ".")); return isFinite(n) && n > 0 ? n : 0; };
    $$("#dtipo button", d).forEach((b) => (b.onclick = () => { tipo = b.dataset.t; $$("#dtipo button", d).forEach((x) => x.classList.toggle("ativo", x === b)); campos(); }));
    campos();
    $("#dger", d).onclick = async (e) => {
      e.preventDefault();
      const o = { data: $("#ddata", d).value || hoje, fabio: $("#dpapel", d).value === "fabio", criminal };
      if (tipo === "procuracao") o.completa = $("#dcompleta", d).checked;
      if (tipo === "contrato") {
        o.objeto = $("#dobj", d).value.trim(); o.termino = $("#dterm", d).value.trim(); o.valor = numero($("#dval", d).value); o.pagamento = $("#dpag", d).value.trim();
        if (!o.objeto || !o.valor) return window.natarioToast("Preencha o objeto e o valor.");
      }
      if (tipo === "habilitacao" || tipo === "renuncia") {
        o.juizo = $("#djuizo", d).value.trim(); o.autos = $("#dautos", d).value.trim(); o.cidade = $("#dcid", d).value.trim();
        if (!o.juizo) return window.natarioToast("Informe o juízo.");
        if (tipo === "habilitacao") { o.custodia = $("#dcust", d).checked; o.finalidade = $("#dfin", d).value.trim(); o.anexos = $("#danx", d).value.trim(); }
      }
      const b = e.target; b.disabled = true; b.textContent = "Gerando…";
      try {
        const blob = await montarDocx(o.fabio ? "fabio" : "natario", TIPOS[tipo].fn(cliente, o));
        const nome = `${TIPOS[tipo].arq} - ${cliente.nome}.docx`.replace(/[\\/:*?"<>|]/g, "");
        const arq = new File([blob], nome, { type: blob.type });
        if (navigator.canShare?.({ files: [arq] }) && /iphone|ipad|android/i.test(navigator.userAgent)) await navigator.share({ files: [arq], title: nome }).catch(() => {});
        else { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
        window.natarioToast(`${TIPOS[tipo].nome} gerada`);
      } catch (err) { window.natarioToast(err.message || String(err)); }
      b.disabled = false; b.textContent = "Gerar .docx";
    };
    function $(s, r) { return r.querySelector(s); }
    function $$(s, r) { return [...r.querySelectorAll(s)]; }
  };
})();
