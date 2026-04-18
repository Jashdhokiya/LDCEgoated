
from database import get_db
db = get_db()
if db is not None:
    result = db.officers.update_one({"role": "AUDIT"}, {"$set": {"taluka": "Kalol"}})
    print("Matched:", result.matched_count, "Modified:", result.modified_count)
else:
    print("No db")

