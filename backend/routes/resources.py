import os
import uuid

from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from werkzeug.utils import secure_filename
from sqlalchemy import or_

from extensions import db
from models import Resource, Subject, DownloadHistory
from utils.decorators import admin_required


resource_bp = Blueprint(
    "resources",
    __name__,
    url_prefix="/api/resources"
)


BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

UPLOAD_FOLDER = os.path.join(
    BASE_DIR,
    "uploads"
)

os.makedirs(
    UPLOAD_FOLDER,
    exist_ok=True
)


ALLOWED = {"pdf"}

MAX_SIZE = 50 * 1024 * 1024


def allowed(filename: str) -> bool:
    return (
        "." in filename
        and filename.rsplit(
            ".", 1
        )[1].lower()
        in ALLOWED
    )


# =========================================================
# GET RESOURCES / SEARCH
# =========================================================

@resource_bp.get("")
def get_resources():

    query = Resource.query.filter_by(
        is_published=True
    )

    subject_id = request.args.get(
        "subject_id",
        type=int
    )

    search = request.args.get("search", "").strip()
    unit = request.args.get("unit", type=int)
    semester = request.args.get("semester", type=int)
    year = request.args.get("year", type=int)
    department_id = request.args.get("department_id", type=int)

    if subject_id:
        query = query.filter(Resource.subject_id == subject_id)
    if unit:
        query = query.filter(Resource.unit_number == unit)
    if semester or year or department_id or search:
        query = query.join(Subject, Resource.subject_id == Subject.id)
        if semester:
            query = query.filter(Subject.semester == semester)
        if year:
            query = query.filter(Subject.year == year)
        if department_id:
            query = query.filter(Subject.department_id == department_id)
        if search:
            # Search metadata and subject fields in SQL for a fast first pass.
            search_pattern = f"%{search}%"
            query = query.filter(or_(
                Resource.title.ilike(search_pattern),
                Resource.description.ilike(search_pattern),
                Resource.file_name.ilike(search_pattern),
                Subject.name.ilike(search_pattern),
                Subject.code.ilike(search_pattern),
            ))

    resources = (
        query
        .order_by(
            Resource.created_at.desc()
        )
        .limit(100)
        .all()
    )

    return jsonify({
        "resources": [
            r.to_dict()
            for r in resources
        ]
    })


# =========================================================
# GET SINGLE RESOURCE
# =========================================================

@resource_bp.get("/<int:resource_id>")
def get_resource(resource_id):

    resource = db.session.get(
        Resource,
        resource_id
    )

    if not resource:
        return jsonify({
            "message": "Resource not found"
        }), 404

    return jsonify({
        "resource": resource.to_dict()
    })


# =========================================================
# UPLOAD PDF
# =========================================================

@resource_bp.post("/upload")
@resource_bp.post("/upload/")
@jwt_required()
@admin_required
def upload_resource():

    file = request.files.get("file")

    if not file or not file.filename:
        return jsonify({
            "message": "PDF file is required"
        }), 400

    if not allowed(file.filename):
        return jsonify({
            "message": "Only PDF files are allowed"
        }), 400

    file.seek(0, os.SEEK_END)

    size = file.tell()

    file.seek(0)

    if size > MAX_SIZE:
        return jsonify({
            "message":
            "File size must be less than 50 MB"
        }), 400

    title = request.form.get(
        "title",
        ""
    ).strip()

    description = request.form.get(
        "description",
        ""
    ).strip()

    subject_id = request.form.get(
        "subject_id",
        type=int
    )

    if not title or not subject_id:
        return jsonify({
            "message":
            "Title and subject_id are required"
        }), 400

    subject = db.session.get(Subject, subject_id)

    if not subject:
        return jsonify({
            "message":
            "Subject not found"
        }), 404

    original = secure_filename(
        file.filename
    )

    unique_name = (
        f"{uuid.uuid4().hex}_{original}"
    )

    path = os.path.join(
        UPLOAD_FOLDER,
        unique_name
    )

    try:

        file.save(path)
        raw_unit = request.form.get("unit_number", "").strip()
        unit_number = int(raw_unit) if raw_unit.isdigit() and int(raw_unit) > 0 else None
        resource = Resource(
            title=title,
            description=description,
            resource_type=request.form.get("resource_type", "pdf").strip().lower() or "pdf",
            unit_number=unit_number,
            file_name=original,
            file_path=path,
            file_size=size,
            downloads=0,
            is_published=True,
            subject_id=subject_id,
            uploaded_by=int(
                get_jwt_identity()
            ),
        )

        db.session.add(resource)

        db.session.commit()

        return jsonify({
            "message":
            "PDF uploaded successfully",
            "resource":
            resource.to_dict()
        }), 201

    except Exception as exc:

        db.session.rollback()

        if os.path.exists(path):
            os.remove(path)

        return jsonify({
            "message":
            "Upload failed",
            "error": str(exc)
        }), 500


# =========================================================
# RENAME NOTE
# =========================================================

@resource_bp.put("/<int:resource_id>")
@jwt_required()
@admin_required
def rename_resource(resource_id):

    resource = db.session.get(
        Resource,
        resource_id
    )

    if not resource:
        return jsonify({
            "message":
            "Resource not found"
        }), 404

    data = request.get_json(
        silent=True
    ) or {}

    title = str(
        data.get("title", "")
    ).strip()

    if not title:
        return jsonify({
            "message":
            "Note title is required"
        }), 400

    if len(title) > 255:
        return jsonify({
            "message":
            "Note title is too long"
        }), 400

    resource.title = title

    db.session.commit()

    return jsonify({
        "message":
        "Note renamed successfully",
        "resource":
        resource.to_dict()
    })


# =========================================================
# DOWNLOAD
# =========================================================

@resource_bp.get(
    "/<int:resource_id>/download"
)
def download_resource(resource_id):

    # Published PDFs can be opened directly by Android/WebView download handlers.
    # A JWT is optional here; when present, history is recorded for that user.
    try:
        verify_jwt_in_request(optional=True)
    except Exception:
        pass

    resource = db.session.get(
        Resource,
        resource_id
    )

    if (
        not resource
        or not resource.is_published
    ):
        return jsonify({
            "message":
            "Resource not found"
        }), 404

    if not os.path.exists(
        resource.file_path
    ):
        return jsonify({
            "message":
            "File not found on server"
        }), 404

    resource.downloads = (
        resource.downloads or 0
    ) + 1

    try:
        identity = get_jwt_identity()
    except Exception:
        identity = None
    if identity:
        history = DownloadHistory(user_id=int(identity), resource_id=resource.id)
        db.session.add(history)
    db.session.commit()

    return send_file(
        resource.file_path,
        as_attachment=True,
        download_name=resource.file_name,
        mimetype="application/pdf",
    )


# =========================================================
# DELETE NOTE
# =========================================================

@resource_bp.delete(
    "/<int:resource_id>"
)
@jwt_required()
@admin_required
def delete_resource(resource_id):

    resource = db.session.get(
        Resource,
        resource_id
    )

    if not resource:
        return jsonify({
            "message":
            "Resource not found"
        }), 404

    path = resource.file_path

    db.session.delete(resource)

    db.session.commit()

    if path and os.path.exists(path):
        os.remove(path)

    return jsonify({
        "message":
        "Note deleted successfully"
    })