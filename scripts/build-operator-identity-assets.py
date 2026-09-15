from pathlib import Path

from PIL import Image, ImageEnhance


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "assets" / "identity"
MASTER = ASSET_DIR / "aetherus-mark-hero-master.png"


def prepare(image: Image.Image) -> Image.Image:
    image = ImageEnhance.Contrast(image).enhance(1.10)
    image = ImageEnhance.Color(image).enhance(0.96)
    return ImageEnhance.Sharpness(image).enhance(1.04)


def save_webp(image: Image.Image, name: str, width: int) -> None:
    ratio = width / image.width
    resized = image.resize(
        (width, round(image.height * ratio)),
        Image.Resampling.LANCZOS,
    )
    resized.save(
        ASSET_DIR / name,
        "WEBP",
        quality=88,
        method=6,
        exact=True,
    )


def main() -> None:
    source = prepare(Image.open(MASTER).convert("RGB"))
    save_webp(source, "aetherus-mark-hero-1440.webp", 1440)
    save_webp(source, "aetherus-mark-hero-960.webp", 960)

    # The square crop removes only editorial negative space. It preserves the
    # complete mark, its open center, and the source material/lighting study.
    mobile = source.crop((360, 0, 1440, 1080))
    save_webp(mobile, "aetherus-mark-hero-mobile-720.webp", 720)
    save_webp(mobile, "aetherus-mark-hero-mobile-480.webp", 480)


if __name__ == "__main__":
    main()
