from database import get_db
db = get_db()
db["support_tickets"].update_many(
    {"user_name": "jash"}, 
    {"$set": {"district": "Dahod"}}
)
print("Updated Jash's tickets to Dahod.")
