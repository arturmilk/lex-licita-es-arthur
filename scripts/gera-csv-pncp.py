#!/usr/bin/env python3
"""
gera-csv-pncp.py — Gera CSV com dados do PNCP (API de Consulta Pública).

De onde vêm os dados: https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao
  (BASE_URL oficial = https://pncp.gov.br/api/consulta — Manual PNCP API Consultas v1.0;
   endpoint correto é /v1/contratacoes/publicacao, SINGULAR, com codigoModalidadeContratacao obrigatório;
   funciona do Brasil; de servidores na Europa o WAF geo-bloqueia).

Uso:
  python gera-csv-pncp.py --dias 365 --termo "notebook" --saida pncp-notebook.csv
  python gera-csv-pncp.py --dias 180 --termo "cadeira" --saida cadeiras.csv --paginas 100

Requisitos: Python 3.8+ (sem dependências externas).
"""
import argparse
import csv
import datetime
import json
import sys
import urllib.request

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Accept": "application/json",
}


def fetch(url: str):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def main() -> int:
    ap = argparse.ArgumentParser(description="Baixa publicações do PNCP e grava CSV")
    ap.add_argument("--dias", type=int, default=365, help="janela de busca em dias (padrão 365)")
    ap.add_argument("--termo", default="", help="filtro por termo no objeto (opcional)")
    ap.add_argument("--saida", default="pncp.csv", help="ficheiro CSV de saída")
    ap.add_argument("--paginas", type=int, default=50, help="máx. de páginas (50 itens cada)")
    ap.add_argument("--modalidade", type=int, default=8, help="código da modalidade de contratação (obrigatório na API; 8 = Pregão Eletrônico)")
    args = ap.parse_args()

    hoje = datetime.date.today()
    data_final = hoje.strftime("%Y%m%d")
    data_inicial = (hoje - datetime.timedelta(days=args.dias)).strftime("%Y%m%d")
    termos = [t.lower() for t in args.termo.split() if len(t) > 2]
    base = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao"

    linhas = []
    for pagina in range(1, args.paginas + 1):
        # codigoModalidadeContratacao é obrigatório no manual (8 = Pregão Eletrônico, o mais comum)
        # roda as modalidades 1..16 para cobrir todas as publicações
        url = f"{base}?dataInicial={data_inicial}&dataFinal={data_final}&codigoModalidadeContratacao={args.modalidade}&pagina={pagina}&tamanhoPagina=50"
        try:
            data = fetch(url)
        except Exception as e:
            print(f"página {pagina}: erro -> {e}")
            break
        itens = data if isinstance(data, list) else (data.get("data") or data.get("items") or [])
        if not itens:
            print(f"página {pagina}: sem itens, a parar")
            break
        for it in itens:
            texto = (it.get("objetoCompra") or it.get("descricao") or "").lower()
            if termos and not any(t in texto for t in termos):
                continue
            unidade = it.get("unidadeOrgao") or {}
            entidade = it.get("orgaoEntidade") or {}
            linhas.append({
                "descricao": it.get("objetoCompra") or it.get("descricao") or "",
                "orgao": unidade.get("nomeUnidade") or entidade.get("razaoSocial") or "",
                "valor_unitario": it.get("valorUnitarioEstimado") or it.get("valorUnitario") or "",
                "valor_total": it.get("valorTotal") or it.get("valorGlobalEstimado") or "",
                "uf": unidade.get("ufSigla") or it.get("uf") or "",
                "data": it.get("dataPublicacaoPncp") or it.get("dataAssinatura") or "",
            })
        print(f"página {pagina}: {len(itens)} itens lidos, {len(linhas)} após filtro")

    if not linhas:
        print("Nenhuma linha obtida. Verifica se estás no Brasil ou tenta --dias maior.")
        return 1

    with open(args.saida, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["descricao", "orgao", "valor_unitario", "valor_total", "uf", "data"])
        w.writeheader()
        w.writerows(linhas)
    print(f"OK: {len(linhas)} linhas gravadas em {args.saida}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
