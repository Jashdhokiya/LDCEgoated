import sys
sys.path.insert(0, ".")
from api.routes.user import _col
col = _col("users")
items = list(col.find({}))
updates = 0
for u in items:
    # Remove large face_reference
    if "face_reference" in u and len(str(u["face_reference"])) > 1000:
        col.update_one({"user_id": u["user_id"]}, {"$unset": {"face_reference": ""}})
        updates += 1
print("Updates done:", updates)
