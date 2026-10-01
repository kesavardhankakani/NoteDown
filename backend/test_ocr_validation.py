import importlib.util
import pathlib

module_path = pathlib.Path(__file__).with_name("routes").joinpath("academic.py")
spec = importlib.util.spec_from_file_location("academic_module", module_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_is_attendance_class_rejects_non_teaching_blocks():
    class Dummy:
        class_type = "library"
        label = "Lunch"
        subject_name = "Lunch"

    assert module._is_attendance_class(Dummy()) is False


def test_validate_vision_grid_accepts_compact_shape():
    valid = {
        "subjects": [
            {"id": 1, "code": "24ACSE51T", "name": "Artificial Intelligence", "type": "class"},
            {"id": 2, "code": "24ACSE52L", "name": "Computer Networks", "type": "lab"},
        ],
        "grid": [
            [-1, 1, -1, -1, -1, -1, -1, -1, -1],
            [-1, -1, 2, -1, -1, -1, -1, -1, -1],
            [-1, -1, -1, 1, -1, -1, -1, -1, -1],
            [-1, -1, -1, -1, 2, -1, -1, -1, -1],
            [-1, 1, -1, -1, -1, -1, -1, -1, -1],
            [-1, -1, 2, -1, -1, -1, -1, -1, -1],
        ],
    }
    result = module._validate_vision_grid(valid)
    assert result["days"] == ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    assert result["grid"][0][1] == 1


def test_validate_vision_grid_rejects_bad_shape():
    bad = {
        "subjects": [{"id": 1, "code": "24ACSE51T", "name": "AI", "type": "class"}],
        "grid": [[1, 2, 3]],
    }
    try:
        module._validate_vision_grid(bad)
        raise AssertionError("Expected validation error for malformed grid")
    except ValueError as exc:
        assert "6 rows" in str(exc)


def test_validate_vision_entries_preserves_times_and_lab_type():
    result = module._validate_vision_entries({
        "entries": [
            {
                "day": "Tue",
                "start_time": "08:30",
                "end_time": "10:00",
                "subject_code": "CS204L",
                "subject_name": "Data Structures",
                "type": "class",
                "room": "Lab 2",
                "faculty": "A. Rao",
                "confidence": 0.93,
            },
            {
                "day": "Wednesday",
                "start_time": "11:15",
                "end_time": "12:05",
                "subject_code": "MA101",
                "subject_name": "Mathematics",
                "type": "class",
                "room": "R3",
                "faculty": "B. Das",
                "confidence": 0.8,
            },
        ]
    })

    lab, lecture = result["entries"]
    assert (lab["day"], lab["start_time"], lab["end_time"]) == (
        "Tuesday", "08:30", "10:00"
    )
    assert lab["type"] == "lab"
    assert lab["room"] == "Lab 2"
    assert lecture["type"] == "class"
    assert lecture["start_time"] == "11:15"


test_validate_vision_entries_preserves_times_and_lab_type()
print("OCR validation smoke tests: PASS")
