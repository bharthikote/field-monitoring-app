-- TFO demos and higher-official demo plots are one list now: every crop in a
-- TFO demo also exists as a demo_plots row, so visits and issues (which
-- attach to demo_plots) work on them exactly like on any other plot.
--
-- Linked by (demo, crop, variety) rather than by crop-row id: editing a TFO
-- demo replaces its tfo_demo_crops rows wholesale, and a plot with visits
-- and issues on it has to survive that.
alter table demo_plots add column if not exists tfo_demo_id uuid references tfo_demos(id) on delete set null;
alter table demo_plots add column if not exists cycle text
  check (cycle is null or cycle in (
    'demo_1', 'demo_2', 'demo_3', 'demo_4',
    'adoption_1', 'adoption_2', 'adoption_3', 'adoption_4'
  ));

create unique index if not exists demo_plots_tfo_demo_crop_key
  on demo_plots (tfo_demo_id, crop_id, variety_id) where tfo_demo_id is not null;

-- Backfill every existing TFO demo crop that doesn't have a plot yet.
insert into demo_plots
  (farmer_id, farmer_name, farmer_phone, crop_id, variety_id, village_id, demo_status, plot_type, cycle, created_by, tfo_demo_id, created_at)
select distinct on (td.id, tdc.crop_id, tdc.variety_id)
  td.farmer_id, f.name, f.phone, tdc.crop_id, tdc.variety_id, td.village_id, td.status,
  case when td.cycle like 'adoption%' then 'adoption' else 'demo' end,
  td.cycle, td.created_by, td.id, td.created_at
from tfo_demos td
join farmers f on f.id = td.farmer_id
join tfo_demo_crops tdc on tdc.demo_id = td.id
where not exists (
  select 1 from demo_plots dp
  where dp.tfo_demo_id = td.id and dp.crop_id = tdc.crop_id and dp.variety_id = tdc.variety_id
)
order by td.id, tdc.crop_id, tdc.variety_id, tdc.created_at;
