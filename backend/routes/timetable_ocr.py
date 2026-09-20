import re
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
import pytesseract


# ============================================================
# TIMETABLE FORMAT
# ============================================================

DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
]

TIME_SLOTS = [
    ("09:15", "10:05"),
    ("10:05", "10:55"),
    ("10:55", "11:45"),
    ("11:45", "12:35"),
    ("12:35", "13:30"),   # Lunch
    ("13:30", "14:20"),
    ("14:20", "15:10"),
    ("15:10", "16:00"),
    ("16:00", "16:50"),
]


# Subject-code mapping from the bottom table
SUBJECTS = {
    "24ACSE51T": {
        "name": "Artificial Intelligence",
        "short": "DSCM",
        "faculty": "Mr. D. Subash Chandra Mouli",
    },

    "24ACSE52T": {
        "name": "Computer Networks",
        "short": "DS",
        "faculty": "Dr. D. Sarika",
    },

    "24ACSE53T": {
        "name": "Data Mining",
        "short": "SMR",
        "faculty": "Mr. S. Mohammad Rafi",
    },

    "24ACSE5BT": {
        "name": "Object Oriented Analysis and Design",
        "short": "STB",
        "faculty": "Miss. S. Tabasum",
    },

    "24ACSE51L": {
        "name": "Artificial Intelligence",
        "short": "DSCM",
        "faculty": "Mr. D. Subash Chandra Mouli",
    },

    "24ACSE52L": {
        "name": "Computer Networks",
        "short": "DS",
        "faculty": "Dr. D. Sarika",
    },

    "24ACSE53L": {
        "name": "Data Mining",
        "short": "SMR",
        "faculty": "Mr. S. Mohammad Rafi",
    },

    "24AENG51T": {
        "name": "Gender Sensitization",
        "short": "GVN",
        "faculty": "Mrs. G. V. Narmada",
    },
}


# ============================================================
# IMAGE PREPROCESSING
# ============================================================

def preprocess_cell(image):
    """
    Improve timetable cell before OCR.
    """

    gray = ImageOps.grayscale(image)

    # Increase contrast
    gray = ImageEnhance.Contrast(gray).enhance(2.0)

    # Sharpen
    gray = gray.filter(ImageFilter.SHARPEN)

    # Upscale
    width, height = gray.size

    scale = 3

    gray = gray.resize(
        (
            width * scale,
            height * scale,
        ),
        Image.Resampling.LANCZOS,
    )

    # Threshold
    gray = gray.point(
        lambda p: 255 if p > 170 else 0
    )

    return gray


# ============================================================
# OCR ONE CELL
# ============================================================

def ocr_cell(image):
    """
    OCR a single timetable cell.
    """

    processed = preprocess_cell(image)

    text = pytesseract.image_to_string(
        processed,
        config="--psm 6",
    )

    text = text.replace("\n", " ")
    text = re.sub(r"\s+", " ", text)

    return text.strip()


# ============================================================
# NORMALIZE OCR TEXT
# ============================================================

def normalize_text(text):
    text = text.upper()

    # Common OCR mistakes
    replacements = {
        "ACSE": "ACSE",
        "ACES": "ACSE",
        "A C S E": "ACSE",

        "ENGSIT": "AENG51T",
        "ENG51T": "AENG51T",

        "24A CSE": "24ACSE",
        "24 ACSE": "24ACSE",

        "24AENG": "24AENG",

        "SMR": "SMR",
        "DSCM": "DSCM",
        "STB": "STB",
        "GVN": "GVN",

        "LIBRARY": "LIBRARY",
        "LIBARY": "LIBRARY",
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    text = re.sub(
        r"\s+",
        " ",
        text,
    ).strip()

    return text


# ============================================================
# FIND SUBJECT CODE
# ============================================================

def find_subject_code(text):

    text = normalize_text(text)

    # Exact known codes first
    for code in SUBJECTS:

        if code in text:
            return code

    # More flexible fallback
    pattern = re.search(
        r"24[A-Z]{3,5}[0-9]{1,2}[A-Z]",
        text,
    )

    if pattern:
        candidate = pattern.group(0)

        # Try fuzzy correction
        for code in SUBJECTS:
            if candidate[:6] == code[:6]:
                return code

    return None


# ============================================================
# DETECT CLASS TYPE
# ============================================================

def detect_type(text):

    text = normalize_text(text)

    if "LAB" in text:
        return "lab"

    if "LIBRARY" in text:
        return "activity"

    return "class"


# ============================================================
# DETECT ROOM
# ============================================================

def detect_room(text):

    text = normalize_text(text)

    if "PR LAB" in text:
        return "PR LAB"

    if "JG LAB" in text:
        return "JG LAB"

    # Room 326
    room = re.search(
        r"\b326\b",
        text,
    )

    if room:
        return "326"

    # Generic room number
    room = re.search(
        r"\b[0-9]{3}\b",
        text,
    )

    if room:
        return room.group(0)

    return ""


# ============================================================
# CONVERT CELL TO ENTRY
# ============================================================

def parse_cell(text, day, start_time, end_time):

    text = normalize_text(text)

    if not text:
        return None

    # Lunch should never become attendance
    if "LUNCH" in text:
        return None

    code = find_subject_code(text)

    # Library
    if "LIBRARY" in text:

        return {
            "day": day,
            "start_time": start_time,
            "end_time": end_time,
            "subject_code": "",
            "subject_name": "Library",
            "room": "",
            "faculty": "",
            "type": "activity",
            "label": "Library",
        }

    # Unknown text without subject code
    if not code:

        # Ignore pure noise
        if len(text) < 3:
            return None

        return {
            "day": day,
            "start_time": start_time,
            "end_time": end_time,
            "subject_code": "",
            "subject_name": text.title(),
            "room": detect_room(text),
            "faculty": "",
            "type": detect_type(text),
            "label": text.title(),
        }

    subject = SUBJECTS[code]

    class_type = detect_type(text)

    room = detect_room(text)

    return {
        "day": day,
        "start_time": start_time,
        "end_time": end_time,
        "subject_code": code,
        "subject_name": subject["name"],
        "room": room,
        "faculty": subject["faculty"],
        "type": class_type,
        "label": subject["name"],
    }


# ============================================================
# SAMPLE TABLE COORDINATES
#
# This timetable has:
#
# x:
# Day column + 9 time columns
#
# y:
# header + 6 day rows
# ============================================================

def get_grid_coordinates(image):

    width, height = image.size

    # The supplied AU timetable has the timetable grid
    # approximately in this area.
    #
    # Use percentages so different resolutions still work.

    left = int(width * 0.042)
    right = int(width * 0.940)

    top = int(height * 0.113)
    bottom = int(height * 0.548)

    grid_width = right - left
    grid_height = bottom - top

    # Day column is approximately 9.4% of grid width
    day_width = int(grid_width * 0.095)

    # Remaining 9 time columns
    time_width = (
        grid_width - day_width
    ) / 9

    x_positions = [
        left,
        left + day_width,
    ]

    for i in range(1, 9):
        x_positions.append(
            int(left + day_width + time_width * i)
        )

    x_positions.append(right)

    # Header approximately 9% of grid height
    header_height = int(grid_height * 0.10)

    row_height = (
        grid_height - header_height
    ) / 6

    y_positions = [
        top,
        top + header_height,
    ]

    for i in range(1, 6):
        y_positions.append(
            int(
                top
                + header_height
                + row_height * i
            )
        )

    y_positions.append(bottom)

    return (
        x_positions,
        y_positions,
    )


# ============================================================
# EXTRACT COMPLETE TIMETABLE
# ============================================================

def extract_timetable(image_path):

    image = Image.open(image_path).convert("RGB")

    x, y = get_grid_coordinates(image)

    entries = []

    # 6 days
    for day_index, day in enumerate(DAYS):

        row_top = y[day_index + 1]
        row_bottom = y[day_index + 2]

        # 9 time slots
        for slot_index in range(9):

            # Lunch column
            if slot_index == 4:
                continue

            col_left = x[slot_index + 1]
            col_right = x[slot_index + 2]

            # Small padding to avoid grid lines
            pad_x = 5
            pad_y = 5

            cell = image.crop(
                (
                    col_left + pad_x,
                    row_top + pad_y,
                    col_right - pad_x,
                    row_bottom - pad_y,
                )
            )

            text = ocr_cell(cell)

            print(
                f"{day} "
                f"{TIME_SLOTS[slot_index][0]}-"
                f"{TIME_SLOTS[slot_index][1]}:"
                f" {text}"
            )

            entry = parse_cell(
                text,
                day,
                TIME_SLOTS[slot_index][0],
                TIME_SLOTS[slot_index][1],
            )

            if entry:
                entries.append(entry)

    return {
        "entries": entries,
        "entry_count": len(entries),
        "warnings": [],
    }


# ============================================================
# TEST
# ============================================================

if __name__ == "__main__":

    result = extract_timetable(
        "tt.jpeg"
    )

    print("\n==============================")
    print("EXTRACTED TIMETABLE")
    print("==============================\n")

    import json

    print(
        json.dumps(
            result,
            indent=2,
            ensure_ascii=False,
        )
    )