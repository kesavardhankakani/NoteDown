import os
import tempfile
import unittest
from datetime import date
from pathlib import Path


_database_dir = tempfile.TemporaryDirectory(prefix="notedown-timetable-test-")
_database_path = Path(_database_dir.name) / "timetable.sqlite"
os.environ["DATABASE_URL"] = f"sqlite:///{_database_path.as_posix()}"
os.environ["JWT_SECRET_KEY"] = "isolated-timetable-import-test-key"

from app import app
from extensions import db
from flask_jwt_extended import create_access_token
from models import Attendance, Timetable, User


class TimetableImportTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)
        cls.client = app.test_client()

    @classmethod
    def tearDownClass(cls):
        with app.app_context():
            db.session.remove()
            db.engine.dispose()
        _database_dir.cleanup()

    def setUp(self):
        with app.app_context():
            db.drop_all()
            db.create_all()
            db.session.execute(db.text("PRAGMA foreign_keys=ON"))
            user = User(
                name="Import Test",
                email="import-test@example.invalid",
                password_hash="test",
            )
            db.session.add(user)
            db.session.flush()
            self.user_id = user.id

            linked = Timetable(
                user_id=user.id,
                subject_name="Old class",
                subject_code="OLD101",
                day_of_week="Monday",
                start_time="09:00",
                end_time="10:00",
                class_type="class",
            )
            keep_history = Timetable(
                user_id=user.id,
                subject_name="Historical class",
                subject_code="OLD102",
                day_of_week="Thursday",
                start_time="14:00",
                end_time="15:00",
                class_type="class",
            )
            obsolete = Timetable(
                user_id=user.id,
                subject_name="Unlinked class",
                subject_code="OLD103",
                day_of_week="Tuesday",
                start_time="10:00",
                end_time="11:00",
                class_type="class",
            )
            db.session.add_all([linked, keep_history, obsolete])
            db.session.flush()
            self.linked_id = linked.id
            self.keep_history_id = keep_history.id
            for timetable_id in (linked.id, keep_history.id):
                db.session.add(
                    Attendance(
                        user_id=user.id,
                        timetable_id=timetable_id,
                        class_date=date(2026, 10, 17),
                        status="present",
                        method="MANUAL",
                        location_mode="manual",
                    )
                )
            db.session.commit()
            self.headers = {
                "Authorization": f"Bearer {create_access_token(identity=str(user.id))}"
            }

    def tearDown(self):
        with app.app_context():
            db.session.remove()

    @staticmethod
    def entry(day, start, end, code, name):
        return {
            "day": day,
            "start_time": start,
            "end_time": end,
            "subject_code": code,
            "subject_name": name,
            "type": "class",
        }

    def test_replace_preserves_attendance_and_reports_saved_rows(self):
        response = self.client.post(
            "/api/timetable/import",
            headers=self.headers,
            json={
                "replace_existing": True,
                "entries": [
                    self.entry("Monday", "09:00", "10:00", "NEW101", "Updated"),
                    self.entry("Wednesday", "11:00", "12:00", "NEW102", "Added"),
                ],
            },
        )

        self.assertEqual(response.status_code, 201, response.get_json())
        payload = response.get_json()
        self.assertEqual(
            (payload["created"], payload["updated"], payload["skipped"]),
            (1, 1, 1),
        )
        self.assertTrue(all(item["id"] is not None for item in payload["timetables"]))

        persisted = self.client.get(
            "/api/timetable",
            headers=self.headers,
        )
        self.assertEqual(persisted.status_code, 200, persisted.get_json())
        saved_items = persisted.get_json()["timetables"]
        self.assertTrue(
            any(item["subject_code"] == "NEW102" for item in saved_items)
        )

        with app.app_context():
            rows = Timetable.query.filter_by(user_id=self.user_id).all()
            by_id = {row.id: row for row in rows}
            self.assertEqual(len(rows), 3)
            self.assertEqual(by_id[self.linked_id].subject_name, "Updated")
            self.assertIn(self.keep_history_id, by_id)
            self.assertNotIn(
                "OLD103",
                {row.subject_code for row in rows},
            )
            self.assertEqual(
                {
                    row.timetable_id
                    for row in Attendance.query.filter_by(user_id=self.user_id)
                },
                {self.linked_id, self.keep_history_id},
            )

    def test_updated_only_import_is_successful_and_duplicates_are_rejected(self):
        response = self.client.post(
            "/api/timetable/import",
            headers=self.headers,
            json={
                "replace_existing": True,
                "entries": [
                    self.entry("Monday", "09:00", "10:00", "NEW101", "Updated")
                ],
            },
        )
        self.assertEqual(response.status_code, 201, response.get_json())
        self.assertEqual(response.get_json()["created"], 0)
        self.assertEqual(response.get_json()["updated"], 1)

        response = self.client.post(
            "/api/timetable/import",
            headers=self.headers,
            json={
                "entries": [
                    self.entry("Monday", "09:00", "10:00", "NEW101", "Updated")
                ]
            },
        )
        self.assertEqual(response.status_code, 400, response.get_json())

    def test_oversized_scanned_fields_do_not_mutate_existing_timetable(self):
        response = self.client.post(
            "/api/timetable/import",
            headers=self.headers,
            json={
                "replace_existing": True,
                "entries": [
                    self.entry("Monday", "09:00", "10:00", "NEW101", "x" * 161)
                ],
            },
        )

        self.assertEqual(response.status_code, 400, response.get_json())
        self.assertIn("subject_name", response.get_json()["skipped_entries"][0]["reason"])
        with app.app_context():
            self.assertEqual(
                Timetable.query.filter_by(id=self.linked_id).one().subject_name,
                "Old class",
            )
            self.assertEqual(
                Timetable.query.filter_by(user_id=self.user_id).count(),
                3,
            )


if __name__ == "__main__":
    unittest.main()
