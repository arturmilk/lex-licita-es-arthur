import { Document, Page, Text, View, StyleSheet, Link } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  header: { fontSize: 16, fontWeight: "bold", marginBottom: 4, textAlign: "center" },
  subheader: { fontSize: 11, color: "#555", marginBottom: 4, textAlign: "center" },
  orgao: { fontSize: 10, color: "#333", marginBottom: 18, textAlign: "center" },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: "bold", marginBottom: 5, borderBottom: "1px solid #ccc", paddingBottom: 3, color: "#1e3a5f" },
  row: { flexDirection: "row", marginBottom: 2 },
  label: { width: 180, fontWeight: "bold", color: "#333" },
  value: { flex: 1, color: "#333" },
  table: { marginTop: 6, border: "1px solid #ccc" },
  tableRow: { flexDirection: "row", borderBottom: "1px solid #eee", padding: 3 },
  tableHeader: { backgroundColor: "#f0f4f8", fontWeight: "bold" },
  tableCell: { flex: 1, fontSize: 8, padding: 2 },
  footer: { position: "absolute", bottom: 25, left: 40, right: 40, fontSize: 8, color: "#888", textAlign: "center", borderTop: "1px solid #eee", paddingTop: 6 },
  mono: { fontFamily: "Courier", fontSize: 9, backgroundColor: "#f8f8f8", padding: 8, marginTop: 4 },
  link: { color: "#2563eb" },
  metaBox: { backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", padding: 8, marginBottom: 12, borderRadius: 2 },
  metaTitle: { fontSize: 10, fontWeight: "bold", color: "#334155", marginBottom: 4 },
  legalBox: { backgroundColor: "#fffbeb", border: "1px solid #fde68a", padding: 8, marginBottom: 12, borderRadius: 2 },
  legalTitle: { fontSize: 10, fontWeight: "bold", color: "#92400e", marginBottom: 4 },
  legalItem: { fontSize: 9, color: "#78350f", marginBottom: 2, paddingLeft: 8 },
  highlight: { backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", padding: 8, borderRadius: 2 },
  highlightValue: { fontSize: 16, fontWeight: "bold", color: "#1e40af", textAlign: "center" },
  highlightLabel: { fontSize: 9, color: "#3b82f6", textAlign: "center" },
});

function fm(v: number) {
  return "R$ " + v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

const NORMATIVOS = [
  { id: "1", texto: "Lei nº 14.133/2021, arts. 6º, XXIII, \"i\", 18, 23 e 72, II e VII — Lei de Licitações e Contratos Administrativos" },
  { id: "2", texto: "Decreto de Licitações de Rondônia nº 28.874/2024" },
  { id: "3", texto: "Instrução nº 10/2015-PR/TJRO (com alterações posteriores), arts. 11 a 18 — pesquisa de preços no Poder Judiciário/RO" },
  { id: "4", texto: "Instrução nº 96/2022-TJRO, atualizada pela Instrução nº 145/2024-TJRO — contratações de TIC" },
  { id: "5", texto: "Resolução CNJ nº 347/2020 — Política de Governança das Contratações no Poder Judiciário" },
  { id: "6", texto: "Instrução Normativa SEGES/ME nº 65/2021 — referência técnica e metodológica federal" },
];

export function RelatorioPDFDocument(props: any) {
  const {
    processo, objeto, quantidade, metodo,
    estatisticas, precoUnitario, precoTotal,
    justificativa, referencias, responsavel, email, linksEvidencias,
  } = props;

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* Cabeçalho */}
        <Text style={styles.header}>ESTIMA.IA — Relatório de Pesquisa de Preços</Text>
        <Text style={styles.subheader}>Processo nº {processo.numero}</Text>
        <Text style={styles.orgao}>{processo.orgao}{processo.unidade ? ` — ${processo.unidade}` : ""}</Text>

        {/* Responsável */}
        <View style={styles.metaBox}>
          <Text style={styles.metaTitle}>Identificação do responsável</Text>
          <View style={styles.row}><Text style={styles.label}>Nome:</Text><Text style={styles.value}>{responsavel || processo.responsavel}</Text></View>
          <View style={styles.row}><Text style={styles.label}>E-mail:</Text><Text style={styles.value}>{email || processo.email}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Órgão:</Text><Text style={styles.value}>{processo.orgao}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Data do relatório:</Text><Text style={styles.value}>{new Date().toLocaleDateString("pt-BR")}</Text></View>
        </View>

        {/* Base legal */}
        <View style={styles.legalBox}>
          <Text style={styles.legalTitle}>Base legal aplicável</Text>
          {NORMATIVOS.map(n => (
            <Text key={n.id} style={styles.legalItem}>• {n.texto}</Text>
          ))}
        </View>

        {/* 1. Objeto */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Objeto da contratação</Text>
          <Text>{objeto}</Text>
          <View style={[styles.row, { marginTop: 4 }]}>
            <Text style={styles.label}>Quantidade:</Text>
            <Text style={styles.value}>{quantidade}</Text>
          </View>
        </View>

        {/* 2. Referências */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Referências de preço aceitas</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, { flex: 2 }]}>Órgão</Text>
              <Text style={styles.tableCell}>Data</Text>
              <Text style={styles.tableCell}>Valor unit.</Text>
              <Text style={styles.tableCell}>Sim.</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>Fonte / Origem</Text>
            </View>
            {referencias.map((r: any, i: number) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 2 }]}>{r.orgao}</Text>
                <Text style={styles.tableCell}>{r.data || r.dataContrato || "—"}</Text>
                <Text style={styles.tableCell}>{fm(r.valor_unitario ?? r.valorUnitario ?? 0)}</Text>
                <Text style={styles.tableCell}>{r.similaridade}%</Text>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>{r.documento_origem || r.documentoOrigem || "—"}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 3. Links / Evidências */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Links das referências (evidências)</Text>
          {linksEvidencias && linksEvidencias.length > 0 ? (
            linksEvidencias.map((link: any, i: number) => (
              <View key={i} style={[styles.row, { marginBottom: 3 }]}>
                <Text style={[styles.label, { fontSize: 9 }]}>{link.nome}:</Text>
                <Link src={link.url} style={[styles.link, { fontSize: 9 }]}>{link.url}</Link>
              </View>
            ))
          ) : (
            <Text>Nenhum link registrado.</Text>
          )}
        </View>

        {/* 4. Estatísticas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Análise estatística</Text>
          <View style={styles.row}><Text style={styles.label}>Referências aceitas:</Text><Text style={styles.value}>{estatisticas.n}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Média aritmética:</Text><Text style={styles.value}>{fm(estatisticas.media)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Mediana:</Text><Text style={styles.value}>{fm(estatisticas.mediana)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Valor mínimo:</Text><Text style={styles.value}>{fm(estatisticas.minimo)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Valor máximo:</Text><Text style={styles.value}>{fm(estatisticas.maximo)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Desvio padrão:</Text><Text style={styles.value}>{estatisticas.desvioPadrao.toFixed(2).replace(".", ",")}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Coef. de variação:</Text><Text style={styles.value}>{estatisticas.coeficienteVariacao.toFixed(1).replace(".", ",")}%{estatisticas.coeficienteVariacao > 25 ? " ⚠ dispersão elevada" : ""}</Text></View>
        </View>

        {/* 5. Preço estimado */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Preço estimado</Text>
          <View style={styles.row}><Text style={styles.label}>Método aplicado:</Text><Text style={styles.value}>{metodo?.replace(/_/g, " ")}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Valor unitário estimado:</Text><Text style={styles.value}>{fm(precoUnitario)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Valor total estimado:</Text><Text style={styles.value}>{fm(precoTotal)}</Text></View>
        </View>

        {/* 6. Justificativa */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Justificativa do preço estimado</Text>
          <Text>{justificativa}</Text>
          <Text style={{ marginTop: 6, fontSize: 9, color: "#555" }}>
            A pesquisa de preços foi realizada em conformidade com o art. 23 da Lei nº 14.133/2021 e com os arts. 11 a 18 da Instrução nº 10/2015-PR/TJRO, consultando bases públicas de contratações governamentais (PNCP, Painel de Preços, Compras.gov.br).
          </Text>
        </View>

        {/* 7. Memória de cálculo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Memória de cálculo</Text>
          <Text style={styles.mono}>
            {`referências aceitas: ${estatisticas.n}
média = ${fm(estatisticas.media)}
mediana = ${fm(estatisticas.mediana)}
mínimo = ${fm(estatisticas.minimo)} | máximo = ${fm(estatisticas.maximo)}
desvio padrão = ${estatisticas.desvioPadrao.toFixed(2).replace(".", ",")}
coeficiente de variação = ${estatisticas.coeficienteVariacao.toFixed(1).replace(".", ",")}%`}
          </Text>
        </View>

        <Text style={styles.footer}>
          Documento gerado automaticamente pela Estima.IA em {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR")} | Responsável: {responsavel || processo.responsavel} | Processo nº {processo.numero}
        </Text>
      </Page>
    </Document>
  );
}
