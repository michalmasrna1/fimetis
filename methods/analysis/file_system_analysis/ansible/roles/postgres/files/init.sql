CREATE SEQUENCE case_id_seq;

CREATE TABLE "case" (
  id int NOT NULL PRIMARY KEY default nextval('case_id_seq'), 
  name varchar(64) NOT NULL, 
  description varchar(128), 
  created timestamp NOT NULL DEFAULT now()
);

CREATE SEQUENCE user_id_seq;

CREATE TABLE "user" (
  id int NOT NULL PRIMARY KEY default nextval('user_id_seq'), 
  login varchar(64) NOT NULL, 
  password varchar(256) NOT NULL,
  name varchar(128), 
  mail varchar(64),
  is_super_admin boolean NOT NULL default FALSE
);

CREATE TYPE fimetis_role AS ENUM ('admin', 'user');

CREATE TABLE "access" (
  user_id int REFERENCES "user"(id), 
  case_id int REFERENCES "case"(id), 
  role fimetis_role NOT NULL default 'user'
);

CREATE SEQUENCE note_id_seq;

CREATE TABLE "note" (
  id int NOT NULL PRIMARY KEY default nextval('note_id_seq'),
  text varchar(2048),
  user_id int REFERENCES "user"(id),
  case_id int REFERENCES "case"(id)
);

CREATE TABLE "mark" (
  id varchar(64) NOT NULL,
  user_id int REFERENCES "user"(id),
  case_id int REFERENCES "case"(id)
);
