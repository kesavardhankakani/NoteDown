from datetime import date, datetime
from extensions import db

class Attendance(db.Model):
    __tablename__ = "attendance"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    subject_id = db.Column(db.Integer, db.ForeignKey("subjects.id"), nullable=False, index=True)
    timetable_id = db.Column(db.Integer, db.ForeignKey("timetables.id"), nullable=True, index=True)
    class_date = db.Column(db.Date, nullable=False, default=date.today)
    status = db.Column(db.String(20), nullable=False, default="present")
    method = db.Column(db.String(20), nullable=False, default="MANUAL")
    location_mode = db.Column(db.String(20), nullable=False, default="manual")
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    accuracy = db.Column(db.Float, nullable=True)
    marked_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user = db.relationship("User")
    subject = db.relationship("Subject", back_populates="attendance_records")
    timetable = db.relationship("Timetable")

    def to_dict(self):
        return {"id": self.id, "subject_id": self.subject_id, "subject_name": self.subject.name if self.subject else None,
                "subject_code": self.subject.code if self.subject else None, "timetable_id": self.timetable_id,
                "class_date": self.class_date.isoformat(), "status": self.status, "method": self.method,
                "location_mode": self.location_mode, "latitude": self.latitude, "longitude": self.longitude,
                "accuracy": self.accuracy, "marked_at": self.marked_at.isoformat() if self.marked_at else None}
