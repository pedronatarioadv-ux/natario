/* Natário Advocacia — calculadoras de prazo e prescrição, Instagram */
"use strict";
(function () {
  const { sb, E, ROTAS, esc, $, $$, toast, erro, copiar, I, br, hoje } = window.Natario;
  const C = window.CalcLogica;

  const feriadosCfg = () => ({ ativos: E.cfg.feriados?.ativos || C.padraoAtivos(), extras: E.cfg.feriados?.extras || [] });

  /* ================= PRAZOS ================= */
  ROTAS.prazos = async (v) => {
    const grupos = [...new Set(C.PRESETS.map((p) => p.grupo))];
    v.innerHTML = `
      <div class="cabecalho"><div><div class="rotulo">Ferramentas</div><h1>Calculadora de prazos</h1>
        <p class="mudo pequeno" style="margin:4px 0 0">Prazos processuais contados na forma do CPP (dias corridos) ou do CPC (dias úteis), com DJe, feriados e recesso.</p></div></div>
      <div class="cartao" style="padding:18px"><form id="fp" class="grade">
        <label class="campo"><span>Forma de intimação</span><select name="modo">
          <option value="dje">Publicação no DJe (data da disponibilização)</option>
          <option value="intimacao">Intimação pessoal / ciência (data da intimação)</option>
          <option value="portal">Portal eletrônico sem consulta (data do envio)</option></select></label>
        <label class="campo"><span id="rotData">Data da disponibilização</span><input type="date" name="data" value="${hoje()}" required></label>
        <label class="campo largo"><span>Prazo</span><select name="preset">${grupos.map((g) => `<optgroup label="${g}">${C.PRESETS.map((p, i) => p.grupo === g ? `<option value="${i}">${esc(p.nome)} — ${p.dias} dias (${esc(p.base)})</option>` : "").join("")}</optgroup>`).join("")}<option value="livre">Outro prazo…</option></select></label>
        <label class="campo"><span>Dias</span><input type="number" name="dias" min="1" value="5"></label>
        <label class="campo"><span>Contagem</span><select name="contagem"><option value="corridos">Dias corridos (CPP, art. 798)</option><option value="uteis">Dias úteis (CPC, art. 219)</option></select></label>
        <label class="check largo"><input type="checkbox" name="preso"> Réu preso, Maria da Penha ou medida urgente (sem suspensão de 20/12 a 20/01 – CPP, art. 798-A)</label>
      </form></div>
      <div id="res" style="margin-top:16px"></div>`;
    const f = $("#fp", v);
    const aplicaPreset = () => {
      if (f.preset.value === "livre") return;
      const p = C.PRESETS[Number(f.preset.value)]; f.dias.value = p.dias; f.contagem.value = p.contagem;
    };
    const calcular = () => {
      const fer = feriadosCfg();
      const civel = f.contagem.value === "uteis";
      const r = C.calcularPrazo({ data: f.data.value, modo: f.modo.value, dias: Number(f.dias.value), contagem: f.contagem.value,
        suspende: civel ? true : !f.preso.checked, ativos: fer.ativos, extras: fer.extras });
      const p = f.preset.value === "livre" ? null : C.PRESETS[Number(f.preset.value)];
      $("#rotData", v).textContent = { dje: "Data da disponibilização", intimacao: "Data da intimação", portal: "Data do envio ao portal" }[f.modo.value];
      const restam = Math.round((C.D(r.vencimento) - C.D(hoje())) / 864e5);
      $("#res", v).innerHTML = `<div class="cartao resultado">
        <div class="destaque"><span class="rotulo">Vencimento</span><b>${C.brLongo(r.vencimento)}</b>
          <span class="selo ${restam < 0 ? "sim" : "nao"}">${restam < 0 ? `vencido há ${-restam} dia(s)` : restam === 0 ? "vence hoje" : `faltam ${restam} dia(s)`}</span></div>
        <p class="mudo pequeno" style="margin:0">${p ? `${esc(p.nome)} · ${esc(p.base)} · ` : ""}${r.dias} dias ${r.contagem === "uteis" ? "úteis" : "corridos"}</p>
        <ul class="passos">${r.etapas.map((e) => `<li><span>${esc(e.rotulo)}</span><b class="num">${C.brLongo(e.data)}</b>${e.nota ? `<span class="nota">${esc(e.nota)}</span>` : ""}</li>`).join("")}</ul>
        ${r.naoUteis.length ? `<details><summary class="pequeno" style="cursor:pointer">Dias não úteis considerados (${r.naoUteis.length})</summary><ul class="passos pequeno">${r.naoUteis.map((x) => `<li><span>${esc(x.motivo)}</span><span class="num">${C.brLongo(x.data)}</span></li>`).join("")}</ul></details>` : ""}
        <p class="mudo pequeno" style="margin:0">Confira suspensões de expediente do tribunal (portarias) e feriados municipais em Ajustes. Em dúvida, protocole antes.</p>
        <div class="linha"><button class="btn pq" id="agendar">${I.agenda} Lançar na agenda</button><button class="btn pq" id="copiarRes">${I.copiar} Copiar</button></div></div>`;
      $("#copiarRes", v).onclick = () => copiar(`${p ? p.nome + " – " : ""}vencimento em ${C.brLongo(r.vencimento)} (${r.etapas.map((e) => `${e.rotulo}: ${C.br(e.data)}`).join("; ")})`);
      $("#agendar", v).onclick = () => agendarPrazo(r.vencimento, p?.nome || `Prazo de ${r.dias} dias`);
    };
    f.preset.onchange = () => { aplicaPreset(); calcular(); };
    f.oninput = calcular; f.onchange = calcular;
    f.preset.value = "4"; aplicaPreset(); calcular();
  };

  function agendarPrazo(data, nome) {
    const { dialogo, campoCliente, ligarCampoCliente, isoLocal, nomeCurto } = window.Natario;
    const d = dialogo(`<form><h2>Lançar prazo na agenda</h2><p class="pequeno">${esc(nome)} · vence em ${C.brLongo(data)}</p>
      ${campoCliente("cli")}<label class="campo"><span>Processo</span><select id="cp"><option value="">—</option></select></label>
      <div class="pe-dialogo"><button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="sv">Lançar</button></div></form>`);
    ligarCampoCliente(d, "cli", async (cid) => {
      const { data: ps } = await sb.from("processos").select("id, numero").eq("cliente_id", cid);
      $("#cp", d).innerHTML = `<option value="">—</option>` + (ps || []).map((p) => `<option value="${p.id}">${esc(p.numero || "Sem número")}</option>`).join("");
      if (ps?.length === 1) $("#cp", d).value = ps[0].id;
    });
    $("#sv", d).onclick = async (e) => {
      e.preventDefault();
      const nomeCli = $("#cli-q", d).value;
      const { error } = await sb.from("compromissos").insert({ cliente_id: $("#cli", d).value || null, processo_id: $("#cp", d).value || null, tipo: "prazo",
        titulo: `${nome}${nomeCli ? ` – ${nomeCurto(nomeCli)}` : ""}`, inicio: isoLocal(data, "09:00"), dia_inteiro: true });
      if (error) return erro(error); d.close(); toast("Prazo lançado na agenda");
    };
  }

  /* ================= PRESCRIÇÃO ================= */
  ROTAS.prescricao = async (v) => {
    const campoPena = (pref, rot) => `<div class="largo"><span class="mudo pequeno" style="font-weight:600">${rot}</span><div class="linha" style="margin-top:5px">
      <input type="number" min="0" name="${pref}a" placeholder="anos" style="width:90px"> <input type="number" min="0" name="${pref}m" placeholder="meses" style="width:90px"> <input type="number" min="0" name="${pref}d" placeholder="dias" style="width:90px"></div></div>`;
    v.innerHTML = `
      <div class="cabecalho"><div><div class="rotulo">Ferramentas</div><h1>Calculadora de prescrição</h1>
        <p class="mudo pequeno" style="margin:4px 0 0">Arts. 109 a 117 do Código Penal. Prazos contados pelo art. 10 do CP (inclui o dia do começo).</p></div></div>
      <form id="fz" class="cartao" style="padding:18px"><div class="grade">
        <label class="campo"><span>Data do fato</span><input type="date" name="fato" required></label>
        <label class="campo"><span>Nascimento do réu (opcional)</span><input type="date" name="nasc"></label>
        ${campoPena("pm", "Pena máxima em abstrato")}
        <label class="campo"><span>Causa de aumento (fração máxima)</span><input type="text" name="aum" placeholder="ex.: 1/3"></label>
        <label class="campo"><span>Causa de diminuição (fração mínima)</span><input type="text" name="dim" placeholder="ex.: 1/3 (tentativa)"></label>
        ${campoPena("pc", "Pena aplicada em concreto (se houver sentença)")}
        <label class="campo"><span>Recebimento da denúncia</span><input type="date" name="rec"></label>
        <label class="campo"><span>Pronúncia</span><input type="date" name="pron"></label>
        <label class="campo"><span>Confirmação da pronúncia</span><input type="date" name="conf"></label>
        <label class="campo"><span>Publicação da sentença condenatória</span><input type="date" name="sent"></label>
        <label class="campo"><span>Acórdão condenatório</span><input type="date" name="acor"></label>
        <label class="campo"><span>Trânsito em julgado para a acusação</span><input type="date" name="tacus"></label>
        <label class="campo"><span>Trânsito em julgado definitivo</span><input type="date" name="tdef"></label>
        <label class="campo"><span>Suspensão (início)</span><input type="date" name="si"></label>
        <label class="campo"><span>Suspensão (fim)</span><input type="date" name="sf"></label>
        <label class="check"><input type="checkbox" name="m21"> Menor de 21 na data do fato</label>
        <label class="check"><input type="checkbox" name="m70"> Maior de 70 na data da sentença</label>
        <label class="check"><input type="checkbox" name="reinc"> Reincidente</label>
        <label class="check"><input type="checkbox" name="multa"> Só pena de multa</label>
      </div></form>
      <div id="res" style="margin-top:16px;display:flex;flex-direction:column;gap:12px"></div>`;
    const f = $("#fz", v);
    const calcular = () => {
      if (!f.fato.value) { $("#res", v).innerHTML = `<div class="cartao vazio">Preencha a data do fato e a pena para ver o cálculo.</div>`; return; }
      const r = C.calcularPrescricao({
        fato: f.fato.value, nascimento: f.nasc.value || null, menor21: f.m21.checked, maior70: f.m70.checked, reincidente: f.reinc.checked, multaIsolada: f.multa.checked,
        penaMax: { anos: f.pma.value, meses: f.pmm.value, dias: f.pmd.value }, aumentoMax: f.aum.value, diminuicaoMin: f.dim.value,
        penaConcreta: (f.pca.value || f.pcm.value || f.pcd.value) ? { anos: f.pca.value, meses: f.pcm.value, dias: f.pcd.value } : null,
        marcos: { recebimento: f.rec.value || null, pronuncia: f.pron.value || null, confirmacao: f.conf.value || null, sentenca: f.sent.value || null, acordao: f.acor.value || null, transitoAcusacao: f.tacus.value || null, transitoDefinitivo: f.tdef.value || null },
        suspensoes: f.si.value ? [{ inicio: f.si.value, fim: f.sf.value || null }] : [], hoje: hoje(),
      });
      if (!r.blocos.length) { $("#res", v).innerHTML = `<div class="cartao vazio">Informe a pena máxima (ou a pena aplicada).</div>`; return; }
      $("#res", v).innerHTML = r.blocos.map((b) => `<div class="cartao resultado">
        <div class="linha" style="justify-content:space-between"><h3>${esc(b.titulo)}</h3><span class="selo ${b.prescrita ? "sim" : "nao"}">${b.prescrita ? "Prescrita" : "Não prescrita"}</span></div>
        <p class="mudo pequeno" style="margin:0">${esc(b.base)}</p>
        <div class="tabela"><table><thead><tr><th>Período</th><th>Prescreveria em</th><th>Resultado</th></tr></thead><tbody>
          ${b.linhas.map((l) => `<tr><td>${esc(l.de.rotulo)} (${br(l.de.data)}) → ${esc(l.ate.rotulo)} (${br(l.ate.data)})</td><td class="num">${br(l.limite)}</td><td>${l.prescrita ? `<b style="color:var(--danger)">prazo esgotado</b>` : "dentro do prazo"}</td></tr>`).join("")}
        </tbody></table></div></div>`).join("") +
        `<div class="cartao resultado"><ul class="pequeno mudo" style="margin:0;padding-left:18px">${r.avisos.map((a) => `<li>${esc(a)}</li>`).join("")}</ul></div>`;
    };
    f.oninput = calcular; calcular();
  };

  /* ================= INSTAGRAM ================= */
  ROTAS.instagram = async (v) => {
    v.innerHTML = `
      <div class="cabecalho"><div><div class="rotulo">Ferramentas</div><h1>Instagram</h1>
        <p class="mudo pequeno" style="margin:4px 0 0">Conteúdo informativo, dentro do Provimento 205/2021 da OAB.</p></div>
        <div class="acoes"><button class="btn" id="temas">Sugerir temas</button></div></div>
      <form id="fi" class="cartao" style="padding:18px"><div class="grade">
        <label class="campo largo"><span>Tema</span><input type="text" name="tema" placeholder="ex.: o que fazer na audiência de custódia" required></label>
        <label class="campo"><span>Formato</span><select name="formato"><option>carrossel</option><option>reels</option><option>post único</option><option>stories</option></select></label>
        <label class="campo"><span>Público</span><input type="text" name="publico" value="público em geral"></label>
        <label class="campo"><span>Tom</span><select name="tom"><option>didático</option><option>direto</option><option>acolhedor</option><option>técnico</option></select></label>
      </div><div class="linha" style="margin-top:12px"><button class="btn primario">Gerar post</button></div></form>
      <div id="res" style="margin-top:16px;display:flex;flex-direction:column;gap:12px"></div>`;
    const f = $("#fi", v), res = $("#res", v);
    const chamar = async (body) => {
      const { data, error } = await sb.functions.invoke("gerar-conteudo", { body });
      if (error) throw new Error((await error.context?.json?.())?.erro || error.message);
      if (data.erro) throw new Error(data.erro);
      return data.resultado;
    };
    $("#temas", v).onclick = async (e) => {
      e.target.disabled = true; res.innerHTML = `<div class="cartao vazio">Pensando em temas…</div>`;
      try {
        const lista = await chamar({ acao: "temas" });
        res.innerHTML = `<ul class="lista">${lista.map((t, i) => `<li><a class="item" href="#" data-i="${i}"><div class="corpo"><div class="titulo">${esc(t.tema)}</div><div class="sub">${esc(t.formato)} · ${esc(t.gancho)}</div></div><span class="lado">usar</span></a></li>`).join("")}</ul>`;
        $$("[data-i]", res).forEach((a) => (a.onclick = (ev) => { ev.preventDefault(); const t = lista[Number(a.dataset.i)]; f.tema.value = t.tema; f.formato.value = t.formato; f.requestSubmit(); }));
      } catch (err) { erro(err); res.innerHTML = ""; }
      e.target.disabled = false;
    };
    f.onsubmit = async (e) => {
      e.preventDefault();
      res.innerHTML = `<div class="cartao vazio">Escrevendo o post…</div>`;
      try {
        const p = await chamar({ acao: "legenda", tema: f.tema.value, formato: f.formato.value, publico: f.publico.value, tom: f.tom.value });
        const legenda = `${p.legenda}\n\n${(p.hashtags || []).join(" ")}`;
        res.innerHTML = `<div class="cartao resultado"><span class="rotulo">${esc(f.formato.value)}</span><h2>${esc(p.titulo)}</h2>
          <h3>Roteiro</h3><ol style="margin:0;padding-left:20px">${(p.roteiro || []).map((s) => `<li style="margin-bottom:6px">${esc(s)}</li>`).join("")}</ol>
          <h3>Legenda</h3><div style="white-space:pre-wrap">${esc(legenda)}</div>
          ${p.cuidados ? `<p class="pequeno" style="color:var(--warn);margin:0">${esc(p.cuidados)}</p>` : ""}
          <div class="linha"><button class="btn primario pq" id="cpL">${I.copiar} Copiar legenda</button><button class="btn pq" id="cpR">${I.copiar} Copiar roteiro</button></div></div>`;
        $("#cpL", res).onclick = () => copiar(legenda);
        $("#cpR", res).onclick = () => copiar((p.roteiro || []).map((s, i) => `${i + 1}. ${s}`).join("\n"));
      } catch (err) { erro(err); res.innerHTML = ""; }
    };
  };
})();
