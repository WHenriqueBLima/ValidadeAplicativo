# ValidadeApp

Aplicativo móvel web para armazenar datas de validade e classificar itens por proximidade de vencimento com sistema de usuários.

## Como usar

1. Para usar em apenas um aparelho, abra `ValidadeApp/index.html` em um navegador moderno.
2. Para sincronizar computador e celular, inicie o servidor com `python server.py` dentro da pasta `ValidadeApp` e acesse `http://SEU-IP:8080`.
3. Faça login com uma das contas:
   - **Mestre**: usuário `master`, senha `master123` (pode gerenciar usuários, editar produtos e excluir produtos)
   - **Simples**: usuário `simple`, senha `simple123` (só gerencia produtos)
4. Use as abas **Adicionar** para cadastrar validades e **Visualizar** para ver o resumo e lista.
5. Adicione o nome do produto, data de validade e quantidade.
6. Na aba visualizar, clique no nome do produto para expandir e ver todas as validades.
7. Use o botão "Adicionar" em um produto existente para cadastrar uma nova validade informando apenas data e quantidade.
8. Para cada validade você pode:
   - Editar a quantidade (campo de entrada + botão "Salvar qtd")
   - Marcar como saída (botão ✔)
   - Excluir (botão ✕ - apenas mestres e itens com saída)
9. Contas mestres usam a aba **Produtos** para editar nomes, excluir produtos totalmente e acessar "Gerenciar Usuários" para criar/excluir contas.

## Recursos

- Sistema de autenticação com níveis de acesso (Mestre/Simples)
- Interface com abas separadas para adicionar e visualizar validades
- **Novo**: Produtos agrupados por nome com expansão/colapso
- **Novo**: Produtos continuam cadastrados mesmo sem validades ativas
- **Novo**: Contas mestres podem corrigir nomes ou excluir produtos totalmente em uma aba separada
- **Novo**: Edição de quantidade em qualquer momento
- Contas mestres podem criar/excluir usuários, excluir saídas confirmadas e administrar produtos
- Contas simples têm acesso limitado (apenas adicionar e marcar saídas)
- Registro de quantidade por validade
- Permite marcar item como saída com registro automático do usuário responsável
- Mantém o registro de saída por até 30 dias antes de excluir
- Histórico de todas as mudanças por 30 dias
- Exibe itens expirados, críticos (até 10 dias), atenção (até 20 dias) e seguros
- Atualiza lista com ordenação automática
- Limpar os campos do formulário com um botão
- Design otimizado para dispositivos móveis
- Sincronização automática a cada 5 segundos quando o servidor local está em uso
- Sincronização online via Supabase quando `sync-config.js` estiver configurado
- Persistência em `data.json` com backups automáticos na pasta `backups`

## Observação

Este app funciona como um aplicativo móvel web e pode ser instalado em dispositivos que suportam PWA.
Os dados ficam salvos no navegador e, quando o servidor local está ativo, também em `data.json`.

## PWA e uso offline

- O app registra um service worker e mantém os arquivos principais em cache.
- Depois do primeiro carregamento/instalação, ele pode abrir mesmo com rede instável.
- Dados criados offline ficam no aparelho e sincronizam quando o servidor voltar a ficar acessível.
- Para instalar e acessar fora da rede local com mais segurança, hospede em HTTPS. O endereço local `192.168...` depende da sua rede Wi-Fi para o primeiro acesso e para sincronização.

## Publicar como PWA

1. Rode `.\build-pwa.ps1` dentro da pasta `ValidadeApp`.
2. Publique a pasta `pwa-dist` em um serviço HTTPS, como Netlify ou Vercel.
3. Abra o link HTTPS no celular.
4. No Chrome Android, use o menu `⋮` e escolha **Instalar app** ou **Adicionar à tela inicial**.

A publicação estática instala o app e mantém os dados no aparelho. Para sincronizar fora da rede local, será necessário hospedar também um backend/banco de dados online.

## Sincronização online com Supabase

1. Crie um projeto em `https://supabase.com`.
2. Abra o SQL Editor do Supabase e execute o conteúdo de `supabase-schema.sql`.
3. Em Project Settings > API, copie:
   - Project URL
   - anon public key
4. Edite `sync-config.js`:

```js
window.VALIDADEAPP_SYNC = {
  provider: 'supabase',
  supabaseUrl: 'https://SEU-PROJETO.supabase.co',
  supabaseAnonKey: 'SUA_ANON_PUBLIC_KEY',
  table: 'app_state',
  rowId: 'validadeapp',
};
```

5. Rode `.\build-pwa.ps1` novamente.
6. Publique a nova pasta `pwa-dist`.

Depois disso, todos os dispositivos usando o mesmo link online vão sincronizar pelo mesmo registro no Supabase.

Também é possível configurar pelo próprio app: abra a engrenagem, toque em **Configurar sincronização** e cole a URL/chave do Supabase em cada dispositivo. Para evitar repetir isso em todo aparelho, prefira preencher `sync-config.js` antes de publicar.
