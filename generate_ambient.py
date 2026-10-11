import math
import wave
import struct
import subprocess
import numpy as np

sample_rate = 44100
duration = 90.0  # 90 seconds seamless loop
total_samples = int(sample_rate * duration)
t = np.linspace(0, duration, total_samples, endpoint=False)

left = np.zeros(total_samples, dtype=np.float64)
right = np.zeros(total_samples, dtype=np.float64)

# Chords progression (4 chords, each 22.5s)
# 1: Cmaj9 (C3, G3, B3, D4, E4) -> [130.81, 196.00, 246.94, 293.66, 329.63]
# 2: Em9 (E3, B3, D4, F#4, G4) -> [164.81, 246.94, 293.66, 369.99, 392.00]
# 3: Am9 (A2, E3, G3, B3, C4) -> [110.00, 164.81, 196.00, 246.94, 261.63]
# 4: Fmaj9#11 (F2, C3, E3, G3, B3) -> [87.31, 130.81, 164.81, 196.00, 246.94]

chords = [
    [65.41, 130.81, 196.00, 246.94, 293.66, 329.63],   # C
    [82.41, 164.81, 246.94, 293.66, 369.99, 392.00],   # Em
    [55.00, 110.00, 164.81, 196.00, 246.94, 261.63],   # Am
    [87.31, 130.81, 164.81, 196.00, 246.94, 329.63],   # Fmaj7#11
]

chord_dur = duration / len(chords)

for c_idx, freqs in enumerate(chords):
    c_start = c_idx * chord_dur
    # Create smooth raised-cosine window for each chord with crossfade
    # Window spans from c_start - 3s to c_start + chord_dur + 3s with periodic wrapping
    phase = 2 * np.pi * (t - c_start) / chord_dur
    # A smooth envelope that peaks in the middle of this chord's duration
    env = np.maximum(0.0, np.cos(phase)) ** 2
    # Ensure it's active mainly within its sector
    dist_from_center = np.abs((t - (c_start + chord_dur / 2.0) + duration / 2.0) % duration - duration / 2.0)
    sector_env = np.clip(1.0 - (dist_from_center / (chord_dur * 0.85)) ** 2, 0.0, 1.0)
    comb_env = sector_env * (0.6 + 0.4 * np.sin(2 * np.pi * t / 6.0))

    for f_idx, f in enumerate(freqs):
        # Detuned stereo oscillators for lush analog chorus
        detune_l = -0.15 * (f_idx + 1)
        detune_r = +0.15 * (f_idx + 1)
        amp = 0.12 / (1.0 + f_idx * 0.35)

        sig_l = np.sin(2 * np.pi * (f + detune_l) * t) * (1.0 + 0.2 * np.sin(2 * np.pi * 0.1 * t))
        sig_r = np.sin(2 * np.pi * (f + detune_r) * t) * (1.0 + 0.2 * np.cos(2 * np.pi * 0.1 * t))

        # Add gentle harmonics
        sig_l += 0.25 * np.sin(2 * np.pi * (f * 2 + detune_l) * t)
        sig_r += 0.25 * np.sin(2 * np.pi * (f * 2 + detune_r) * t)

        left += sig_l * comb_env * amp
        right += sig_r * comb_env * amp

# Deep sub-bass cosmic foundation (constant warm C2 / G1 slow swell)
sub_l = np.sin(2 * np.pi * 65.41 * t) * 0.14 * (0.8 + 0.2 * np.sin(2 * np.pi * t / 15.0))
sub_r = np.sin(2 * np.pi * 65.41 * t + 0.2) * 0.14 * (0.8 + 0.2 * np.cos(2 * np.pi * t / 15.0))
left += sub_l
right += sub_r

# Celestial high chime / crystalline sparkles at key intervals
chime_freqs = [1046.5, 1318.5, 1567.9, 1975.5, 2093.0]
for idx, cf in enumerate(chime_freqs):
    chime_times = [10.0 + idx * 15.0, 45.0 + idx * 12.0, 75.0 + idx * 8.0]
    for ct in chime_times:
        if ct < duration - 4.0:
            chime_t = t - ct
            mask = (chime_t >= 0) & (chime_t <= 4.0)
            tau = chime_t[mask]
            envelope = np.exp(-tau / 1.2) * (np.sin(2 * np.pi * cf * tau) + 0.3 * np.sin(2 * np.pi * cf * 1.5 * tau))
            pan = 0.5 + 0.4 * np.sin(idx * 1.7)
            left[mask] += envelope * 0.045 * (1.0 - pan)
            right[mask] += envelope * 0.045 * pan

# Soft interstellar cosmic breeze / pinkish noise
rng = np.random.default_rng(42)
white = rng.normal(0, 0.015, total_samples)
# Simple running average low-pass filter
kernel_size = 40
kernel = np.ones(kernel_size) / kernel_size
pink_l = np.convolve(white, kernel, mode='same')
pink_r = np.convolve(rng.normal(0, 0.015, total_samples), kernel, mode='same')

# Modulate cosmic wind slowly
wind_mod = (0.5 + 0.5 * np.sin(2 * np.pi * t / 18.0)) * 0.025
left += pink_l * wind_mod
right += pink_r * wind_mod

# Normalize nicely without clipping
peak = max(np.max(np.abs(left)), np.max(np.abs(right)))
if peak > 0:
    left = (left / peak) * 0.85
    right = (right / peak) * 0.85

# Convert to 16-bit PCM WAV
left_16 = np.int16(left * 32767)
right_16 = np.int16(right * 32767)
interleaved = np.empty((total_samples * 2,), dtype=np.int16)
interleaved[0::2] = left_16
interleaved[1::2] = right_16

wav_path = '/tmp/space_ambient_temp.wav'
with wave.open(wav_path, 'wb') as wf:
    wf.setnchannels(2)
    wf.setsampwidth(2)
    wf.setframerate(sample_rate)
    wf.writeframes(interleaved.tobytes())

# Use ffmpeg to convert to high quality 192kbps MP3
mp3_target = '/home/cyber/projects/3d-portfolio/assets/space_ambient.mp3'
subprocess.run([
    'ffmpeg', '-y', '-i', wav_path,
    '-codec:a', 'libmp3lame', '-b:a', '192k',
    mp3_target
], check=True)

print("Generated space_ambient.mp3 successfully!")
