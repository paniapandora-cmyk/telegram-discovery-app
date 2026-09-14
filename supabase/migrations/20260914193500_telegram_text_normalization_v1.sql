create or replace function public.normalize_telegram_text_v1(p_text text)
returns text
language plpgsql
immutable
set search_path to 'pg_catalog'
as $$
declare
  lines text[];
  n integer;
  block_size integer;
  left_block text;
  right_block text;
  changed boolean;
  result_text text;
begin
  if p_text is null then return null; end if;

  result_text := replace(replace(replace(replace(replace(p_text,'&quot;','"'),'&#39;',''''),'&apos;',''''),'&lt;','<'),'&gt;','>');
  result_text := replace(result_text,'&amp;','&');
  result_text := regexp_replace(result_text, E'\r\n?', E'\n', 'g');
  result_text := btrim(result_text);
  if result_text = '' then return null; end if;

  lines := regexp_split_to_array(result_text, E'\n');

  loop
    changed := false;
    n := coalesce(array_length(lines,1),0);
    exit when n < 2;

    for block_size in reverse least(40,n/2)..1 loop
      left_block := array_to_string(lines[(n-(2*block_size)+1):(n-block_size)], E'\n');
      right_block := array_to_string(lines[(n-block_size+1):n], E'\n');
      if length(btrim(left_block)) >= 20 and left_block = right_block then
        lines := lines[1:(n-block_size)];
        changed := true;
        exit;
      end if;
    end loop;

    exit when not changed;
  end loop;

  result_text := btrim(array_to_string(lines,E'\n'));
  return nullif(result_text,'');
end;
$$;

create or replace function public.normalize_telegram_content_trigger_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $$
begin
  if new.source_type='TELEGRAM' then
    new.text_content := public.normalize_telegram_text_v1(new.text_content);
    new.description := public.normalize_telegram_text_v1(new.description);
    if new.text_content is not null then
      new.title := left(new.text_content,160);
    end if;
    new.metadata := coalesce(new.metadata,'{}'::jsonb) || jsonb_build_object('text_normalized_version',1);
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_telegram_content_v1 on public.contents;
create trigger normalize_telegram_content_v1
before insert or update of text_content,description,title on public.contents
for each row
when (new.source_type='TELEGRAM')
execute function public.normalize_telegram_content_trigger_v1();

revoke all on function public.normalize_telegram_content_trigger_v1() from public,anon,authenticated;
revoke all on function public.normalize_telegram_text_v1(text) from public,anon,authenticated;
grant execute on function public.normalize_telegram_text_v1(text) to service_role;
