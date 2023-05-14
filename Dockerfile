FROM ip-147-251-115-39.flt.cloud.muni.cz:8080/copas-base:4.0.0

WORKDIR /copas-fimetis

RUN export DEBIAN_FRONTEND=noninteractive \
    && apt-get update \
    && apt-get install -y wget curl sudo gnupg python3-pip \
    && pip3 install --upgrade pip \
    && pip3 install ansible==2.10 \
    && rm -rf /var/lib/apt/lists/*

COPY . .

# move the Copas UI configuration to the configuration directory
RUN cp -r /copas-fimetis/ui_config/* /etc/copas

RUN ansible-playbook /copas-fimetis/ansible/fs_analysis-playbook.yml

# Add the required line to the start of the file
RUN cp /etc/postgresql/14/main/pg_hba.conf /etc/postgresql/14/main/pg_hba.conf.tmp \
    && echo "local fimetis fimetis trust" > /etc/postgresql/14/main/pg_hba.conf \
    && cat /etc/postgresql/14/main/pg_hba.conf.tmp >> /etc/postgresql/14/main/pg_hba.conf \
    && rm /etc/postgresql/14/main/pg_hba.conf.tmp

LABEL copas.module.description="The Fimetis tool enables the examination of file system metadata." \
    copas.module.author.name="Michal Masrna" \
    copas.module.author.email="514084@muni.cz" \
    copas.module.author.institution="Masaryk University"

CMD ["/bin/bash", "/copas-fimetis/init.sh"]