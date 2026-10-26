#!/bin/bash
# Build and publish to http://<server>/week/. The site's fonts/ folder is left as it is.
#   scripts/deploy.sh           build + upload the page
#   scripts/deploy.sh --nginx   also install server/tuse-week.conf (rolled back if nginx -t fails)
# Server address and password come from D:\WUYI\secret.env (line 1: host, line 2: root password).
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/d/Environment:$PATH"
npm run build --silent

export SSH_ASKPASS="$PWD/scripts/askpass.sh" SSH_ASKPASS_REQUIRE=force DISPLAY=:0
H=$(sed -n 1p /d/WUYI/secret.env | tr -d '\r\n')
O=(-o ConnectTimeout=15 -o PubkeyAuthentication=no -o PreferredAuthentications=password,keyboard-interactive)
NGINX="${1:-}"

tar -C dist -czf dist.tgz .
files=(dist.tgz); [ "$NGINX" = "--nginx" ] && files+=(server/tuse-week.conf)
timeout 60 ssh "${O[@]}" root@"$H" 'mkdir -p /tmp/tuse'
timeout 120 scp -q "${O[@]}" "${files[@]}" root@"$H":/tmp/tuse/
rm -f dist.tgz

timeout 90 ssh "${O[@]}" root@"$H" bash -s -- "$H" "$NGINX" <<'REMOTE'
set -euo pipefail
H=$1; SITE=/www/wwwroot/tuse-week-site/week; T=/tmp/tuse/dist; CONF=/www/server/panel/vhost/nginx/tuse-week.conf
rm -rf "$T" && mkdir -p "$T" && tar -xzf /tmp/tuse/dist.tgz -C "$T"
mkdir -p "$SITE/assets"
# hashed files first, then the page that points at them; files from older builds go after a week
cp -n "$T"/assets/* "$SITE/assets/"
install -m 0644 "$T/index.html" "$SITE/index.html"
find "$SITE/assets" -type f -mtime +7 | while read -r f; do [ -e "$T/assets/$(basename "$f")" ] || rm -f "$f"; done
chown -R www:www "$SITE"
if [ "${2:-}" = "--nginx" ]; then
  cp "$CONF" /tmp/tuse/tuse-week.conf.prev
  sed "s/__HOST__/$H/" /tmp/tuse/tuse-week.conf > "$CONF"
  if nginx -t >/tmp/tuse/nginx-test.log 2>&1; then nginx -s reload; echo "nginx: reloaded"
  else cat /tmp/tuse/nginx-test.log; cp /tmp/tuse/tuse-week.conf.prev "$CONF"; nginx -t >/dev/null 2>&1 && echo "nginx: rolled back"; exit 1; fi
fi
echo INSTALLED
REMOTE

js=$(grep -o 'assets/index-[^"]*\.js' dist/index.html | head -1)
[ "$(curl -s -m 10 "http://$H/week/" | md5sum | cut -c1-12)" = "$(md5sum < dist/index.html | cut -c1-12)" ] \
  && [ "$(curl -s -m 10 "http://$H/week/$js" | md5sum | cut -c1-12)" = "$(md5sum < "dist/$js" | cut -c1-12)" ] \
  && echo "线上与本地一致" || { echo "线上不一致"; exit 1; }
curl -sI -m 10 "http://$H/week/$js" | grep -i '^cache-control' || true
