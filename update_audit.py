
import sys
try:
    from pymongo import MongoClient
    client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=2000)
    db = client.eduguard_db
    result = db.officers.update_one({"role": "AUDIT"}, {"$set": {"taluka": "Kalol"}})
    print("Matched:", result.matched_count, "Modified:", result.modified_count)
except Exception as e:
    print("Error:", e)

