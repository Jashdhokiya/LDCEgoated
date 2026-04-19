from database import get_db

def fix_support_tickets():
    db = get_db()
    tickets = list(db["support_tickets"].find({"district": None}))
    print(f"Found {len(tickets)} tickets without district.")
    
    for t in tickets:
        user_id = t.get("user_id")
        user = db["users"].find_one({"user_id": user_id})
        if user:
            db["support_tickets"].update_one(
                {"_id": t["_id"]},
                {"$set": {
                    "district": user.get("district"),
                    "user_name": user.get("name")
                }}
            )
            print(f"Updated ticket {t['_id']} for user {user_id} with district {user.get('district')}")

if __name__ == "__main__":
    fix_support_tickets()
