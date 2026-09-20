from extensions import db

class Subject(db.Model):
    __tablename__ = "subjects"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    code = db.Column(db.String(30), unique=True, nullable=False)
    semester = db.Column(db.Integer, nullable=False)
    year = db.Column(db.Integer, nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=False)

    department = db.relationship("Department", back_populates="subjects")
    resources = db.relationship("Resource", back_populates="subject", cascade="all, delete-orphan")
    attendance_records = db.relationship("Attendance", back_populates="subject", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "code": self.code,
            "semester": self.semester,
            "year": self.year,
            "department_id": self.department_id,
        }
