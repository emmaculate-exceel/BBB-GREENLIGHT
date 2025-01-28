# BBB Scaling up Setup Guide

BigBlueButton Scaling Setup Guide
Prerequisites

Ubuntu 20.04 LTS servers (minimum 8GB RAM, 4 vCPUs each)
Domain names configured for each server
SSL certificates (Let's Encrypt recommended)
Ports 80, 443, 16384-32768 open on all servers

1. BBB Application Servers Setup
For each BBB server:
##  Install BBB
```
wget -qO- https://ubuntu.bigbluebutton.org/bbb-install.sh | bash -s -- -v xenial-22 -s your-bbb-server.example.com -e your-email@example.com
Verify Installation
bashCopysudo bbb-conf --check
sudo bbb-conf --status
```
2. Scalelite Installation (Load Balancer Server)
Prerequisites Installation
bashCopy# Install Docker and Docker Compose
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo systemctl enable docker
sudo systemctl start docker

## Create directories
```
sudo mkdir -p /var/log/scalelite /etc/scalelite /var/lib/scalelite
Configure Scalelite
bashCopy# Create docker-compose.yml
cat << EOF > /etc/scalelite/docker-compose.yml
version: '3'
services:
  redis:
    image: redis:5.0
    volumes:
      - redis_data:/data
  postgres:
    image: postgres:9.5
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=scalelite
      - POSTGRES_PASSWORD=scalelite_password
  scalelite-api:
    image: blindsidenetwks/scalelite:v1-api
    depends_on:
      - redis
      - postgres
    env_file: env
    ports:
      - "3000:3000"
  scalelite-nginx:
    image: blindsidenetwks/scalelite:v1-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /etc/letsencrypt:/etc/nginx/ssl
    depends_on:
      - scalelite-api

volumes:
  redis_data:
  postgres_data:
EOF
```
Configure Environment Variables
```
cat << EOF > /etc/scalelite/env
URL_HOST=loadbalancer.example.com
SECRET_KEY_BASE=$(openssl rand -hex 64)
LOADBALANCER_SECRET=$(openssl rand -hex 32)
DATABASE_URL=postgresql://scalelite:scalelite_password@postgres:5432/scalelite
REDIS_URL=redis://redis:6379
EOF
```
3. Greenlight Installation (Frontend Server)
Install Dependencies
```
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo systemctl enable docker
sudo systemctl start docker
Configure Greenlight
bashCopy# Clone Greenlight
git clone https://github.com/bigbluebutton/greenlight.git
cd greenlight
```
##  Configure environment
```
cp .env.example .env
```
## Edit .env file with your settings:
```
BIGBLUEBUTTON_ENDPOINT=https://loadbalancer.example.com/bigbluebutton/
BIGBLUEBUTTON_SECRET=your_secret_from_scalelite
```
Start Greenlight
```
docker-compose up -d
```
4. Connect BBB Servers to Scalelite
On the Scalelite server:
## For each BBB server, add it to the pool
```
docker exec -it scalelite-api bundle exec rake servers:add[https://bbb1.example.com/bigbluebutton/api,secret1]
docker exec -it scalelite-api bundle exec rake servers:add[https://bbb2.example.com/bigbluebutton/api,secret2]
```
##Verify Server Pool
```
docker exec -it scalelite-api bundle exec rake servers:list
```
5. Testing and Verification

Access Greenlight through your domain
Create a test meeting
Join from multiple clients
Monitor server distribution using:
```
docker exec -it scalelite-api bundle exec rake status
```
Important Notes

Backup Considerations:

Regular backups of Postgres database
Backup of Redis data
Backup of Greenlight configurations


Monitoring:

Set up monitoring for all servers
Monitor CPU, memory, and network usage
Set up alerts for server health


Security:

Keep all systems updated
Use strong passwords
Regularly rotate secrets
Implement proper firewall rules


Maintenance:

Schedule regular maintenance windows
Keep BBB versions synchronized across servers
Monitor disk space for recordings