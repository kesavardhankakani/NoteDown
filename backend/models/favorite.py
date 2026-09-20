from datetime import datetime
from extensions import db

class Favorite(db.Model):
    __tablename__ = "favorites"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    resource_id = db.Column(db.Integer, db.ForeignKey("resources.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    resource = db.relationship("Resource", back_populates="favorites")
    user = db.relationship("User")

    __table_args__ = (
        db.UniqueConstraint("user_id", "resource_id", name="uq_favorite_user_resource"),
    )
