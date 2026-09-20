from app import app
from extensions import db
from models import User

with app.app_context():
    email = input("Admin email: ").strip().lower()
    name = input("Admin name: ").strip()
    password = input("Admin password: ").strip()

    if User.query.filter_by(email=email).first():
        print("User already exists.")
    else:
        user = User(name=name, email=email, role="admin")
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        print("Admin created successfully.")
