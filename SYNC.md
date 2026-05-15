# Sincronizacao em mais de um dispositivo

Para manter os mesmos dados no celular, computador e outros aparelhos, o app precisa estar publicado em HTTPS e conectado ao Supabase.

## Fluxo recomendado

1. Crie um projeto no Supabase.
2. Abra o SQL Editor do Supabase e execute `supabase-schema.sql`.
3. Em Project Settings > API, copie a Project URL e a anon public key.
4. Preencha `sync-config.js`:

```js
window.VALIDADEAPP_SYNC = {
  provider: 'supabase',
  supabaseUrl: 'https://SEU-PROJETO.supabase.co',
  supabaseAnonKey: 'SUA_ANON_PUBLIC_KEY',
  table: 'app_state',
  rowId: 'validadeapp',
};
```

5. Rode `.\build-pwa.ps1`.
6. Suba as mudancas para o GitHub.
7. Publique pelo GitHub Pages usando GitHub Actions.
8. Abra o mesmo link do GitHub Pages em todos os dispositivos.
9. No primeiro acesso de cada aparelho, aceite a sincronizacao automatica.

## Como o app evita sobrescrever dados

Quando um aparelho salva uma mudanca, o app busca o estado mais recente do Supabase, junta com o que existe no aparelho e so depois envia o resultado. Isso reduz o risco de um dispositivo sobrescrever informacoes novas de outro.

Ainda assim, evite editar o mesmo produto ao mesmo tempo em dois aparelhos diferentes. Se isso acontecer, a sincronizacao preserva os registros, mas a ultima edicao do mesmo item pode prevalecer.
