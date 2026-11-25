-- PROPOSTA — aplicar manualmente no Supabase após revisão.
-- Admin autorizado: kazin1324@gmail.com
-- Este arquivo NÃO foi executado no projeto.

begin;

-- Catálogo: leitura pública; escrita somente pelo usuário administrativo.
drop policy if exists "Enable insert for authenticated users only" on public.tarefas;
drop policy if exists "Florenza admin insert tarefas" on public.tarefas;
drop policy if exists "Florenza admin update tarefas" on public.tarefas;
drop policy if exists "Florenza admin delete tarefas" on public.tarefas;

create policy "Florenza admin insert tarefas"
on public.tarefas for insert to authenticated
with check (lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'kazin1324@gmail.com');

create policy "Florenza admin update tarefas"
on public.tarefas for update to authenticated
using (lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'kazin1324@gmail.com')
with check (lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'kazin1324@gmail.com');

create policy "Florenza admin delete tarefas"
on public.tarefas for delete to authenticated
using (lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'kazin1324@gmail.com');

-- Mídias: vitrine pode ler somente mídias ativas; CRUD restrito ao admin.
drop policy if exists "Florenza public read active media" on public.produto_midias;
drop policy if exists "Florenza admin manage media" on public.produto_midias;

create policy "Florenza public read active media"
on public.produto_midias for select to anon, authenticated
using (
  ativo = true
  or lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'kazin1324@gmail.com'
);

create policy "Florenza admin manage media"
on public.produto_midias for all to authenticated
using (lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'kazin1324@gmail.com')
with check (lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'kazin1324@gmail.com');

-- Leads: visitantes podem cadastrar o próprio e-mail; somente admin pode consultar.
drop policy if exists "Florenza public create lead" on public.leads;
drop policy if exists "Florenza admin read leads" on public.leads;

create policy "Florenza public create lead"
on public.leads for insert to anon, authenticated
with check (
  email is not null
  and length(email) <= 254
  and email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$'
);

create policy "Florenza admin read leads"
on public.leads for select to authenticated
using (lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'kazin1324@gmail.com');

-- Storage: acesso público de leitura aos modelos; escrita/administração somente admin.
drop policy if exists "Florenza public read product models" on storage.objects;
drop policy if exists "Florenza admin upload product models" on storage.objects;
drop policy if exists "Florenza admin update product models" on storage.objects;
drop policy if exists "Florenza admin delete product models" on storage.objects;

create policy "Florenza public read product models"
on storage.objects for select to anon, authenticated
using (bucket_id = 'product-models');

create policy "Florenza admin upload product models"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-models'
  and lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'kazin1324@gmail.com'
);

create policy "Florenza admin update product models"
on storage.objects for update to authenticated
using (
  bucket_id = 'product-models'
  and lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'kazin1324@gmail.com'
)
with check (
  bucket_id = 'product-models'
  and lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'kazin1324@gmail.com'
);

create policy "Florenza admin delete product models"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-models'
  and lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'kazin1324@gmail.com'
);

commit;
