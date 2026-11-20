-- BellaLovers • Esquema inicial para una base de datos NUEVA en Supabase.
-- NO ejecutar en los proyectos de RutaYa / Master Viviana / inventario existente.
-- Requiere PostgreSQL 15+ y extensión pgcrypto (disponible en Supabase).
-- Ejecutar una sola vez en SQL Editor de un proyecto exclusivo de BellaLovers.
create extension if not exists pgcrypto with schema extensions;
create schema if not exists bella_private;
revoke all on schema bella_private from public, anon, authenticated;
grant usage on schema bella_private to authenticated;

create table public.bl_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','operador')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.bl_settings (
  id integer primary key default 1 check (id=1),
  min_purchase integer not null default 50000 check(min_purchase>=0),
  point_value integer not null default 10000 check(point_value>0),
  unlock_points integer not null default 50 check(unlock_points>0),
  student_gift_min integer not null default 150000 check(student_gift_min>=0),
  cycle_months integer not null default 12 check(cycle_months between 1 and 120),
  grace_days integer not null default 30 check(grace_days between 0 and 365),
  exclude_discounts boolean not null default true,
  student_first_no_points boolean not null default true,
  shop_url text not null default 'https://bellashopinsumos-dotcom.github.io/bella-shop-pruebas/',
  updated_at timestamptz not null default now()
);
insert into public.bl_settings(id) values (1);
create table public.bl_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 3 and 120),
  phone text not null unique,
  category text not null check (category in ('estudiante','manicurista','profesora')),
  teacher_verified boolean not null default false,
  marketing_optin boolean not null default false,
  data_policy_accepted_at timestamptz not null,
  blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bl_profiles_category_idx on public.bl_profiles(category);
create table public.bl_teacher_codes (
  teacher_id uuid primary key references public.bl_profiles(id) on delete cascade,
  code text not null unique,
  label text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.bl_referrals (
  student_id uuid primary key references public.bl_profiles(id) on delete cascade,
  teacher_id uuid not null references public.bl_profiles(id),
  code text not null,
  awarded_at timestamptz,
  awarded_purchase uuid,
  created_at timestamptz not null default now(),
  check(student_id<>teacher_id)
);
create index bl_referrals_teacher_idx on public.bl_referrals(teacher_id);
create table public.bl_referral_tiers (
  min_amount integer primary key check(min_amount>=0),
  points integer not null check(points>=0)
);
insert into public.bl_referral_tiers values
  (50000,1),(100000,2),(200000,4),(400000,6),(600000,8),(1000000,10);
create table public.bl_cycles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.bl_profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  grace_until timestamptz not null,
  closed_at timestamptz,
  check (expires_at>started_at and grace_until>=expires_at)
);
create index bl_cycles_customer_idx on public.bl_cycles(customer_id, expires_at desc);
create table public.bl_purchases (
  id uuid primary key default gen_random_uuid(),
  invoice text not null unique check(char_length(trim(invoice)) between 2 and 80),
  customer_id uuid not null references public.bl_profiles(id),
  products_total integer not null check(products_total>=0),
  delivery_fee integer not null default 0 check(delivery_fee>=0),
  special_discount boolean not null default false,
  status text not null default 'confirmada' check(status in ('confirmada','anulada')),
  points_awarded integer not null default 0,
  referral_awarded integer not null default 0,
  welcome_eligible boolean not null default false,
  created_by uuid not null references auth.users(id),
  reason text,
  created_at timestamptz not null default now(),
  voided_at timestamptz
);
create index bl_purchases_customer_idx on public.bl_purchases(customer_id,created_at desc);
create table public.bl_rewards (
  id uuid primary key default gen_random_uuid(),
  product_ref text not null,
  name text not null,
  image_url text,
  points_cost integer not null check(points_cost>0),
  stock integer not null default 0 check(stock>=0),
  reserved integer not null default 0 check(reserved>=0 and reserved<=stock),
  unit_cost integer not null default 0 check(unit_cost>=0),
  audience text not null default 'todas' check(audience in ('todas','estudiante','manicurista','profesora')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.bl_gift_options (
  id uuid primary key default gen_random_uuid(),
  product_ref text not null,
  name text not null,
  stock integer not null default 0 check(stock>=0),
  unit_cost integer not null default 0 check(unit_cost>=0),
  active boolean not null default true
);
create table public.bl_gift_claims (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.bl_profiles(id),
  purchase_id uuid not null references public.bl_purchases(id),
  gift_id uuid not null references public.bl_gift_options(id),
  delivered_by uuid not null references auth.users(id),
  delivered_at timestamptz not null default now()
);
create table public.bl_redemptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.bl_profiles(id),
  total_points integer not null check(total_points>0),
  status text not null default 'solicitada' check(status in ('solicitada','aprobada','rechazada')),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references auth.users(id),
  reason text
);
create index bl_redemptions_customer_idx on public.bl_redemptions(customer_id, created_at desc);
create table public.bl_redemption_items (
  redemption_id uuid not null references public.bl_redemptions(id),
  reward_id uuid not null references public.bl_rewards(id),
  qty integer not null check(qty between 1 and 99),
  points_each integer not null check(points_each>0),
  primary key(redemption_id, reward_id)
);
create table public.bl_points (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.bl_profiles(id),
  cycle_id uuid not null references public.bl_cycles(id),
  delta integer not null check(delta<>0),
  kind text not null check(kind in ('compra','referido','redencion','reintegro','reverso','ajuste','vencimiento')),
  purchase_id uuid references public.bl_purchases(id),
  redemption_id uuid references public.bl_redemptions(id),
  detail text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index bl_points_customer_idx on public.bl_points(customer_id,created_at desc);
create index bl_points_cycle_idx on public.bl_points(cycle_id);
create unique index bl_points_one_purchase_idx on public.bl_points(purchase_id,customer_id,kind) where purchase_id is not null and kind in ('compra','referido','reverso');
create table public.bl_audit (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  entity text not null,
  entity_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index bl_audit_created_idx on public.bl_audit(created_at desc);

-- Función de verificación de permisos en esquema no expuesto por la API.
create or replace function bella_private.staff(p_manager boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.bl_staff where user_id=auth.uid() and active and (not p_manager or role='admin'));
$$;
create or replace function bella_private.log_change(p_action text,p_entity text,p_id text,p_detail jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.bl_audit(actor,action,entity,entity_id,detail) values(auth.uid(),p_action,p_entity,p_id,p_detail);
$$;
create or replace function bella_private.expire_one(p_customer uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; b integer; v integer:=0; threshold integer;
begin
  if auth.uid()<>p_customer and not bella_private.staff() then raise exception 'Sin autorización'; end if;
  select unlock_points into threshold from public.bl_settings where id=1;
  for r in select * from public.bl_cycles where customer_id=p_customer and closed_at is null order by expires_at for update loop
    select coalesce(sum(delta),0)::integer into b from public.bl_points where cycle_id=r.id;
    if (now()>=r.grace_until) or (now()>=r.expires_at and b<threshold) then
      if b>0 then
        insert into public.bl_points(customer_id,cycle_id,delta,kind,detail,created_by)
        values(p_customer,r.id,-b,'vencimiento','Fin de vigencia del ciclo',auth.uid());
        v:=v+b;
      end if;
      update public.bl_cycles set closed_at=now() where id=r.id;
    end if;
  end loop;
  return v;
end;$$;
create or replace function bella_private.add_points(p_customer uuid,p_points integer,p_kind text,p_purchase uuid,p_detail text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c uuid; s record; start_time timestamptz:=now();
begin
  if not bella_private.staff() then raise exception 'Sin autorización'; end if;
  if p_points<=0 then return null; end if;
  perform 1 from public.bl_profiles where id=p_customer and not blocked for update;
  if not found then raise exception 'Cuenta inexistente o bloqueada'; end if;
  perform bella_private.expire_one(p_customer);
  select id into c from public.bl_cycles
    where customer_id=p_customer and started_at<=now() and expires_at>now() and closed_at is null
    order by started_at desc limit 1 for update;
  if c is null then
    select cycle_months,grace_days into s from public.bl_settings where id=1;
    insert into public.bl_cycles(customer_id,started_at,expires_at,grace_until)
    values(p_customer,start_time,start_time+make_interval(months=>s.cycle_months),start_time+make_interval(months=>s.cycle_months,days=>s.grace_days)) returning id into c;
  end if;
  insert into public.bl_points(customer_id,cycle_id,delta,kind,purchase_id,detail,created_by)
  values(p_customer,c,p_points,p_kind,p_purchase,p_detail,auth.uid());
  return c;
end;$$;

create or replace function bella_private.register_customer(p_name text,p_category text,p_teacher_code text,p_marketing boolean,p_accept boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare p_id uuid:=auth.uid(); user_phone text; verified timestamptz; existing public.bl_profiles%rowtype; t record;
begin
  if p_id is null then raise exception 'Inicia sesión con SMS primero'; end if;
  select phone, phone_confirmed_at into user_phone,verified from auth.users where id=p_id;
  if verified is null or user_phone is null or user_phone='' then raise exception 'El celular debe estar verificado por SMS'; end if;
  if p_name is null or char_length(trim(p_name))<3 or char_length(trim(p_name))>120 then raise exception 'Nombre inválido'; end if;
  if p_category not in ('estudiante','manicurista','profesora') then raise exception 'Categoría inválida'; end if;
  if not coalesce(p_accept,false) then raise exception 'Debes aceptar el tratamiento de datos'; end if;
  select * into existing from public.bl_profiles where id=p_id for update;
  if found then
    update public.bl_profiles set full_name=trim(p_name), marketing_optin=coalesce(p_marketing,false),updated_at=now() where id=p_id;
  else
    insert into public.bl_profiles(id,full_name,phone,category,marketing_optin,data_policy_accepted_at)
    values(p_id,trim(p_name),user_phone,p_category,coalesce(p_marketing,false),now());
    if p_category='estudiante' and nullif(trim(coalesce(p_teacher_code,'')),'') is not null then
      select teacher_id,code into t from public.bl_teacher_codes where upper(code)=upper(trim(p_teacher_code)) and enabled;
      if not found or t.teacher_id=p_id then raise exception 'Código de profesora inexistente'; end if;
      insert into public.bl_referrals(student_id,teacher_id,code) values(p_id,t.teacher_id,t.code);
    end if;
  end if;
  perform bella_private.log_change('registro','cliente',p_id::text,'{}'::jsonb);
  return p_id;
end;$$;

create or replace function bella_private.activate_teacher(p_customer uuid,p_label text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if not bella_private.staff(true) then raise exception 'Solo administración'; end if;
  perform 1 from public.bl_profiles where id=p_customer and category='profesora' for update;
  if not found then raise exception 'Debe estar registrada como profesora'; end if;
  update public.bl_profiles set teacher_verified=true where id=p_customer;
  select code into v_code from public.bl_teacher_codes where teacher_id=p_customer;
  if v_code is null then
    v_code:='BL-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    insert into public.bl_teacher_codes(teacher_id,code,label) values(p_customer,v_code,left(trim(p_label),100));
  else
    update public.bl_teacher_codes set label=left(trim(p_label),100),enabled=true where teacher_id=p_customer;
  end if;
  perform bella_private.log_change('habilitar','profesora',p_customer::text,jsonb_build_object('codigo',v_code));
  return v_code;
end;$$;

create or replace function bella_private.record_purchase(p_customer uuid,p_invoice text,p_amount integer,p_discount boolean,p_delivery integer,p_notes text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pr public.bl_profiles%rowtype; cfg public.bl_settings%rowtype; pu uuid; n integer; n_all integer; pts integer:=0; refpts integer:=0; fir boolean:=false; gift boolean:=false; rel record; threshold integer;
begin
  if not bella_private.staff() then raise exception 'Solo empleados autorizados'; end if;
  if p_amount is null or p_amount<0 or p_delivery is null or p_delivery<0 then raise exception 'Valor inválido'; end if;
  if length(trim(coalesce(p_invoice,'')))<2 then raise exception 'Factura obligatoria'; end if;
  select * into pr from public.bl_profiles where id=p_customer for update;
  if not found or pr.blocked then raise exception 'Clienta inexistente o bloqueada'; end if;
  select * into cfg from public.bl_settings where id=1;
  select count(*) into n from public.bl_purchases where customer_id=p_customer and status='confirmada' and products_total>=cfg.min_purchase and (not cfg.exclude_discounts or not special_discount);
  fir:=n=0;
  -- El regalo aplica únicamente a la primera compra real, aunque haya compras previas que no sumaran puntos.
  select count(*) into n_all from public.bl_purchases where customer_id=p_customer and status='confirmada';
  gift:=(pr.category='estudiante' and n_all=0 and p_amount>=cfg.student_gift_min);
  if p_amount>=cfg.min_purchase and (not cfg.exclude_discounts or not coalesce(p_discount,false)) then
    pts:=floor(p_amount::numeric/cfg.point_value)::integer;
    if pr.category='estudiante' and cfg.student_first_no_points and fir then pts:=0; end if;
  end if;
  insert into public.bl_purchases(invoice,customer_id,products_total,delivery_fee,special_discount,points_awarded,welcome_eligible,reason,created_by)
  values(trim(p_invoice),p_customer,p_amount,p_delivery,coalesce(p_discount,false),pts,gift,nullif(p_notes,''),auth.uid()) returning id into pu;
  if pts>0 then perform bella_private.add_points(p_customer,pts,'compra',pu,'Factura '||trim(p_invoice)); end if;
  if pr.category='estudiante' and fir and p_amount>=cfg.min_purchase and (not cfg.exclude_discounts or not coalesce(p_discount,false)) then
    select * into rel from public.bl_referrals where student_id=p_customer and awarded_purchase is null for update;
    if found then
      select coalesce((select points from public.bl_referral_tiers where min_amount<=p_amount order by min_amount desc limit 1),0) into refpts;
      if refpts>0 then
        perform bella_private.add_points(rel.teacher_id,refpts,'referido',pu,'Compra referida verificada');
        update public.bl_referrals set awarded_purchase=pu,awarded_at=now() where student_id=p_customer;
        update public.bl_purchases set referral_awarded=refpts where id=pu;
      end if;
    end if;
  end if;
  perform bella_private.log_change('confirmar','compra',pu::text,jsonb_build_object('invoice',p_invoice,'points',pts,'referral',refpts,'gift',gift));
  return jsonb_build_object('purchase_id',pu,'points',pts,'referral_points',refpts,'welcome_eligible',gift);
end;$$;

create or replace function bella_private.void_purchase(p_purchase uuid,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare pu public.bl_purchases%rowtype; r record;
begin
  if not bella_private.staff(true) then raise exception 'Solo administración'; end if;
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'Indica el motivo de anulación'; end if;
  select * into pu from public.bl_purchases where id=p_purchase for update;
  if not found or pu.status='anulada' then raise exception 'Compra inexistente o anulada'; end if;
  if exists(select 1 from public.bl_gift_claims where purchase_id=p_purchase) then raise exception 'Primero revisa el regalo ya entregado'; end if;
  for r in select customer_id,cycle_id,delta from public.bl_points where purchase_id=p_purchase and kind in ('compra','referido') loop
    perform 1 from public.bl_profiles where id=r.customer_id for update;
    insert into public.bl_points(customer_id,cycle_id,delta,kind,purchase_id,detail,created_by)
      values(r.customer_id,r.cycle_id,-r.delta,'reverso',p_purchase,p_reason,auth.uid());
  end loop;
  update public.bl_purchases set status='anulada',reason=trim(p_reason),voided_at=now() where id=p_purchase;
  update public.bl_referrals set awarded_at=null,awarded_purchase=null where awarded_purchase=p_purchase;
  perform bella_private.log_change('anular','compra',p_purchase::text,jsonb_build_object('motivo',p_reason));
end;$$;

create or replace function bella_private.request_redemption(p_items jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare who uuid:=auth.uid(); profile_type text; threshold integer; available integer; amount integer:=0; r record; c record; spend integer; remaining integer; rid uuid; valid_items jsonb;
begin
  if who is null then raise exception 'Inicia sesión'; end if;
  select category into profile_type from public.bl_profiles where id=who and not blocked for update;
  if not found then raise exception 'Completa tu registro o consulta con BellaShop'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>15 then raise exception 'Selecciona de 1 a 15 premios'; end if;
  perform bella_private.expire_one(who);
  -- Agrupar IDs repetidos y validar cantidad sin dejar el stock negativo.
  for r in select value->>'reward_id' as reward_id, sum((value->>'qty')::integer) as qty from jsonb_array_elements(p_items) group by value->>'reward_id' order by value->>'reward_id' loop
    if r.qty<1 or r.qty>99 then raise exception 'Cantidad inválida'; end if;
    perform 1 from public.bl_rewards where id=r.reward_id::uuid for update;
    select * into c from public.bl_rewards where id=r.reward_id::uuid;
    if not found or not c.active or (c.audience not in ('todas',profile_type)) then raise exception 'Premio no permitido'; end if;
    if c.stock-c.reserved<r.qty then raise exception 'No hay suficientes existencias de %',c.name; end if;
    amount:=amount+c.points_cost*r.qty;
  end loop;
  select unlock_points into threshold from public.bl_settings where id=1;
  select coalesce(sum(v.balance),0)::integer into available from (
    select c.id,coalesce(sum(p.delta),0)::integer balance from public.bl_cycles c
    left join public.bl_points p on p.cycle_id=c.id
    where c.customer_id=who and c.closed_at is null and now()<c.grace_until
      and (now()<c.expires_at or now()<c.grace_until)
    group by c.id
  ) v;
  if available<threshold then raise exception 'Necesitas al menos % puntos para redimir',threshold; end if;
  if amount>available then raise exception 'Tus puntos no alcanzan'; end if;
  insert into public.bl_redemptions(customer_id,total_points) values(who,amount) returning id into rid;
  for r in select value->>'reward_id' reward_id,sum((value->>'qty')::integer) qty from jsonb_array_elements(p_items) group by value->>'reward_id' order by value->>'reward_id' loop
    select * into c from public.bl_rewards where id=r.reward_id::uuid for update;
    insert into public.bl_redemption_items(redemption_id,reward_id,qty,points_each) values(rid,c.id,r.qty,c.points_cost);
    update public.bl_rewards set reserved=reserved+r.qty where id=c.id;
  end loop;
  remaining:=amount;
  for c in select cy.id, coalesce(sum(pt.delta),0)::integer balance from public.bl_cycles cy
      left join public.bl_points pt on pt.cycle_id=cy.id
      where cy.customer_id=who and cy.closed_at is null and now()<cy.grace_until
      group by cy.id having coalesce(sum(pt.delta),0)>0 order by min(cy.expires_at) loop
    exit when remaining=0;
    spend:=least(c.balance,remaining);
    insert into public.bl_points(customer_id,cycle_id,delta,kind,redemption_id,detail)
      values(who,c.id,-spend,'redencion',rid,'Solicitud de premio');
    remaining:=remaining-spend;
  end loop;
  if remaining>0 then raise exception 'Saldo inconsistente, intenta nuevamente'; end if;
  perform bella_private.log_change('solicitar','redencion',rid::text,jsonb_build_object('puntos',amount));
  return rid;
end;$$;

create or replace function bella_private.decide_redemption(p_redemption uuid,p_approve boolean,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare re public.bl_redemptions%rowtype; i record; p record;
begin
  if not bella_private.staff() then raise exception 'Solo empleados autorizados'; end if;
  select * into re from public.bl_redemptions where id=p_redemption for update;
  if not found or re.status<>'solicitada' then raise exception 'Solicitud ya procesada o inexistente'; end if;
  if not p_approve and length(trim(coalesce(p_reason,'')))<3 then raise exception 'Explica por qué rechazas el premio'; end if;
  for i in select * from public.bl_redemption_items where redemption_id=p_redemption order by reward_id loop
    perform 1 from public.bl_rewards where id=i.reward_id for update;
    if p_approve then
      update public.bl_rewards set stock=stock-i.qty,reserved=reserved-i.qty where id=i.reward_id and stock>=i.qty and reserved>=i.qty;
    else
      update public.bl_rewards set reserved=reserved-i.qty where id=i.reward_id and reserved>=i.qty;
    end if;
    if not found then raise exception 'Stock reservado inconsistente'; end if;
  end loop;
  if not p_approve then
    perform 1 from public.bl_profiles where id=re.customer_id for update;
    for p in select cycle_id,-sum(delta)::integer points from public.bl_points where redemption_id=p_redemption and kind='redencion' group by cycle_id loop
      insert into public.bl_points(customer_id,cycle_id,delta,kind,redemption_id,detail,created_by)
      values(re.customer_id,p.cycle_id,p.points,'reintegro',p_redemption,'Solicitud rechazada',auth.uid());
    end loop;
  end if;
  update public.bl_redemptions set status=case when p_approve then 'aprobada' else 'rechazada' end, processed_at=now(),processed_by=auth.uid(),reason=nullif(trim(p_reason),'') where id=p_redemption;
  perform bella_private.log_change('procesar','redencion',p_redemption::text,jsonb_build_object('aprobada',p_approve,'motivo',p_reason));
end;$$;

create or replace function bella_private.deliver_welcome(p_student uuid,p_gift uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare pu uuid; gift_stock integer; gift_claim uuid;
begin
  if not bella_private.staff() then raise exception 'Solo empleados autorizados'; end if;
  perform 1 from public.bl_profiles where id=p_student and category='estudiante' for update;
  if not found then raise exception 'No es estudiante'; end if;
  if exists(select 1 from public.bl_gift_claims where student_id=p_student) then raise exception 'Ya recibió su regalo de bienvenida'; end if;
  select id into pu from public.bl_purchases where customer_id=p_student and status='confirmada' and welcome_eligible order by created_at limit 1;
  if pu is null then raise exception 'La estudiante no cumple la condición de primera compra'; end if;
  select stock into gift_stock from public.bl_gift_options where id=p_gift and active for update;
  if gift_stock is null or gift_stock<1 then raise exception 'Regalo agotado o no disponible'; end if;
  update public.bl_gift_options set stock=stock-1 where id=p_gift;
  insert into public.bl_gift_claims(student_id,purchase_id,gift_id,delivered_by) values(p_student,pu,p_gift,auth.uid()) returning id into gift_claim;
  perform bella_private.log_change('entregar','regalo',gift_claim::text,jsonb_build_object('estudiante',p_student));
  return gift_claim;
end;$$;

create or replace function bella_private.adjust_points(p_customer uuid,p_delta integer,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare c uuid; available integer;
begin
  if not bella_private.staff(true) then raise exception 'Solo administración'; end if;
  if p_delta=0 or p_delta is null or abs(p_delta)>10000 then raise exception 'Ajuste fuera de rango'; end if;
  if length(trim(coalesce(p_reason,'')))<8 then raise exception 'Motivo obligatorio de al menos 8 caracteres'; end if;
  if p_delta>0 then
    c:=bella_private.add_points(p_customer,p_delta,'ajuste',null,p_reason);
  else
    perform 1 from public.bl_profiles where id=p_customer for update;
    perform bella_private.expire_one(p_customer);
    select cy.id,coalesce(sum(pt.delta),0)::integer into c,available from public.bl_cycles cy
       left join public.bl_points pt on pt.cycle_id=cy.id
       where cy.customer_id=p_customer and cy.closed_at is null and now()<cy.grace_until
       group by cy.id order by min(cy.expires_at) limit 1;
    if c is null or available < -p_delta then raise exception 'Saldo insuficiente para ajuste'; end if;
    insert into public.bl_points(customer_id,cycle_id,delta,kind,detail,created_by)
    values(p_customer,c,p_delta,'ajuste',p_reason,auth.uid());
  end if;
  perform bella_private.log_change('ajuste','puntos',p_customer::text,jsonb_build_object('delta',p_delta,'motivo',p_reason));
end;$$;

create or replace function bella_private.expire_all_due() returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; count_total integer:=0;
begin
  if not bella_private.staff(true) then raise exception 'Solo administración'; end if;
  for r in select distinct customer_id from public.bl_cycles where closed_at is null and now()>=expires_at limit 500 loop
    count_total:=count_total+bella_private.expire_one(r.customer_id);
  end loop;
  perform bella_private.log_change('procesar','vencimientos','lote',jsonb_build_object('puntos',count_total));
  return count_total;
end;$$;

-- Fachadas de RPC con SECURITY INVOKER; privilegios altos quedan en bella_private.
create function public.bl_register(p_name text,p_category text,p_teacher_code text,p_marketing boolean,p_accept boolean) returns uuid
language sql security invoker set search_path = '' as $$select bella_private.register_customer(p_name,p_category,p_teacher_code,p_marketing,p_accept)$$;
create function public.bl_activate_teacher(p_customer uuid,p_label text) returns text
language sql security invoker set search_path = '' as $$select bella_private.activate_teacher(p_customer,p_label)$$;
create function public.bl_purchase(p_customer uuid,p_invoice text,p_amount integer,p_discount boolean,p_delivery integer,p_notes text) returns jsonb
language sql security invoker set search_path = '' as $$select bella_private.record_purchase(p_customer,p_invoice,p_amount,p_discount,p_delivery,p_notes)$$;
create function public.bl_void_purchase(p_purchase uuid,p_reason text) returns void
language sql security invoker set search_path = '' as $$select bella_private.void_purchase(p_purchase,p_reason)$$;
create function public.bl_redeem(p_items jsonb) returns uuid
language sql security invoker set search_path = '' as $$select bella_private.request_redemption(p_items)$$;
create function public.bl_decide_redemption(p_redemption uuid,p_approve boolean,p_reason text) returns void
language sql security invoker set search_path = '' as $$select bella_private.decide_redemption(p_redemption,p_approve,p_reason)$$;
create function public.bl_deliver_welcome(p_student uuid,p_gift uuid) returns uuid
language sql security invoker set search_path = '' as $$select bella_private.deliver_welcome(p_student,p_gift)$$;
create function public.bl_adjust_points(p_customer uuid,p_delta integer,p_reason text) returns void
language sql security invoker set search_path = '' as $$select bella_private.adjust_points(p_customer,p_delta,p_reason)$$;
create function public.bl_sync_my_points() returns integer
language sql security invoker set search_path = '' as $$select bella_private.expire_one(auth.uid())$$;
create function public.bl_expire_due() returns integer
language sql security invoker set search_path = '' as $$select bella_private.expire_all_due()$$;

-- Auditar operaciones directas hechas por personal autorizado (configuración, perfiles y catálogos).
create or replace function bella_private.audit_mutation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare entity_id text;
begin
  entity_id:=case when TG_OP='DELETE' then to_jsonb(old)->>'id' else to_jsonb(new)->>'id' end;
  if entity_id is null and TG_TABLE_NAME='bl_settings' then entity_id:='1'; end if;
  if entity_id is null and TG_TABLE_NAME='bl_referral_tiers' then
    entity_id:=coalesce(to_jsonb(new)->>'min_amount',to_jsonb(old)->>'min_amount');
  end if;
  insert into public.bl_audit(actor,action,entity,entity_id,detail)
  values(auth.uid(),lower(TG_OP),TG_TABLE_NAME,entity_id,jsonb_build_object('fecha',now()));
  if TG_OP='DELETE' then return old; end if;
  return new;
end;$$;
create trigger bl_audit_profiles after update on public.bl_profiles for each row execute function bella_private.audit_mutation();
create trigger bl_audit_rewards after insert or update or delete on public.bl_rewards for each row execute function bella_private.audit_mutation();
create trigger bl_audit_gift_options after insert or update or delete on public.bl_gift_options for each row execute function bella_private.audit_mutation();
create trigger bl_audit_settings after update on public.bl_settings for each row execute function bella_private.audit_mutation();
create trigger bl_audit_tiers after insert or update or delete on public.bl_referral_tiers for each row execute function bella_private.audit_mutation();

-- RLS: privacidad por usuario y lectura para empleados aprobados.
do $$ declare table_name text; begin
  foreach table_name in array array['bl_staff','bl_settings','bl_profiles','bl_teacher_codes','bl_referrals','bl_referral_tiers','bl_cycles','bl_purchases','bl_rewards','bl_gift_options','bl_gift_claims','bl_redemptions','bl_redemption_items','bl_points','bl_audit'] loop
    execute format('alter table public.%I enable row level security',table_name);
  end loop;
end $$;
create policy bl_staff_read on public.bl_staff for select to authenticated using(user_id=(select auth.uid()) or (select bella_private.staff(true)));
create policy bl_settings_read on public.bl_settings for select to authenticated using(true);
create policy bl_settings_write on public.bl_settings for update to authenticated using((select bella_private.staff(true))) with check((select bella_private.staff(true)));
create policy bl_profiles_read on public.bl_profiles for select to authenticated using(id=(select auth.uid()) or (select bella_private.staff()));
create policy bl_profiles_staff_update on public.bl_profiles for update to authenticated using((select bella_private.staff(true))) with check((select bella_private.staff(true)));
create policy bl_teachers_read on public.bl_teacher_codes for select to authenticated using(enabled or teacher_id=(select auth.uid()) or (select bella_private.staff()));
create policy bl_referrals_read on public.bl_referrals for select to authenticated using(student_id=(select auth.uid()) or (select bella_private.staff()));
create policy bl_tiers_read on public.bl_referral_tiers for select to authenticated using(true);
create policy bl_tiers_modify on public.bl_referral_tiers for all to authenticated using((select bella_private.staff(true))) with check((select bella_private.staff(true)));
create policy bl_cycles_read on public.bl_cycles for select to authenticated using(customer_id=(select auth.uid()) or (select bella_private.staff()));
create policy bl_purchases_read on public.bl_purchases for select to authenticated using(customer_id=(select auth.uid()) or (select bella_private.staff()));
create policy bl_rewards_read on public.bl_rewards for select to authenticated using(active or (select bella_private.staff()));
create policy bl_rewards_manage on public.bl_rewards for all to authenticated using((select bella_private.staff(true))) with check((select bella_private.staff(true)));
create policy bl_gifts_read on public.bl_gift_options for select to authenticated using(active or (select bella_private.staff()));
create policy bl_gifts_manage on public.bl_gift_options for all to authenticated using((select bella_private.staff(true))) with check((select bella_private.staff(true)));
create policy bl_claims_read on public.bl_gift_claims for select to authenticated using(student_id=(select auth.uid()) or (select bella_private.staff()));
create policy bl_redemptions_read on public.bl_redemptions for select to authenticated using(customer_id=(select auth.uid()) or (select bella_private.staff()));
create policy bl_redemption_items_read on public.bl_redemption_items for select to authenticated using(exists(select 1 from public.bl_redemptions r where r.id=redemption_id and (r.customer_id=(select auth.uid()) or (select bella_private.staff()))));
create policy bl_points_read on public.bl_points for select to authenticated using(customer_id=(select auth.uid()) or (select bella_private.staff()));
create policy bl_audit_read on public.bl_audit for select to authenticated using((select bella_private.staff(true)));

-- Dar acceso SELECT a las tablas para que RLS decida las filas visibles.
grant select on public.bl_staff,public.bl_settings,public.bl_profiles,public.bl_teacher_codes,public.bl_referrals,public.bl_referral_tiers,public.bl_cycles,public.bl_purchases,public.bl_rewards,public.bl_gift_options,public.bl_gift_claims,public.bl_redemptions,public.bl_redemption_items,public.bl_points,public.bl_audit to authenticated;
grant insert,update,delete on public.bl_rewards,public.bl_gift_options,public.bl_referral_tiers to authenticated;
grant update on public.bl_settings,public.bl_profiles to authenticated;
-- El rol anónimo no tiene lectura ni escrituras de datos privados.
revoke all on public.bl_staff,public.bl_settings,public.bl_profiles,public.bl_teacher_codes,public.bl_referrals,public.bl_referral_tiers,public.bl_cycles,public.bl_purchases,public.bl_rewards,public.bl_gift_options,public.bl_gift_claims,public.bl_redemptions,public.bl_redemption_items,public.bl_points,public.bl_audit from anon;
-- Las funciones nuevas en Postgres reciben EXECUTE para PUBLIC por defecto: retirarlo.
revoke execute on all functions in schema bella_private from public,anon,authenticated;
revoke execute on function public.bl_register(text,text,text,boolean,boolean),public.bl_activate_teacher(uuid,text),public.bl_purchase(uuid,text,integer,boolean,integer,text),public.bl_void_purchase(uuid,text),public.bl_redeem(jsonb),public.bl_decide_redemption(uuid,boolean,text),public.bl_deliver_welcome(uuid,uuid),public.bl_adjust_points(uuid,integer,text),public.bl_sync_my_points(),public.bl_expire_due() from public,anon;
grant execute on function bella_private.staff(boolean) to authenticated;
grant execute on function bella_private.register_customer(text,text,text,boolean,boolean) to authenticated;
grant execute on function bella_private.activate_teacher(uuid,text) to authenticated;
grant execute on function bella_private.record_purchase(uuid,text,integer,boolean,integer,text) to authenticated;
grant execute on function bella_private.void_purchase(uuid,text) to authenticated;
grant execute on function bella_private.request_redemption(jsonb) to authenticated;
grant execute on function bella_private.decide_redemption(uuid,boolean,text) to authenticated;
grant execute on function bella_private.deliver_welcome(uuid,uuid) to authenticated;
grant execute on function bella_private.adjust_points(uuid,integer,text) to authenticated;
grant execute on function bella_private.expire_one(uuid) to authenticated;
grant execute on function bella_private.expire_all_due() to authenticated;
-- Las funciones internas llamadas dentro de funciones SECURITY DEFINER se ejecutan con el propietario de la BD.
grant execute on function public.bl_register(text,text,text,boolean,boolean),public.bl_activate_teacher(uuid,text),public.bl_purchase(uuid,text,integer,boolean,integer,text),public.bl_void_purchase(uuid,text),public.bl_redeem(jsonb),public.bl_decide_redemption(uuid,boolean,text),public.bl_deliver_welcome(uuid,uuid),public.bl_adjust_points(uuid,integer,text),public.bl_sync_my_points(),public.bl_expire_due() to authenticated;
-- Importante: ninguna de estas RPC acepta un parámetro de identidad para suplantar la cuenta cliente.
-- Para habilitar el primer administrador, crear usuario email/contraseña en Authentication,
-- después ejecutar (reemplazar correo real):
-- insert into public.bl_staff(user_id,role)
-- select id,'admin' from auth.users where email='ADMIN@TUCORREO.COM';
