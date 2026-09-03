-- Demo lifecycle status, same 3 values as the higher-role demo_plots table
-- (migration 006/015) - needed for the monitoring page's Edit restriction
-- and Complete/Terminate actions.
alter table tfo_demos add column status text not null default 'ongoing';
alter table tfo_demos add constraint tfo_demos_status_check check (status in ('ongoing', 'completed', 'terminated'));
