import argparse

from app.db.mongo import close_database, connect_database, users


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Promote an existing verified OffersBite account to administrator."
    )
    parser.add_argument(
        "email",
        help="Email address of the existing account to promote.",
    )
    email = parser.parse_args().email.strip().lower()
    connect_database()
    try:
        account = users.find_one({"email": email}, {"_id": 1, "emailVerifiedAt": 1})
        if not account:
            raise SystemExit(
                "No account exists for that email. Create and verify the account first."
            )
        if not account.get("emailVerifiedAt"):
            raise SystemExit(
                "That account is not email-verified. Verify it before promoting."
            )
        users.update_one(
            {"_id": account["_id"]},
            {"$set": {"role": "admin", "isActive": True}},
        )
        print(f"Administrator access granted to {email}.")
    finally:
        close_database()


if __name__ == "__main__":
    main()
