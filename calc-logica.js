// Natário Advocacia · lógica das calculadoras (prazos e prescrição)
// Funções puras: datas sempre como 'AAAA-MM-DD'.
(function (raiz) {
  "use strict";

  // ---------- datas ----------
  const D = (s) => { const [a, m, d] = s.split("-").map(Number); return new Date(Date.UTC(a, m - 1, d)); };
  const S = (dt) => dt.toISOString().slice(0, 10);
  const soma = (s, n) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return S(d); };
  const diaSem = (s) => D(s).getUTCDay(); // 0 dom … 6 sáb
  const br = (s) => { if (!s) return ""; const [a, m, d] = s.split("-"); return `${d}/${m}/${a}`; };
  const SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const brLongo = (s) => `${br(s)} (${SEMANA[diaSem(s)]})`;

  function addMeses(s, meses) {
    const d = D(s);
    const dia = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + meses);
    const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(dia, ultimo));
    return S(d);
  }
  const diffDias = (a, b) => Math.round((D(b) - D(a)) / 864e5);

  // ---------- feriados ----------
  function pascoa(ano) { // algoritmo de Meeus
    const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  }

  // Catálogo de feriados e dias sem expediente forense. "padrao" = ligado de início.
  const CATALOGO = [
    { id: "confraternizacao", nome: "Confraternização Universal", grupo: "Nacional", fixo: "01-01", padrao: true },
    { id: "tiradentes", nome: "Tiradentes", grupo: "Nacional", fixo: "04-21", padrao: true },
    { id: "trabalho", nome: "Dia do Trabalho", grupo: "Nacional", fixo: "05-01", padrao: true },
    { id: "independencia", nome: "Independência", grupo: "Nacional", fixo: "09-07", padrao: true },
    { id: "aparecida", nome: "Nossa Senhora Aparecida", grupo: "Nacional", fixo: "10-12", padrao: true },
    { id: "finados", nome: "Finados", grupo: "Nacional", fixo: "11-02", padrao: true },
    { id: "republica", nome: "Proclamação da República", grupo: "Nacional", fixo: "11-15", padrao: true },
    { id: "consciencia", nome: "Consciência Negra", grupo: "Nacional", fixo: "11-20", padrao: true },
    { id: "natal", nome: "Natal", grupo: "Nacional", fixo: "12-25", padrao: true },
    { id: "carnaval_seg", nome: "Carnaval (segunda)", grupo: "Forense", pascoa: -48, padrao: true },
    { id: "carnaval_ter", nome: "Carnaval (terça)", grupo: "Forense", pascoa: -47, padrao: true },
    { id: "cinzas", nome: "Quarta-feira de Cinzas (expediente reduzido)", grupo: "Forense", pascoa: -46, padrao: true },
    { id: "quinta_santa", nome: "Quinta-feira Santa", grupo: "Forense", pascoa: -3, padrao: true },
    { id: "sexta_santa", nome: "Sexta-feira Santa", grupo: "Nacional", pascoa: -2, padrao: true },
    { id: "corpus", nome: "Corpus Christi", grupo: "Forense", pascoa: 60, padrao: true },
    { id: "justica", nome: "Dia da Justiça", grupo: "Forense", fixo: "12-08", padrao: true },
    { id: "todos_santos", nome: "Todos os Santos (Justiça Federal)", grupo: "Forense", fixo: "11-01", padrao: false },
    { id: "sao_joao", nome: "São João", grupo: "Alagoas", fixo: "06-24", padrao: true },
    { id: "sao_pedro", nome: "São Pedro", grupo: "Alagoas", fixo: "06-29", padrao: true },
    { id: "emancipacao_al", nome: "Emancipação Política de Alagoas", grupo: "Alagoas", fixo: "09-16", padrao: true },
  ];

  // Mapa data -> nome do feriado, para um intervalo de anos
  function mapaFeriados(anoIni, anoFim, ativos, extras) {
    const mapa = {};
    for (let ano = anoIni; ano <= anoFim; ano++) {
      const p = pascoa(ano);
      for (const f of CATALOGO) {
        if (!ativos.includes(f.id)) continue;
        const dt = f.fixo ? `${ano}-${f.fixo}` : soma(p, f.pascoa);
        mapa[dt] = f.nome;
      }
    }
    for (const e of extras || []) if (e && e.data) mapa[e.data] = e.nome || "Feriado local / sem expediente";
    return mapa;
  }
  const padraoAtivos = () => CATALOGO.filter((f) => f.padrao).map((f) => f.id);

  // ---------- prazos processuais ----------
  // Recesso forense (Res. CNJ 244/2016): 20/12 a 06/01, sem expediente.
  const noRecesso = (s) => { const md = s.slice(5); return md >= "12-20" || md <= "01-06"; };
  // Suspensão de prazos 20/12 a 20/01 (art. 798-A CPP; art. 220 CPC).
  const naSuspensao = (s) => { const md = s.slice(5); return md >= "12-20" || md <= "01-20"; };

  /**
   * opcoes = { data, modo: 'dje'|'portal'|'intimacao', dias, contagem: 'corridos'|'uteis',
   *            suspende: bool, ativos: [ids], extras: [{data,nome}] }
   */
  function calcularPrazo(o) {
    const ano = Number(o.data.slice(0, 4));
    const fer = mapaFeriados(ano - 1, ano + 2, o.ativos || padraoAtivos(), o.extras);
    const motivoNaoUtil = (s) => {
      const w = diaSem(s);
      if (w === 0 || w === 6) return w === 0 ? "domingo" : "sábado";
      if (fer[s]) return fer[s];
      if (noRecesso(s)) return "recesso forense";
      return null;
    };
    const suspenso = (s) => o.suspende && naSuspensao(s);
    const util = (s) => !motivoNaoUtil(s);
    const naoUteis = []; // dias pulados, para explicar
    const anota = (s, motivo) => { if (!naoUteis.find((x) => x.data === s)) naoUteis.push({ data: s, motivo }); };
    const proxUtil = (s) => { // primeiro dia útil a partir de s (inclusive), sem suspensão
      let d = s;
      for (let i = 0; i < 400; i++) {
        const m = motivoNaoUtil(d) || (suspenso(d) ? "prazos suspensos (20/12 a 20/01)" : null);
        if (!m) return d;
        anota(d, m); d = soma(d, 1);
      }
      return d;
    };

    const etapas = [];
    let inicio;
    if (o.modo === "dje") {
      etapas.push({ rotulo: "Disponibilização no DJe", data: o.data });
      const pub = proxUtil(soma(o.data, 1));
      etapas.push({ rotulo: "Publicação (1º dia útil seguinte)", data: pub, nota: "Lei 11.419/2006, art. 4º, § 3º" });
      inicio = proxUtil(soma(pub, 1));
    } else if (o.modo === "portal") {
      etapas.push({ rotulo: "Envio da intimação ao portal", data: o.data });
      let ciencia = soma(o.data, 10);
      if (!util(ciencia)) ciencia = proxUtil(ciencia);
      etapas.push({ rotulo: "Ciência presumida (10 dias corridos, sem consulta)", data: ciencia, nota: "Lei 11.419/2006, art. 5º, § 3º" });
      inicio = proxUtil(soma(ciencia, 1));
    } else {
      etapas.push({ rotulo: "Intimação / ciência", data: o.data });
      inicio = proxUtil(soma(o.data, 1));
    }
    etapas.push({ rotulo: "Início da contagem (1º dia)", data: inicio, nota: "exclui o dia do começo (CPP, art. 798, § 1º; Súm. 310 STF)" });

    let d = inicio, contados = 1;
    const n = Math.max(1, Number(o.dias) || 1);
    while (contados < n) {
      d = soma(d, 1);
      if (suspenso(d)) { anota(d, "prazos suspensos (20/12 a 20/01)"); continue; }
      if (o.contagem === "uteis" && !util(d)) { anota(d, motivoNaoUtil(d)); continue; }
      contados++;
    }
    let venc = d;
    if (!util(venc)) {
      const original = venc;
      venc = proxUtil(soma(venc, 1));
      anota(original, motivoNaoUtil(original));
      etapas.push({ rotulo: "Vencimento original (dia não útil)", data: original });
      etapas.push({ rotulo: "Prorrogado para", data: venc, nota: "CPP, art. 798, § 3º" });
    } else {
      etapas.push({ rotulo: "Vencimento", data: venc });
    }
    naoUteis.sort((a, b) => a.data.localeCompare(b.data));
    return { inicio, vencimento: venc, etapas, naoUteis, contagem: o.contagem, dias: n };
  }

  const PRESETS = [
    { grupo: "Penal", nome: "Resposta à acusação", dias: 10, base: "CPP, art. 396", contagem: "corridos" },
    { grupo: "Penal", nome: "Defesa prévia – Lei de Drogas", dias: 10, base: "Lei 11.343/2006, art. 55", contagem: "corridos" },
    { grupo: "Penal", nome: "Defesa preliminar – funcionário público", dias: 15, base: "CPP, art. 514", contagem: "corridos" },
    { grupo: "Penal", nome: "Memoriais / alegações finais", dias: 5, base: "CPP, art. 403, § 3º", contagem: "corridos" },
    { grupo: "Penal", nome: "Apelação (interposição)", dias: 5, base: "CPP, art. 593", contagem: "corridos" },
    { grupo: "Penal", nome: "Razões / contrarrazões de apelação", dias: 8, base: "CPP, art. 600", contagem: "corridos" },
    { grupo: "Penal", nome: "Apelação no JECrim (com razões)", dias: 10, base: "Lei 9.099/95, art. 82, § 1º", contagem: "corridos" },
    { grupo: "Penal", nome: "Recurso em sentido estrito", dias: 5, base: "CPP, art. 586", contagem: "corridos" },
    { grupo: "Penal", nome: "Razões / contrarrazões de RESE", dias: 2, base: "CPP, art. 588", contagem: "corridos" },
    { grupo: "Penal", nome: "Embargos de declaração", dias: 2, base: "CPP, arts. 382 e 619", contagem: "corridos" },
    { grupo: "Penal", nome: "Embargos de declaração no JECrim", dias: 5, base: "Lei 9.099/95, art. 83", contagem: "corridos" },
    { grupo: "Penal", nome: "Embargos infringentes e de nulidade", dias: 10, base: "CPP, art. 609, p. único", contagem: "corridos" },
    { grupo: "Penal", nome: "Agravo em execução", dias: 5, base: "Súmula 700 STF; LEP, art. 197", contagem: "corridos" },
    { grupo: "Penal", nome: "Recurso especial / extraordinário", dias: 15, base: "CPC, art. 1.003, § 5º (contagem corrida em matéria penal)", contagem: "corridos" },
    { grupo: "Penal", nome: "Agravo em REsp / RE", dias: 15, base: "CPC, art. 1.042 (contagem corrida em matéria penal)", contagem: "corridos" },
    { grupo: "Penal", nome: "Agravo regimental (STJ/STF)", dias: 5, base: "Lei 8.038/90, art. 39", contagem: "corridos" },
    { grupo: "Penal", nome: "Recurso ordinário em HC (STJ)", dias: 5, base: "Lei 8.038/90, art. 30", contagem: "corridos" },
    { grupo: "Cível", nome: "Contestação", dias: 15, base: "CPC, art. 335", contagem: "uteis" },
    { grupo: "Cível", nome: "Apelação / contrarrazões", dias: 15, base: "CPC, art. 1.003, § 5º", contagem: "uteis" },
    { grupo: "Cível", nome: "Agravo de instrumento", dias: 15, base: "CPC, art. 1.003, § 5º", contagem: "uteis" },
    { grupo: "Cível", nome: "Embargos de declaração", dias: 5, base: "CPC, art. 1.023", contagem: "uteis" },
    { grupo: "Cível", nome: "Manifestação sem prazo fixado", dias: 5, base: "CPC, art. 218, § 3º", contagem: "uteis" },
    { grupo: "Cível", nome: "Recurso inominado (JEC)", dias: 10, base: "Lei 9.099/95, art. 42", contagem: "uteis" },
  ];

  // ---------- prazo penal (art. 10 CP) ----------
  // Inclui o dia do começo, calendário comum, sem prorrogação.
  function prazoPenal(inicio, { anos = 0, meses = 0, dias = 0 }) {
    let d = addMeses(inicio, Math.round(anos * 12) + meses);
    d = soma(d, dias - 1);
    return d;
  }

  // ---------- prescrição ----------
  const LEI_12234 = "2010-05-06"; // vigência da Lei 12.234/2010
  function prazoArt109(penaAnos, dataFato) {
    if (penaAnos > 12) return 20;
    if (penaAnos > 8) return 16;
    if (penaAnos > 4) return 12;
    if (penaAnos > 2) return 8;
    if (penaAnos >= 1) return 4;
    return dataFato && dataFato < LEI_12234 ? 2 : 3;
  }
  function fracao(txt) {
    if (!txt) return 0;
    const t = String(txt).trim().replace(",", ".");
    if (t.includes("/")) { const [a, b] = t.split("/").map(Number); return b ? a / b : 0; }
    return Number(t) || 0;
  }
  // pena expressa em anos decimais (meses = 1/12 ano; dias = 1/360 ano, como meses de 30 dias)
  const penaEmAnos = (p) => (Number(p.anos) || 0) + (Number(p.meses) || 0) / 12 + (Number(p.dias) || 0) / 360;
  function fmtPena(anosDec) {
    let totalDias = Math.round(anosDec * 360);
    const a = Math.floor(totalDias / 360); totalDias -= a * 360;
    const m = Math.floor(totalDias / 30); const d = totalDias - m * 30;
    return [a && `${a} ano${a > 1 ? "s" : ""}`, m && `${m} ${m > 1 ? "meses" : "mês"}`, d && `${d} dia${d > 1 ? "s" : ""}`]
      .filter(Boolean).join(", ") || "0";
  }
  function fmtPrazo(meses) {
    const a = Math.floor(meses / 12), m = meses % 12;
    return [a && `${a} ano${a > 1 ? "s" : ""}`, m && `${m} ${m > 1 ? "meses" : "mês"}`].filter(Boolean).join(" e ");
  }
  function idadeEm(nasc, data) {
    const n = D(nasc), x = D(data);
    let i = x.getUTCFullYear() - n.getUTCFullYear();
    if (x.getUTCMonth() < n.getUTCMonth() || (x.getUTCMonth() === n.getUTCMonth() && x.getUTCDate() < n.getUTCDate())) i--;
    return i;
  }

  /**
   * o = { fato, nascimento?, menor21?, maior70?, reincidente?, multaIsolada?,
   *       penaMax:{anos,meses,dias}, aumentoMax:'1/3', diminuicaoMin:'1/3',
   *       penaConcreta:{anos,meses,dias}|null,
   *       marcos:{ recebimento, pronuncia, confirmacao, sentenca, acordao, transitoAcusacao, transitoDefinitivo },
   *       suspensoes:[{inicio,fim,motivo}], hoje }
   */
  function calcularPrescricao(o) {
    const hoje = o.hoje;
    const avisos = [];
    let menor21 = !!o.menor21, maior70 = !!o.maior70;
    if (o.nascimento && o.fato && idadeEm(o.nascimento, o.fato) < 21) menor21 = true;
    const dataSent = o.marcos.sentenca || o.marcos.acordao;
    if (o.nascimento && dataSent && idadeEm(o.nascimento, dataSent) >= 70) maior70 = true;
    const reduz = menor21 || maior70;

    const prazoMeses = (pena, comReinc) => {
      let anos = o.multaIsolada ? 2 : prazoArt109(pena, o.fato);
      let meses = anos * 12;
      if (comReinc && o.reincidente) meses = Math.round(meses * 4 / 3);
      if (reduz) meses = meses / 2;
      return meses;
    };
    // fim do prazo contado a partir de 'inicio' (art. 10 CP), somando dias suspensos no intervalo
    const fimPrazo = (inicio, meses) => {
      let fim = prazoPenal(inicio, { meses: Math.floor(meses), dias: Math.round((meses % 1) * 30) });
      for (const s of o.suspensoes || []) {
        if (!s.inicio) continue;
        const sf = s.fim || hoje;
        const ini = s.inicio > inicio ? s.inicio : inicio;
        if (ini <= sf && ini <= fim) fim = soma(fim, diffDias(ini, sf) + 1);
      }
      return fim;
    };

    // pena máxima em abstrato com causas de aumento (máx.) e diminuição (mín.)
    let penaAbs = penaEmAnos(o.penaMax || {});
    const aum = fracao(o.aumentoMax), dim = fracao(o.diminuicaoMin);
    penaAbs = penaAbs * (1 + aum) * (1 - dim);

    const m = o.marcos;
    const marcosInterruptivos = [
      { id: "fato", rotulo: "Data do fato", data: o.fato },
      { id: "recebimento", rotulo: "Recebimento da denúncia/queixa", data: m.recebimento },
      { id: "pronuncia", rotulo: "Pronúncia", data: m.pronuncia },
      { id: "confirmacao", rotulo: "Decisão confirmatória da pronúncia", data: m.confirmacao },
      { id: "sentenca", rotulo: "Publicação da sentença condenatória", data: m.sentenca },
      { id: "acordao", rotulo: "Acórdão condenatório", data: m.acordao },
    ].filter((x) => x.data).sort((a, b) => a.data.localeCompare(b.data));

    const fimProcesso = m.transitoDefinitivo || hoje;
    const analisa = (meses, desde, rotuloTipo) => {
      const linhas = [];
      const lista = marcosInterruptivos.filter((x) => !desde || x.data >= desde);
      for (let i = 0; i < lista.length; i++) {
        const a = lista[i];
        const b = lista[i + 1] || { rotulo: m.transitoDefinitivo ? "Trânsito em julgado" : "Hoje", data: fimProcesso };
        const limite = fimPrazo(a.data, meses);
        const prescrita = b.data > limite;
        linhas.push({ de: a, ate: b, limite, prescrita, tipo: rotuloTipo });
      }
      return linhas;
    };

    const resultado = { reduz, menor21, maior70, penaAbs, avisos, blocos: [] };

    // 1) Pretensão punitiva em abstrato
    if (penaAbs > 0 || o.multaIsolada) {
      const meses = prazoMeses(penaAbs, false);
      const linhas = analisa(meses, null, "abstrata");
      resultado.blocos.push({
        titulo: "Prescrição da pretensão punitiva (pena em abstrato)",
        base: `Pena máxima considerada: ${fmtPena(penaAbs)} → prazo de ${fmtPrazo(meses)} (CP, art. 109${reduz ? " c/c art. 115" : ""})`,
        meses, linhas, prescrita: linhas.some((l) => l.prescrita),
      });
    }

    // 2) Retroativa e intercorrente (pena em concreto)
    const pc = o.penaConcreta ? penaEmAnos(o.penaConcreta) : 0;
    if (pc > 0) {
      const meses = prazoMeses(pc, false);
      const fatoAntigo = o.fato && o.fato < LEI_12234;
      const retro = analisa(meses, fatoAntigo ? null : (m.recebimento || null), "retroativa")
        .filter((l) => l.de.data < (dataSent || hoje));
      if (!fatoAntigo && m.recebimento) avisos.push("Fato posterior à Lei 12.234/2010: a retroativa não alcança o período anterior ao recebimento da denúncia (CP, art. 110, § 1º).");
      resultado.blocos.push({
        titulo: "Prescrição retroativa (pena em concreto)",
        base: `Pena aplicada: ${fmtPena(pc)} → prazo de ${fmtPrazo(meses)} (CP, art. 110, § 1º)`,
        meses, linhas: retro, prescrita: retro.some((l) => l.prescrita),
      });
      if (dataSent) {
        const ultimo = [m.acordao, m.sentenca].filter(Boolean).sort().pop();
        const limite = fimPrazo(ultimo, meses);
        const ate = { rotulo: m.transitoDefinitivo ? "Trânsito em julgado" : "Hoje", data: fimProcesso };
        const l = { de: { rotulo: ultimo === m.acordao ? "Acórdão condenatório" : "Publicação da sentença", data: ultimo }, ate, limite, prescrita: ate.data > limite };
        resultado.blocos.push({
          titulo: "Prescrição intercorrente / superveniente",
          base: `Da última decisão condenatória até o trânsito em julgado definitivo · prazo de ${fmtPrazo(meses)}`,
          meses, linhas: [l], prescrita: l.prescrita,
        });
      }
      // 3) Pretensão executória
      if (m.transitoAcusacao) {
        const mesesPPE = prazoMeses(pc, true);
        const limite = fimPrazo(m.transitoAcusacao, mesesPPE);
        const ate = { rotulo: "Hoje (ou início do cumprimento)", data: hoje };
        resultado.blocos.push({
          titulo: "Prescrição da pretensão executória",
          base: `Prazo de ${fmtPrazo(mesesPPE)}${o.reincidente ? " (aumentado de 1/3 pela reincidência, art. 110)" : ""}, contado do trânsito para a acusação (art. 112, I). Interrompe-se pelo início ou continuação do cumprimento e pela reincidência (art. 117, V e VI).`,
          meses: mesesPPE,
          linhas: [{ de: { rotulo: "Trânsito em julgado para a acusação", data: m.transitoAcusacao }, ate, limite, prescrita: hoje > limite }],
          prescrita: hoje > limite,
        });
      }
    }
    if (reduz) avisos.push(`Prazos reduzidos pela metade (art. 115): ${menor21 ? "menor de 21 anos na data do fato" : ""}${menor21 && maior70 ? " e " : ""}${maior70 ? "maior de 70 anos na data da sentença" : ""}.`);
    avisos.push("Confira causas suspensivas (art. 116 CP; art. 366 CPP; art. 89, § 6º, Lei 9.099) e, havendo concurso de crimes, calcule cada crime isoladamente (art. 119 CP).");
    return resultado;
  }

  const api = { D, S, soma, br, brLongo, addMeses, pascoa, CATALOGO, padraoAtivos, mapaFeriados, calcularPrazo, PRESETS,
    prazoPenal, prazoArt109, calcularPrescricao, fmtPena, fmtPrazo, idadeEm, fracao };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else raiz.CalcLogica = api;
})(typeof window !== "undefined" ? window : globalThis);
