from getpass import getpass

from app import app
from extensions import db
from models import User

with app.app_context():
    db.create_all()
    email = input("Admin email: ").strip().lower()
    name = input("Admin name: ").strip()
    password = getpass("Admin password (minimum 6 characters): ")

    if not email or not name or len(password) < 6:
        raise SystemExit("Email, name and a password of at least 6 characters are required.")

    user = User.query.filter_by(email=email).first()
    if user:
        user.name = name
        user.role = "admin"
        user.set_password(password)
        db.session.commit()
        print("Existing user promoted to admin successfully.")
    else:
        user = User(name=name, email=email, role="admin")
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        print("Admin created successfully.")
