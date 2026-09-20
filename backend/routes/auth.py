from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from extensions import db
from models import User

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

def make_token(user):
    return create_access_token(identity=str(user.id), additional_claims={"role": user.role})

@auth_bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name") or data.get("username") or "").strip()
    email = str(data.get("email") or "").strip().lower()
    password = str(data.get("password") or "")
    department_id = data.get("department_id") or None
    if not name or not email or len(password) < 6:
        return jsonify({"message": "Name, email and password (minimum 6 characters) are required"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"message": "Email already registered"}), 409
    user = User(name=name, email=email, role="student", department_id=department_id)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify({"message": "Registration successful", "access_token": make_token(user), "user": user.to_dict()}), 201

@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email") or "").strip().lower()
    password = str(data.get("password") or "")
    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"message": "Invalid email or password"}), 401
    return jsonify({"message": "Login successful", "access_token": make_token(user), "user": user.to_dict()}), 200

@auth_bp.get("/me")
@jwt_required()
def me():
    user = db.session.get(User, int(get_jwt_identity()))
    if not user:
        return jsonify({"message": "User not found"}), 404
    return jsonify({"user": user.to_dict()})
