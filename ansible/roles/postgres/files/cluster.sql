INSERT INTO public.cluster (id, name, filter_id, definition, description) VALUES (6, 'user SSH files', 1, '\/(home|root).*\.ssh\/(id_rsa|authorized_keys).*', 'files according to regex .*.ssh\/(id_rsa|authorized_keys*).');
INSERT INTO public.cluster (id, name, filter_id, definition, description) VALUES (7, 'standard executables', 1, '\/bin\/.*|\/sbin\/.*|\/usr\/bin\/.*|\/usr\/sbin\/.*|\/usr\/local\/bin.*|\/usr\/local\/sbin.*', 'files in /bin /sbin /usr/bin /usr/sbin /usr/local/bin /usr/local/sbin');
INSERT INTO public.cluster (id, name, filter_id, definition, description) VALUES (8, 'python scripts', 1, '.*\.py( \(\$FILE_NAME\))?( \(deleted\)| \(deleted-realloc\))?', 'files with .py extension');
INSERT INTO public.cluster (id, name, filter_id, definition, description) VALUES (9, 'shell scripts', 1, '.*\.sh( \(\$FILE_NAME\))?( \(deleted\)| \(deleted-realloc\))?', 'files with .sh extension');
INSERT INTO public.cluster (id, name, filter_id, definition, description) VALUES (10, 'php scripts', 1, '.*\.php( \(\$FILE_NAME\))?( \(deleted\)| \(deleted-realloc\))?', 'files with .php extension');
INSERT INTO public.cluster (id, name, filter_id, definition, description) VALUES (11, 'perl scripts', 1, '.*\.pl( \(\$FILE_NAME\))?( \(deleted\)| \(deleted-realloc\))?', 'files with .pl extension');
INSERT INTO public.cluster (id, name, filter_id, definition, description) VALUES (12, 'cron definition', 1, '(\/var\/spool\/cron\/.*|\/etc\/cron\.d\/.*|\/etc\/cron\/.*|\/etc\/anacrontab\/.*)', 'cron definition in /var/spool/cron /etc/cron.d/ /etc/cron/ /etc/anacrontab');
INSERT INTO public.cluster (id, name, filter_id, definition, description) VALUES (13, 'starts with "."', 1, '.*\/\..*', 'files that starts with a .');
INSERT INTO public.cluster (id, name, filter_id, definition, description) VALUES (14, 'suspicious files', 1, '.*\/\.\.\..*|.*\/\\s{2,}.*|.*\/\.{3,}.*', 'files that match regex .*\/\.\.\..*|.*\/[\s.]* (consists of dots and white spaces)');
INSERT INTO public.cluster (id, name, filter_id, definition, description) VALUES (15, 'executables with sbit', 3, 'r.*s.*', 'executable files with the S-bit (uid/gid) being set');
INSERT INTO public.cluster (id, name, filter_id, definition, description) VALUES (16, 'weak permissions', 3, '(d|r)(.)*w(x|-)', 'files writable for users');
INSERT INTO public.cluster (id, name, filter_id, definition, description) VALUES (17, 'compilation signs', 1, '(\/usr\/)(include|bin\/gcc).*', 'compilation signs');
INSERT INTO public.cluster (id, name, filter_id, definition, description) VALUES (18, 'unusual commands', 1, '((\/usr){0,1})(\/(s){0,1}bin\/)(shred|curl|wget)', 'commands wget curl shred');
INSERT INTO public.cluster (id, name, filter_id, definition, description) VALUES (19, 'system configuration changes', 1, '(\/etc\/crontab\/.*|\/etc\/cron\..*|\/var\/spool\/cron\/crontabs\/.*|\/etc\/init\.d\/.*|\/etc\/rc.local|\/etc\/passwd|\/etc\/shadow)', 'System configuration files (matches crontab definitions, /etc/init.d/, /etc/rc.local, /etc/passwd, /etc/shadow files)');
INSERT INTO public.cluster (id, name, filter_id, definition, description) VALUES (20, 'all files', 2, '', 'All files in dataset');
