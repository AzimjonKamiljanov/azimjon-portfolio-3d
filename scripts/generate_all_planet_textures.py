import numpy as np
from PIL import Image
import os

assets_dir = "/home/cyber/projects/3d-portfolio/assets"
os.makedirs(assets_dir, exist_ok=True)

W, H = 2048, 1024
lat = np.linspace(-np.pi/2, np.pi/2, H)[:, None]
lon = np.linspace(-np.pi, np.pi, W)[None, :]
x = np.cos(lat) * np.cos(lon)
y = np.sin(lat) * np.ones_like(lon)
z = np.cos(lat) * np.sin(lon)

def normalize(arr):
    mn, mx = arr.min(), arr.max()
    if mx - mn < 1e-6:
        return np.zeros_like(arr)
    return (arr - mn) / (mx - mn)

def generate_seamless_noise(octaves):
    res = np.zeros((H, W), dtype=np.float32)
    for scale, amp in octaves:
        p1 = scale * (x * 1.37 + y * 0.93 + z * 1.15)
        p2 = scale * (y * 1.41 - z * 0.82 + x * 0.54)
        p3 = scale * (z * 1.23 + x * 0.77 - y * 1.05)
        res += amp * (np.sin(p1) * np.cos(p2) + np.sin(p3))
    return normalize(res)

print("Generating Mercury texture...")
# 1. Mercury: cratered gray/slate rock
n_merc = generate_seamless_noise([(2, 0.4), (5, 0.25), (12, 0.15), (28, 0.1), (60, 0.06), (120, 0.04)])
# Craters
craters = np.zeros((H, W), dtype=np.float32)
np.random.seed(42)
for _ in range(80):
    clat = np.random.uniform(-1.4, 1.4)
    clon = np.random.uniform(-np.pi, np.pi)
    cr_rad = np.random.uniform(0.02, 0.12)
    dist = np.arccos(np.clip(np.sin(lat)*np.sin(clat) + np.cos(lat)*np.cos(clat)*np.cos(lon - clon), -1, 1))
    c_rim = np.exp(-((dist - cr_rad)**2) / (cr_rad*0.3)**2)
    c_floor = np.where(dist < cr_rad, -0.4 * (1 - dist/cr_rad), 0)
    craters += (c_rim * 0.5 + c_floor)
merc_val = np.clip(n_merc * 0.7 + craters * 0.3, 0, 1)
merc_r = np.clip(merc_val * 160 + 60, 0, 255).astype(np.uint8)
merc_g = np.clip(merc_val * 155 + 58, 0, 255).astype(np.uint8)
merc_b = np.clip(merc_val * 150 + 55, 0, 255).astype(np.uint8)
merc_img = Image.fromarray(np.stack([merc_r, merc_g, merc_b], axis=-1))
merc_img.save(os.path.join(assets_dir, "mercury_2048.jpg"), quality=90)

print("Generating Venus texture...")
# 2. Venus: dense swirling golden/amber sulfuric clouds
n_venus1 = generate_seamless_noise([(1.5, 0.5), (3.5, 0.25), (8, 0.15), (18, 0.08)])
n_venus2 = generate_seamless_noise([(2.5, 0.4), (6, 0.25), (14, 0.15), (32, 0.08)])
v_swirl = np.sin(lat * 12 + n_venus1 * 4) * 0.5 + 0.5
v_mix = v_swirl * 0.6 + n_venus2 * 0.4
venus_r = np.clip(220 + v_mix * 35 - 30, 0, 255).astype(np.uint8)
venus_g = np.clip(185 + v_mix * 40 - 45, 0, 255).astype(np.uint8)
venus_b = np.clip(130 + v_mix * 45 - 50, 0, 255).astype(np.uint8)
venus_img = Image.fromarray(np.stack([venus_r, venus_g, venus_b], axis=-1))
venus_img.save(os.path.join(assets_dir, "venus_2048.jpg"), quality=90)

print("Generating Mars texture...")
# 3. Mars: rusty orange-red, dark maria, polar caps, canyons
n_mars = generate_seamless_noise([(2, 0.4), (4.5, 0.25), (10, 0.15), (24, 0.1), (50, 0.05)])
# Polar caps
polar_n = np.clip((np.abs(lat) - 1.25) / 0.3, 0, 1)
# Dark maria (volcanic basalt plains)
maria = np.where((n_mars < 0.42) & (np.abs(lat) < 1.0), 0.4, 0.0)
mars_val = n_mars * 0.8 + 0.2 - maria * 0.5
mars_r = np.clip(mars_val * 180 + 75 + polar_n * 90, 0, 255).astype(np.uint8)
mars_g = np.clip(mars_val * 90 + 35 + polar_n * 130, 0, 255).astype(np.uint8)
mars_b = np.clip(mars_val * 50 + 15 + polar_n * 140, 0, 255).astype(np.uint8)
mars_img = Image.fromarray(np.stack([mars_r, mars_g, mars_b], axis=-1))
mars_img.save(os.path.join(assets_dir, "mars_2048.jpg"), quality=90)

print("Generating Jupiter texture...")
# 4. Jupiter: horizontal banded atmosphere with wavy turbulence and Great Red Spot
n_jup_turb = generate_seamless_noise([(3, 0.4), (8, 0.3), (20, 0.2), (45, 0.1)])
jup_bands = np.sin(lat * 28 + n_jup_turb * 3.5) * 0.5 + 0.5
jup_noise = generate_seamless_noise([(4, 0.4), (12, 0.3), (30, 0.2)])
jup_mix = jup_bands * 0.65 + jup_noise * 0.35

# Great Red Spot at latitude -22 degrees (-0.38 rad), lon = 0.5 rad
grs_lat = -0.38
grs_lon = 0.5
d_lat = (lat - grs_lat) / 0.12
d_lon = (lon - grs_lon) / 0.24
grs_dist = np.sqrt(d_lat**2 + d_lon**2)
grs_mask = np.clip(1.0 - grs_dist, 0, 1)
grs_mask = np.sin(grs_mask * np.pi / 2)**2

jup_r = (180 + jup_mix * 70) * (1 - grs_mask) + (215 * grs_mask)
jup_g = (130 + jup_mix * 60 - (1 - jup_bands)*35) * (1 - grs_mask) + (75 * grs_mask)
jup_b = (90 + jup_mix * 50 - (1 - jup_bands)*45) * (1 - grs_mask) + (50 * grs_mask)

jup_img = Image.fromarray(np.stack([
    np.clip(jup_r, 0, 255).astype(np.uint8),
    np.clip(jup_g, 0, 255).astype(np.uint8),
    np.clip(jup_b, 0, 255).astype(np.uint8)
], axis=-1))
jup_img.save(os.path.join(assets_dir, "jupiter_2048.jpg"), quality=90)

print("Generating Saturn texture & rings...")
# 5. Saturn: subtle golden bands
n_sat = generate_seamless_noise([(2, 0.4), (6, 0.3), (15, 0.2)])
sat_bands = np.sin(lat * 22 + n_sat * 1.5) * 0.5 + 0.5
sat_mix = sat_bands * 0.5 + n_sat * 0.5
sat_r = np.clip(225 + sat_mix * 28 - 15, 0, 255).astype(np.uint8)
sat_g = np.clip(195 + sat_mix * 32 - 20, 0, 255).astype(np.uint8)
sat_b = np.clip(140 + sat_mix * 35 - 25, 0, 255).astype(np.uint8)
sat_img = Image.fromarray(np.stack([sat_r, sat_g, sat_b], axis=-1))
sat_img.save(os.path.join(assets_dir, "saturn_2048.jpg"), quality=90)

# Saturn Rings (radial 1D alpha gradient mapped to ring texture)
ring_w, ring_h = 1024, 64
r_coords = np.linspace(0, 1, ring_w)
# 0.0 - 0.22: C ring (semi-transparent)
# 0.22 - 0.65: B ring (dense bright gold)
# 0.65 - 0.72: Cassini Division (gap, transparent!)
# 0.72 - 0.95: A ring (medium density)
# 0.95 - 1.0: Encke gap / outer fringe
r_alpha = np.zeros(ring_w, dtype=np.float32)
r_color_val = np.zeros(ring_w, dtype=np.float32)

for i, rc in enumerate(r_coords):
    if rc < 0.22:
        # C ring
        r_alpha[i] = 0.35 * (rc / 0.22)
        r_color_val[i] = 0.6
    elif rc < 0.65:
        # B ring
        t = (rc - 0.22) / 0.43
        r_alpha[i] = 0.88 + 0.1 * np.sin(t * 30)
        r_color_val[i] = 0.9 + 0.1 * np.sin(t * 25)
    elif rc < 0.72:
        # Cassini division
        r_alpha[i] = 0.05
        r_color_val[i] = 0.2
    elif rc < 0.95:
        # A ring
        t = (rc - 0.72) / 0.23
        r_alpha[i] = 0.65 + 0.1 * np.sin(t * 20)
        r_color_val[i] = 0.8
    else:
        # Outer fade
        r_alpha[i] = 0.3 * (1.0 - (rc - 0.95) / 0.05)
        r_color_val[i] = 0.5

r_rgba = np.zeros((ring_h, ring_w, 4), dtype=np.uint8)
for y_idx in range(ring_h):
    r_rgba[y_idx, :, 0] = np.clip(r_color_val * 230, 0, 255).astype(np.uint8)
    r_rgba[y_idx, :, 1] = np.clip(r_color_val * 205, 0, 255).astype(np.uint8)
    r_rgba[y_idx, :, 2] = np.clip(r_color_val * 160, 0, 255).astype(np.uint8)
    r_rgba[y_idx, :, 3] = np.clip(r_alpha * 255, 0, 255).astype(np.uint8)

ring_img = Image.fromarray(r_rgba, 'RGBA')
ring_img.save(os.path.join(assets_dir, "saturn_ring.png"))

print("Generating Uranus texture & rings...")
# 6. Uranus: pale cyan/aquamarine ice giant
n_ura = generate_seamless_noise([(2, 0.4), (5, 0.3), (12, 0.2)])
ura_mix = np.sin(lat * 10 + n_ura * 1.0) * 0.5 + 0.5
ura_r = np.clip(150 + ura_mix * 25 - 10, 0, 255).astype(np.uint8)
ura_g = np.clip(215 + ura_mix * 20 - 10, 0, 255).astype(np.uint8)
ura_b = np.clip(230 + ura_mix * 18 - 8, 0, 255).astype(np.uint8)
ura_img = Image.fromarray(np.stack([ura_r, ura_g, ura_b], axis=-1))
ura_img.save(os.path.join(assets_dir, "uranus_2048.jpg"), quality=90)

# Uranus Ring
u_ring_rgba = np.zeros((64, 512, 4), dtype=np.uint8)
u_coords = np.linspace(0, 1, 512)
u_alpha = np.where((u_coords > 0.4) & (u_coords < 0.85), 0.45 * np.sin((u_coords - 0.4)/0.45 * np.pi), 0)
for y_idx in range(64):
    u_ring_rgba[y_idx, :, 0] = 180
    u_ring_rgba[y_idx, :, 1] = 225
    u_ring_rgba[y_idx, :, 2] = 245
    u_ring_rgba[y_idx, :, 3] = np.clip(u_alpha * 255, 0, 255).astype(np.uint8)
u_ring_img = Image.fromarray(u_ring_rgba, 'RGBA')
u_ring_img.save(os.path.join(assets_dir, "uranus_ring.png"))

print("Generating Neptune texture...")
# 7. Neptune: deep vivid azure blue with white cirrus streaks & dark spot
n_nep1 = generate_seamless_noise([(2.5, 0.5), (6, 0.25), (14, 0.15)])
n_nep2 = generate_seamless_noise([(8, 0.5), (20, 0.3), (40, 0.2)])
nep_bands = np.sin(lat * 16 + n_nep1 * 2.0) * 0.5 + 0.5
# White storm bands
nep_white = np.where((n_nep2 > 0.72) & (np.abs(lat) < 0.9), (n_nep2 - 0.72) * 3.5, 0.0)
# Dark spot at lat -0.3, lon -0.8
ds_dist = np.sqrt(((lat - (-0.3))/0.15)**2 + ((lon - (-0.8))/0.25)**2)
ds_mask = np.clip(1.0 - ds_dist, 0, 1)

nep_r = np.clip((40 + nep_bands * 35) * (1 - ds_mask*0.6) + nep_white * 180, 0, 255).astype(np.uint8)
nep_g = np.clip((85 + nep_bands * 45) * (1 - ds_mask*0.6) + nep_white * 190, 0, 255).astype(np.uint8)
nep_b = np.clip((190 + nep_bands * 50) * (1 - ds_mask*0.4) + nep_white * 120, 0, 255).astype(np.uint8)
nep_img = Image.fromarray(np.stack([nep_r, nep_g, nep_b], axis=-1))
nep_img.save(os.path.join(assets_dir, "neptune_2048.jpg"), quality=90)

print("Generating Pluto texture...")
# 8. Pluto: mottled tan, dark tholins, bright heart (Tombaugh Regio)
n_pluto = generate_seamless_noise([(2, 0.4), (5, 0.25), (11, 0.18), (25, 0.1), (55, 0.07)])
# Heart Tombaugh Regio at lat 0.35, lon 0.3
h_x = (lon - 0.3) / 0.35
h_y = (lat - 0.35) / 0.35
# Heart curve approximation: (x^2 + y^2 - 1)^3 - x^2 * y^3 < 0
h_dist = np.sqrt(h_x**2 + (h_y - 0.4*np.abs(h_x))**2)
heart_mask = np.clip(1.0 - h_dist / 0.65, 0, 1)
heart_mask = np.sin(heart_mask * np.pi / 2)**2

pluto_base_r = n_pluto * 120 + 80
pluto_base_g = n_pluto * 95 + 65
pluto_base_b = n_pluto * 75 + 50
# Tholin dark reddish brown equator
tholin = np.where((np.abs(lat) < 0.4) & (n_pluto < 0.45), 0.5, 0.0)

pluto_r = np.clip((pluto_base_r * (1 - tholin * 0.4)) * (1 - heart_mask) + (235 * heart_mask), 0, 255).astype(np.uint8)
pluto_g = np.clip((pluto_base_g * (1 - tholin * 0.6)) * (1 - heart_mask) + (220 * heart_mask), 0, 255).astype(np.uint8)
pluto_b = np.clip((pluto_base_b * (1 - tholin * 0.7)) * (1 - heart_mask) + (205 * heart_mask), 0, 255).astype(np.uint8)
pluto_img = Image.fromarray(np.stack([pluto_r, pluto_g, pluto_b], axis=-1))
pluto_img.save(os.path.join(assets_dir, "pluto_2048.jpg"), quality=90)

print("Generating Sun turbulent plasma texture...")
# 9. Sun plasma texture for extra detail
n_sun1 = generate_seamless_noise([(3, 0.5), (7, 0.3), (16, 0.15), (35, 0.05)])
n_sun2 = generate_seamless_noise([(5, 0.4), (12, 0.3), (28, 0.2), (60, 0.1)])
sun_mix = n_sun1 * 0.6 + n_sun2 * 0.4
sun_r = np.clip(255 * np.ones_like(sun_mix), 0, 255).astype(np.uint8)
sun_g = np.clip(sun_mix * 200 + 45, 0, 255).astype(np.uint8)
sun_b = np.clip(sun_mix**2 * 80, 0, 255).astype(np.uint8)
sun_img = Image.fromarray(np.stack([sun_r, sun_g, sun_b], axis=-1))
sun_img.save(os.path.join(assets_dir, "sun_plasma.jpg"), quality=90)

print("All textures successfully generated in assets/!")
