export interface EstatisticasPreco {
  n: number; media: number; mediana: number; minimo: number; maximo: number;
  desvioPadrao: number; coeficienteVariacao: number;
}

export function media(valores: number[]): number {
  if (valores.length === 0) return 0;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

export function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const o = [...valores].sort((a, b) => a - b);
  const n = o.length;
  return n % 2 === 0 ? (o[n / 2 - 1] + o[n / 2]) / 2 : o[Math.floor(n / 2)];
}

export function minimo(valores: number[]): number { return valores.length ? Math.min(...valores) : 0; }
export function maximo(valores: number[]): number { return valores.length ? Math.max(...valores) : 0; }

export function variancia(valores: number[]): number {
  if (valores.length === 0) return 0;
  const m = media(valores);
  return valores.reduce((acc, v) => acc + Math.pow(v - m, 2), 0) / valores.length;
}

export function desvioPadrao(valores: number[]): number { return Math.sqrt(variancia(valores)); }

export function coeficienteVariacao(valores: number[]): number {
  const m = media(valores);
  return m === 0 ? 0 : (desvioPadrao(valores) / m) * 100;
}

export function calcularEstatisticas(valores: number[]): EstatisticasPreco {
  const n = valores.length;
  if (n === 0) return { n: 0, media: 0, mediana: 0, minimo: 0, maximo: 0, desvioPadrao: 0, coeficienteVariacao: 0 };
  const m = media(valores);
  const dp = desvioPadrao(valores);
  return { n, media: m, mediana: mediana(valores), minimo: minimo(valores), maximo: maximo(valores), desvioPadrao: dp, coeficienteVariacao: m === 0 ? 0 : (dp / m) * 100 };
}

export function mediaPonderada(valores: number[], pesos: number[]): number {
  if (valores.length === 0) return 0;
  const somaPesos = pesos.reduce((a, b) => a + b, 0);
  if (somaPesos === 0) return media(valores);
  return valores.reduce((acc, v, i) => acc + v * (pesos[i] ?? 1), 0) / somaPesos;
}

export function calcularPrecoEstimado(
  valores: number[],
  metodo: MetodoCalculo,
  quantidade: number,
  pesos?: number[],
): { unitario: number; total: number } {
  let unit = 0;
  switch (metodo) {
    case "media_aritmetica": unit = media(valores); break;
    case "mediana":          unit = mediana(valores); break;
    case "menor_preco":      unit = minimo(valores); break;
    case "media_ponderada":  unit = pesos?.length ? mediaPonderada(valores, pesos) : media(valores); break;
    default:                 unit = media(valores);
  }
  return { unitario: unit, total: unit * quantidade };
}

export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

type MetodoCalculo = "media_aritmetica" | "mediana" | "media_ponderada" | "menor_preco";
