
from database import get_db
db = get_db()
print(db.officers.find_one({"role": "AUDIT"}, {"_id": 0}))

