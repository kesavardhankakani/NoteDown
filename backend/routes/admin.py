from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from utils.decorators import admin_required


admin_bp = Blueprint(
    "admin",
    __name__,
    url_prefix="/api/admin"
)


@admin_bp.get("/dashboard")
@jwt_required()
@admin_required
def dashboard():

    return jsonify({
        "message": "Welcome to NoteDown Admin Dashboard",
        "role": "admin"
    })