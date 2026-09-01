alter table farmers add column status text not null default 'active';
alter table farmers add constraint farmers_status_check check (status in ('active', 'deactivated'));
