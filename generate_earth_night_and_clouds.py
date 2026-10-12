import numpy as np
from PIL import Image
import os

assets_dir = "/home/cyber/projects/3d-portfolio/assets"
spec_path = os.path.join(assets_dir, "earth_specular_2048.jpg")

# Open specular map: oceans are white (mean > 150), land is dark (< 100)
spec_img = Image.open(spec_path).convert("L")
spec_arr = np.array(spec_img, dtype=np.float32) / 255.0
H, W = spec_arr.shape

lat = np.linspace(-np.pi/2, np.pi/2, H)[:, None]
lon = np.linspace(-np.pi, np.pi, W)[None, :]
x = np.cos(lat) * np.cos(lon)
y = np.sin(lat) * np.ones_like(lon)
z = np.cos(lat) * np.sin(lon)

# Land mask: where specular is low
land_mask = np.clip((0.35 - spec_arr) / 0.25, 0.0, 1.0)
# Zero out extreme Antarctica & Arctic
land_mask = np.where(lat < -1.15, 0.0, land_mask)
land_mask = np.where(lat > 1.35, 0.0, land_mask)

# Generate multi-scale noise for city distribution
np.random.seed(101)
def seamless_noise(octaves):
    res = np.zeros((H, W), dtype=np.float32)
    for scale, amp in octaves:
        p1 = scale * (x * 1.5 + y * 0.9 + z * 1.2)
        p2 = scale * (y * 1.3 - z * 0.8 + x * 0.6)
        res += amp * (np.sin(p1) * np.cos(p2))
    mn, mx = res.min(), res.max()
    return (res - mn) / (mx - mn + 1e-6)

n_macro = seamless_noise([(3, 0.5), (8, 0.3), (18, 0.2)])
n_micro = seamless_noise([(35, 0.5), (75, 0.3), (150, 0.2)])

# Population concentration boosts (Europe, East Asia, North America, India)
# Approximate lat/lon centers:
def region_boost(c_lat, c_lon, rad_lat, rad_lon, weight):
    d = np.sqrt(((lat - c_lat)/rad_lat)**2 + ((lon - c_lon)/rad_lon)**2)
    return weight * np.clip(1.0 - d, 0.0, 1.0)

# Europe (lat ~0.85, lon ~0.25)
b_eu = region_boost(0.85, 0.25, 0.28, 0.45, 1.5)
# North America East & West (lat ~0.7, lon ~-1.6 to -1.3)
b_na = region_boost(0.68, -1.50, 0.30, 0.65, 1.4)
# East Asia (China/Japan lat ~0.6, lon ~2.0)
b_asia = region_boost(0.60, 2.05, 0.32, 0.60, 1.6)
# India (lat ~0.35, lon ~1.35)
b_india = region_boost(0.35, 1.35, 0.22, 0.30, 1.5)
# Middle East & North Africa (lat ~0.45, lon ~0.7)
b_me = region_boost(0.45, 0.75, 0.25, 0.40, 1.2)

boost = 1.0 + b_eu + b_na + b_asia + b_india + b_me

# City density: concentrated nodes with sparse spiderwebs
city_density = (n_macro ** 2.2) * (n_micro ** 1.8) * boost * land_mask
# Threshold into sharp bright nodes (metropolises) and fine filament networks
city_raw = np.clip((city_density - 0.12) / 0.55, 0.0, 1.0)
city_sharp = (city_raw ** 2.5) * 1.8

# Add micro-sparks for individual city lights
sparks = np.random.uniform(0.0, 1.0, (H, W))
sparks = np.where((sparks > 0.985) & (land_mask > 0.5), 1.0, 0.0)
city_final = np.clip(city_sharp + sparks * 0.7 * land_mask, 0.0, 1.0)

# Color: warm golden amber / sodium vapor glow (R=255, G=205, B=125)
night_r = np.clip(city_final * 255, 0, 255).astype(np.uint8)
night_g = np.clip(city_final * 205, 0, 255).astype(np.uint8)
night_b = np.clip(city_final * 120, 0, 255).astype(np.uint8)

night_rgb = np.stack([night_r, night_g, night_b], axis=-1)
night_img = Image.fromarray(night_rgb, 'RGB')
night_out = os.path.join(assets_dir, "earth_night_2048.jpg")
night_img.save(night_out, quality=92)
print("✓ Saved earth_night_2048.jpg")

# -------------------------------------------------------------
# 2. GENERATE REALISTIC PROCEDURAL EARTH CLOUDS (RGBA PNG)
# -------------------------------------------------------------
print("Generating earth_clouds_2048.png...")
n_cloud1 = seamless_noise([(2.5, 0.45), (6, 0.3), (14, 0.15), (32, 0.1)])
n_cloud2 = seamless_noise([(4, 0.4), (10, 0.3), (25, 0.2), (60, 0.1)])

# Swirling cloud bands along latitudes (trade winds & jet streams)
cloud_swirl = np.sin(lat * 8.0 + n_cloud1 * 3.5) * 0.5 + 0.5
cloud_mix = cloud_swirl * 0.45 + n_cloud2 * 0.55

# Cyclonic storms
def cyclone(c_lat, c_lon, rad):
    d = np.sqrt(((lat - c_lat)/rad)**2 + ((lon - c_lon)/(rad*1.8))**2)
    spiral = np.sin(d * 18.0 - lon * 2.0) * 0.5 + 0.5
    return np.clip(1.0 - d, 0.0, 1.0) * spiral

c1 = cyclone(0.55, -0.9, 0.18)
c2 = cyclone(-0.45, 1.8, 0.22)
c3 = cyclone(0.35, 2.4, 0.20)

total_clouds = np.clip(cloud_mix * 0.75 + (c1 + c2 + c3) * 0.45, 0.0, 1.0)
# Cut off lower cloud values so oceans/continents show cleanly beneath
cloud_alpha = np.clip((total_clouds - 0.38) / 0.52, 0.0, 1.0)
cloud_alpha = (cloud_alpha ** 1.4) * 0.88 # Max 88% opacity

cloud_rgba = np.zeros((H, W, 4), dtype=np.uint8)
cloud_rgba[:, :, 0] = 255 # White clouds
cloud_rgba[:, :, 1] = 255
cloud_rgba[:, :, 2] = 255
cloud_rgba[:, :, 3] = np.clip(cloud_alpha * 255, 0, 255).astype(np.uint8)

cloud_img = Image.fromarray(cloud_rgba, 'RGBA')
cloud_out = os.path.join(assets_dir, "earth_clouds_2048.png")
cloud_img.save(cloud_out)
print("✓ Saved earth_clouds_2048.png")
