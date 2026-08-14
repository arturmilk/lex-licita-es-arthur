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
});

function fm(v: number) { return "R$ " + v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, "."); }

export function RelatorioPDFDocument(props: any) {
  const { processo, objeto, quantidade, metodo, estatisticas, precoUnitario, precoTotal, justificativa, referencias, responsavel, email, linksEvidencias } = props;

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
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Referencias de preco aceitas (PNCP)</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, { flex: 2 }]}>Orgao</Text>
              <Text style={styles.tableCell}>Valor unit.</Text>
              <Text style={styles.tableCell}>Similaridade</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>Origem</Text>
            </View>
            {referencias.map((r: any, i: number) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 2 }]}>{r.orgao}</Text>
                <Text style={styles.tableCell}>{fm(r.valor_unitario)}</Text>
                <Text style={styles.tableCell}>{r.similaridade}%</Text>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>{r.documento_origem}</Text>
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
          <View style={styles.row}><Text style={styles.label}>Media:</Text><Text style={styles.value}>{fm(estatisticas.media)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Mediana:</Text><Text style={styles.value}>{fm(estatisticas.mediana)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Minimo:</Text><Text style={styles.value}>{fm(estatisticas.minimo)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Maximo:</Text><Text style={styles.value}>{fm(estatisticas.maximo)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Desvio padrao:</Text><Text style={styles.value}>{estatisticas.desvioPadrao.toFixed(2).replace(".", ",")}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Coef. de variacao:</Text><Text style={styles.value}>{estatisticas.coeficienteVariacao.toFixed(1).replace(".", ",")}%</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Preco estimado</Text>
          <View style={styles.row}><Text style={styles.label}>Metodo aplicado:</Text><Text style={styles.value}>{metodo}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Valor unitario estimado:</Text><Text style={styles.value}>{fm(precoUnitario)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Valor total estimado:</Text><Text style={styles.value}>{fm(precoTotal)}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Justificativa</Text>
          <Text>{justificativa}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Memoria de calculo</Text>
          <Text style={styles.mono}>
            {`referencias aceitas: ${estatisticas.n}
media = ${fm(estatisticas.media)}
mediana = ${fm(estatisticas.mediana)}
minimo = ${fm(estatisticas.minimo)} | maximo = ${fm(estatisticas.maximo)}
desvio padrao = ${estatisticas.desvioPadrao.toFixed(2).replace(".", ",")}
coeficiente de variacao = ${estatisticas.coeficienteVariacao.toFixed(1).replace(".", ",")}%`}
          </Text>
        </View>

        <Text style={styles.footer}>Documento gerado automaticamente pela Estima.IA em {new Date().toLocaleDateString("pt-BR")} | Responsavel: {responsavel || processo.responsavel}</Text>
      </Page>
    </Document>
  );
}
