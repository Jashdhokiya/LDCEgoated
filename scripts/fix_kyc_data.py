from api.database import get_db
from datetime import datetime, timedelta

def fix_kyc():
    db = get_db()
    if db is None:
        print("Could not connect to database.")
        return
        
    users = db["users"]

    # Fix all users who have 365 days validity
    now = datetime.utcnow()
    expiry = now + timedelta(days=90)

    update_data = {
        "kyc_profile.days_remaining": 90,
        "kyc_profile.dynamic_validity_days": 90,
        "kyc_profile.kyc_expiry_date": expiry.strftime("%Y-%m-%d"),
    }

    result = users.update_many(
        {"kyc_profile.dynamic_validity_days": 365},
        {"$set": update_data}
    )

    print(f"Updated {result.modified_count} users from 365 to 90 days validity.")

    # Also fix those with kyc_complete but no dynamic_validity_days yet
    result2 = users.update_many(
        {"kyc_complete": True, "kyc_profile.dynamic_validity_days": {"$exists": False}},
        {"$set": update_data}
    )
    print(f"Initialized {result2.modified_count} verified users to 90 days.")

if __name__ == "__main__":
    fix_kyc()
