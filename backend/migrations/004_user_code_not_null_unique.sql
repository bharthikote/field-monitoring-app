alter table users alter column user_code set not null;

alter table users drop constraint if exists users_user_code_key;
alter table users add constraint users_user_code_key unique (user_code);
