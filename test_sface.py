import cv2
import numpy as np
import urllib.request

req = urllib.request.urlopen('https://github.com/opencv/opencv/raw/master/samples/data/lena.jpg')
img = cv2.imdecode(np.asarray(bytearray(req.read()), dtype=np.uint8), cv2.IMREAD_COLOR)

detector = cv2.FaceDetectorYN_create("data/models/yunet.onnx", "", (img.shape[1], img.shape[0]))
_, faces = detector.detect(img)

if faces is not None:
    recognizer = cv2.FaceRecognizerSF_create("data/models/sface.onnx", "")
    aligned = recognizer.alignCrop(img, faces[0])
    emb = recognizer.feature(aligned)
    print("Embedding generated! Shape:", emb.shape)
    
    score = recognizer.match(emb, emb, cv2.FaceRecognizerSF_FR_COSINE)
    print("Match score against itself:", score)
else:
    print("No faces detected.")
