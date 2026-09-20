from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from extensions import db
from models import Department
from utils.decorators import admin_required

department_bp = Blueprint("departments", __name__, url_prefix="/api/departments")

@department_bp.get("")
def get_departments():
    return jsonify({"departments": [d.to_dict() for d in Department.query.order_by(Department.name).all()]})

@department_bp.post("")
@jwt_required()
@admin_required
def create_department():
    data=request.get_json(silent=True) or {}; name=str(data.get("name") or "").strip(); code=str(data.get("code") or "").strip().upper(); description=str(data.get("description") or "").strip()
    if not name or not code: return jsonify({"message":"Name and code are required"}),400
    if Department.query.filter_by(code=code).first(): return jsonify({"message":"Department code already exists"}),409
    d=Department(name=name,code=code,description=description); db.session.add(d); db.session.commit(); return jsonify({"message":"Department created successfully","department":d.to_dict()}),201

@department_bp.put("/<int:department_id>")
@jwt_required()
@admin_required
def rename_department(department_id):
    d=db.session.get(Department,department_id)
    if not d:return jsonify({"message":"Department not found"}),404
    name=str((request.get_json(silent=True) or {}).get("name") or "").strip()
    if not name:return jsonify({"message":"Department name is required"}),400
    d.name=name;db.session.commit();return jsonify({"message":"Department renamed successfully","department":d.to_dict()})

@department_bp.delete("/<int:department_id>")
@jwt_required()
@admin_required
def delete_department(department_id):
    d=db.session.get(Department,department_id)
    if not d:return jsonify({"message":"Department not found"}),404
    if d.subjects:return jsonify({"message":"Delete or move the department subjects first"}),409
    db.session.delete(d);db.session.commit();return jsonify({"message":"Department deleted successfully"})
