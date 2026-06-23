#!/usr/bin/env python3
"""Generate a 1240x1240 PNG source icon for Tauri from a simple vector-like drawing."""

from PIL import Image, ImageDraw, ImageFont
import os

DEST = os.path.join(os.path.dirname(__file__), "..", "src-tauri", "icons", "icon-source.png")

SIZE = 1240
PADDING = SIZE // 12
CORNER = SIZE // 8

img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Rounded amber/burgundy background
bg_color = (42, 24, 16, 255)
accent = (251, 191, 36, 255)
shadow = (120, 53, 15, 255)

# Draw rounded rectangle background
draw.rounded_rectangle(
    [PADDING, PADDING, SIZE - PADDING, SIZE - PADDING],
    radius=CORNER,
    fill=bg_color,
    outline=accent,
    width=SIZE // 60,
)

# Draw a simple wine glass symbol in the center
cx, cy = SIZE // 2, SIZE // 2
bowl_w = SIZE // 3
bowl_h = SIZE // 3
stem_w = SIZE // 20
stem_h = SIZE // 5
base_w = SIZE // 5
base_h = SIZE // 25

# Bowl (semicircle-ish)
draw.ellipse(
    [cx - bowl_w // 2, cy - bowl_h // 2 - SIZE // 20, cx + bowl_w // 2, cy + bowl_h // 2],
    fill=accent,
)
# Highlight
draw.ellipse(
    [cx - bowl_w // 4, cy - bowl_h // 3, cx - bowl_w // 8, cy - bowl_h // 8],
    fill=(255, 230, 160, 255),
)
# Stem
draw.rectangle(
    [cx - stem_w // 2, cy + bowl_h // 2 - SIZE // 40, cx + stem_w // 2, cy + bowl_h // 2 + stem_h],
    fill=accent,
)
# Base
draw.rounded_rectangle(
    [cx - base_w // 2, cy + bowl_h // 2 + stem_h, cx + base_w // 2, cy + bowl_h // 2 + stem_h + base_h],
    radius=base_h // 2,
    fill=accent,
)

os.makedirs(os.path.dirname(DEST), exist_ok=True)
img.save(DEST)
print(f"Saved {DEST}")
