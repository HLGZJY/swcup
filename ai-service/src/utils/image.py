"""Image preprocessing utilities."""

import io
import base64
import cv2
import numpy as np
from PIL import Image
from torchvision import transforms

# Standard ImageNet normalization
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
])


def base64_to_image(base64_str: str) -> Image.Image:
    """Decode base64 string to PIL Image."""
    # Remove data URI prefix if present
    if ',' in base64_str:
        base64_str = base64_str.split(',')[1]
    img_bytes = base64.b64decode(base64_str)
    img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    return img


def image_to_tensor(img: Image.Image) -> "torch.Tensor":
    """Convert PIL Image to normalized tensor."""
    return transform(img)


def pil_to_cv2(img: Image.Image) -> np.ndarray:
    """Convert PIL Image to OpenCV BGR format."""
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)


def cv2_to_pil(img: np.ndarray) -> Image.Image:
    """Convert OpenCV BGR to PIL RGB."""
    return Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))


def calculate_blur_score(img: Image.Image) -> float:
    """Calculate blur score using Laplacian variance. Higher = sharper."""
    cv_img = pil_to_cv2(img)
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def calculate_brightness(img: Image.Image) -> float:
    """Calculate average brightness (0-255)."""
    cv_img = pil_to_cv2(img)
    hsv = cv2.cvtColor(cv_img, cv2.COLOR_BGR2HSV)
    return float(hsv[:, :, 2].mean())
