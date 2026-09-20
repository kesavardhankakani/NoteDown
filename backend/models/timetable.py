from datetime import datetime

from extensions import db


class Timetable(db.Model):
    __tablename__ = "timetables"

    id = db.Column(
        db.Integer,
        primary_key=True,
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    # Optional legacy link to master Subject.
    # Timetable OCR does NOT require this.
    subject_id = db.Column(
        db.Integer,
        db.ForeignKey("subjects.id"),
        nullable=True,
        index=True,
    )

    # Independent OCR timetable data.
    subject_code = db.Column(
        db.String(50),
        nullable=True,
    )

    subject_name = db.Column(
        db.String(160),
        nullable=True,
    )

    day_of_week = db.Column(
        db.String(12),
        nullable=False,
    )

    start_time = db.Column(
        db.String(5),
        nullable=False,
    )

    end_time = db.Column(
        db.String(5),
        nullable=False,
    )

    room = db.Column(
        db.String(100),
        nullable=True,
    )

    faculty = db.Column(
        db.String(160),
        nullable=True,
    )

    class_type = db.Column(
        db.String(20),
        nullable=False,
        default="class",
    )

    label = db.Column(
        db.String(160),
        nullable=True,
    )

    latitude = db.Column(db.Float)

    longitude = db.Column(db.Float)

    radius = db.Column(
        db.Float,
        default=50,
    )

    attendance_mode = db.Column(
        db.String(10),
        nullable=False,
        default="MANUAL",
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
    )

    subject = db.relationship("Subject")

    def to_dict(self):
        subject_name = (
            self.subject_name
            or (
                self.subject.name
                if self.subject
                else ""
            )
        )

        subject_code = (
            self.subject_code
            or (
                self.subject.code
                if self.subject
                else ""
            )
        )

        return {
            "id": self.id,
            "subject_id": self.subject_id,
            "subject_name": subject_name,
            "subject_code": subject_code,
            "day_of_week": self.day_of_week,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "room": self.room or "",
            "faculty": self.faculty or "",
            "class_type": self.class_type or "class",
            "label": self.label or "",
            "latitude": self.latitude,
            "longitude": self.longitude,
            "radius": self.radius or 50,
            "attendance_mode": (
                self.attendance_mode or "MANUAL"
            ),
            "created_at": (
                self.created_at.isoformat()
                if self.created_at
                else None
            ),
        }