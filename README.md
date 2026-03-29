# SkateTrack

Reconstrução do front do sistema **SkateTrack** com foco em produto funcional real, identidade visual urbana/profissional e integração direta com o Supabase já existente. Esta versão foi pensada para publicação estática no **GitHub Pages**, usando apenas HTML, CSS, JavaScript puro, Supabase JS, Leaflet e Nominatim.

## Estrutura do projeto

```text
skatetrack/
├── index.html
├── athlete.html
├── plans.html
├── admin.html
├── athletes.html
├── reports.html
└── README.md
```

## Páginas existentes

### `index.html`
Tela de login com autenticação real no Supabase.

### `athlete.html`
Tela **Meu dia** do atleta:
- check-in GPS real via navegador
- fallback manual
- gravação na tabela `checkins`
- geocodificação reversa para GPS quando disponível
- histórico real do dia
- leitura de planos ativos

### `plans.html`
Tela **Meus planos** do atleta:
- cadastro de múltiplos planos
- gravação na tabela `plans`
- lista real ordenada por data inicial

### `admin.html`
Tela da gestão com:
- mapa Leaflet
- último check-in do dia por atleta
- métricas reais
- alertas operacionais
- tabela operacional cruzando `profiles`, `checkins` e `plans`

### `athletes.html`
Tela de cadastro administrativo:
- lista real de atletas (`profiles` com `role = athlete`)
- edição real de dados pessoais persistidos em `profiles`
- área preparada para expansão futura de cobertura/seguro, sem persistência falsa

### `reports.html`
Tela de relatórios:
- relatório operacional (`profiles` + `checkins`)
- relatório de cobertura/seguro (`profiles` + `plans`)
- exportação CSV real

## Como publicar no GitHub Pages

1. Extraia o conteúdo do `.zip`.
2. Suba todos os arquivos para um repositório no GitHub.
3. Vá em **Settings > Pages**.
4. Em **Build and deployment**, selecione:
   - **Source:** Deploy from a branch
   - **Branch:** `main` (ou a branch desejada)
   - **Folder:** `/root`
5. Salve.
6. Aguarde o GitHub gerar a URL pública.

Como o projeto é estático, não há etapa de build.

## Configuração do Supabase

A configuração está centralizada em `supabase.js`.

Atualmente o projeto já está apontando para:

```js
const SUPABASE_URL = 'https://knfockwyslspdxyuokvv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_c_F2FA-vcunpHa6PQAgkgA_Frb6x00A';
```

Se precisar trocar no futuro, altere apenas esse arquivo.

## Como o login por username funciona

O campo de login recebe apenas o `username`.

Internamente, o front converte para o padrão:

```text
username@skatetrack.local
```

Exemplos:
- `admin` → `admin@skatetrack.local`
- `atleta1` → `atleta1@skatetrack.local`

A autenticação é feita com `signInWithPassword` do Supabase Auth.
Após o login, o sistema lê a tabela `profiles` e redireciona automaticamente:

- `role = admin` → `admin.html`
- `role = athlete` → `athlete.html`

## Tabelas do Supabase usadas em cada tela

### `profiles`
Usada em:
- controle de perfil e redirecionamento
- dados do atleta
- base administrativa
- relatórios

Campos aproveitados:
- `id`
- `username`
- `full_name`
- `social_name`
- `role`
- `active`
- `sex`
- `birth_date`
- `rg`
- `cpf`
- `created_at`
- `updated_at`

### `checkins`
Usada em:
- check-in GPS
- check-in manual
- histórico do atleta
- mapa geral
- relatórios operacionais

### `checkin_geocoding`
Usada em:
- armazenamento de geocodificação de check-ins manuais
- plotagem de check-ins manuais no mapa da gestão

### `plans`
Usada em:
- cadastro de deslocamentos
- leitura de planos ativos
- cruzamento administrativo
- relatórios de cobertura/seguro

## Regras já implementadas

- login real com Supabase
- persistência de sessão
- logout funcional
- menus separados por perfil
- múltiplos check-ins por dia sem sobrescrever registros anteriores
- último check-in do dia usado como posição atual do mapa
- múltiplos planos por atleta
- exportação CSV funcional
- geolocalização real do navegador
- geocodificação manual com Nominatim
- mapa mundial com Leaflet
- layout responsivo para mobile, tablet e desktop

## Limitações documentadas

### 1. Recuperação de senha
Não foi implementado fluxo de recuperação por e-mail, conforme solicitado.

### 2. Campos administrativos de cobertura futura
Itens como unidade responsável, referência, categoria e situação ainda **não existem nas tabelas informadas**. Por isso, a tela de atletas foi preparada visualmente para expansão futura, mas **sem simular persistência falsa**.

### 3. Dependência de HTTPS para GPS
A captura de localização do navegador depende de contexto seguro. Em produção no GitHub Pages isso normalmente funciona por HTTPS. Em abertura local via arquivo (`file://`) o GPS pode falhar.

### 4. Dependência do RLS já existente
O front foi construído para usar a estrutura real já criada. O comportamento final depende das policies de RLS do Supabase já permitirem:
- o atleta ler e gravar seus próprios registros
- o admin ler todos os registros necessários
- o admin editar os dados permitidos em `profiles`

Se alguma tela carregar sem dados ou falhar em gravação mesmo com o front correto, o primeiro ponto a validar são as policies.

## Testes recomendados após publicação

1. Login com um usuário `athlete`
2. Login com um usuário `admin`
3. Registro de check-in GPS
4. Registro de check-in manual
5. Conferência do histórico do dia
6. Cadastro de plano
7. Visualização do mapa geral
8. Edição de cadastro do atleta pela gestão
9. Exportação dos dois CSVs
10. Logout e retorno ao login

## Observação final

Esta entrega foi montada para ter comportamento de sistema real e não de mockup. Ainda assim, qualquer ajuste fino ligado a policy do Supabase, nomes exatos de usuários já criados no Auth ou permissões de produção pode exigir alinhamento final no ambiente já publicado.
