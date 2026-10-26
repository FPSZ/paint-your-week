#!/bin/bash
# Runs on the server. Files were uploaded to /tmp/tuse/ first.
set -euo pipefail
HOST="$1"
SRC=/tmp/tuse
SITE=/www/wwwroot/tuse-week-site/week
CONF=/www/server/panel/vhost/nginx/tuse-week.conf

if ss -ltnp | grep -q '127.0.0.1:18731 ' && ! systemctl is-active --quiet tuse-week; then
  echo "port 18731 is taken by something else:"; ss -ltnp | grep 18731; exit 1
fi

mkdir -p "$SITE" /opt/tuse-week /var/lib/tuse-week
install -m 0644 "$SRC/index.html" "$SITE/index.html"
install -m 0755 "$SRC/server.py" /opt/tuse-week/server.py
python3 "$SRC/fetch_fonts.py" "$SITE/fonts"
chown -R www:www /www/wwwroot/tuse-week-site /var/lib/tuse-week
chmod 750 /var/lib/tuse-week

install -m 0644 "$SRC/tuse-week.service" /etc/systemd/system/tuse-week.service
systemctl daemon-reload
systemctl enable tuse-week >/dev/null 2>&1
systemctl restart tuse-week
for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -fsS http://127.0.0.1:18731/week/api/ping >/dev/null 2>&1 && break
  sleep 0.5
done
echo "api: $(curl -fsS http://127.0.0.1:18731/week/api/ping)"

[ -f "$CONF" ] && cp "$CONF" "$SRC/tuse-week.conf.prev"
sed "s/__HOST__/$HOST/" "$SRC/tuse-week.conf" > "$CONF"
if nginx -t >/tmp/tuse/nginx-test.log 2>&1; then
  nginx -s reload
  echo "nginx: reloaded"
else
  cat /tmp/tuse/nginx-test.log
  if [ -f "$SRC/tuse-week.conf.prev" ]; then cp "$SRC/tuse-week.conf.prev" "$CONF"; else rm -f "$CONF"; fi
  nginx -t >/dev/null 2>&1 && echo "nginx: config rolled back, existing sites unaffected"
  exit 1
fi
