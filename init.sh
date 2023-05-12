#!/bin/bash

set -m

#################### Elasticsearch #####################
# This process cannot lock memory
sudo -u elasticsearch /usr/share/elasticsearch/bin/elasticsearch &

######################## Nginx #########################
/usr/sbin/nginx &

######################## Flask #########################
cd /opt/backend && export PATH=/opt/backend/venv/bin:/usr/bin:/usr/sbin && sudo -u www-data /opt/backend/venv/bin/uwsgi --ini /opt/backend/backendAPI.ini &

###################### Postgres ########################
# Add the required line to the start of the file
cp /etc/postgresql/14/main/pg_hba.conf /etc/postgresql/14/main/pg_hba.conf.tmp
echo "local fimetis fimetis trust" > /etc/postgresql/14/main/pg_hba.conf
cat /etc/postgresql/14/main/pg_hba.conf.tmp >> /etc/postgresql/14/main/pg_hba.conf
rm /etc/postgresql/14/main/pg_hba.conf.tmp

sudo -u postgres /usr/lib/postgresql/14/bin/postgres -D /var/lib/postgresql/14/main -c config_file=/etc/postgresql/14/main/postgresql.conf &
sleep 10 # wait for the postgres to start
sudo -u postgres createuser -s fimetis
sudo -u postgres createdb fimetis

pushd /tmp
sudo -u fimetis psql fimetis fimetis -f init.sql
sudo -u fimetis psql fimetis fimetis -f filter.sql
sudo -u fimetis psql fimetis fimetis -f cluster.sql
popd

source /opt/backend/venv/bin/activate && /opt/backend/import_super_admin.py --user admin --passwd timesix-elk

#################### Uploading data ####################
pushd /tmp
psql fimetis fimetis -f insert_test_case.sql
popd
source /opt/backend/venv/bin/activate && python3 /opt/backend/import_metadata.py --input_file /opt/metadata-uploader/test.mac --case test --format mactime
curl -XPOST 'localhost:9200/filter/typename' -H 'Content-Type: application/json' -d '{ "name": "select all", "type": "template", "json": "{\"match_all\": {}}"}'

####################### Copas UI #######################

cd /copas-ui && gunicorn "app:create_app()" &

fg %1