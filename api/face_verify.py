"""
api/face_verify.py
Face verification service using OpenCV.

Workflow:
  1. During profile creation → user captures a selfie via webcam
     → base64 image stored in MongoDB as `face_reference`
  2. During KYC renewal → user captures a new selfie
     → compared against stored reference using histogram + structural analysis
     → returns confidence score (0-100)

Uses OpenCV's Haar Cascade for face detection and histogram correlation
for matching.  This is a lightweight approach suitable for demo / MVP;
production would use a proper embedding model (ArcFace, FaceNet, etc.).
"""

import base64
import io
import logging
import os
import urllib.request
from typing import Optional, Tuple

import cv2
import numpy as np

import cloudinary
import cloudinary.uploader
import cloudinary.api

logger = logging.getLogger(__name__)

# ── Cloudinary Configuration ──────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")

CLOUDINARY_ENABLED = bool(CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET)

if CLOUDINARY_ENABLED:
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
        secure=True
    )
    logger.info("[face_verify] Cloudinary configured for face image storage.")
else:
    logger.warning("[face_verify] Cloudinary not configured. Falling back to MongoDB base64 storage.")

# Load Haar cascade for frontal face detection
_FACE_CASCADE = None


def _get_cascade():
    global _FACE_CASCADE
    if _FACE_CASCADE is None:
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        _FACE_CASCADE = cv2.CascadeClassifier(cascade_path)
    return _FACE_CASCADE


def upload_face(b64_string: str) -> str:
    """
    Upload a base64 image to Cloudinary and return the secure URL.
    If Cloudinary is not configured or fails, returns the original base64.
    """
    if not CLOUDINARY_ENABLED:
        return b64_string

    try:
        # Cloudinary uploader handles base64 natively
        if not b64_string.startswith("data:"):
            b64_string = f"data:image/jpeg;base64,{b64_string}"

        response = cloudinary.uploader.upload(
            b64_string,
            folder="eduguard_faces",
            resource_type="image"
        )
        url = response.get("secure_url")
        logger.info(f"[face_verify] Uploaded face to Cloudinary: {url}")
        return url or b64_string
    except Exception as e:
        logger.error(f"[face_verify] Cloudinary upload failed: {e}")
        return b64_string


def _b64_to_cv2(image_data: str) -> Optional[np.ndarray]:
    """Decode a base64 image string OR download from a URL to an OpenCV BGR image."""
    try:
        if image_data.startswith("http://") or image_data.startswith("https://"):
            # It's a URL
            req = urllib.request.urlopen(image_data)
            arr = np.asarray(bytearray(req.read()), dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            return img

        # Strip data URL prefix if present for base64
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]
        img_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        logger.error(f"Failed to decode image data: {e}")
        return None


def _detect_face(img: np.ndarray) -> Optional[np.ndarray]:
    """Detect the largest face in an image and return the cropped face region."""
    cascade = _get_cascade()
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))

    if len(faces) == 0:
        return None

    # Pick the largest face
    (x, y, w, h) = max(faces, key=lambda f: f[2] * f[3])
    face_crop = img[y:y + h, x:x + w]

    # Resize to standard size for comparison
    face_crop = cv2.resize(face_crop, (160, 160))
    return face_crop


def detect_face_in_image(b64_image: str) -> dict:
    """
    Check if a face is present in the given base64 image.
    Returns detection result with face count and bounding boxes.
    """
    img = _b64_to_cv2(b64_image)
    if img is None:
        return {"face_detected": False, "face_count": 0, "error": "Invalid image"}

    cascade = _get_cascade()
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))

    return {
        "face_detected": len(faces) > 0,
        "face_count": len(faces),
        "faces": [{"x": int(x), "y": int(y), "w": int(w), "h": int(h)} for (x, y, w, h) in faces],
    }


def verify_faces(reference_b64: str, probe_b64: str) -> dict:
    """
    Compare a probe (new) face image against a stored reference image.

    Returns:
        {
            "match": bool,
            "confidence": float (0-100),
            "details": str,
            "face_detected_ref": bool,
            "face_detected_probe": bool,
        }
    """
    ref_img = _b64_to_cv2(reference_b64)
    probe_img = _b64_to_cv2(probe_b64)

    if ref_img is None:
        return {"match": False, "confidence": 0, "details": "Could not decode reference image",
                "face_detected_ref": False, "face_detected_probe": False}
    if probe_img is None:
        return {"match": False, "confidence": 0, "details": "Could not decode probe image",
                "face_detected_ref": False, "face_detected_probe": False}

    ref_face = _detect_face(ref_img)
    probe_face = _detect_face(probe_img)

    if ref_face is None:
        return {"match": False, "confidence": 0, "details": "No face detected in reference image",
                "face_detected_ref": False, "face_detected_probe": probe_face is not None}
    if probe_face is None:
        return {"match": False, "confidence": 0, "details": "No face detected in probe image",
                "face_detected_ref": True, "face_detected_probe": False}

    # ── Multi-metric comparison ───────────────────────────────────────────────

    # 1. Histogram correlation (color distribution similarity)
    scores = []
    for channel in range(3):
        hist_ref = cv2.calcHist([ref_face], [channel], None, [64], [0, 256])
        hist_probe = cv2.calcHist([probe_face], [channel], None, [64], [0, 256])
        cv2.normalize(hist_ref, hist_ref)
        cv2.normalize(hist_probe, hist_probe)
        corr = cv2.compareHist(hist_ref, hist_probe, cv2.HISTCMP_CORREL)
        scores.append(corr)
    hist_score = sum(scores) / len(scores)  # -1 to 1, 1 = perfect

    # 2. Structural similarity via normalized cross-correlation
    ref_gray = cv2.cvtColor(ref_face, cv2.COLOR_BGR2GRAY)
    probe_gray = cv2.cvtColor(probe_face, cv2.COLOR_BGR2GRAY)
    ncc = cv2.matchTemplate(ref_gray, probe_gray, cv2.TM_CCORR_NORMED)[0][0]

    # 3. Edge structure comparison (Canny edges → histogram correlation)
    ref_edges = cv2.Canny(ref_gray, 50, 150)
    probe_edges = cv2.Canny(probe_gray, 50, 150)
    hist_ref_e = cv2.calcHist([ref_edges], [0], None, [32], [0, 256])
    hist_probe_e = cv2.calcHist([probe_edges], [0], None, [32], [0, 256])
    cv2.normalize(hist_ref_e, hist_ref_e)
    cv2.normalize(hist_probe_e, hist_probe_e)
    edge_score = cv2.compareHist(hist_ref_e, hist_probe_e, cv2.HISTCMP_CORREL)

    # ── Weighted confidence ───────────────────────────────────────────────────
    # Map to 0-100 scale
    hist_pct = max(0, (hist_score + 1) / 2) * 100     # -1..1 → 0..100
    ncc_pct = max(0, ncc) * 100                        # 0..1 → 0..100
    edge_pct = max(0, (edge_score + 1) / 2) * 100      # -1..1 → 0..100

    confidence = 0.45 * hist_pct + 0.35 * ncc_pct + 0.20 * edge_pct
    confidence = round(min(100, max(0, confidence)), 1)

    match = confidence >= 55.0

    return {
        "match": match,
        "confidence": confidence,
        "details": (
            f"Face match {'confirmed' if match else 'failed'} "
            f"(histogram={hist_pct:.0f}%, structure={ncc_pct:.0f}%, edges={edge_pct:.0f}%)"
        ),
        "face_detected_ref": True,
        "face_detected_probe": True,
        "breakdown": {
            "histogram_score": round(hist_pct, 1),
            "structural_score": round(ncc_pct, 1),
            "edge_score": round(edge_pct, 1),
        },
    }
