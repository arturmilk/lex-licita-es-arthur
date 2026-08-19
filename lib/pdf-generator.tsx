import { Document, Page, Text, View, StyleSheet, Link } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica" },
  header: { fontSize: 18, fontWeight: "bold", marginBottom: 8, textAlign: "center" },
  subheader: { fontSize: 12, color: "#555", marginBottom: 20, textAlign: "center" },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 13, fontWeight: "bold", marginBottom: 6, borderBottom: "1px solid #ccc", paddingBottom: 4 },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 180, fontWeight: "bold", color: "#333" },
  value: { flex: 1, color: "#333" },
  table: { marginTop: 8, border: "1px solid #ccc" },
  tableRow: { flexDirection: "row", borderBottom: "1px solid #ccc", padding: 4 },
  tableHeader: { backgroundColor: "#f5f5f5", fontWeight: "bold" },
  tableCell: { flex: 1, fontSize: 9, padding: 2 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 9, color: "#888", textAlign: "center" },
  mono: { fontFamily: "Courier", fontSize: 10, backgroundColor: "#f5f5f5", padding: 8, marginTop: 6 },
  link: { color: "#2563eb", textDecoration: "underline" },
  metaBox: { backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", padding: 10, marginBottom: 14, borderRadius: 4 },
  metaTitle: { fontSize: 11, fontWeight: "bold", color: "#334155", marginBottom: 4 },
  alertBox: { backgroundColor: "#fef2f2", border: "1px solid #fecaca", padding: 8, marginBottom: 10, borderRadius: 4 },
  alertText: { fontSize: 10, color: "#b91c1c" },
});

function fm(v: number) { return "R$ " + v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, "."); }

function rotuloItem(itens: any[], itemId?: string) {
  if (!itemId || itemId === "global") return "Objeto (global)";
  const item = (itens || []).find((i: any) => i.id === itemId);
  return item ? (item.descricao || "Item") : "Item";
}

export function RelatorioPDFDocument(props: any) {
  const {
    processo, objeto, quantidade, metodo, estatisticas, precoUnitario, precoTotal,
    justificativa, referencias, responsavel, email, linksEvidencias, premissas, itens, alertaCv,
  } = props;

  const params = premissas?.parametrosRelatorio || { exibirMedia: true, exibirDesvio: true, exibirMaximo: true, exibirMinimo: true };
  const meEpp = premissas?.meEpp;
  const decomps = premissas?.decomposicaoCustos || [];
  const itensLista = itens || premissas?.itens || [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Estima.IA - Relatorio de Pesquisa de Precos</Text>
        <Text style={styles.subheader}>Processo n {processo.numero}</Text>

        <View style={styles.metaBox}>
          <Text style={styles.metaTitle}>Responsavel e identificacao</Text>
          <View style={styles.row}><Text style={styles.label}>Nome:</Text><Text style={styles.value}>{responsavel || processo.responsavel}</Text></View>
          <View style={styles.row}><Text style={styles.label}>E-mail / Login:</Text><Text style={styles.value}>{email || processo.email}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Orgao:</Text><Text style={styles.value}>{processo.orgao}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Unidade:</Text><Text style={styles.value}>{processo.unidade}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Data do relatorio:</Text><Text style={styles.value}>{new Date().toLocaleDateString("pt-BR")}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Objeto da contratacao</Text>
          <Text>{objeto}</Text>
          <View style={styles.row}><Text style={styles.label}>Quantidade:</Text><Text style={styles.value}>{quantidade}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Unidade de medida:</Text><Text style={styles.value}>{premissas?.unidadeMedida || ""}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Forma de parcelamento:</Text><Text style={styles.value}>{premissas?.formaParcelamento || ""}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Local de entrega:</Text><Text style={styles.value}>{premissas?.localEntrega || "nao informado"}</Text></View>
        </View>

        {itensLista.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1.1 Itens / lotes da contratacao</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableCell, { flex: 2 }]}>Descricao</Text>
                <Text style={styles.tableCell}>Qtd.</Text>
                <Text style={styles.tableCell}>Un.</Text>
                <Text style={styles.tableCell}>Item edital</Text>
              </View>
              {itensLista.map((i: any, idx: number) => (
                <View key={idx} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 2 }]}>{i.descricao || `Item ${idx + 1}`}</Text>
                  <Text style={styles.tableCell}>{i.quantidade}</Text>
                  <Text style={styles.tableCell}>{i.unidadeMedida || "un"}</Text>
                  <Text style={styles.tableCell}>{i.itemEdital || "-"}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Referencias de preco aceitas</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, { flex: 1.4 }]}>Item</Text>
              <Text style={[styles.tableCell, { flex: 1.6 }]}>Orgao / Fornecedor</Text>
              <Text style={styles.tableCell}>Valor unit.</Text>
              <Text style={styles.tableCell}>Sim.</Text>
              <Text style={styles.tableCell}>Fonte</Text>
            </View>
            {referencias.map((r: any, i: number) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 1.4 }]}>{rotuloItem(itensLista, r.itemId)}</Text>
                <Text style={[styles.tableCell, { flex: 1.6 }]}>{r.orgao}</Text>
                <Text style={styles.tableCell}>{r.valor_unitario != null ? fm(r.valor_unitario) : "-"}</Text>
                <Text style={styles.tableCell}>{r.similaridade}%</Text>
                <Text style={styles.tableCell}>{r.fonte}{r.cnpj ? ` (${r.cnpj})` : ""}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Links das referencias (evidencias)</Text>
          {linksEvidencias && linksEvidencias.length > 0 ? (
            linksEvidencias.map((link: any, i: number) => (
              <View key={i} style={styles.row}>
                <Text style={styles.label}>{link.nome}:</Text>
                <Link src={link.url} style={styles.link}>{link.url}</Link>
              </View>
            ))
          ) : (
            <Text>Nenhum link registrado.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Estatisticas (calculos deterministicos)</Text>
          <View style={styles.row}><Text style={styles.label}>Referencias aceitas:</Text><Text style={styles.value}>{estatisticas.n}</Text></View>
          {params.exibirMedia !== false && <View style={styles.row}><Text style={styles.label}>Media:</Text><Text style={styles.value}>{fm(estatisticas.media)}</Text></View>}
          <View style={styles.row}><Text style={styles.label}>Mediana:</Text><Text style={styles.value}>{fm(estatisticas.mediana)}</Text></View>
          {params.exibirMinimo !== false && <View style={styles.row}><Text style={styles.label}>Minimo:</Text><Text style={styles.value}>{fm(estatisticas.minimo)}</Text></View>}
          {params.exibirMaximo !== false && <View style={styles.row}><Text style={styles.label}>Maximo:</Text><Text style={styles.value}>{fm(estatisticas.maximo)}</Text></View>}
          {params.exibirDesvio !== false && <View style={styles.row}><Text style={styles.label}>Desvio padrao:</Text><Text style={styles.value}>{estatisticas.desvioPadrao.toFixed(2).replace(".", ",")}</Text></View>}
          <View style={styles.row}><Text style={styles.label}>Coef. de variacao:</Text><Text style={styles.value}>{estatisticas.coeficienteVariacao.toFixed(1).replace(".", ",")}% (limite {premissas?.cvLimite || 20}%)</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Preco estimado</Text>
          <View style={styles.row}><Text style={styles.label}>Metodo aplicado (efetivo):</Text><Text style={styles.value}>{metodo}</Text></View>
          {alertaCv || premissas?.alertaCv ? (
            <View style={styles.alertBox}>
              <Text style={styles.alertText}>
                Alerta de dispersao: CV {(alertaCv?.cv ?? premissas?.alertaCv?.cv ?? 0).toFixed(1).replace(".", ",")}% ultrapassou o limite
                ({alertaCv?.limite ?? premissas?.alertaCv?.limite ?? 20}%). Regra aplicada: menor preco como referencia de calculo.
              </Text>
            </View>
          ) : null}
          <View style={styles.row}><Text style={styles.label}>Valor unitario estimado:</Text><Text style={styles.value}>{fm(precoUnitario)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Valor total estimado:</Text><Text style={styles.value}>{fm(precoTotal)}</Text></View>
        </View>

        {meEpp && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5.1 Reserva ME/EPP (LC n 123/2006)</Text>
            <View style={styles.row}><Text style={styles.label}>Aplicar regra:</Text><Text style={styles.value}>{meEpp.aplicar ? "Sim" : "Nao"}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Tipo:</Text><Text style={styles.value}>{meEpp.tipo === "exclusividade" ? "Exclusividade (ate R$ 80.000)" : "Reserva de 25%"}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Valor reservado:</Text><Text style={styles.value}>{fm(meEpp.valorReservado || 0)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Base legal:</Text><Text style={styles.value}>{meEpp.baseLegal || "LC 123/2006, art. 48"}</Text></View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Justificativa</Text>
          <Text>{justificativa}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Premissas e justificativas do processo</Text>
          <View style={styles.row}><Text style={styles.label}>Fontes utilizadas:</Text><Text style={styles.value}>{(premissas?.fontes || []).join(", ") || "-"}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Quantitativos:</Text><Text style={styles.value}>{premissas?.quantidade ?? quantidade} {premissas?.unidadeMedida || "un"} · {itensLista.length} item(ns)/lote(s)</Text></View>
          <View style={styles.row}><Text style={styles.label}>Local de entrega:</Text><Text style={styles.value}>{premissas?.localEntrega || "nao informado"}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Coeficiente de variacao:</Text><Text style={styles.value}>{estatisticas.coeficienteVariacao.toFixed(1).replace(".", ",")}%</Text></View>
          <View style={styles.row}><Text style={styles.label}>Tendencia central escolhida:</Text><Text style={styles.value}>{metodo}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Parametros exibidos:</Text><Text style={styles.value}>{[
            params.exibirMedia !== false && "media",
            params.exibirDesvio !== false && "desvio padrao",
            params.exibirMaximo !== false && "maximo",
            params.exibirMinimo !== false && "minimo",
          ].filter(Boolean).join(", ") || "nenhum"}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Periodo pesquisado:</Text><Text style={styles.value}>{premissas?.periodoPesquisa || ""} · {premissas?.regiaoPesquisa || ""}</Text></View>
          {premissas?.pesquisaMercado?.length > 0 && (
            <View style={styles.row}><Text style={styles.label}>Pesquisa de mercado:</Text><Text style={styles.value}>{premissas.pesquisaMercado.length} cotacao(oes) manual(is) com CNPJ e fonte</Text></View>
          )}
          {decomps.length > 0 && (
            <View style={styles.row}><Text style={styles.label}>Decomposicao de custos:</Text><Text style={styles.value}>{decomps.length} composicao(oes) registrada(s)</Text></View>
          )}
        </View>

        {decomps.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7.1 Decomposicao de custos</Text>
            {decomps.map((c: any, ci: number) => {
              let insumos = 0, maoObra = 0, encargos = 0, bdi = 0;
              for (const x of c.custos || []) {
                if (x.tipo === "insumo" || x.tipo === "outro") insumos += (x.custoUnitario || 0) * (x.quantidade || 1);
                if (x.tipo === "mao_de_obra") maoObra += (x.custoUnitario || 0) * (x.quantidade || 1);
                if (x.tipo === "encargo") encargos += x.percentual || 0;
                if (x.tipo === "bdi") bdi += x.percentual || 0;
              }
              const total = (insumos + maoObra * (1 + encargos / 100)) * (1 + bdi / 100);
              return (
                <View key={ci} style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: 10, fontWeight: "bold", color: "#334155", marginBottom: 4 }}>
                    {rotuloItem(itensLista, c.itemId)} — {c.nome || "Composicao"}
                  </Text>
                  <View style={styles.table}>
                    <View style={[styles.tableRow, styles.tableHeader]}>
                      <Text style={[styles.tableCell, { flex: 1.4 }]}>Tipo</Text>
                      <Text style={[styles.tableCell, { flex: 2.4 }]}>Descricao</Text>
                      <Text style={styles.tableCell}>Qtd.</Text>
                      <Text style={styles.tableCell}>Custo unit.</Text>
                      <Text style={styles.tableCell}>%</Text>
                    </View>
                    {(c.custos || []).map((x: any, xi: number) => (
                      <View key={xi} style={styles.tableRow}>
                        <Text style={[styles.tableCell, { flex: 1.4 }]}>{x.tipo}</Text>
                        <Text style={[styles.tableCell, { flex: 2.4 }]}>{x.descricao}</Text>
                        <Text style={styles.tableCell}>{x.quantidade ?? "-"}</Text>
                        <Text style={styles.tableCell}>{x.custoUnitario != null ? fm(x.custoUnitario) : "-"}</Text>
                        <Text style={styles.tableCell}>{x.percentual != null ? `${x.percentual}%` : "-"}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={{ fontSize: 9, color: "#475569", marginTop: 3 }}>
                    Insumos: {fm(insumos)} · Mao de obra dedicada: {fm(maoObra)} (encargos {encargos}%) · BDI: {bdi}% → Total: {fm(total)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Memoria de calculo</Text>
          <Text style={styles.mono}>
            {`referencias aceitas: ${estatisticas.n}
media = ${fm(estatisticas.media)}
mediana = ${fm(estatisticas.mediana)}
minimo = ${fm(estatisticas.minimo)} | maximo = ${fm(estatisticas.maximo)}
desvio padrao = ${estatisticas.desvioPadrao.toFixed(2).replace(".", ",")}
coeficiente de variacao = ${estatisticas.coeficienteVariacao.toFixed(1).replace(".", ",")}% (limite ${premissas?.cvLimite || 20}%)
metodo efetivo = ${metodo}`}
          </Text>
        </View>

        <Text style={styles.footer}>Documento gerado automaticamente pela Estima.IA em {new Date().toLocaleDateString("pt-BR")} | Responsavel: {responsavel || processo.responsavel}</Text>
      </Page>
    </Document>
  );
}
