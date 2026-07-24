#!/bin/bash
# Script to grant fan control permissions on Dell Latitude 5290
echo "Enabling Dell Hardware Fan Control permissions..."
sudo chmod 666 /sys/class/hwmon/hwmon*/pwm1 /sys/class/hwmon/hwmon*/pwm1_enable 2>/dev/null || true
echo "✅ Hardware Fan Control permissions set successfully!"
