#!/bin/bash

INITIALIZED="/copas-fimetis/initialized"

set -m

#################### Elasticsearch #####################
# This process cannot lock memory
sudo -u elasticsearch /usr/share/elasticsearch/bin/elasticsearch &

######################## Nginx #########################
/usr/sbin/nginx &

######################## Flask #########################
cd /opt/backend && export PATH=/opt/backend/venv/bin:/usr/bin:/usr/sbin && sudo -u www-data /opt/backend/venv/bin/uwsgi --ini /opt/backend/backendAPI.ini &

###################### Postgres ########################
sudo -u postgres /usr/lib/postgresql/14/bin/postgres -D /var/lib/postgresql/14/main -c config_file=/etc/postgresql/14/main/postgresql.conf &

# #################### Uploading data ####################
# Only upload the initial data on the first run
if [ ! -e $INITIALIZED ]; then
    touch $INITIALIZED
    # Wait for all of the services to start
    sleep 10
    sudo -u postgres createuser -s fimetis
    sudo -u postgres createdb fimetis

    pushd /tmp
    sudo -u fimetis psql fimetis fimetis -f init.sql
    sudo -u fimetis psql fimetis fimetis -f filter.sql
    sudo -u fimetis psql fimetis fimetis -f cluster.sql
    sudo -u fimetis psql fimetis fimetis -f insert_test_case.sql
    popd

    source /opt/backend/venv/bin/activate && /opt/backend/import_super_admin.py --user admin --passwd timesix-elk

    source /opt/backend/venv/bin/activate && python3 /opt/backend/import_metadata.py --input_file /opt/metadata-uploader/test.mac --case test --format mactime
    curl -XPOST 'localhost:9200/filter/typename' -H 'Content-Type: application/json' -d '{ "name": "select all", "type": "template", "json": "{\"match_all\": {}}"}'
fi

####################### Copas UI #######################

cd /copas-ui && gunicorn "app:create_app()" &

fg %1