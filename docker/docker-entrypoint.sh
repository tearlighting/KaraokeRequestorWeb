#!/bin/sh
set -eu
umask 0002

# The application writes SQLite databases and configuration beside its PHP files.
# This is a local-only development container; keep the bind-mounted workspace writable
# to the Apache worker so those files remain on the host and survive container rebuilds.
chmod a+rwX /var/www/html 2>/dev/null || true

# New installations place queue data in a dedicated least-privilege mount directory.
# Existing config/db files are never moved or rewritten by startup.
mkdir -p /var/www/html/runtime/queue
chmod a+rwX /var/www/html/runtime /var/www/html/runtime/queue 2>/dev/null || true
# Shared group 33 (www-data) for PHP and the non-root Node writer; only this directory.
if [ "${YUKARI_NODE_QUEUE_MUTATIONS:-0}" = "1" ]; then
    chgrp 33 /var/www/html/runtime/queue
    chmod 2770 /var/www/html/runtime/queue
    for path in /var/www/html/runtime/queue/*.db /var/www/html/runtime/queue/*-wal /var/www/html/runtime/queue/*-shm; do
        if [ -f "$path" ]; then chgrp 33 "$path"; chmod g+rw "$path"; fi
    done
fi


for path in \
    /var/www/html/cms \
    /var/www/html/images \
    /var/www/html/images/bg \
    /var/www/html/images/mypage_icons \
    /var/www/html/notfoundrequest \
    /var/www/html/cache
 do
    if [ -d "$path" ]; then
        chmod a+rwX "$path" 2>/dev/null || true
    fi
done

for path in \
    /var/www/html/config.ini \
    /var/www/html/request.db \
    /var/www/html/prioritydb.db \
    /var/www/html/updatenotice.db \
    /var/www/html/cms/comment.db \
    /var/www/html/notfoundrequest/notfoundrequest.db
 do
    if [ -f "$path" ]; then
        chmod a+rw "$path" 2>/dev/null || true
    fi
done

# This connection performs no business writes and holds no long-lived transaction.
# It owns WAL/SHM lifecycle on the PHP writer mount, not on Node's read-only mount.
if [ "${YUKARI_NODE_QUEUE:-0}" = "1" ]; then
    su -s /bin/sh www-data -c 'php /workspace/docker/queue-wal-anchor.php' &
fi

exec "$@"
