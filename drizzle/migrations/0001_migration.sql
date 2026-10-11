drop policy if exists "photos read" on storage.objects;
create policy "photos read" on storage.objects for select to authenticated using (
  bucket_id = 'visit-photos' and (
    public.has_role(auth.uid(),'admin')
    or public.schedule_tech(((storage.foldername(name))[1])::uuid) = auth.uid()
    or public.schedule_client(((storage.foldername(name))[1])::uuid) = public.my_client_id()
  )
);
create policy "photos update" on storage.objects for update to authenticated using (
  bucket_id = 'visit-photos' and (public.has_role(auth.uid(),'admin') or public.schedule_tech(((storage.foldername(name))[1])::uuid) = auth.uid())
);