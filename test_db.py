import sys
try:
    from database import get_db
    db = get_db()
    tickets = list(db["support_tickets"].find().limit(10))
    print("Tickets in DB:", len(tickets))
    for t in tickets:
        print(f"ID: {t.get('_id')} - User: {t.get('user_name')} - District: {t.get('district')} - Msg: {t.get('message')}")
except Exception as e:
    print("Error:", e)
