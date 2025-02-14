import os
import uuid
import json
import math
import io

import boto3
from googleapiclient.discovery import build
from google.oauth2 import service_account
from googleapiclient.http import MediaIoBaseUpload

# ==========================================================
# 1) 環境変数からバケット名とサービスアカウントJSONのキーを取得
# ==========================================================
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")  # "my-bucket" など
SERVICE_ACCOUNT_FILE_PATH = "secret/summer-lexicon-449309-a6-e6d6e9a3ddf3.json"

# スライドのデフォルトサイズ (16:9)
SLIDE_WIDTH_EMU = 9144000   # 10 inch (914400 * 10)
SLIDE_HEIGHT_EMU = 5143500  # 約 5.625 inch

# Google API のスコープ
SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/presentations"
]

# boto3 クライアント
s3 = boto3.client("s3")


def _get_service_account_credentials():
    """
    S3 に置いてあるサービスアカウント JSON を取得し、
    メモリ上で Credentials オブジェクトを作成して返す。
    """
    # S3からサービスアカウントJSONを取得
    resp = s3.get_object(Bucket=S3_BUCKET_NAME, Key=SERVICE_ACCOUNT_FILE_PATH)
    service_account_json_str = resp["Body"].read().decode("utf-8")  # JSON文字列

    # JSONパース
    info = json.loads(service_account_json_str)

    # from_service_account_info で認証情報を生成
    creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    return creds


def upload_image_to_drive(drive_service, s3_key):
    """
    (変更ポイント)
    S3 から画像をダウンロードし、メモリ上 (BytesIO) で Drive へアップロードし、公開URL(uc?export=view&id=xxx) を返す。
    """
    # S3から画像を取得
    # 例: products/productId.png, parts/partId.png
    filename = os.path.basename(s3_key)
    resp = s3.get_object(Bucket=S3_BUCKET_NAME, Key=s3_key)
    img_bytes = resp["Body"].read()  # バイナリ

    # MIMEタイプざっくり判定 (拡張子が png なら "image/png", それ以外は image/jpeg)
    # ※ 厳密には python-magic 等で判定してもよい
    if filename.lower().endswith(".png"):
        mime_type = "image/png"
    else:
        mime_type = "image/jpeg"

    media_body = MediaIoBaseUpload(io.BytesIO(img_bytes), mimetype=mime_type)

    file_metadata = {"name": filename}
    result = drive_service.files().create(
        body=file_metadata,
        media_body=media_body,
        fields="id"
    ).execute()

    file_id = result.get("id")
    if not file_id:
        raise RuntimeError("Drive upload failed: no fileId returned.")

    # 公開権限を付与（誰でも閲覧可）
    drive_service.permissions().create(
        fileId=file_id,
        body={"type": "anyone", "role": "reader"}
    ).execute()

    # uc?export=view 形式のURL
    return f"https://drive.google.com/uc?export=view&id={file_id}"


def create_slides_for_product(
    slides_service,
    drive_service,
    presentation_id,
    product_id,
    part_ids,
    slide_title="製品と部品"
):
    """
    1つのスライドを作り:
      - 製品画像(中央 大きめ)
      - 部品画像(周囲に円形配置)
      - 製品画像の中心→部品画像の中心に線を引く
    """
    requests = []

    # 新しいスライド
    slide_id = f"slide_{uuid.uuid4().hex}"
    requests.append({
        "createSlide": {
            "objectId": slide_id,
            "slideLayoutReference": {"predefinedLayout": "BLANK"}
        }
    })

    # タイトルテキスト
    title_shape_id = f"title_{uuid.uuid4().hex}"
    requests.append({
        "createShape": {
            "objectId": title_shape_id,
            "shapeType": "TEXT_BOX",
            "elementProperties": {
                "pageObjectId": slide_id,
                "size": {
                    "width":  {"magnitude": 5000000, "unit": "EMU"},
                    "height": {"magnitude": 400000,  "unit": "EMU"}
                },
                "transform": {
                    "scaleX": 1,
                    "scaleY": 1,
                    "translateX": 300000,
                    "translateY": 200000,
                    "unit": "EMU"
                }
            }
        }
    })
    requests.append({
        "insertText": {
            "objectId": title_shape_id,
            "insertionIndex": 0,
            "text": f"{slide_title}\n(productId: {product_id})"
        }
    })

    #
    # 1) 製品画像を中央に配置
    #
    product_s3_key = f"products/{product_id}.png"
    product_img_url = upload_image_to_drive(drive_service, product_s3_key)
    product_img_id = f"product_img_{uuid.uuid4().hex}"

    product_width = int(SLIDE_WIDTH_EMU * 0.33)
    product_height = int(SLIDE_HEIGHT_EMU * 0.33)

    center_x = (SLIDE_WIDTH_EMU - product_width) / 2
    center_y = (SLIDE_HEIGHT_EMU - product_height) / 2

    requests.append({
        "createImage": {
            "objectId": product_img_id,
            "url": product_img_url,
            "elementProperties": {
                "pageObjectId": slide_id,
                "size": {
                    "width":  {"magnitude": product_width,  "unit": "EMU"},
                    "height": {"magnitude": product_height, "unit": "EMU"}
                },
                "transform": {
                    "translateX": center_x,
                    "translateY": center_y,
                    "scaleX": 1,
                    "scaleY": 1,
                    "unit": "EMU"
                }
            }
        }
    })

    # 製品画像中心
    product_center_x = center_x + product_width / 2
    product_center_y = center_y + product_height / 2

    #
    # 2) 部品画像を周囲に円形配置
    #
    part_w = int(SLIDE_WIDTH_EMU * 0.1)
    part_h = int(SLIDE_HEIGHT_EMU * 0.1)
    num_parts = len(part_ids)

    if num_parts > 0:
        radius = (product_width / 2) + (part_w * 1.0)
        angle_step = 2 * math.pi / num_parts
    else:
        radius = 0
        angle_step = 0

    part_centers = []

    for i, part_id in enumerate(part_ids):
        part_s3_key = f"parts/{part_id}.png"
        part_img_url = upload_image_to_drive(drive_service, part_s3_key)
        part_img_id = f"part_img_{uuid.uuid4().hex}"

        # 円形配置 (中心座標)
        theta = i * angle_step
        px_center = product_center_x + radius * math.cos(theta)
        py_center = product_center_y + radius * math.sin(theta)

        px_left = px_center - part_w / 2
        py_top  = py_center - part_h / 2

        requests.append({
            "createImage": {
                "objectId": part_img_id,
                "url": part_img_url,
                "elementProperties": {
                    "pageObjectId": slide_id,
                    "size": {
                        "width":  {"magnitude": part_w,  "unit": "EMU"},
                        "height": {"magnitude": part_h, "unit": "EMU"}
                    },
                    "transform": {
                        "translateX": px_left,
                        "translateY": py_top,
                        "scaleX": 1,
                        "scaleY": 1,
                        "unit": "EMU"
                    }
                }
            }
        })

        part_centers.append((px_center, py_center))

    #
    # 3) 製品の中心→部品の中心へ線を引く
    #
    for (px, py) in part_centers:
        line_id = f"line_{uuid.uuid4().hex}"

        left   = min(product_center_x, px)
        right  = max(product_center_x, px)
        top    = min(product_center_y, py)
        bottom = max(product_center_y, py)

        width  = right - left
        height = bottom - top

        requests.append({
            "createLine": {
                "objectId": line_id,
                "lineCategory": "STRAIGHT",
                "elementProperties": {
                    "pageObjectId": slide_id,
                    "size": {
                        "width":  {"magnitude": width,  "unit": "EMU"},
                        "height": {"magnitude": height, "unit": "EMU"}
                    },
                    "transform": {
                        "translateX": left,
                        "translateY": top,
                        "scaleX": 1,
                        "scaleY": 1,
                        "unit": "EMU"
                    }
                }
            }
        })

    #
    # 4) batchUpdate
    #
    slides_service.presentations().batchUpdate(
        presentationId=presentation_id,
        body={"requests": requests}
    ).execute()


def create_slides_with_design(product_ids, presentation_title="製品と部品のレイアウト"):
    """
    - sample_data.json から製品と部品の紐付けを取得
    - 新規プレゼンを作成
    - product_ids ごとに1枚スライドを追加 (中央に製品画像, 周囲に部品画像)
    - リンクを知っている全員が編集可に
    - 生成したURLを返す
    """
    # 1) sample_data.json を読み込み
    with open("sample_data.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    products_data = data["products"]

    # 2) サービスアカウント認証
    creds = _get_service_account_credentials()
    slides_service = build("slides", "v1", credentials=creds)
    drive_service = build("drive", "v3", credentials=creds)

    # 3) 新しいプレゼン作成
    presentation = slides_service.presentations().create(
        body={"title": presentation_title}
    ).execute()
    presentation_id = presentation["presentationId"]

    # 4) 各製品IDについてスライド生成
    for prod_id in product_ids:
        prod_data = next((p for p in products_data if p["productId"] == prod_id), None)
        if not prod_data:
            print(f"警告: productId={prod_id} が JSON に見つからずスキップ")
            continue

        part_ids = prod_data.get("parts", [])
        create_slides_for_product(
            slides_service,
            drive_service,
            presentation_id,
            product_id=prod_id,
            part_ids=part_ids,
            slide_title="製品と部品のサンプル"
        )

    # 5) リンクを知っている全員が"編集可"
    drive_service.permissions().create(
        fileId=presentation_id,
        body={"type": "anyone", "role": "writer"}
    ).execute()

    return f"https://docs.google.com/presentation/d/{presentation_id}/edit"


def handler(event, context):
    """
    AWS Lambda 用ハンドラー
    event.body が JSON 形式で、{"productIds": [...]} を含む想定
    
    例:
    {
      "body": {
        "productIds": ["pr1", "pr2"]
      }
    }
    """
    try:
        # event.body が文字列の場合はまず JSON パース
        body = event.get("body")
        if isinstance(body, str):
            body = json.loads(body)

        product_ids = body["productIds"]
        if not product_ids:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "No productIds"})
            }

        slide_url = create_slides_with_design(product_ids)
        print("作成されたスライドURL:", slide_url)

        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "success",
                "slideUrl": slide_url
            })
        }

    except Exception as e:
        print("Error:", str(e))
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }