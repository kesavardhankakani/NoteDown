from datetime import datetime
from extensions import db

class DownloadHistory(db.Model):
    __tablename__ = "download_history"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    resource_id = db.Column(db.Integer, db.ForeignKey("resources.id"), nullable=False)
    downloaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    resource = db.relationship("Resource", back_populates="download_history")
    user = db.relationship("User")
