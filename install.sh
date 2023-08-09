#!/bin/bash

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
sudo usermod -aG sudo $USER

# Install Portainer
docker volume create portainer_data
docker run -d -p 9000:9000 --name=portainer --restart=always -v /var/run/docker.sock:/var/run/docker.sock -v portainer_data:/data portainer/portainer-ce

# Get the system's IPv4 address
ipv4_address=$(ip -4 addr show scope global | grep inet | awk '{print $2}' | cut -d'/' -f1)

# Display installation completion message
echo "Docker and Portainer installation is complete."
echo "Access Portainer at: http://$ipv4_address:9000"
echo "Login to Portainer and set up your environment."

# Refresh shell to apply group changes
exec bash
