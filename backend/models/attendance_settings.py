from extensions import db

class AttendanceSettings(db.Model):
    __tablename__ = "attendance_settings"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, unique=True)
    minimum_percentage = db.Column(db.Float, nullable=False, default=75.0)
    location_enabled = db.Column(db.Boolean, nullable=False, default=False)
    default_radius = db.Column(db.Float, nullable=False, default=50.0)

    def to_dict(self):
        return {"minimum_percentage": self.minimum_percentage, "location_enabled": self.location_enabled, "default_radius": self.default_radius}
