from datetime import timedelta

from flask import Flask, jsonify
from flask_cors import CORS
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from dotenv import load_dotenv

load_dotenv()

from config import Config
from extensions import db, jwt
from models import (
    User,
    Department,
    Subject,
    Resource,
    Favorite,
    DownloadHistory,
)

from routes.auth import auth_bp
from routes.departments import department_bp
from routes.subjects import subject_bp
from routes.resources import resource_bp
from routes.user_features import features_bp
from routes.academic import academic_bp
from routes.admin import admin_bp


def create_app():
    app = Flask(__name__)

    app.config.from_object(Config)

    # Keep JWT valid for 7 days
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=7)

    db.init_app(app)
    jwt.init_app(app)

    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": "*"
            }
        },
        allow_headers=[
            "Content-Type",
            "Authorization",
        ],
        methods=[
            "GET",
            "POST",
            "PUT",
            "DELETE",
            "OPTIONS",
        ],
    )

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(department_bp)
    app.register_blueprint(subject_bp)
    app.register_blueprint(resource_bp)
    app.register_blueprint(features_bp)
    app.register_blueprint(academic_bp)
    app.register_blueprint(admin_bp)

    @app.get("/api/health")
    def health():
        return jsonify({
            "service": "NoteDown API",
            "status": "healthy",
        })

    @app.get("/api/db-test")
    def db_test():
        try:
            db.session.execute(text("SELECT 1"))

            return jsonify({
                "status": "connected"
            })

        except SQLAlchemyError as exc:
            db.session.rollback()

            return jsonify({
                "status": "error",
                "message": str(exc),
            }), 500

    return app


def ensure_schema(app):
    """
    Create new tables and safely add missing columns
    to existing NoteDown tables.
    """

    with app.app_context():

        db.create_all()

        try:
            from sqlalchemy import inspect

            inspector = inspect(db.engine)

            # -------------------------
            # Resources
            # -------------------------

            if inspector.has_table("resources"):

                cols = {
                    c["name"]
                    for c in inspector.get_columns("resources")
                }

                if "unit_number" not in cols:

                    db.session.execute(
                        text(
                            "ALTER TABLE resources "
                            "ADD COLUMN unit_number INTEGER"
                        )
                    )

                    db.session.commit()

            # -------------------------
            # Attendance
            # -------------------------

            if inspector.has_table("attendance"):

                attendance_cols = {
                    c["name"]
                    for c in inspector.get_columns("attendance")
                }

                additions = {
                    "location_mode":
                        "VARCHAR(20) DEFAULT 'manual'",

                    "latitude":
                        "FLOAT",

                    "longitude":
                        "FLOAT",

                    "accuracy":
                        "FLOAT",

                    "timetable_id":
                        "INTEGER",

                    "method":
                        "VARCHAR(20) DEFAULT 'MANUAL'",

                    "marked_at":
                        "TIMESTAMP",
                }

                for column, definition in additions.items():

                    if column not in attendance_cols:

                        db.session.execute(
                            text(
                                f"ALTER TABLE attendance "
                                f"ADD COLUMN {column} {definition}"
                            )
                        )

                db.session.commit()

            # -------------------------
            # Timetable
            # -------------------------

            if inspector.has_table("timetables"):

                timetable_cols = {
                    c["name"]
                    for c in inspector.get_columns("timetables")
                }

                timetable_additions = {
                    "faculty":
                        "VARCHAR(160)",

                    "class_type":
                        "VARCHAR(20) DEFAULT 'class'",

                    "label":
                        "VARCHAR(160)",
                }

                for column, definition in timetable_additions.items():

                    if column not in timetable_cols:

                        db.session.execute(
                            text(
                                f"ALTER TABLE timetables "
                                f"ADD COLUMN {column} {definition}"
                            )
                        )

                db.session.commit()

        except Exception as exc:

            db.session.rollback()

            print(
                "Schema migration skipped:",
                exc,
            )


# -----------------------------------
# Create application
# -----------------------------------

app = create_app()


# -----------------------------------
# Initialize database/schema
# -----------------------------------

try:
    ensure_schema(app)

except Exception as exc:

    print(
        "Schema initialization deferred:",
        exc,
    )


# -----------------------------------
# Run server
# -----------------------------------

if __name__ == "__main__":

    with app.app_context():
        db.create_all()

    print(
        "NoteDown API running at "
        "http://127.0.0.1:5000"
    )

    print(
        "Health check: "
        "http://127.0.0.1:5000/api/health"
    )

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True,
    )