# docker

FIRST CHANGE THE FILES TO BE EXECUTABLE!!!!!

sudo chmod +x install.sh another.sh (etc... space between scripts)


---Docker and Portainer Installation---

After running the "install.sh" script, follow these steps manually:

Access Portainer by opening a web browser and navigating to http://<your_system's_IPv4_address>:9000.
Complete the initial setup by creating an admin user, setting up the environment, and connecting Portainer to your Docker instance.


Highly Suggest you make a few docker networks before deploying any of the docker-compose.yml files (plex, sonarr, etc..)
 1. Web
 2. VPN

Once you make those you can deploy the docker-compose.yml files with the Network Statements uncommented.


