import io
import os
import uuid
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import (
    jwt_required,
    get_jwt_identity,
    verify_jwt_in_request,
)
from werkzeug.utils import secure_filename
from sqlalchemy import or_
from supabase import create_client

from extensions import db
from models import Resource, Subject, DownloadHistory
from utils.decorators import admin_required


resource_bp = Blueprint(
    "resources",
    __name__,
    url_prefix="/api/resources"
)


# =========================================================
# SUPABASE STORAGE
# =========================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

SUPABASE_BUCKET = "notedown-pdfs"


if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL is not configured")

if not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is not configured")


supabase = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
)


# =========================================================
# CONFIGURATION
# =========================================================

ALLOWED = {"pdf"}

MAX_SIZE = 50 * 1024 * 1024


# =========================================================
# HELPERS
# =========================================================

def allowed(filename: str) -> bool:
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in ALLOWED
    )


def storage_path_for_upload(filename: str) -> str:
    """
    New PDFs are stored in Supabase using a unique path.

    Example:
        resources/8d7f1234_notes.pdf
    """

    original = secure_filename(filename)

    unique_name = f"{uuid.uuid4().hex}_{original}"

    return f"resources/{unique_name}"


def is_supabase_storage_path(path: str) -> bool:
    """
    New NoteDown resources use paths like:

        resources/abc123_notes.pdf

    Old resources may contain local filesystem paths.
    """

    return bool(
        path
        and path.replace("\\", "/").startswith("resources/")
    )


def resolve_legacy_file_path(file_path: str):
    """
    Safely resolve an OLD/local resource file.

    We do NOT migrate or modify old resources.

    Supports paths such as:

        uploads/file.pdf
        backend/uploads/file.pdf
        C:\\...\\backend\\uploads\\file.pdf
        file.pdf
    """

    if not file_path:
        return None

    raw_path = str(file_path).strip()

    if not raw_path:
        return None

    # Absolute path
    candidate = Path(raw_path)

    if candidate.is_absolute() and candidate.exists():
        return candidate

    backend_dir = Path(__file__).resolve().parent.parent
    uploads_dir = backend_dir / "uploads"

    normalized = raw_path.replace("\\", "/").lstrip("/")

    candidates = [
        backend_dir / normalized,
        uploads_dir / Path(normalized).name,
        uploads_dir / normalized,
        backend_dir / "uploads" / Path(normalized).name,
    ]

    for path in candidates:
        try:
            if path.exists() and path.is_file():
                return path
        except Exception:
            continue

    # Last fallback: filename only
    filename = Path(normalized).name

    if filename:
        fallback = uploads_dir / filename

        if fallback.exists() and fallback.is_file():
            return fallback

    return None


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

    search = request.args.get(
        "search",
        ""
    ).strip()

    unit = request.args.get(
        "unit",
        type=int
    )

    semester = request.args.get(
        "semester",
        type=int
    )

    year = request.args.get(
        "year",
        type=int
    )

    department_id = request.args.get(
        "department_id",
        type=int
    )

    if subject_id:
        query = query.filter(
            Resource.subject_id == subject_id
        )

    if unit:
        query = query.filter(
            Resource.unit_number == unit
        )

    if (
        semester
        or year
        or department_id
        or search
    ):

        query = query.join(
            Subject,
            Resource.subject_id == Subject.id
        )

        if semester:
            query = query.filter(
                Subject.semester == semester
            )

        if year:
            query = query.filter(
                Subject.year == year
            )

        if department_id:
            query = query.filter(
                Subject.department_id == department_id
            )

        if search:

            search_pattern = f"%{search}%"

            query = query.filter(
                or_(
                    Resource.title.ilike(
                        search_pattern
                    ),
                    Resource.description.ilike(
                        search_pattern
                    ),
                    Resource.file_name.ilike(
                        search_pattern
                    ),
                    Subject.name.ilike(
                        search_pattern
                    ),
                    Subject.code.ilike(
                        search_pattern
                    ),
                )
            )

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
            resource.to_dict()
            for resource in resources
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
# UPLOAD NEW PDF
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

    # -----------------------------------------------------
    # Check file size
    # -----------------------------------------------------

    file.seek(0, os.SEEK_END)

    size = file.tell()

    file.seek(0)

    if size > MAX_SIZE:

        return jsonify({
            "message": "File size must be less than 50 MB"
        }), 400

    # -----------------------------------------------------
    # Form fields
    # -----------------------------------------------------

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
            "message": "Title and subject_id are required"
        }), 400

    # -----------------------------------------------------
    # Validate subject
    # -----------------------------------------------------

    subject = db.session.get(
        Subject,
        subject_id
    )

    if not subject:

        return jsonify({
            "message": "Subject not found"
        }), 404

    # -----------------------------------------------------
    # Prepare Supabase path
    # -----------------------------------------------------

    original = secure_filename(
        file.filename
    )

    storage_path = storage_path_for_upload(
        original
    )

    uploaded_to_supabase = False

    try:

        # -------------------------------------------------
        # Read PDF
        # -------------------------------------------------

        pdf_bytes = file.read()

        if not pdf_bytes:

            return jsonify({
                "message": "Uploaded PDF is empty"
            }), 400

        # -------------------------------------------------
        # Upload NEW PDF to Supabase
        # -------------------------------------------------

        supabase.storage.from_(
            SUPABASE_BUCKET
        ).upload(
            storage_path,
            pdf_bytes,
            {
                "content-type": "application/pdf",
                "cache-control": "3600",
                "upsert": False,
            }
        )

        uploaded_to_supabase = True

        # -------------------------------------------------
        # Unit number
        # -------------------------------------------------

        raw_unit = request.form.get(
            "unit_number",
            ""
        ).strip()

        unit_number = (
            int(raw_unit)
            if (
                raw_unit.isdigit()
                and int(raw_unit) > 0
            )
            else None
        )

        # -------------------------------------------------
        # Create database record
        # -------------------------------------------------

        resource = Resource(
            title=title,

            description=description,

            resource_type=(
                request.form.get(
                    "resource_type",
                    "pdf"
                )
                .strip()
                .lower()
                or "pdf"
            ),

            unit_number=unit_number,

            file_name=original,

            # IMPORTANT:
            # New resources store the Supabase path.
            file_path=storage_path,

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
            "message": "PDF uploaded successfully",
            "resource": resource.to_dict()
        }), 201

    except Exception as exc:

        # -------------------------------------------------
        # Roll back DB
        # -------------------------------------------------

        db.session.rollback()

        # -------------------------------------------------
        # If Supabase upload succeeded but DB failed,
        # remove ONLY the NEW Supabase file.
        #
        # Existing PDFs are NEVER touched here.
        # -------------------------------------------------

        if uploaded_to_supabase:

            try:

                supabase.storage.from_(
                    SUPABASE_BUCKET
                ).remove([
                    storage_path
                ])

            except Exception as cleanup_error:

                print(
                    "Supabase cleanup warning:",
                    cleanup_error
                )

        print(
            "PDF upload failed:",
            exc
        )

        return jsonify({
            "message": "Upload failed",
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
            "message": "Resource not found"
        }), 404

    data = request.get_json(
        silent=True
    ) or {}

    title = str(
        data.get(
            "title",
            ""
        )
    ).strip()

    if not title:

        return jsonify({
            "message": "Note title is required"
        }), 400

    if len(title) > 255:

        return jsonify({
            "message": "Note title is too long"
        }), 400

    resource.title = title

    db.session.commit()

    return jsonify({
        "message": "Note renamed successfully",
        "resource": resource.to_dict()
    })


# =========================================================
# DOWNLOAD PDF
# =========================================================

@resource_bp.get(
    "/<int:resource_id>/download"
)
def download_resource(resource_id):

    # -----------------------------------------------------
    # JWT is optional
    # -----------------------------------------------------

    try:

        verify_jwt_in_request(
            optional=True
        )

    except Exception:

        pass

    # -----------------------------------------------------
    # Get resource
    # -----------------------------------------------------

    resource = db.session.get(
        Resource,
        resource_id
    )

    if (
        not resource
        or not resource.is_published
    ):

        return jsonify({
            "message": "Resource not found"
        }), 404

    storage_path = resource.file_path

    if not storage_path:

        return jsonify({
            "message": "PDF storage path is missing"
        }), 404

    # =====================================================
    # NEW RESOURCE → SUPABASE
    # =====================================================

    if is_supabase_storage_path(storage_path):

        try:

            pdf_bytes = (
                supabase
                .storage
                .from_(SUPABASE_BUCKET)
                .download(storage_path)
            )

        except Exception as exc:

            print(
                "Supabase PDF download failed:",
                exc
            )

            return jsonify({
                "message": "File not found in storage"
            }), 404

        if not pdf_bytes:

            return jsonify({
                "message": "File not found in storage"
            }), 404

        return send_pdf_and_record_download(
            resource,
            pdf_bytes
        )

    # =====================================================
    # OLD RESOURCE → LOCAL FILE
    #
    # We do NOT migrate it.
    # We do NOT modify it.
    # =====================================================

    legacy_file = resolve_legacy_file_path(
        storage_path
    )

    if not legacy_file:

        return jsonify({
            "message": "File not found on server"
        }), 404

    try:

        with open(
            legacy_file,
            "rb"
        ) as pdf_file:

            pdf_bytes = pdf_file.read()

    except Exception as exc:

        print(
            "Legacy PDF read failed:",
            exc
        )

        return jsonify({
            "message": "File not found on server"
        }), 404

    if not pdf_bytes:

        return jsonify({
            "message": "File not found on server"
        }), 404

    return send_pdf_and_record_download(
        resource,
        pdf_bytes
    )


# =========================================================
# DOWNLOAD HELPERS
# =========================================================

def send_pdf_and_record_download(
    resource,
    pdf_bytes
):

    # -----------------------------------------------------
    # Update download counter
    # -----------------------------------------------------

    resource.downloads = (
        resource.downloads or 0
    ) + 1

    # -----------------------------------------------------
    # Record download history
    # -----------------------------------------------------

    try:

        identity = get_jwt_identity()

    except Exception:

        identity = None

    if identity:

        try:

            history = DownloadHistory(
                user_id=int(identity),
                resource_id=resource.id
            )

            db.session.add(history)

        except Exception as exc:

            print(
                "Download history error:",
                exc
            )

    # -----------------------------------------------------
    # Save download counter/history
    # -----------------------------------------------------

    try:

        db.session.commit()

    except Exception as exc:

        db.session.rollback()

        print(
            "Download database update error:",
            exc
        )

    # -----------------------------------------------------
    # Send PDF
    # -----------------------------------------------------

    return send_file(
        io.BytesIO(pdf_bytes),

        as_attachment=True,

        download_name=resource.file_name,

        mimetype="application/pdf"
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
            "message": "Resource not found"
        }), 404

    storage_path = resource.file_path

    try:

        # -------------------------------------------------
        # ONLY delete Supabase file for NEW resources.
        #
        # Old local PDFs are deliberately left untouched.
        # -------------------------------------------------

        if is_supabase_storage_path(
            storage_path
        ):

            try:

                supabase.storage.from_(
                    SUPABASE_BUCKET
                ).remove([
                    storage_path
                ])

            except Exception as exc:

                print(
                    "Supabase file deletion warning:",
                    exc
                )

        # -------------------------------------------------
        # Delete database record
        # -------------------------------------------------

        db.session.delete(resource)

        db.session.commit()

        return jsonify({
            "message": "Note deleted successfully"
        })

    except Exception as exc:

        db.session.rollback()

        return jsonify({
            "message": "Delete failed",
            "error": str(exc)
        }), 500

