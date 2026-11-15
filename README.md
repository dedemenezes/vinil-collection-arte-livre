# Arte Livre — Coleção de Vinil

Site estático (GitHub Pages) para consultar a coleção:

- **Albums** — artista, título, selo, ano, formato, catálogo
- **Tracks** — faixa, BPM, nota, Camelot

Sem build step: HTML + CSS + JS lendo JSON em `data/`.

## Rodar local

```bash
python3 -m http.server 8080
```

Abra http://localhost:8080

> `file://` não funciona — o browser bloqueia `fetch` dos JSON.

## GitHub Pages

1. Publique este repositório no GitHub
2. Settings → Pages → Source: branch `main`, pasta `/` (root)
3. Site fica em `https://<user>.github.io/<repo>/`

## Atualizar dados

```bash
python3 scripts/build_data.py \
  --albums /caminho/colecao-discogs.csv \
  --tracks /caminho/arte_livre_colecao_faixas_bpm_nota.csv
```

Isso regenera `data/albums.json`, `data/tracks.json` e `data/meta.json`.
