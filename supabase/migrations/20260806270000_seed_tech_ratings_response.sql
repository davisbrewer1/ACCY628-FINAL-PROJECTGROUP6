-- Light demo metrics for manager Technicians page: 2 ratings + response times per tech.

with picks as (
  select
    st.id as ticket_id,
    st.customer_id,
    st.assigned_technician_id as technician_id,
    coalesce(st.opened_at, st.created_at) as opened_at,
    t.technician_name,
    row_number() over (
      partition by st.assigned_technician_id
      order by coalesce(st.completed_at, st.opened_at) desc
    ) as rn
  from public.service_tickets st
  join public.technicians t on t.id = st.assigned_technician_id
  where st.status = 'Completed'
    and st.assigned_technician_id is not null
),
chosen as (
  select * from picks where rn <= 2
),
seed as (
  select
    c.*,
    case c.technician_name
      when 'Kai Cipher' then case c.rn when 1 then 0.4 else 0.7 end
      when 'Quinn Volt' then case c.rn when 1 then 0.6 else 1.1 end
      when 'Terry Tech' then case c.rn when 1 then 1.0 else 1.5 end
      when 'Jamie Network' then case c.rn when 1 then 0.9 else 1.8 end
      when 'Chris Cloud' then case c.rn when 1 then 1.2 else 2.0 end
      when 'Dana Desktop' then case c.rn when 1 then 1.5 else 2.5 end
      when 'Evan Endpoint' then case c.rn when 1 then 0.8 else 1.3 end
      else case c.rn when 1 then 1.4 else 2.2 end
    end as response_hours,
    case c.technician_name
      when 'Kai Cipher' then case c.rn when 1 then 5 else 5 end
      when 'Quinn Volt' then case c.rn when 1 then 5 else 4 end
      when 'Terry Tech' then case c.rn when 1 then 4 else 4 end
      when 'Jamie Network' then case c.rn when 1 then 5 else 4 end
      when 'Chris Cloud' then case c.rn when 1 then 4 else 3 end
      when 'Dana Desktop' then case c.rn when 1 then 4 else 5 end
      when 'Evan Endpoint' then case c.rn when 1 then 5 else 4 end
      else case c.rn when 1 then 3 else 4 end
    end as stars,
    case c.rn
      when 1 then 'Quick help — issue resolved cleanly.'
      else 'Solid work, appreciated the update.'
    end as comment_text
  from chosen c
),
upd as (
  update public.service_tickets st
  set
    responded_at = s.opened_at + make_interval(mins => greatest(15, (s.response_hours * 60)::int)),
    target_response_at = coalesce(
      st.target_response_at,
      s.opened_at + interval '4 hours'
    )
  from seed s
  where st.id = s.ticket_id
  returning st.id
)
insert into public.ticket_ratings (
  ticket_id, customer_id, technician_id, rated_by, rating, comment
)
select
  s.ticket_id,
  s.customer_id,
  s.technician_id,
  '33333333-3333-3333-3333-333333333307'::uuid,
  s.stars,
  s.comment_text
from seed s
on conflict (ticket_id) do update
set
  rating = excluded.rating,
  comment = excluded.comment,
  technician_id = excluded.technician_id,
  updated_at = now();
