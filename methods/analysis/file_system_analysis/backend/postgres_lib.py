import psycopg2
from contextlib import closing

PG_USER = 'fimetis'
PG_DB = 'fimetis'


def get_db_connection():
    return psycopg2.connect(database=PG_DB, user=PG_USER, password=None)


def insert_case(name, description):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('INSERT INTO "case" (name, description) VALUES (%s, %s)', (name, description))
        conn.commit()
    conn.close()


def insert_user_case_role(user_name, case_name, role):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE login=%s', (user_name,))
        user_id = cur.fetchone()[0]

        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]

        cur.execute('INSERT INTO "access" (user_id, case_id, role) VALUES (%s, %s, %s)', (user_id, case_id, role))
        conn.commit()
    conn.close()


def get_user_by_login(login):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT password, is_super_admin FROM "user" WHERE login=%s', (login,))
        user = cur.fetchone()
    conn.close()

    return user


def delete_case(case_name):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]
        cur.execute('DELETE FROM "access" WHERE case_id=%s', (case_id,))
        cur.execute('DELETE FROM "note" WHERE case_id=%s', (case_id,))
        cur.execute('DELETE FROM "mark" WHERE case_id=%s', (case_id,))
        cur.execute('DELETE FROM "user-cluster-case" WHERE case_id=%s', (case_id,))


        cur.execute('DELETE FROM "case" WHERE id=%s', (case_id,))

        conn.commit()
    conn.close()


def has_user_admin_access(user_name, case_name):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]
        cur.execute('SELECT id FROM "user" WHERE login=%s', (user_name,))
        user_id = cur.fetchone()[0]

        cur.execute('SELECT * FROM "access" WHERE user_id=%s AND case_id=%s AND role=%s', (user_id, case_id, 'admin'))

        rows = cur.fetchall()

    conn.close()

    return len(rows) == 1


def get_accessible_cases(user_name):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT is_super_admin FROM "user" WHERE login=%s', (user_name,))
        is_super_admin = cur.fetchone()[0]

        if is_super_admin:
            cur.execute('SELECT "case".id,name,description,created FROM "case" ORDER BY name')
            cases = cur.fetchall()
        else:
            cur.execute('SELECT DISTINCT "case".id,"case".name,description,created FROM "case" INNER JOIN "access" ON "case".id="access".case_id '
                        'INNER JOIN "user" ON "user".id="access".user_id WHERE login=%s ORDER BY name', (user_name,))
            cases = cur.fetchall()


        normalized_result = []
        for case in cases:
            normalized_case = {
                'id': case[0],
                'name': case[1],
                'description': case[2],
                'created': case[3]
            }
            if is_super_admin:
                normalized_case['isAdmin'] = True
            else:
                cur.execute('SELECT id FROM "user" WHERE login=%s', (user_name,))
                user_id = cur.fetchone()[0]
                cur.execute('SELECT role FROM "access" WHERE user_id=%s and case_id=%s', (user_id, case[0]))
                normalized_case['isAdmin'] = cur.fetchone()[0] == 'admin'

            normalized_result.append(normalized_case)

    conn.close()

    return normalized_result


def get_administrated_cases(user_name):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT is_super_admin FROM "user" WHERE login=%s', (user_name,))
        is_super_admin = cur.fetchone()[0]

        if is_super_admin:
            cur.execute('SELECT id,name,description,created FROM "case" ORDER BY NAME')
            cases = cur.fetchall()
        else:
            cur.execute(
                'SELECT "case".id,"case".name,description,created,role '
                'FROM "case" INNER JOIN "access" ON "case".id="access".case_id '
                'INNER JOIN "user" ON "user".id="access".user_id WHERE login=%s AND role=%s ORDER BY name',
                (user_name, 'admin')
            )
            cases = cur.fetchall()

        normalized_result = []
        for case in cases:
            normalized_case = {
                'id': case[0],
                'name': case[1],
                'description': case[2],
                'created': case[3],
                'admins': [],
                'users': []
            }

            cur.execute(
                'SELECT login FROM "user" INNER JOIN "access" ON "user".id="access".user_id '
                'WHERE case_id=%s AND role=%s ORDER BY login',
                (normalized_case['id'], 'admin')
            )
            admins = cur.fetchall()

            for admin in admins:
                normalized_case['admins'].append(admin[0])

            cur.execute(
                'SELECT login FROM "user" INNER JOIN "access" ON "user".id="access".user_id '
                'WHERE case_id=%s AND role=%s ORDER BY login',
                (normalized_case['id'], 'user')
            )
            users = cur.fetchall()

            for user in users:
                normalized_case['users'].append(user[0])

            normalized_result.append(normalized_case)

    conn.close()

    return normalized_result


def get_available_users_to_add(case_id):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT login FROM "user" WHERE login not in '
                    '(SELECT login FROM "user" INNER JOIN "access" ON "user".id="access".user_id WHERE case_id=%s AND role=%s)'
                    ' ORDER BY login',
                    (case_id, 'user'))

        users = cur.fetchall()
        result = []
        for user in users:
            result.append(user[0])

    conn.close()
    return result


def get_all_users(login):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id, login FROM "user" WHERE login!=%s', (login,))
        users = cur.fetchall()

        result = []
        for user in users:
            result.append({'id': user[0], 'login': user[1]})

    conn.close()

    return result


def get_available_admins_to_add(case_id):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT login FROM "user" WHERE login not in '
                    '(SELECT login FROM "user" INNER JOIN "access" ON "user".id="access".user_id WHERE case_id=%s AND role=%s)'
                    ' ORDER BY login',
                    (case_id, 'admin'))

        users = cur.fetchall()
        result = []
        for user in users:
            result.append(user[0])

    conn.close()
    return result


def add_user_access_to_case(case_id, login, role):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE login=%s', (login,))
        user_id = cur.fetchone()[0]

        cur.execute('INSERT INTO "access" (case_id, user_id, role) VALUES (%s, %s, %s)', (case_id, user_id, role))

        cur.execute('SELECT text FROM "note" WHERE case_id=%s AND user_id=%s', (case_id, user_id))
        note = cur.fetchone()

        if note is None:
            cur.execute('INSERT INTO "note" (text, case_id, user_id) VALUES (%s, %s, %s)', ('Initial note', case_id, user_id))
        conn.commit()

    conn.close()


def delete_user_access_to_case(case_id, login):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE login=%s', (login,))
        user_id = cur.fetchone()[0]

        cur.execute('DELETE FROM "access" WHERE user_id=%s AND case_id=%s', (user_id, case_id))
        conn.commit()

    conn.close()


def update_case_description(case_id, description):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('UPDATE "case" SET description=%s WHERE id=%s', (description, case_id))
        conn.commit()

    conn.close()


def insert_init_note_for_case(case_name, login):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE login=%s', (login,))
        user_id = cur.fetchone()[0]

        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]

        cur.execute('INSERT INTO "note" (text, case_id, user_id) VALUES (%s, %s, %s)', ('Initial note', case_id, user_id))
        conn.commit()

    conn.close()


def get_note_for_case(case_name, login):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE login=%s', (login,))
        user_id = cur.fetchone()[0]

        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]

        cur.execute('SELECT text FROM "note" WHERE user_id=%s AND case_id=%s', (user_id, case_id))
        text = cur.fetchone()[0]

    conn.close()
    return text


def update_note_for_case(updated_note, case_name, login):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE login=%s', (login,))
        user_id = cur.fetchone()[0]

        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]

        cur.execute('UPDATE "note" SET text=%s WHERE user_id=%s AND case_id=%s', (updated_note, user_id, case_id))
        conn.commit()

    conn.close()


def get_all_marks_for_case_and_user(case_name, login):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE login=%s', (login,))
        user_id = cur.fetchone()[0]

        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]

        cur.execute('SELECT id FROM "mark" WHERE user_id=%s AND case_id=%s', (user_id, case_id))

        marks = cur.fetchall()
        result = []

        for mark in marks:
            result.append(mark[0])

        return result


def insert_mark(case_name, login, id):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE login=%s', (login,))
        user_id = cur.fetchone()[0]

        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]

        cur.execute('INSERT INTO "mark" (id, case_id, user_id) VALUES (%s, %s, %s)', (id, case_id, user_id))
        conn.commit()

    conn.close()


def delete_mark(case_name, login, id):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE login=%s', (login,))
        user_id = cur.fetchone()[0]

        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]

        cur.execute('DELETE FROM "mark" WHERE id=%s AND case_id=%s AND user_id=%s', (id, case_id, user_id))

        conn.commit()

    conn.close()


def get_all_cluster_definitons():
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id, name, definition, description, filter_id FROM "cluster" ORDER BY id')
        cluster_definitions = cur.fetchall()

        normalized_result = []
        for cluster_definition in cluster_definitions:
            filter_id = cluster_definition[4]

            cur.execute('SELECT id, name, definition FROM "filter" WHERE id=%s', (filter_id,))
            filter_db = cur.fetchone()
            normalized_cluster_definition = {
                'id': cluster_definition[0],
                'name': cluster_definition[1],
                'definition': cluster_definition[2],
                'description': cluster_definition[3],
                'filter_id': filter_db[0],
                'filter_name': filter_db[1],
                'filter_definition': filter_db[2]
            }

            normalized_result.append(normalized_cluster_definition)

    conn.close()
    return normalized_result


def insert_cluster_definition(name, definition, description, filter_name):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "filter" WHERE name=%s', (filter_name,))
        filter_id = cur.fetchone()[0]

        cur.execute('INSERT INTO "cluster" (name, definition, description, filter_id) VALUES (%s, %s, %s, %s)', (name, definition, description, filter_id))
        conn.commit()
    conn.close()


def delete_cluster_definition(id):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('DELETE FROM "cluster" WHERE id=%s', (id,))
        conn.commit()

    conn.close()


def get_filters():
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT name FROM "filter"')

        filters = cur.fetchall()

    conn.close()

    normalized_result = []
    for filter in filters:
        normalized_result.append(filter[0])


    return normalized_result


def get_clusters_for_user_and_case(login, case_name):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE login=%s', (login,))
        user_id = cur.fetchone()[0]

        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]


        cur.execute('SELECT cluster_id FROM "user-cluster-case" WHERE case_id=%s AND user_id=%s ORDER BY cluster_id', (case_id, user_id))

        cluster_ids = cur.fetchall()

        clusters = []
        for cluster_id in cluster_ids:
            cur.execute('SELECT id, name, definition, description, filter_id FROM "cluster" WHERE id=%s ORDER BY id', (cluster_id[0],))
            cluster_definition = cur.fetchone()

            filter_id = cluster_definition[4]
            cur.execute('SELECT id, name, definition FROM "filter" WHERE id=%s', (filter_id,))
            filter_db = cur.fetchone()
            normalized_cluster_definition = {
                'id': cluster_definition[0],
                'name': cluster_definition[1],
                'definition': cluster_definition[2],
                'description': cluster_definition[3],
                'filter_id': filter_db[0],
                'filter_name': filter_db[1],
                'filter_definition': filter_db[2]
            }

            clusters.append(normalized_cluster_definition)

    conn.close()

    return clusters


def add_user_clusters_for_case(login, case_name, cluster_ids):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE login=%s', (login,))
        user_id = cur.fetchone()[0]

        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]

        for cluster_id in cluster_ids:
            cur.execute('INSERT INTO "user-cluster-case" (cluster_id, user_id, case_id) VALUES (%s, %s, %s)', (cluster_id, user_id, case_id))

        conn.commit()

    conn.close()


def delete_user_clusters_from_case(login, case_name, cluster_ids):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "user" WHERE login=%s', (login,))
        user_id = cur.fetchone()[0]

        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]

        for cluster_id in cluster_ids:
            cur.execute('DELETE FROM "user-cluster-case" WHERE cluster_id=%s AND user_id=%s AND case_id=%s', (cluster_id, user_id, case_id))

        conn.commit()

    conn.close()


def add_access_for_many_users_to_case(case_name, full_access_user_ids, read_access_user_ids, cluster_ids):
    conn = get_db_connection()

    with closing(conn.cursor()) as cur:
        cur.execute('SELECT id FROM "case" WHERE name=%s', (case_name,))
        case_id = cur.fetchone()[0]

        for id in full_access_user_ids:
            cur.execute('INSERT INTO "access" (user_id, case_id, role) VALUES (%s, %s, %s)', (id, case_id, 'admin'))
            cur.execute('INSERT INTO "note" (user_id, case_id, text) VALUES (%s, %s, %s)', (id, case_id, 'Initial note'))

            for cluster_id in cluster_ids:
                cur.execute('INSERT INTO "user-cluster-case" (cluster_id, user_id, case_id) VALUES (%s, %s, %s)',
                            (cluster_id, id, case_id))

        for id in read_access_user_ids:
            cur.execute('INSERT INTO "access" (user_id, case_id, role) VALUES (%s, %s, %s)', (id, case_id, 'user'))
            cur.execute('INSERT INTO "note" (user_id, case_id, text) VALUES (%s, %s, %s)', (id, case_id, 'Initial note'))

            for cluster_id in cluster_ids:
                cur.execute('INSERT INTO "user-cluster-case" (cluster_id, user_id, case_id) VALUES (%s, %s, %s)',
                            (cluster_id, id, case_id))

        conn.commit()

    conn.close()





