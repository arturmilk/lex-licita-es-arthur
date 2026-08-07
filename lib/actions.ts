"use server";
export async function criarProcesso(data: any) { return { id: "mock", ...data }; }
export async function listarProcessos(orgaoId: string) { return []; }
export async function criarPesquisa(data: any) { return { id: "mock", ...data }; }
export async function atualizarPesquisa(id: string, data: any) { return { id, ...data }; }
export async function salvarResultadosPNCP(pesquisaId: string, resultados: any[]) { return resultados; }
export async function avaliarResultado(id: string, status: string, justificativa?: string) { return { id, status, justificativa }; }
export async function salvarEvidencia(data: any) { return { id: "mock", ...data }; }
export async function buscarConfiguracoes(orgaoId: string) { return { similaridade_minima: 75, cv_alerta_percentual: 25 }; }
