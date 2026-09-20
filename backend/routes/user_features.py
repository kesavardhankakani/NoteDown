from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import Favorite, Resource, DownloadHistory

features_bp = Blueprint("features", __name__, url_prefix="/api")

@features_bp.get("/favorites")
@jwt_required()
def favorites():
    uid = int(get_jwt_identity())
    rows = Favorite.query.filter_by(user_id=uid).order_by(Favorite.created_at.desc()).all()
    return jsonify({"favorites": [r.resource.to_dict() for r in rows]})

@features_bp.post("/favorites/<int:resource_id>")
@jwt_required()
def add_favorite(resource_id):
    uid = int(get_jwt_identity())
    if not db.session.get(Resource, resource_id):
        return jsonify({"message": "Resource not found"}), 404
    if Favorite.query.filter_by(user_id=uid, resource_id=resource_id).first():
        return jsonify({"message": "Already in favorites"})
    db.session.add(Favorite(user_id=uid, resource_id=resource_id))
    db.session.commit()
    return jsonify({"message": "Added to favorites"}), 201

@features_bp.delete("/favorites/<int:resource_id>")
@jwt_required()
def remove_favorite(resource_id):
    uid = int(get_jwt_identity())
    row = Favorite.query.filter_by(user_id=uid, resource_id=resource_id).first()
    if row:
        db.session.delete(row)
        db.session.commit()
    return jsonify({"message": "Removed from favorites"})

@features_bp.get("/history")
@jwt_required()
def history():
    uid = int(get_jwt_identity())
    rows = DownloadHistory.query.filter_by(user_id=uid).order_by(DownloadHistory.downloaded_at.desc()).all()
    return jsonify({"history": [{"id": x.id, "downloaded_at": x.downloaded_at.isoformat(), "resource": x.resource.to_dict()} for x in rows]})
