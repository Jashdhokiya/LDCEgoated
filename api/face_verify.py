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
import uuid
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

# Deep Learning Models (YuNet for detection, SFace for recognition)
_DETECTOR = None
_RECOGNIZER = None


def _get_dnn_models():
    global _DETECTOR, _RECOGNIZER
    if _DETECTOR is None or _RECOGNIZER is None:
        os.makedirs("data/models", exist_ok=True)
        yunet_path = "data/models/yunet.onnx"
        sface_path = "data/models/sface.onnx"
        
        if not os.path.exists(yunet_path):
            logger.info("[face_verify] Downloading YuNet face detection model...")
            urllib.request.urlretrieve("https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx", yunet_path)
            
        if not os.path.exists(sface_path):
            logger.info("[face_verify] Downloading SFace recognition model...")
            urllib.request.urlretrieve("https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx", sface_path)

        _DETECTOR = cv2.FaceDetectorYN_create(yunet_path, "", (320, 320))
        _RECOGNIZER = cv2.FaceRecognizerSF_create(sface_path, "")
        
    return _DETECTOR, _RECOGNIZER


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
        
    # Local fallback if Cloudinary isn't configured or failed
    try:
        os.makedirs("data/faces", exist_ok=True)
        filename = f"data/faces/face_{uuid.uuid4().hex[:8]}.jpg"
        
        # Decode and save locally
        clean_b64 = b64_string.split(",", 1)[1] if "," in b64_string else b64_string
        img_bytes = base64.b64decode(clean_b64)
        with open(filename, "wb") as f:
            f.write(img_bytes)
        logger.info(f"[face_verify] Saved face locally: {filename}")
        return filename
    except Exception as fallback_e:
        logger.error(f"[face_verify] Local fallback failed: {fallback_e}")
        return b64_string


def _b64_to_cv2(image_data: str) -> Optional[np.ndarray]:
    """Decode a base64 image string OR download from a URL OR load from local path."""
    try:
        if image_data.startswith("http://") or image_data.startswith("https://"):
            # It's a URL
            req = urllib.request.urlopen(image_data)
            arr = np.asarray(bytearray(req.read()), dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            return img

        if os.path.exists(image_data):
            # It's a local file path
            return cv2.imread(image_data, cv2.IMREAD_COLOR)

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


def _extract_embedding(img: np.ndarray) -> Optional[np.ndarray]:
    """Detect the largest face using YuNet and extract SFace embedding."""
    detector, recognizer = _get_dnn_models()
    h, w = img.shape[:2]
    
    # Needs to match image size exactly for YuNet
    detector.setInputSize((w, h))
    _, faces = detector.detect(img)
    
    if faces is None or len(faces) == 0:
        return None

    # faces[i] format is [x, y, w, h, x_re, y_re, x_le, y_le, x_nt, y_nt, x_rcm, y_rcm, x_lcm, y_lcm, score]
    # Pick the highest-scored face (last element is score, but usually sorted)
    best_face = max(faces, key=lambda f: f[-1])
    
    aligned_face = recognizer.alignCrop(img, best_face)
    embedding = recognizer.feature(aligned_face)
    return embedding


def detect_face_in_image(b64_image: str) -> dict:
    """
    Check if a face is present in the given image string.
    Returns detection result with face count and bounding boxes via YuNet.
    """
    img = _b64_to_cv2(b64_image)
    if img is None:
        return {"face_detected": False, "face_count": 0, "error": "Invalid image"}

    detector, _ = _get_dnn_models()
    h, w = img.shape[:2]
    detector.setInputSize((w, h))
    _, faces = detector.detect(img)

    if faces is None:
        return {"face_detected": False, "face_count": 0, "faces": []}

    return {
        "face_detected": len(faces) > 0,
        "face_count": len(faces),
        "faces": [{"x": float(f[0]), "y": float(f[1]), "w": float(f[2]), "h": float(f[3])} for f in faces]
    }


def verify_faces(reference_b64: str, probe_b64: str) -> dict:
    """
    Compare a probe (new) face image against a stored reference using SFace.
    """
    ref_img = _b64_to_cv2(reference_b64)
    probe_img = _b64_to_cv2(probe_b64)

    if ref_img is None:
        return {"match": False, "confidence": 0, "details": "Could not decode reference image",
                "face_detected_ref": False, "face_detected_probe": False}
    if probe_img is None:
        return {"match": False, "confidence": 0, "details": "Could not decode probe image",
                "face_detected_ref": False, "face_detected_probe": False}

    ref_emb = _extract_embedding(ref_img)
    probe_emb = _extract_embedding(probe_img)

    if ref_emb is None:
        return {"match": False, "confidence": 0, "details": "No face detected in reference image",
                "face_detected_ref": False, "face_detected_probe": probe_emb is not None}
    if probe_emb is None:
        return {"match": False, "confidence": 0, "details": "No face detected in probe image",
                "face_detected_ref": True, "face_detected_probe": False}

    # Compare embeddings using Cosine Similarity
    _, recognizer = _get_dnn_models()
    score = recognizer.match(ref_emb, probe_emb, cv2.FaceRecognizerSF_FR_COSINE)
    
    # Official OpenCV SFace Threshold for Cosine is >= 0.363 for same person
    # Scale score to 0..100 percentage. Make 0.363 equal to 60%.
    if score < 0.363:
        confidence = float(max(0, (score / 0.363) * 60))
    else:
        confidence = float(min(100, 60 + ((score - 0.363) / (1.0 - 0.363)) * 40))

    confidence = float(round(confidence, 1))
    match = bool(score >= 0.363)

    return {
        "match": match,
        "confidence": confidence,
        "details": f"Face match {'confirmed' if match else 'failed'} via SFace DNN Module",
        "face_detected_ref": True,
        "face_detected_probe": True,
        "breakdown": {
            "cosine_similarity": float(round(score, 3)),
            "sface_threshold_required": 0.363
        },
    }
