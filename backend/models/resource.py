from datetime import datetime
from extensions import db

class Resource(db.Model):
    __tablename__ = "resources"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    resource_type = db.Column(db.String(50), nullable=False, default="pdf")
    unit_number = db.Column(db.Integer, nullable=True)
    file_name = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.Integer)
    downloads = db.Column(db.Integer, default=0)
    is_published = db.Column(db.Boolean, default=True)
    subject_id = db.Column(db.Integer, db.ForeignKey("subjects.id"), nullable=False)
    uploaded_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    subject = db.relationship("Subject", back_populates="resources")
    uploader = db.relationship("User", foreign_keys=[uploaded_by])
    favorites = db.relationship("Favorite", back_populates="resource", cascade="all, delete-orphan")
    download_history = db.relationship("DownloadHistory", back_populates="resource", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "resource_type": self.resource_type,
            "unit_number": self.unit_number,
            "file_name": self.file_name,
            "file_size": self.file_size,
            "downloads": self.downloads or 0,
            "is_published": self.is_published,
            "subject_id": self.subject_id,
            "uploaded_by": self.uploaded_by,
            "subject": self.subject.to_dict() if self.subject else None,
            "subject_name": self.subject.name if self.subject else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
