#!/usr/bin/env bash
# =============================================================================
# Samyoj — GCE VM Diagnostic Snapshot (READ-ONLY)
# -----------------------------------------------------------------------------
# Purpose: Capture a full snapshot of the production VM state for deployment
#          planning. This script makes NO changes — it only reads information.
#
# Usage (run INSIDE the VM, e.g. after `gcloud compute ssh samyoj-server`):
#   bash vm-diagnostics.sh > vm-diagnostics-$(date +%Y%m%d-%H%M).txt
#
# The output file is safe to share with your deployment engineer/agent.
# =============================================================================

echo "==============================================================================="
echo " SAMYOJ VM DIAGNOSTIC SNAPSHOT"
echo " Generated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "==============================================================================="

echo
echo "### 1. HOST IDENTITY & UPTIME ###"
hostname
whoami
uptime
uname -a

echo
echo "### 2. OS / DISTRO ###"
cat /etc/os-release 2>/dev/null
cat /etc/debian_version 2>/dev/null

echo
echo "### 3. CPU & MEMORY ###"
nproc
free -h
cat /proc/meminfo | head -3

echo
echo "### 4. DISK USAGE ###"
df -h /
df -h /var 2>/dev/null

echo
echo "### 5. NETWORK & IPs ###"
hostname -I
ip addr show | grep -E "inet |inet6 " | grep -v 127.0.0.1

echo
echo "### 6. RUNTIMES (Node / Python / Docker) ###"
node -v 2>/dev/null || echo "Node NOT installed"
npm -v 2>/dev/null || echo "npm NOT installed"
pm2 -v 2>/dev/null || echo "PM2 NOT installed"
python3 --version 2>/dev/null || echo "python3 NOT installed"
docker --version 2>/dev/null || echo "Docker NOT installed"
docker compose version 2>/dev/null || docker-compose --version 2>/dev/null || echo "docker compose NOT installed"

echo
echo "### 7. PM2 PROCESSES ###"
pm2 list 2>/dev/null || echo "PM2 not available"
pm2 jlist 2>/dev/null | head -c 6000; echo
pm2 save --dry-run 2>/dev/null | head -40 || true
cat ~/.pm2/dump.pm2 2>/dev/null | head -c 4000; echo

echo
echo "### 8. LISTENING PORTS ###"
sudo ss -tlnp 2>/dev/null || ss -tlnp 2>/dev/null
echo "--- all listening (non-sudo view) ---"
ss -tln 2>/dev/null | head -40

echo
echo "### 9. SERVICES (systemd) ###"
systemctl list-units --type=service --state=running 2>/dev/null | grep -Ei "nginx|redis|postgres|node|pm2|docker|samyoj|whatsapp" || echo "no matching services"
systemctl is-active nginx 2>/dev/null && echo "nginx: ACTIVE" || echo "nginx: not running"
systemctl is-active redis 2>/dev/null && echo "redis: ACTIVE (systemd)" || echo "redis: not a systemd unit (may run in docker)"

echo
echo "### 10. DOCKER CONTAINERS ###"
docker ps -a 2>/dev/null || echo "Docker not available"
docker images 2>/dev/null | head -20 || echo "Docker not available"

echo
echo "### 11. NGINX CONFIG ###"
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || echo "no nginx sites-enabled"
for f in /etc/nginx/sites-enabled/*; do
  echo "----- $f -----"
  cat "$f" 2>/dev/null
done
cat /etc/nginx/nginx.conf 2>/dev/null | head -60

echo
echo "### 12. PROJECT LOCATIONS ###"
for d in /var/www/Samyoj /var/www/samyoj /var/www/whatsapp /home/*/Samyoj /home/*/samyoj /srv/*; do
  [ -d "$d" ] && echo "FOUND: $d"
done
echo "--- searching common paths ---"
ls -d /var/www/* /home/*/* 2>/dev/null | head -40

echo
echo "### 13. GIT STATE (project repo) ###"
find / -maxdepth 4 -name ".git" -type d 2>/dev/null | grep -vE "node_modules|/proc|/sys|/usr|/opt" | head -10
for g in $(find / -maxdepth 4 -name ".git" -type d 2>/dev/null | grep -vE "node_modules|/proc|/sys|/usr|/opt" | head -3); do
  echo "----- $g -----"
  cd "$g/.."
  git remote -v 2>/dev/null
  git log --oneline -5 2>/dev/null
  git status -s 2>/dev/null | head -20
  git branch -a 2>/dev/null | head -10
  cd /
done

echo
echo "### 14. ENV FILES (KEY NAMES ONLY — VALUES REDACTED) ###"
for envf in $(find / -maxdepth 4 -name ".env" -type f 2>/dev/null | grep -vE "node_modules|/proc|/sys|/usr|/opt"); do
  echo "----- $envf -----"
  while IFS='=' read -r k v; do
    case "$k" in
      \#*|'' ) continue;;
      * ) echo "$k=<redacted>";;
    esac
  done < "$envf"
done

echo
echo "### 15. CRON JOBS ###"
crontab -l 2>/dev/null || echo "no user crontab"
ls -la /etc/cron.d/ 2>/dev/null
for f in /etc/cron.d/* /etc/cron.daily/* /etc/cron.hourly/*; do
  echo "----- $f -----"
  cat "$f" 2>/dev/null
done

echo
echo "### 16. BACKUP CONFIG ###"
ls -la /backups /var/backups 2>/dev/null
find /backups /var/backups -name "*.sql*" -o -name "*.gz" 2>/dev/null | head -10

echo
echo "### 17. SSL / CERTBOT ###"
ls -la /etc/letsencrypt/live/ 2>/dev/null || echo "no letsencrypt"
sudo certbot certificates 2>/dev/null | head -30

echo
echo "### 18. WEBSERVER HTTP TEST ###"
curl -s -o /dev/null -w "localhost:80 -> %{http_code}\n" http://localhost/ 2>/dev/null || echo "no http on 80"
curl -s -o /dev/null -w "localhost:443 -> %{http_code}\n" https://localhost/ -k 2>/dev/null || echo "no https on 443"
curl -s -o /dev/null -w "localhost:8000/health -> %{http_code}\n" http://localhost:8000/health 2>/dev/null || echo "no api on 8000"
curl -s -o /dev/null -w "localhost:5000/health -> %{http_code}\n" http://localhost:5000/health 2>/dev/null || echo "no api on 5000"
curl -s http://localhost:8000/health 2>/dev/null | head -c 500; echo
curl -s http://localhost:8000/api/whatsapp/webhook/health 2>/dev/null | head -c 500; echo

echo
echo "### 19. GOOGLE CLOUD SQL / REDIS CONNECTION HINTS ###"
env | grep -E "DATABASE_URL|REDIS_URL|CLOUD_SQL|INSTANCE" | sed 's/=.*/=<redacted>/' || true

echo
echo "### 20. ROUTES / FIREWALL (ufw/iptables) ###"
sudo ufw status 2>/dev/null || echo "ufw not present"
sudo iptables -L -n 2>/dev/null | head -30 || echo "cannot read iptables without root"

echo
echo "==============================================================================="
echo " SNAPSHOT COMPLETE"
echo "==============================================================================="
