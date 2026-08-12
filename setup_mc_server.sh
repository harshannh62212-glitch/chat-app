#!/bin/bash
# ==============================================================================
# Highly Optimized Minecraft Server Setup Script for Ubuntu Server (Dell Latitude 5290)
# Designed for 20 Players (10GB RAM Allocation)
# ==============================================================================

# Exit on error
set -e

echo "🚀 Starting Minecraft Server Setup (Optimized for 20 players, 10GB RAM)..."
echo "======================================================================="

# 1. Install Java 21 and dependencies
echo "📦 Installing Java 21 and necessary utilities..."
sudo apt update
sudo apt install -y openjdk-21-jre-headless screen wget jq

# 2. Create Minecraft Server directory
MC_DIR="$HOME/minecraft-server"
echo "📁 Creating server directory at: $MC_DIR"
mkdir -p "$MC_DIR"
cd "$MC_DIR"

# 3. Download the latest PaperMC 1.21 Jar
echo "📥 Fetching latest PaperMC 1.21 jar..."
LATEST_BUILD=$(curl -s -H "User-Agent: Antigravity/1.0.0 (contact@antigravity.ai)" https://fill.papermc.io/v3/projects/paper/versions/1.21.11/builds | jq -r '.[0].id')
DOWNLOAD_URL=$(curl -s -H "User-Agent: Antigravity/1.0.0 (contact@antigravity.ai)" https://fill.papermc.io/v3/projects/paper/versions/1.21.11/builds | jq -r '.[0].downloads["server:default"].url')
echo "⬇️ Downloading build #${LATEST_BUILD}..."
wget -q --show-progress "$DOWNLOAD_URL" -O paper.jar

# 4. Accept the EULA automatically
echo "📝 Accepting EULA..."
echo "eula=true" > eula.txt

# 5. Generate and override config files with 20-player optimizations
echo "🔧 Configuring optimized server properties..."
cat <<EOT > server.properties
# Minecraft server properties
enable-query=false
prevent-proxy-connections=false
server-port=25565
online-mode=true
pvp=true
difficulty=easy
max-players=20
view-distance=6
simulation-distance=4
network-compression-threshold=256
spawn-protection=0
motd=Wired-IO Private Minecraft Server
EOT

# Create spigot.yml with entity-limit optimizations
echo "🔧 Configuring optimized Spigot settings..."
mkdir -p config
cat <<EOT > spigot.yml
# Spigot configuration
settings:
  save-user-cache-on-stop-only: true
  bungeecord: false
world-settings:
  default:
    verbose: false
    mob-spawn-range: 3
    item-despawn-rate: 4000
    arrow-despawn-rate: 300
    merge-radius:
      item: 4.0
      exp: 6.0
    nerf-spawner-mobs: true
    growth:
      cactus-modifier: 100
      cane-modifier: 100
      melon-modifier: 100
      mushroom-modifier: 100
      pumpkin-modifier: 100
      sapling-modifier: 100
      beetroot-modifier: 100
      carrot-modifier: 100
      potato-modifier: 100
      wheat-modifier: 100
      netherwart-modifier: 100
      vine-modifier: 100
      cocoa-modifier: 100
      bamboo-modifier: 100
      sweetberry-modifier: 100
      kelp-modifier: 100
EOT

# Create paper-world-defaults.yml with chunk and despawn optimizations
cat <<EOT > paper-world-defaults.yml
# Paper world configuration defaults
chunks:
  auto-save-interval: 6000
  max-auto-save-chunks-per-tick: 6
  prevent-moving-into-unloaded-chunks: true
entities:
  behavior:
    baby-zombie-movement-modifier: 0.5
    spawner-nerfed-mobs-should-jump: false
  spawning:
    despawn-ranges:
      monster:
        soft: 30
        hard: 96
      creature:
        soft: 30
        hard: 96
      ambient:
        soft: 30
        hard: 96
      underground_water_creature:
        soft: 30
        hard: 96
      water_creature:
        soft: 30
        hard: 96
      water_ambient:
        soft: 30
        hard: 96
EOT

# 6. Create launch script using Aikar's flags optimized for 10GB allocation
echo "⚙️ Creating optimized start script (10GB RAM allocation)..."
cat <<EOT > start.sh
#!/bin/bash
java -Xms10G -Xmx10G -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8m -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 -Dusing.aikars.flags=https://mcflags.emc.gs -Daikars.new.flags=true -jar paper.jar nogui
EOT
chmod +x start.sh

# 7. Create a systemd service to automatically start it on boot and keep it running
echo "⚙️ Creating systemd service file (system_config)..."
cat <<EOT > mc-server.service
[Unit]
Description=Minecraft Server (PaperMC)
After=network.target

[Service]
User=$USER
WorkingDirectory=$MC_DIR
ExecStart=/bin/bash $MC_DIR/start.sh
Restart=always

[Install]
WantedBy=multi-user.target
EOT

echo ""
echo "======================================================================="
echo "🎉 Setup complete! Script and configs generated successfully."
echo "======================================================================="
echo ""
echo "To install and run this on your Ubuntu Server:"
echo "1. Copy the script or execute it on your server."
echo "2. Start the server using: ./start.sh"
echo "3. (Optional) Run as a system boot service:"
echo "   sudo cp $MC_DIR/mc-server.service /etc/systemd/system/"
echo "   sudo systemctl daemon-reload"
echo "   sudo systemctl enable mc-server"
echo "   sudo systemctl start mc-server"
echo ""
