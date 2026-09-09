# Sincronizacao publica

Este arquivo registra a forma recomendada de deixar o app acessível para vários dispositivos sem precisar alterar o config em cada aparelho.

## Backend externo

1. Hospede o backend em um servidor público acessível pela web.
2. O backend precisa expor a rota `/api/state`.
3. Ajuste o arquivo `sync-config.js` antes do build:

```js
window.VALIDADEAPP_SYNC = {
  provider: 'local',
  serverUrl: 'https://SEU-BACKEND-EXTERNO.com',
  supabaseUrl: '',
  supabaseAnonKey: '',
  table: 'app_state',
  rowId: 'validadeapp',
};
```

4. Rode `./build-pwa.ps1`.
5. Publique a pasta `pwa-dist` no GitHub Pages ou outro host estático.
6. Todos os dispositivos abrem o mesmo link e o app usa automaticamente o mesmo backend externo.

## Supabase

Para usar o Supabase em vez do backend próprio:

```js
window.VALIDADEAPP_SYNC = {
  provider: 'supabase',
  supabaseUrl: 'https://SEU-PROJETO.supabase.co',
  supabaseAnonKey: 'SUA_ANON_PUBLIC_KEY',
  table: 'app_state',
  rowId: 'validadeapp',
};
```

Com isso, não é preciso repetir a configuração em cada aparelho.
