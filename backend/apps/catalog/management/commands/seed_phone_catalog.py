import re
from django.core.management.base import BaseCommand
from apps.catalog.models import Category, Product
from apps.inventory.models import DeviceItem


class Command(BaseCommand):
    help = "Seeds phone brand categories, creates 200+ clean general phone models, and migrates existing device items."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("=== SEEDING PHONE CATALOG & MIGRATING INVENTORY ==="))

        # 1. Setup Brand Categories
        categories_data = [
            {"name": "Apple iPhone", "is_device": True},
            {"name": "Samsung Galaxy", "is_device": True},
            {"name": "Xiaomi / Redmi / Poco", "is_device": True},
            {"name": "Google Pixel", "is_device": True},
            {"name": "Oppo / Realme", "is_device": True},
            {"name": "Infinix / Tecno", "is_device": True},
            {"name": "Autres Marques", "is_device": True},
        ]

        cat_objs = {}
        for cdata in categories_data:
            cat, created = Category.objects.update_or_create(
                name=cdata["name"],
                defaults={"is_device": cdata["is_device"]},
            )
            cat_objs[cdata["name"]] = cat
            status = "Created" if created else "Updated"
            self.stdout.write(f"  [Category] {status}: {cat.name}")

        # 2. Complete models dictionary
        models_to_create = []

        # --- APPLE IPHONE (Complete history from iPhone 7 to iPhone 16 series) ---
        apple_models = [
            # 7 & 8 series
            "iPhone 7", "iPhone 7 Plus",
            "iPhone 8", "iPhone 8 Plus",
            # X generation
            "iPhone X", "iPhone XR", "iPhone XS", "iPhone XS Max",
            # 11 generation
            "iPhone 11", "iPhone 11 Pro", "iPhone 11 Pro Max",
            # SE series
            "iPhone SE (2020)", "iPhone SE (2022)",
            # 12 generation
            "iPhone 12 mini", "iPhone 12", "iPhone 12 Pro", "iPhone 12 Pro Max",
            # 13 generation
            "iPhone 13 mini", "iPhone 13", "iPhone 13 Pro", "iPhone 13 Pro Max",
            # 14 generation
            "iPhone 14", "iPhone 14 Plus", "iPhone 14 Pro", "iPhone 14 Pro Max",
            # 15 generation
            "iPhone 15", "iPhone 15 Plus", "iPhone 15 Pro", "iPhone 15 Pro Max",
            # 16 generation (latest current)
            "iPhone 16", "iPhone 16 Plus", "iPhone 16 Pro", "iPhone 16 Pro Max", "iPhone 16e",
        ]
        def make_sku(prefix, name):
            slug = name.replace("+", " PLUS ").replace("&", " AND ")
            slug = re.sub(r"[^A-Z0-9]+", "-", slug.upper()).strip("-")
            return f"{prefix}-{slug}"

        for name in apple_models:
            models_to_create.append({
                "brand": "Apple",
                "name": name,
                "sku": make_sku("APL", name),
                "platform": Product.Platform.APPLE,
                "category": cat_objs["Apple iPhone"],
            })

        # --- SAMSUNG GALAXY ---
        samsung_models = [
            # Galaxy S series
            "Galaxy S9", "Galaxy S9+", "Galaxy S10e", "Galaxy S10", "Galaxy S10+", "Galaxy S10 5G",
            "Galaxy S20", "Galaxy S20+", "Galaxy S20 Ultra", "Galaxy S20 FE",
            "Galaxy S21", "Galaxy S21+", "Galaxy S21 Ultra", "Galaxy S21 FE",
            "Galaxy S22", "Galaxy S22+", "Galaxy S22 Ultra",
            "Galaxy S23", "Galaxy S23+", "Galaxy S23 Ultra", "Galaxy S23 FE",
            "Galaxy S24", "Galaxy S24+", "Galaxy S24 Ultra", "Galaxy S24 FE",
            # Galaxy Note series
            "Galaxy Note 9", "Galaxy Note 10", "Galaxy Note 10 Lite", "Galaxy Note 10+",
            "Galaxy Note 20", "Galaxy Note 20 Ultra",
            # Galaxy Z Fold / Z Flip series
            "Galaxy Fold", "Galaxy Z Fold 2", "Galaxy Z Fold 3", "Galaxy Z Fold 4", "Galaxy Z Fold 5", "Galaxy Z Fold 6",
            "Galaxy Z Flip", "Galaxy Z Flip 3", "Galaxy Z Flip 4", "Galaxy Z Flip 5", "Galaxy Z Flip 6",
            # Galaxy A series (Comprehensive from A0x to A7x)
            "Galaxy A01", "Galaxy A02", "Galaxy A02s", "Galaxy A03", "Galaxy A03s", "Galaxy A04", "Galaxy A04s", "Galaxy A04e", "Galaxy A05", "Galaxy A05s", "Galaxy A06",
            "Galaxy A10", "Galaxy A10s", "Galaxy A11", "Galaxy A12", "Galaxy A13", "Galaxy A14", "Galaxy A14 5G", "Galaxy A15", "Galaxy A15 5G", "Galaxy A16 5G",
            "Galaxy A20", "Galaxy A20s", "Galaxy A21s", "Galaxy A22", "Galaxy A22 5G", "Galaxy A23", "Galaxy A24", "Galaxy A25 5G",
            "Galaxy A30", "Galaxy A30s", "Galaxy A31", "Galaxy A32", "Galaxy A33 5G", "Galaxy A34 5G", "Galaxy A35 5G",
            "Galaxy A50", "Galaxy A50s", "Galaxy A51", "Galaxy A52", "Galaxy A52 5G", "Galaxy A52s 5G", "Galaxy A53 5G", "Galaxy A54 5G", "Galaxy A55 5G",
            "Galaxy A70", "Galaxy A71", "Galaxy A72", "Galaxy A73 5G",
            # Galaxy M series
            "Galaxy M11", "Galaxy M12", "Galaxy M13", "Galaxy M14", "Galaxy M21", "Galaxy M22", "Galaxy M23",
            "Galaxy M31", "Galaxy M32", "Galaxy M33", "Galaxy M34", "Galaxy M51", "Galaxy M52", "Galaxy M53", "Galaxy M54",
        ]
        for name in samsung_models:
            models_to_create.append({
                "brand": "Samsung",
                "name": name,
                "sku": make_sku("SAM", name),
                "platform": Product.Platform.ANDROID,
                "category": cat_objs["Samsung Galaxy"],
            })

        # --- XIAOMI / REDMI / POCO ---
        xiaomi_models = [
            # Redmi Note series
            "Redmi Note 7", "Redmi Note 7 Pro", "Redmi Note 8", "Redmi Note 8T", "Redmi Note 8 Pro",
            "Redmi Note 9", "Redmi Note 9S", "Redmi Note 9 Pro",
            "Redmi Note 10", "Redmi Note 10S", "Redmi Note 10 5G", "Redmi Note 10 Pro",
            "Redmi Note 11", "Redmi Note 11S", "Redmi Note 11 Pro", "Redmi Note 11 Pro+ 5G",
            "Redmi Note 12", "Redmi Note 12 5G", "Redmi Note 12S", "Redmi Note 12 Pro", "Redmi Note 12 Pro+ 5G",
            "Redmi Note 13", "Redmi Note 13 5G", "Redmi Note 13 Pro", "Redmi Note 13 Pro+ 5G",
            "Redmi Note 14", "Redmi Note 14 Pro", "Redmi Note 14 Pro+ 5G",
            # Redmi Standard / A / C series
            "Redmi 7", "Redmi 7A", "Redmi 8", "Redmi 8A", "Redmi 9", "Redmi 9A", "Redmi 9C", "Redmi 9T",
            "Redmi 10", "Redmi 10A", "Redmi 10C", "Redmi 10 2022", "Redmi 12", "Redmi 12C", "Redmi 13", "Redmi 13C", "Redmi 14C",
            "Redmi A1", "Redmi A1+", "Redmi A2", "Redmi A2+", "Redmi A3",
            # Poco series
            "Poco X3 NFC", "Poco X3 Pro", "Poco X4 Pro 5G", "Poco X5 5G", "Poco X5 Pro 5G", "Poco X6 5G", "Poco X6 Pro 5G",
            "Poco F3", "Poco F4", "Poco F4 GT", "Poco F5", "Poco F5 Pro", "Poco F6", "Poco F6 Pro",
            "Poco M3", "Poco M3 Pro 5G", "Poco M4 Pro", "Poco M4 Pro 5G", "Poco M5", "Poco M5s", "Poco M6", "Poco M6 Pro",
            # Xiaomi Flagships (Mi / T / Ultra)
            "Xiaomi Mi 9", "Xiaomi Mi 9T", "Xiaomi Mi 9T Pro", "Xiaomi Mi 10", "Xiaomi Mi 10T", "Xiaomi Mi 10T Pro",
            "Xiaomi 11", "Xiaomi 11T", "Xiaomi 11T Pro", "Xiaomi 11 Lite 5G NE",
            "Xiaomi 12", "Xiaomi 12X", "Xiaomi 12 Pro", "Xiaomi 12T", "Xiaomi 12T Pro",
            "Xiaomi 13", "Xiaomi 13 Pro", "Xiaomi 13 Ultra", "Xiaomi 13T", "Xiaomi 13T Pro",
            "Xiaomi 14", "Xiaomi 14 Pro", "Xiaomi 14 Ultra", "Xiaomi 14T", "Xiaomi 14T Pro",
        ]
        for name in xiaomi_models:
            brand = "Poco" if name.startswith("Poco") else ("Redmi" if name.startswith("Redmi") else "Xiaomi")
            models_to_create.append({
                "brand": brand,
                "name": name,
                "sku": make_sku("XIA", name),
                "platform": Product.Platform.ANDROID,
                "category": cat_objs["Xiaomi / Redmi / Poco"],
            })

        # --- GOOGLE PIXEL ---
        google_models = [
            "Pixel 3", "Pixel 3 XL", "Pixel 3a", "Pixel 3a XL",
            "Pixel 4", "Pixel 4 XL", "Pixel 4a", "Pixel 4a (5G)",
            "Pixel 5", "Pixel 5a (5G)",
            "Pixel 6", "Pixel 6 Pro", "Pixel 6a",
            "Pixel 7", "Pixel 7 Pro", "Pixel 7a",
            "Pixel 8", "Pixel 8 Pro", "Pixel 8a",
            "Pixel 9", "Pixel 9 Pro", "Pixel 9 Pro XL", "Pixel 9 Pro Fold",
            "Pixel Fold",
        ]
        for name in google_models:
            models_to_create.append({
                "brand": "Google",
                "name": name,
                "sku": make_sku("GOOG", name),
                "platform": Product.Platform.ANDROID,
                "category": cat_objs["Google Pixel"],
            })

        # --- OPPO / REALME ---
        oppo_realme_models = [
            # Oppo Reno
            ("Oppo", "Reno 4"), ("Oppo", "Reno 5"), ("Oppo", "Reno 5 Pro"), ("Oppo", "Reno 6"), ("Oppo", "Reno 6 Pro"),
            ("Oppo", "Reno 7"), ("Oppo", "Reno 7 Pro"), ("Oppo", "Reno 8"), ("Oppo", "Reno 8 Lite"), ("Oppo", "Reno 8 Pro"),
            ("Oppo", "Reno 10"), ("Oppo", "Reno 10 Pro"), ("Oppo", "Reno 11"), ("Oppo", "Reno 11F"), ("Oppo", "Reno 11 Pro"),
            ("Oppo", "Reno 12"), ("Oppo", "Reno 12F"), ("Oppo", "Reno 12 Pro"),
            # Oppo A
            ("Oppo", "A15"), ("Oppo", "A16"), ("Oppo", "A16s"), ("Oppo", "A17"), ("Oppo", "A17k"), ("Oppo", "A18"),
            ("Oppo", "A38"), ("Oppo", "A53"), ("Oppo", "A54"), ("Oppo", "A57"), ("Oppo", "A58"), ("Oppo", "A74"),
            ("Oppo", "A76"), ("Oppo", "A77"), ("Oppo", "A78"), ("Oppo", "A79"), ("Oppo", "A94"), ("Oppo", "A96"), ("Oppo", "A98 5G"),
            # Oppo Find
            ("Oppo", "Find X3 Pro"), ("Oppo", "Find X5 Pro"), ("Oppo", "Find X6 Pro"), ("Oppo", "Find X7 Ultra"),
            ("Oppo", "Find N2 Flip"), ("Oppo", "Find N3 Flip"),
            # Realme C
            ("Realme", "C11"), ("Realme", "C21"), ("Realme", "C21Y"), ("Realme", "C25"), ("Realme", "C25Y"),
            ("Realme", "C30"), ("Realme", "C31"), ("Realme", "C33"), ("Realme", "C35"), ("Realme", "C51"),
            ("Realme", "C53"), ("Realme", "C55"), ("Realme", "C67"),
            # Realme Number
            ("Realme", "Realme 7"), ("Realme", "Realme 7 Pro"), ("Realme", "Realme 8"), ("Realme", "Realme 8 Pro"),
            ("Realme", "Realme 9"), ("Realme", "Realme 9i"), ("Realme", "Realme 9 Pro"), ("Realme", "Realme 9 Pro+"),
            ("Realme", "Realme 10"), ("Realme", "Realme 11"), ("Realme", "Realme 11 Pro"), ("Realme", "Realme 11 Pro+"),
            ("Realme", "Realme 12"), ("Realme", "Realme 12+"), ("Realme", "Realme 12 Pro"), ("Realme", "Realme 12 Pro+"),
            # Realme GT
            ("Realme", "GT Master Edition"), ("Realme", "GT Neo 2"), ("Realme", "GT Neo 3"), ("Realme", "GT 2 Pro"),
            ("Realme", "GT 6"), ("Realme", "GT 6T"),
        ]
        for brand, name in oppo_realme_models:
            prefix = "OPP" if brand == "Oppo" else "RLM"
            models_to_create.append({
                "brand": brand,
                "name": name,
                "sku": make_sku(prefix, name),
                "platform": Product.Platform.ANDROID,
                "category": cat_objs["Oppo / Realme"],
            })

        # --- INFINIX / TECNO ---
        infinix_tecno_models = [
            # Infinix Hot
            ("Infinix", "Hot 9"), ("Infinix", "Hot 10"), ("Infinix", "Hot 10 Play"), ("Infinix", "Hot 11"), ("Infinix", "Hot 11 Play"),
            ("Infinix", "Hot 12"), ("Infinix", "Hot 12 Play"), ("Infinix", "Hot 20"), ("Infinix", "Hot 20i"),
            ("Infinix", "Hot 30"), ("Infinix", "Hot 30i"), ("Infinix", "Hot 40"), ("Infinix", "Hot 40i"), ("Infinix", "Hot 40 Pro"), ("Infinix", "Hot 50 Pro"),
            # Infinix Note
            ("Infinix", "Note 10"), ("Infinix", "Note 10 Pro"), ("Infinix", "Note 11"), ("Infinix", "Note 11 Pro"),
            ("Infinix", "Note 12"), ("Infinix", "Note 12 G96"), ("Infinix", "Note 30"), ("Infinix", "Note 30 Pro"), ("Infinix", "Note 30 VIP"),
            ("Infinix", "Note 40"), ("Infinix", "Note 40 Pro"), ("Infinix", "Note 40 Pro+ 5G"),
            # Infinix Smart & Zero
            ("Infinix", "Smart 6"), ("Infinix", "Smart 7"), ("Infinix", "Smart 8"),
            ("Infinix", "Zero 8"), ("Infinix", "Zero 20"), ("Infinix", "Zero 30"), ("Infinix", "Zero 30 5G"), ("Infinix", "Zero Ultra"),
            # Tecno Spark
            ("Tecno", "Spark 7"), ("Tecno", "Spark 8"), ("Tecno", "Spark 8P"), ("Tecno", "Spark 9"), ("Tecno", "Spark 9 Pro"),
            ("Tecno", "Spark 10"), ("Tecno", "Spark 10C"), ("Tecno", "Spark 10 Pro"), ("Tecno", "Spark 20"), ("Tecno", "Spark 20C"), ("Tecno", "Spark 20 Pro"), ("Tecno", "Spark 20 Pro+"),
            # Tecno Camon
            ("Tecno", "Camon 17"), ("Tecno", "Camon 17 Pro"), ("Tecno", "Camon 18"), ("Tecno", "Camon 18 Premier"),
            ("Tecno", "Camon 19"), ("Tecno", "Camon 19 Pro"), ("Tecno", "Camon 20"), ("Tecno", "Camon 20 Pro"), ("Tecno", "Camon 20 Premier"),
            ("Tecno", "Camon 30"), ("Tecno", "Camon 30 Pro"), ("Tecno", "Camon 30 Premier"),
            # Tecno Pova & Pop
            ("Tecno", "Pova 3"), ("Tecno", "Pova 4"), ("Tecno", "Pova 4 Pro"), ("Tecno", "Pova 5"), ("Tecno", "Pova 5 Pro"), ("Tecno", "Pova 6 Pro"),
            ("Tecno", "Pop 5"), ("Tecno", "Pop 7"), ("Tecno", "Pop 8"),
        ]
        for brand, name in infinix_tecno_models:
            prefix = "INF" if brand == "Infinix" else "TEC"
            models_to_create.append({
                "brand": brand,
                "name": name,
                "sku": make_sku(prefix, name),
                "platform": Product.Platform.ANDROID,
                "category": cat_objs["Infinix / Tecno"],
            })

        # Insert / Update all products
        created_count = 0
        updated_count = 0
        created_products_map = {}

        for pdata in models_to_create:
            prod, created = Product.objects.update_or_create(
                sku=pdata["sku"],
                defaults={
                    "name": pdata["name"],
                    "brand": pdata["brand"],
                    "platform": pdata["platform"],
                    "category": pdata["category"],
                    "storage_gb": None,
                    "ram_gb": None,
                    "is_active": True,
                },
            )
            created_products_map[(prod.brand.lower(), prod.name.lower())] = prod
            created_products_map[prod.name.lower()] = prod
            if created:
                created_count += 1
            else:
                updated_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Successfully seeded models: {created_count} created, {updated_count} updated. Total: {len(models_to_create)}"
        ))

        # 3. MIGRATE EXISTING 17 DEVICE ITEMS
        self.stdout.write(self.style.NOTICE("--- Migrating existing DeviceItem records ---"))
        devices = DeviceItem.objects.all().select_related("product")
        migrated_devices = 0

        # Common color keywords to detect
        known_colors = [
            "noir", "black", "midnight", "starlight", "blanc", "white", "bleu", "blue",
            "deep purple", "violet", "purple", "titanium naturel", "natural titanium", "titanium",
            "phantom black", "gris titane", "gray", "grey", "silver", "or", "gold",
            "awesome navy", "green", "vert", "rouge", "red", "yellow", "jaune"
        ]

        for d in devices:
            old_prod = d.product
            # 3a. Storage & RAM migration
            if old_prod.storage_gb and not d.storage_gb:
                d.storage_gb = old_prod.storage_gb
            is_apple = (
                (old_prod.brand and old_prod.brand.lower() == "apple")
                or "iphone" in old_prod.name.lower()
            )
            if is_apple:
                d.ram_gb = None
            elif old_prod.ram_gb and not d.ram_gb:
                d.ram_gb = old_prod.ram_gb

            # 3b. Color extraction from old product name if not already set
            if not d.color and old_prod.name:
                name_lower = old_prod.name.lower()
                for c in known_colors:
                    if c in name_lower:
                        # Capitalize nicely
                        d.color = c.title()
                        break

            # 3c. Link to new general product model
            # Normalize old product name
            clean_name = old_prod.name
            # Remove storage like "128GB", "256GB"
            clean_name = re.sub(r"\b\d+\s*(?:gb|go|to|tb)\b", "", clean_name, flags=re.IGNORECASE)
            # Remove color terms
            for c in known_colors:
                clean_name = re.sub(rf"\b{re.escape(c)}\b", "", clean_name, flags=re.IGNORECASE)
            # Remove "Apple", "Samsung", "Xiaomi", "Google" prefix if in name
            clean_name = re.sub(r"^(?:apple|samsung|xiaomi|google|applr)\s+", "", clean_name, flags=re.IGNORECASE)
            clean_name = clean_name.strip()

            # Fix typos like "Iphone 17 pro max" -> "iPhone 16 Pro Max"
            if "17 pro max" in clean_name.lower():
                clean_name = "iPhone 16 Pro Max"
            elif "iphone" in clean_name.lower():
                # Fix casing: "iphone 13" -> "iPhone 13"
                clean_name = re.sub(r"^iphone", "iPhone", clean_name, flags=re.IGNORECASE)

            # Find matching newly seeded product
            target_prod = created_products_map.get(clean_name.lower())
            if not target_prod:
                # Try finding in all products
                target_prod = Product.objects.filter(name__iexact=clean_name).first()
            if not target_prod and "iphone" in clean_name.lower():
                # Fuzzy match
                for p_name, prod_obj in created_products_map.items():
                    if clean_name.lower() in str(p_name):
                        target_prod = prod_obj
                        break

            if target_prod:
                d.product = target_prod

            d.save()
            migrated_devices += 1
            self.stdout.write(
                f"  Migrated device #{d.id}: {d.product.brand} {d.product.name} | "
                f"Storage: {d.storage_gb} Go | RAM: {d.ram_gb or '-'} Go | Color: {d.color or '-'} | Status: {d.status}"
            )

        self.stdout.write(self.style.SUCCESS(f"Finished migrating {migrated_devices} existing inventory devices!"))
