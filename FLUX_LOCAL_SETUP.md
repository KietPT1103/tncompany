# FLUX.2 [klein] 4B Local Setup

Tai lieu nay huong dan chay local image edit service cho route `gesture-frame-edit.php` bang `FLUX.2 [klein] 4B`.

## 1. Yeu cau may

- Windows 10/11 hoac Linux
- Python 3.11 hoac 3.12
- NVIDIA GPU khuyen nghi tu RTX 3090 / 4070 tro len
- VRAM khuyen nghi:
  - Theo model card Hugging Face: khoang `~13GB VRAM`
  - Theo repo chinh thuc cua Black Forest Labs: phu hop cho consumer GPU va realtime workflows

Nguon:
- https://huggingface.co/black-forest-labs/FLUX.2-klein-4B
- https://github.com/black-forest-labs/flux2

## 2. Tao service local

Thu muc da duoc scaffold san:

`scripts/flux-local-service`

Trong do co:

- `app.py`: FastAPI service load model va xu ly image edit
- `requirements.txt`: thu vien can cai
- `start.ps1`: script khoi dong nhanh tren Windows

## 3. Cai PyTorch CUDA

Chon dung lenh theo CUDA cua may anh tren trang PyTorch. Vi du CUDA 12.8:

```powershell
cd D:\Workspace\Work\tn-company\scripts\flux-local-service
python -m venv .venv
.venv\Scripts\activate
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
```

Neu anh chi co CPU, van co the cai ban CPU nhung se cham hon rat nhieu:

```powershell
pip install torch torchvision
```

## 4. Cai thu vien FLUX service

Sau khi cai `torch` xong:

```powershell
cd D:\Workspace\Work\tn-company\scripts\flux-local-service
.venv\Scripts\activate
pip install -r requirements.txt
```

## 5. Dang nhap Hugging Face neu can

Model `black-forest-labs/FLUX.2-klein-4B` la open weights, nhung anh van nen login de viec download weight on dinh hon:

```powershell
pip install -U huggingface_hub
huggingface-cli login
```

Sau do nhap token Hugging Face cua anh.

## 6. Khoi dong local service

```powershell
cd D:\Workspace\Work\tn-company\scripts\flux-local-service
.venv\Scripts\activate
python app.py
```

Hoac nhanh hon:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Mac dinh service chay tai:

`http://127.0.0.1:8754`

Kiem tra health:

```powershell
curl http://127.0.0.1:8754/health
```

## 7. Noi vao project PHP hien tai

Project da duoc cap nhat de ho tro provider local.

Set trong `public/api/config.local.php`:

```php
'gesture_edit_provider' => 'local_flux',
'gesture_edit_local_url' => 'http://127.0.0.1:8754/edit',
'gesture_edit_local_token' => '',
'gesture_edit_local_model_id' => 'black-forest-labs/FLUX.2-klein-4B',
'gesture_edit_local_output_size' => '1024x1024',
'gesture_edit_timeout_seconds' => 180,
```

Neu muon khoa service local bang token:

```php
'gesture_edit_local_token' => 'mot_chuoi_bi_mat',
```

Va set them bien moi truong truoc khi chay service:

```powershell
$env:FLUX_LOCAL_TOKEN="mot_chuoi_bi_mat"
python app.py
```

## 8. Model se hoat dong nhu the nao

Service local hien tai xu ly theo luong:

1. Nhan `image_data_url`, `mask_data_url`, `box`, `prompt`
2. Crop vung trong khung tay + them padding
3. Dua crop do vao FLUX.2 [klein] 4B theo che do image editing
4. Dung mask de ghep lai vao anh goc
5. PHP luu file output vao `public/uploads/gesture-studio`

Huong nay nhanh va thuc te hon cho demo realtime vi model chi sua vung can sua.

## 9. Thu nghiem end-to-end

1. Chay local FLUX service
2. Chay web/PHP cua project
3. Dang nhap admin
4. Mo `http://localhost:5173/admin/gesture-studio` hoac domain tuong ung
5. Giu 2 tay thanh khung L
6. Nam tay roi mo ra de doi prompt
7. He thong tu dong goi local FLUX va sinh anh

## 10. Neu bi loi

### Loi khong ket noi local service

- Kiem tra service da chay chua
- Kiem tra `gesture_edit_local_url`
- Kiem tra firewall co chan `127.0.0.1:8754` khong

### Loi het VRAM

- Giam `gesture_edit_local_output_size` xuong `768x768`
- Bat CPU offload:

```powershell
$env:FLUX_LOCAL_CPU_OFFLOAD="1"
```

- Dong ung dung GPU khac

### Loi service chay cham

- Giam output size
- Dam bao dang chay bang GPU, khong phai CPU
- Kiem tra `torch.cuda.is_available()` trong Python

### Loi model khong tai duoc

- Login Hugging Face
- Kiem tra mang
- Thu tai truoc bang Python:

```powershell
python -c "from diffusers import Flux2KleinPipeline; Flux2KleinPipeline.from_pretrained('black-forest-labs/FLUX.2-klein-4B')"
```

## 11. Ghi chu ky thuat

- Route PHP: `public/api/gesture-frame-edit.php`
- Service Python: `scripts/flux-local-service/app.py`
- Frontend fullscreen: `src/app/(dashboard)/gesture-studio/page.tsx`

Neu anh muon buoc tiep theo, minh co the lam tiep:

1. them script auto-start FLUX service cung luc chay `npm run dev`
2. them endpoint `/warmup`
3. them queue tranh goi model chong cheo khi user doi prompt lien tuc
