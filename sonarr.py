#!/usr/bin/env python3
import requests

def generate_docker_compose(puid, pgid, tz, config_path, media_path, downloads_path):
    docker_compose = f"""version: "2.1"
services:
  sonarr:
    image: lscr.io/linuxserver/sonarr:latest
    container_name: sonarr
    environment:
      - PUID={puid}
      - PGID={pgid}
      - TZ={tz}
    volumes:
      - {config_path}:/config
      - {media_path}:/media #optional
      - {downloads_path}:/downloads #optional
    networks:
      - Web
    ports:
      - 8989:8989
    restart: unless-stopped
networks:
  Web:
    external: true
"""
    return docker_compose

def deploy_stack(portainer_url, api_token, stack_name, docker_compose_content):
    url = f"{portainer_url}/api/stacks"
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json"
    }
    payload = {
        "Name": stack_name,
        "StackFileContent": docker_compose_content
    }

    response = requests.post(url, json=payload, headers=headers)
    if response.status_code == 201:
        print("Stack deployed successfully!")
    else:
        print("Error deploying stack:", response.text)

def main():
    portainer_url = input("Enter Portainer URL (e.g., http://your-portainer-url) without the port: ")
    api_token = input("Enter your Portainer API token (create one under Users in portainer webGUI): ")

    puid = input("Enter PUID: ")
    pgid = input("Enter PGID: ")
    tz = input("Enter Timezone (TZ): ")
    config_path = input("Enter path for /config volume: ")
    media_path = input("Enter path for /media volume (optional): ")
    downloads_path = input("Enter path for /downloads volume (optional): ")

    docker_compose_content = generate_docker_compose(puid, pgid, tz, config_path, media_path, downloads_path)

    stack_name = input("Enter a name for the stack: ")
    deploy_stack(portainer_url, api_token, stack_name, docker_compose_content)

if __name__ == "__main__":
    main()
