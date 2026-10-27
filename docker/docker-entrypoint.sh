#!/bin/sh
set -eu
umask 0002

# In MySQL mode the only writable shared PHP runtime state is the Node queue
# owner fence. The business SQLite databases are neither mounted nor initialized.
if [ "${YUKARI_MYSQL_MODE:-0}" = "1" ]; then
    mkdir -p /var/www/html/runtime/queue-owner
    chgrp 33 /var/www/html/runtime/queue-owner 2>/dev/null || true
    chmod 2770 /var/www/html/runtime/queue-owner 2>/dev/null || true
else
    # Explicitly retained for the isolated/legacy SQLite compatibility profile.
    chmod a+rwX /var/www/html 2>/dev/null || true
    mkdir -p /var/www/html/runtime/queue
    chmod a+rwX /var/www/html/runtime /var/www/html/runtime/queue 2>/dev/null || true
    if [ "${YUKARI_NODE_QUEUE_MUTATIONS:-0}" = "1" ]; then
        chgrp 33 /var/www/html/runtime/queue
        chmod 2770 /var/www/html/runtime/queue
        for path in /var/www/html/runtime/queue/*.db /var/www/html/runtime/queue/*-wal /var/www/html/runtime/queue/*-shm; do
            if [ -f "$path" ]; then chgrp 33 "$path"; chmod g+rw "$path"; fi
        done
    fi
    for path in /var/www/html/cms /var/www/html/images /var/www/html/images/bg /var/www/html/images/mypage_icons /var/www/html/notfoundrequest /var/www/html/cache; do
        if [ -d "$path" ]; then chmod a+rwX "$path" 2>/dev/null || true; fi
    done
    for path in /var/www/html/config.ini /var/www/html/request.db /var/www/html/prioritydb.db /var/www/html/updatenotice.db /var/www/html/cms/comment.db /var/www/html/notfoundrequest/notfoundrequest.db; do
        if [ -f "$path" ]; then chmod a+rw "$path" 2>/dev/null || true; fi
    done
    if [ "${YUKARI_NODE_QUEUE:-0}" = "1" ]; then
        su -s /bin/sh www-data -c 'php /workspace/docker/queue-wal-anchor.php' &
    fi
fi

exec "$@"
