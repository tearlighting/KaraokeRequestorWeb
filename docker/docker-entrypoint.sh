#!/bin/sh
set -eu

# The application writes SQLite databases and configuration beside its PHP files.
# This is a local-only development container; keep the bind-mounted workspace writable
# to the Apache worker so those files remain on the host and survive container rebuilds.
chmod a+rwX /var/www/html 2>/dev/null || true

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

exec "$@"