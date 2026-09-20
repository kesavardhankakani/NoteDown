import os
import sys

# Add backend folder to Python path
sys.path.insert(
    0,
    os.path.dirname(
        os.path.dirname(
            os.path.abspath(__file__)
        )
    )
)

from app import app
from extensions import db
from models import User


ADMIN_EMAIL = "admin@notedown.com"
ADMIN_PASSWORD = "admin123"
ADMIN_NAME = "NoteDown Admin"


with app.app_context():

    existing_admin = User.query.filter_by(
        email=ADMIN_EMAIL
    ).first()

    if existing_admin:

        existing_admin.name = ADMIN_NAME
        existing_admin.role = "admin"
        existing_admin.set_password(ADMIN_PASSWORD)

        db.session.commit()

        print("================================")
        print("Admin updated successfully!")
        print("Email:", ADMIN_EMAIL)
        print("Password:", ADMIN_PASSWORD)
        print("Role:", existing_admin.role)
        print("================================")

    else:

        admin = User(
            name=ADMIN_NAME,
            email=ADMIN_EMAIL,
            role="admin"
        )

        admin.set_password(ADMIN_PASSWORD)

        db.session.add(admin)
        db.session.commit()

        print("================================")
        print("Admin created successfully!")
        print("Email:", ADMIN_EMAIL)
        print("Password:", ADMIN_PASSWORD)
        print("Role:", admin.role)
        print("================================")