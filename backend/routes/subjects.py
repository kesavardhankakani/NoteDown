from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from extensions import db
from models import Subject, Department
from utils.decorators import admin_required

subject_bp=Blueprint("subjects",__name__,url_prefix="/api/subjects")

@subject_bp.get("")
def get_subjects():
    q=Subject.query; department_id=request.args.get("department_id",type=int); year=request.args.get("year",type=int); semester=request.args.get("semester",type=int)
    if department_id:q=q.filter_by(department_id=department_id)
    if year:q=q.filter_by(year=year)
    if semester:q=q.filter_by(semester=semester)
    rows=[]
    for s in q.order_by(Subject.name).all():
        item=s.to_dict(); item["department_name"]=s.department.name if s.department else None; rows.append(item)
    return jsonify({"subjects":rows})

@subject_bp.post("")
@jwt_required()
@admin_required
def create_subject():
    data=request.get_json(silent=True) or {}; name=str(data.get("name") or "").strip(); code=str(data.get("code") or "").strip().upper(); semester=data.get("semester"); year=data.get("year"); department_id=data.get("department_id")
    if not name or not code or semester is None or year is None or not department_id:return jsonify({"message":"Name, code, semester, year and department_id are required"}),400
    if not db.session.get(Department,department_id):return jsonify({"message":"Department not found"}),404
    if Subject.query.filter_by(code=code).first():return jsonify({"message":"Subject code already exists"}),409
    s=Subject(name=name,code=code,semester=int(semester),year=int(year),department_id=int(department_id));db.session.add(s);db.session.commit();return jsonify({"message":"Subject created successfully","subject":s.to_dict()}),201

@subject_bp.put("/<int:subject_id>")
@jwt_required()
@admin_required
def rename_subject(subject_id):
    s=db.session.get(Subject,subject_id)
    if not s:return jsonify({"message":"Subject not found"}),404
    name=str((request.get_json(silent=True) or {}).get("name") or "").strip()
    if not name:return jsonify({"message":"Subject name is required"}),400
    s.name=name;db.session.commit();return jsonify({"message":"Subject renamed successfully","subject":s.to_dict()})

@subject_bp.delete("/<int:subject_id>")
@jwt_required()
@admin_required
def delete_subject(subject_id):
    s=db.session.get(Subject,subject_id)
    if not s:return jsonify({"message":"Subject not found"}),404
    db.session.delete(s);db.session.commit();return jsonify({"message":"Subject deleted successfully"})
