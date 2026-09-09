"""
AgriNexus AI - Agricultural Vision Augmentation Transforms
Tailored augmentations designed specifically to preserve microscopic and macroscopic
foliar disease lesion patterns (spots, blights, rust pustules, halos).
"""

try:
    import torchvision.transforms as transforms
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False


def get_training_transforms(image_size: int = 224):
    """
    Agricultural Training Pipeline:
    - RandomResizedCrop (scale 0.8 to 1.0, preserving lesion proportion)
    - RandomHorizontalFlip & RandomVerticalFlip (leaf symmetry)
    - RandomRotation (-15 to +15 degrees)
    - ColorJitter (slight brightness/contrast/saturation shifts, preserving hue signatures)
    - GaussianBlur (mild 3x3 kernel mimicking field camera autofocus imperfections)
    - RandomErasing (mild occlusion robustness)
    """
    if not TORCH_AVAILABLE:
        return None

    return transforms.Compose([
        transforms.RandomResizedCrop(image_size, scale=(0.8, 1.0), ratio=(0.9, 1.1)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomVerticalFlip(p=0.5),
        transforms.RandomRotation(degrees=15),
        transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.15, hue=0.04),
        transforms.GaussianBlur(kernel_size=(3, 3), sigma=(0.1, 1.5)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        transforms.RandomErasing(p=0.15, scale=(0.02, 0.15), value="random"),
    ])


def get_validation_transforms(image_size: int = 224):
    """Clean deterministic transforms for validation and evaluation."""
    if not TORCH_AVAILABLE:
        return None

    return transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
